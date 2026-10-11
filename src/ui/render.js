// @ts-check
import { LEGAL_FORMS, SECTIONS, WORKFORCE } from "../config.js";
import { statusView } from "../core/company.js";
import { formatDistance, osmUrl } from "../core/geo.js";

/**
 * @typedef {import("../core/company.js").Company & { distanceKm?: number|null }} Company
 * @typedef {{ dom: import("./dom.js").Dom, t: (k: string, v?: Record<string, unknown>) => string, locale: () => string }} RenderCtx
 */

/**
 * @param {RenderCtx} ctx
 * @param {string} status
 * @param {"company"|"establishment"} [kind]
 */
export function statusBadge(ctx, status, kind = "company") {
    const s = statusView(status, kind);
    return ctx.dom.h("span", { class: `status ${s.tone}`, "data-status": s.code || "unknown" }, ctx.t(s.labelKey));
}

/**
 * Nom affichable : les instantanés minimisés (RGPD) n'ont plus de nom enregistré.
 * @param {RenderCtx} ctx
 * @param {{ name: string, siren: string, minimized?: string }} c
 */
export function displayName(ctx, c) {
    if (c.minimized) return ctx.t(`privacy.minimizedName.${c.minimized}`, { siren: c.siren });
    return c.name || ctx.t("common.noName");
}

/**
 * Valeur ou mention neutre « Non renseigné » (jamais undefined / vide).
 * @param {RenderCtx} ctx
 * @param {unknown} value
 * @param {string} [missingKey]
 */
export function valueOrMissing(ctx, value, missingKey = "common.missing") {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text ? text : ctx.dom.h("span", { class: "missing-data" }, `— ${ctx.t(missingKey)}`);
}

/**
 * @param {RenderCtx} ctx
 * @param {Company} c
 * @param {boolean} active
 * @param {"data-fav"|"data-detail-fav"|"data-remove"} attribute
 */
export function favoriteButton(ctx, c, active, attribute = "data-fav") {
    return ctx.dom.h(
        "button",
        {
            type: "button",
            class: `fav ${active ? "active" : ""}`,
            [attribute]: c.siren,
            "aria-pressed": String(active),
            "aria-label": ctx.t(active ? "favorite.remove" : "favorite.add", { name: displayName(ctx, c) }),
            id: attribute === "data-detail-fav" ? "detailFav" : undefined,
            "data-testid": "favorite-toggle"
        },
        "♥"
    );
}

/**
 * @param {RenderCtx} ctx
 * @param {string} code
 */
export function workforceLabel(ctx, code) {
    return WORKFORCE.some(([c]) => c === code) ? ctx.t(`workforce.${code}`) : code;
}

/**
 * @param {RenderCtx} ctx
 * @param {string} code
 */
export function sectionLabel(ctx, code) {
    return SECTIONS.some(([c]) => c === code) ? `${code} — ${ctx.t(`section.${code}`)}` : code;
}

/**
 * @param {RenderCtx} ctx
 * @param {string} code
 */
export function legalLabel(ctx, code) {
    return LEGAL_FORMS.some(([c]) => c === code) ? `${ctx.t(`legal.${code}`)} (${code})` : code;
}

/**
 * @param {RenderCtx} ctx
 * @param {Company} c
 */
export function activityText(ctx, c) {
    if (c.activityLabel && c.activity) return `${c.activityLabel} (${c.activity})`;
    return c.activityLabel || c.activity;
}

/**
 * Carte entreprise (structure et attributs data-* de la v1.1.1 conservés pour Playwright).
 * @param {RenderCtx} ctx
 * @param {Company} c
 * @param {{ isFavorite: boolean, onDetail: (s: string) => void, onFavorite: (s: string) => void, onCompare: (s: string) => void }} opts
 */
