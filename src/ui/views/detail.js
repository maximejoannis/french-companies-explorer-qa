// @ts-check
import { LIMITS } from "../../config.js";
import { fromSnapshot, statusView } from "../../core/company.js";
import { formatEuro, formatPercent } from "../../core/finances.js";
import { isAbortError } from "../../services/http.js";
import { columnChart } from "../charts.js";
import { isNode } from "../dom.js";
import { activityText, displayName, favoriteButton, legalLabel, statusBadge, valueOrMissing, workforceLabel } from "../render.js";

/**
 * @typedef {import("../../core/company.js").Company} Company
 */

/** @param {string} siren */
export function officialUrl(siren) {
    return `https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(siren)}`;
}

/**
 * Fiche entreprise enrichie (N-1) : dirigeants, finances, labels, TVA, établissements paginés.
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createDetailView(ctx) {
    const { dom } = ctx;
    const { h, $, replace } = dom;
    /** @type {AbortController|null} */
    let controller = null;
    /** @type {Company|null} */
    let current = null;
    let fromCache = false;
    let estFilter = "all";
    let estPage = 1;

    /** @param {string} message */
    function state(message) {
        replace($("#detailRoot"), h("div", { class: "state", "data-testid": "detail-state" }, message));
    }

    /**
     * @param {string} label
     * @param {unknown} value
     */
    const defRow = (label, value) => h("div", {}, h("dt", {}, label), h("dd", {}, isNode(value) ? value : valueOrMissing(ctx, value)));

    /** @param {Company} c */
    function establishmentsSection(c) {
        const filtered = c.establishments.filter(e => {
            const tone = statusView(e.status, "establishment").tone;
            return estFilter === "all" || (estFilter === "active" ? tone === "active" : tone === "closed");
        });
        const size = LIMITS.establishmentsPageSize;
        const pages = Math.max(1, Math.ceil(filtered.length / size));
        estPage = Math.min(estPage, pages);
        const slice = filtered.slice((estPage - 1) * size, estPage * size);
        const t = ctx.t;
        const toolbar = h(
            "div",
            { class: "establishment-toolbar" },
            ...[
                ["all", "detail.estAll"],
                ["active", "detail.estActive"],
                ["closed", "detail.estClosed"]
            ].map(([value, key]) =>
                h(
                    "button",
                    {
                        type: "button",
                        class: `button secondary ${estFilter === value ? "active" : ""}`,
                        "data-est-filter": value,
                        "aria-pressed": String(estFilter === value),
                        onclick: () => {
                            estFilter = value;
                            estPage = 1;
                            renderCompany();
                        }
                    },
                    t(key)
                )
            )
        );
        const list = slice.length
            ? slice.map(e =>
                  h(
                      "div",
                      { class: "establishment" },
                      h("b", {}, valueOrMissing(ctx, e.siret, "detail.noSiret")),
                      h("p", {}, valueOrMissing(ctx, e.address || e.city, "detail.noAddress")),
                      statusBadge(ctx, e.status, "establishment"),
                      e.isHeadOffice ? h("span", { class: "pill" }, t("detail.headOffice")) : null
                  )
              )
            : [h("p", { class: "muted" }, t("detail.estNone"))];
        const total = c.establishmentsCount;
        const summary = h(
            "p",
            { class: "muted", "data-testid": "establishments-summary" },
            t("detail.estSummary", { shown: c.establishments.length, total: total ?? "?", open: c.openEstablishmentsCount ?? "?" })
        );
        const pager =
            pages > 1
                ? h(
                      "div",
                      { class: "pagination", "data-testid": "establishments-pagination" },
                      h(
                          "button",
                          {
                              type: "button",
                              class: "button secondary",
                              disabled: estPage <= 1,
                              onclick: () => {
                                  estPage -= 1;
                                  renderCompany();
                              }
                          },
                          t("pagination.prev")
                      ),
                      h("span", { class: "pill" }, t("pagination.label", { page: estPage, max: pages })),
                      h(
                          "button",
                          {
                              type: "button",
                              class: "button secondary",
                              disabled: estPage >= pages,
                              onclick: () => {
                                  estPage += 1;
                                  renderCompany();
                              }
                          },
                          t("pagination.next")
                      )
                  )
                : null;
        return h(
            "article",
            { class: "panel detail-section span-all" },
            h("p", { class: "eyebrow" }, t("detail.establishments")),
            summary,
            toolbar,
            h("div", { id: "establishmentList", class: "establishments" }, ...list),
            pager
        );
    }

    /** @param {Company} c */
    function financesSection(c) {
        const t = ctx.t;
        const locale = ctx.locale();
        if (!c.finances.length)
            return h(
                "article",
                { class: "panel detail-section" },
                h("p", { class: "eyebrow" }, t("detail.finances")),
                h("p", { class: "muted", "data-testid": "detail-finances-empty" }, t("detail.noFinances"))
            );
        const table = h(
            "table",
            { class: "compare-table", "data-testid": "detail-finances-table" },
            h("caption", { class: "sr-only" }, t("detail.finances")),
            h(
                "thead",
                {},
                h(
                    "tr",
                    {},
                    h("th", { scope: "col" }, t("detail.year")),
                    h("th", { scope: "col" }, t("detail.revenue")),
                    h("th", { scope: "col" }, t("detail.netIncome")),
                    h("th", { scope: "col" }, t("detail.revenueChange"))
                )
            ),
            h(
                "tbody",
                {},
                ...c.finances.map(f =>
                    h(
                        "tr",
                        {},
                        h("th", { scope: "row" }, String(f.year)),
                        h("td", {}, valueOrMissing(ctx, formatEuro(f.revenue, locale))),
                        h("td", { class: f.netIncome !== null && f.netIncome < 0 ? "negative" : "" }, valueOrMissing(ctx, formatEuro(f.netIncome, locale))),
                        h("td", {}, formatPercent(f.revenueChange, locale) || "—")
                    )
                )
            )
        );
        const chart = c.finances.some(f => f.revenue !== null)
            ? columnChart(dom, {
                  title: t("detail.revenueChart"),
                  points: c.finances.map(f => ({ label: String(f.year), value: f.revenue })),
                  format: v => formatEuro(v, locale)
              })
            : null;
        return h(
            "article",
            { class: "panel detail-section" },
            h("p", { class: "eyebrow" }, t("detail.finances")),
            chart,
            h("div", { class: "table-scroll" }, table)
        );
    }

    /** @param {Company} c */
    function directorsSection(c) {
        const t = ctx.t;
        const items = c.directors.length
            ? c.directors.map(d =>
                  h(
                      "li",
                      {},
                      h("b", {}, d.kind === "company" ? d.name : [d.name, d.firstNames].filter(Boolean).join(" ")),
                      d.role ? ` — ${d.role}` : "",
                      d.birth ? h("span", { class: "muted" }, ` · ${t("detail.born", { date: d.birth })}`) : null,
                      d.kind === "company" && d.siren
                          ? [
                                " · ",
                                h(
                                    "button",
                                    { type: "button", class: "link-button", "data-detail": d.siren, onclick: () => ctx.actions.openDetail(d.siren) },
                                    `SIREN ${d.siren}`
                                )
                            ]
                          : null
                  )
              )
            : [h("li", { class: "muted" }, t(fromCache ? "detail.directorsNotStored" : "detail.noDirectors"))];
        return h(
            "article",
            { class: "panel detail-section", "data-testid": "detail-directors" },
            h("p", { class: "eyebrow" }, t("detail.directors")),
            h("ul", { class: "plain-list" }, ...items),
            h("p", { class: "muted small" }, t("detail.directorsNotice"))
        );
    }

    function renderCompany() {
        const c = current;
        if (!c) return;
        const t = ctx.t;
        const fav = favoriteButton(ctx, c, ctx.actions.isFavorite(c.siren), "data-detail-fav");
        fav.addEventListener("click", () => {
            ctx.actions.toggleFavorite(c.siren);
            renderCompany();
        });
        const labels = c.labels.length
            ? c.labels.map(l => h("span", { class: "pill label-pill", title: t(`labelHelp.${l}`) }, t(`label.${l}`)))
            : [h("span", { class: "muted" }, t("detail.noLabels"))];
        const vatCopy = h(
            "button",
            {
                type: "button",
                class: "link-button",
                "data-testid": "copy-vat",
                onclick: async () => ctx.toast(t((await ctx.copy(c.vat)) ? "detail.vatCopied" : "share.failed"))
            },
            t("detail.copy")
        );
        replace(
            $("#detailRoot"),
            fromCache ? h("p", { class: "banner banner-info inline", role: "note", "data-testid": "detail-cached" }, t("detail.fromSnapshot")) : null,
            c.diffusion === "P"
                ? h("p", { class: "banner banner-warning inline", role: "note", "data-testid": "detail-partial-diffusion" }, t("privacy.partialDiffusion"))
                : null,
            h(
                "section",
                { class: "detail-hero" },
                h(
                    "article",
                    { class: "panel detail-main" },
                    h(
                        "div",
                        { class: "detail-heading" },
                        h(
                            "div",
                            {},
                            h("p", { class: "eyebrow" }, t("detail.eyebrow")),
                            h("h1", { class: "detail-title", tabindex: "-1" }, displayName(ctx, c)),
                            h("p", { class: "muted" }, valueOrMissing(ctx, activityText(ctx, c)))
                        ),
                        fav
                    ),
                    h(
                        "div",
                        { class: "actions" },
                        statusBadge(ctx, c.status),
                        h("span", { class: "pill" }, `SIREN ${c.siren}`),
                        c.acronym ? h("span", { class: "pill" }, c.acronym) : null
                    )
                ),
                h(
                    "article",
                    { class: "panel detail-side" },
                    h("p", { class: "eyebrow" }, t("detail.identifiers")),
                    h(
                        "dl",
                        { class: "definition" },
                        defRow("SIREN", c.siren),
                        defRow(t("field.siret"), c.siret),
                        defRow(t("field.activityCode"), c.activity),
                        h(
                            "div",
                            { "data-testid": "detail-vat" },
                            h("dt", {}, t("field.vat")),
                            h("dd", {}, c.vat, c.vatComputed ? h("small", { class: "muted" }, ` (${t("detail.vatComputed")})`) : null, " ", vatCopy)
                        )
                    )
                )
            ),
            h(
                "section",
                { class: "detail-grid" },
                h(
                    "article",
                    { class: "panel detail-section" },
                    h("p", { class: "eyebrow" }, t("detail.headOfficeTitle")),
                    h("h3", {}, c.city || t("detail.location")),
                    h("p", {}, valueOrMissing(ctx, c.address, "detail.noAddress")),
                    h("p", { class: "muted" }, c.postalCode)
                ),
                h(
                    "article",
                    { class: "panel detail-section" },
                    h("p", { class: "eyebrow" }, t("detail.structure")),
                    h(
                        "dl",
                        { class: "definition" },
                        defRow(t("field.category"), c.category ? t(`category.${c.category}`) : ""),
                        defRow(t("field.legal"), legalLabel(ctx, c.legal)),
                        defRow(t("field.workforce"), workforceLabel(ctx, c.workforce)),
                        defRow(
                            t("detail.openEstablishments"),
                            c.establishmentsCount === null ? "" : `${c.openEstablishmentsCount ?? "?"} / ${c.establishmentsCount}`
                        )
                    )
                ),
                h(
                    "article",
                    { class: "panel detail-section" },
                    h("p", { class: "eyebrow" }, t("detail.creation")),
                    h("h3", {}, valueOrMissing(ctx, c.creation))
                ),
                h(
                    "article",
                    { class: "panel detail-section" },
                    h("p", { class: "eyebrow" }, t("detail.actions")),
                    h(
                        "div",
                        { class: "actions" },
                        h(
                            "button",
                            { id: "detailCompare", type: "button", class: "button secondary", onclick: () => ctx.actions.addCompare(c.siren) },
                            t("action.compare")
                        ),
                        h(
                            "button",
                            {
                                id: "copySiren",
                                type: "button",
                                class: "button",
                                onclick: async () => ctx.toast(t((await ctx.copy(c.siren)) ? "detail.sirenCopied" : "share.failed"))
                            },
                            t("detail.copySiren")
                        ),
                        h(
                            "button",
                            { type: "button", class: "button secondary", "data-testid": "print-detail", onclick: () => ctx.win.print?.() },
                            t("detail.print")
                        ),
                        h(
                            "a",
                            { class: "official-link", href: officialUrl(c.siren), target: "_blank", rel: "noopener noreferrer" },
                            `${t("detail.official")} ↗`
                        )
                    )
                ),
                h(
                    "article",
                    { class: "panel detail-section span-all", "data-testid": "detail-labels" },
                    h("p", { class: "eyebrow" }, t("detail.labels")),
                    h("div", { class: "actions" }, ...labels)
                ),
                financesSection(c),
                directorsSection(c),
                establishmentsSection(c)
            )
        );
    }

    /**
     * @param {string} siren
     */
    async function show(siren) {
        estFilter = "all";
        estPage = 1;
        controller?.abort();
        const cached = ctx.companyFromCache(siren);
        if (cached) {
            current = cached;
            fromCache = false;
            return renderCompany();
        }
        controller = new AbortController();
        const mine = controller;
        current = null;
        state(ctx.t("detail.loading"));
        try {
            const company = await ctx.api.getBySiren(siren, mine.signal);
            if (mine !== controller) return;
            if (!company) return fallback(siren, ctx.t("detail.notFound"));
            ctx.cacheCompanies([company]);
            current = company;
            fromCache = false;
            renderCompany();
        } catch (error) {
            if (isAbortError(error) || mine !== controller) return;
            fallback(siren, ctx.errorMessage(error));
        }
    }

    /**
     * Repli sur l'instantané enregistré (favori ou comparaison) si l'API est indisponible.
     * @param {string} siren
     * @param {string} message
     */
    function fallback(siren, message) {
        const snap = ctx.store.get().favorites.find(f => f.siren === siren) || ctx.store.get().compare.find(f => f.siren === siren);
        if (!snap) return state(message);
        current = fromSnapshot(snap);
        fromCache = true;
        renderCompany();
    }

    return {
        show,
        render: renderCompany,
        get company() {
            return current;
        }
    };
}
