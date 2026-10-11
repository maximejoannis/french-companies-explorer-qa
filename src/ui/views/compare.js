// @ts-check
import { LIMITS } from "../../config.js";
import { moveInCompare, valuesDiffer } from "../../core/compare.js";
import { formatEuro } from "../../core/finances.js";
import { isAbortError } from "../../services/http.js";
import { statusView } from "../../core/company.js";
import { displayName, valueOrMissing, workforceLabel } from "../render.js";

/**
 * Comparaison enrichie (N-8) : partage par URL, différences seules, réordonnancement accessible.
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createCompareView(ctx) {
    const { dom, store } = ctx;
    const { h, $, replace } = dom;
    /** @type {AbortController|null} */
    let loadController = null;

    /** @param {any[]} list */
    function setCompare(list) {
        store.set({ compare: list });
        ctx.persist("compare");
        ctx.router.sync({ view: "compare", sirens: list.map(c => c.siren) });
        render();
    }

    /** @param {any[]} items */
    function table(items) {
        const t = ctx.t;
        const locale = ctx.locale();
        const diffOnly = /** @type {HTMLInputElement} */ ($("#compareDiffOnly")).checked;
        /** @type {[string, (c: any) => unknown][]} */
        const defs = [
            ["SIREN", c => c.siren],
            [t("field.status"), c => t(statusView(c.status).labelKey)],
            [t("field.activity"), c => c.activityLabel || c.activity],
            [t("field.city"), c => c.city],
            [t("field.postalCode"), c => c.postalCode],
            [t("field.creation"), c => c.creation],
            [t("field.category"), c => (c.category ? t(`category.${c.category}`) : "")],
            [t("field.workforce"), c => workforceLabel(ctx, c.workforce)],
            [t("field.lastRevenue"), c => (c.lastRevenue === null ? "" : `${formatEuro(c.lastRevenue, locale)} (${c.lastFinanceYear})`)],
            [t("field.lastNetIncome"), c => (c.lastNetIncome === null ? "" : formatEuro(c.lastNetIncome, locale))],
            [t("field.labels"), c => c.labels.map((/** @type {string} */ l) => t(`label.${l}`)).join(", ")],
            [t("detail.openEstablishments"), c => (c.establishmentsCount === null ? "" : `${c.openEstablishmentsCount ?? "?"} / ${c.establishmentsCount}`)]
        ];
        const rows = defs.map(([label, get]) => ({ label, values: items.map(get) })).filter(row => !diffOnly || valuesDiffer(row.values));
        return h(
            "div",
            { class: "compare-scroll", tabindex: "0", "aria-label": t("compare.scrollLabel") },
            h(
                "table",
                { class: "compare-table", "data-testid": "compare-table" },
                h("caption", { class: "sr-only" }, t("compare.title")),
                h(
                    "thead",
                    {},
                    h("tr", {}, h("th", { scope: "col" }, t("compare.criterion")), ...items.map(c => h("th", { scope: "col" }, displayName(ctx, c))))
                ),
                h(
                    "tbody",
                    {},
                    ...(rows.length
                        ? rows.map(row => {
                              const differs = valuesDiffer(row.values);
                              return h(
                                  "tr",
                                  { "data-differs": String(differs) },
                                  h(
                                      "th",
                                      { scope: "row" },
                                      row.label,
                                      differs ? h("span", { class: "sr-only" }, ` — ${t("compare.differs")}`) : null,
                                      differs ? h("span", { "aria-hidden": "true" }, " ≠") : null
                                  ),
                                  ...row.values.map(v => h("td", {}, valueOrMissing(ctx, v)))
                              );
                          })
                        : [h("tr", {}, h("td", { colspan: String(items.length + 1) }, t("compare.noDiff")))])
                )
            )
        );
    }

    function render() {
        const t = ctx.t;
        const root = $("#compareRoot");
        const items = store.get().compare;
        if (!items.length) return replace(root, h("div", { class: "state" }, t("compare.empty", { max: LIMITS.compareMax })));
        replace(
            root,
            h(
                "div",
                { class: "compare-picker" },
                ...items.map((c, i) =>
                    h(
                        "article",
                        { class: "compare-panel", "data-testid": `compare-panel-${c.siren}` },
                        h("p", { class: "eyebrow" }, t("compare.company", { n: i + 1 })),
                        h("h3", {}, displayName(ctx, c)),
                        h("p", { class: "muted" }, `SIREN ${c.siren}`),
                        h(
                            "div",
                            { class: "actions" },
                            h(
                                "button",
                                {
                                    type: "button",
                                    class: "button secondary",
                                    "data-testid": "compare-move-left",
                                    disabled: i === 0,
                                    "aria-label": t("compare.moveLeft", { name: displayName(ctx, c) }),
                                    onclick: () => setCompare(moveInCompare(store.get().compare, c.siren, -1))
                                },
                                "←"
                            ),
                            h(
                                "button",
                                {
                                    type: "button",
                                    class: "button secondary",
                                    "data-testid": "compare-move-right",
                                    disabled: i === items.length - 1,
                                    "aria-label": t("compare.moveRight", { name: displayName(ctx, c) }),
                                    onclick: () => setCompare(moveInCompare(store.get().compare, c.siren, 1))
                                },
                                "→"
                            ),
                            h(
                                "button",
                                {
                                    type: "button",
                                    class: "button secondary",
                                    "data-rm": c.siren,
                                    "aria-label": t("compare.remove", { name: displayName(ctx, c) }),
                                    onclick: () => setCompare(store.get().compare.filter(x => x.siren !== c.siren))
                                },
                                t("compare.removeShort")
                            ),
                            h(
                                "button",
                                { type: "button", class: "button", "data-open": c.siren, onclick: () => ctx.actions.openDetail(c.siren) },
                                t("action.detail")
                            )
                        )
                    )
                ),
                items.length === 1 ? h("article", { class: "compare-panel" }, h("p", { class: "muted" }, t("compare.addSecond"))) : null
            ),
            items.length >= 2 ? table(items) : null
        );
    }

    /**
     * Ouvre une comparaison partagée : charge les entreprises manquantes.
     * @param {string[]} sirens
     */
    async function show(sirens) {
        const currentSirens = store.get().compare.map(c => c.siren);
        if (!sirens.length || sirens.join(",") === currentSirens.join(",")) {
            ctx.router.sync({ view: "compare", sirens: currentSirens });
            return render();
        }
        loadController?.abort();
        loadController = new AbortController();
        const mine = loadController;
        replace($("#compareRoot"), h("div", { class: "state" }, ctx.t("compare.loading")));
        try {
            const snaps = [];
            for (const siren of sirens) {
                const known = ctx.companyFromCache(siren);
                const company = known || (await ctx.api.getBySiren(siren, mine.signal));
                if (company) {
                    ctx.cacheCompanies([company]);
                    snaps.push(ctx.storedSnapshot(company));
                }
            }
            if (mine !== loadController) return;
            store.set({ compare: snaps.slice(0, LIMITS.compareMax) });
            ctx.persist("compare");
            ctx.toast(ctx.t("compare.loaded", { count: snaps.length }));
            render();
        } catch (error) {
            if (isAbortError(error)) return;
            replace($("#compareRoot"), h("div", { class: "state" }, ctx.errorMessage(error)));
        }
    }

    $("#compareDiffOnly").addEventListener("change", render);
    $("#compareShareBtn").addEventListener("click", async () => {
        const sirens = store.get().compare.map(c => c.siren);
        if (sirens.length < 2) return ctx.toast(ctx.t("compare.shareNeedTwo"));
        ctx.router.sync({ view: "compare", sirens });
        ctx.toast(ctx.t((await ctx.copy(ctx.router.href())) ? "share.copied" : "share.failed"));
    });

    return { render, show };
}