export function companyCard(ctx, c, opts) {
    const { h } = ctx.dom;
    const distance =
        typeof c.distanceKm === "number"
            ? h(
                  "div",
                  { class: "meta-line" },
                  h("b", {}, `${ctx.t("field.distance")} : `),
                  h("span", { "data-testid": "result-distance" }, formatDistance(c.distanceKm, ctx.locale()))
              )
            : null;
    const map =
        c.latitude !== null && c.longitude !== null && typeof c.distanceKm === "number"
            ? h(
                  "a",
                  {
                      class: "official-link",
                      href: osmUrl(c.latitude, c.longitude),
                      target: "_blank",
                      rel: "noopener noreferrer",
                      "data-testid": "result-osm-link"
                  },
                  `${ctx.t("nearby.osm")} ↗`
              )
            : null;
    const fav = favoriteButton(ctx, c, opts.isFavorite);
    fav.addEventListener("click", () => opts.onFavorite(c.siren));
    return h(
        "article",
        { class: "company", "data-testid": `company-card-${c.siren}`, "data-siren": c.siren },
        h(
            "div",
            { class: "company-top" },
            h("div", {}, statusBadge(ctx, c.status), h("h3", {}, c.name || ctx.t("common.noName")), h("p", { class: "muted" }, `SIREN ${c.siren}`)),
            fav
        ),
        h(
            "div",
            { class: "company-meta" },
            h("div", { class: "meta-line" }, h("b", {}, `${ctx.t("field.activity")} : `), valueOrMissing(ctx, activityText(ctx, c))),
            h("div", { class: "meta-line" }, h("b", {}, `${ctx.t("field.headOffice")} : `), valueOrMissing(ctx, c.city || c.address)),
            h("div", { class: "meta-line" }, h("b", {}, `${ctx.t("field.creation")} : `), valueOrMissing(ctx, c.creation)),
            distance,
            map
        ),
        h(
            "div",
            { class: "company-footer" },
            h(
                "button",
                { type: "button", class: "button secondary", "data-compare": c.siren, onclick: () => opts.onCompare(c.siren) },
                ctx.t("action.compare")
            ),
            h("button", { type: "button", class: "button", "data-detail": c.siren, onclick: () => opts.onDetail(c.siren) }, ctx.t("action.detail"))
        )
    );
}

/**
 * Vue tableau triable des résultats (aria-sort sur l'en-tête actif).
 * @param {RenderCtx} ctx
 * @param {Company[]} list
 * @param {{ sort: string, onSort: (mode: string) => void, onDetail: (s: string) => void }} opts
 */
export function companyTable(ctx, list, opts) {
    const { h } = ctx.dom;
    /** @type {[string, string, string|null, string|null][]} [label, key, ascMode, descMode] */
    const cols = [
        [ctx.t("field.name"), "name", "name-asc", "name-desc"],
        [ctx.t("field.siren"), "siren", null, null],
        [ctx.t("field.status"), "status", "status", null],
        [ctx.t("field.city"), "city", null, null],
        [ctx.t("field.creation"), "creation", "creation-oldest", "creation-newest"],
        [ctx.t("field.activity"), "activity", null, null]
    ];
    const header = cols.map(([label, , asc, desc]) => {
        const state = opts.sort === asc ? "ascending" : opts.sort === desc ? "descending" : "none";
        if (!asc) return h("th", { scope: "col" }, label);
        const next = state === "ascending" && desc ? desc : asc;
        return h(
            "th",
            { scope: "col", "aria-sort": state },
            h(
                "button",
                { type: "button", class: "th-sort", onclick: () => opts.onSort(next) },
                label,
                h("span", { "aria-hidden": "true" }, state === "ascending" ? " ▲" : state === "descending" ? " ▼" : " ↕")
            )
        );
    });
    return h(
        "table",
        { class: "compare-table results-table" },
        h("caption", { class: "sr-only" }, ctx.t("results.tableLabel")),
        h("thead", {}, h("tr", {}, ...header)),
        h(
            "tbody",
            {},
            ...list.map(c =>
                h(
                    "tr",
                    { "data-siren": c.siren },
                    h(
                        "td",
                        {},
                        h(
                            "button",
                            { type: "button", class: "link-button", "data-detail": c.siren, onclick: () => opts.onDetail(c.siren) },
                            c.name || ctx.t("common.noName")
                        )
                    ),
                    h("td", {}, c.siren),
                    h("td", {}, statusBadge(ctx, c.status)),
                    h("td", {}, valueOrMissing(ctx, c.city)),
                    h("td", {}, valueOrMissing(ctx, c.creation)),
                    h("td", {}, valueOrMissing(ctx, activityText(ctx, c)))
                )
            )
        )
    );
}
