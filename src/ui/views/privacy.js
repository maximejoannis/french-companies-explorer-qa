// @ts-check
import { APP_VERSION, RETENTION_OPTIONS } from "../../config.js";
import { applyRetention, buildInventory, buildPersonalDataExport, minimizeSnapshot } from "../../core/privacy.js";
import { prefsDefaults } from "../../core/schema.js";
import { eraseAppData, readAppKeys } from "../../services/storage.js";

/**
 * Page « Confidentialité » (N-16) : inventaire des données locales, export (portabilité),
 * effacement par catégorie ou total, durée de conservation et minimisation.
 * @param {import("../app-context.js").AppContext} ctx
 * @param {{ local: import("../../services/storage.js").StorageBackend|null, session: import("../../services/storage.js").StorageBackend|null, resetState: () => void }} privacyEnv
 */
export function createPrivacyView(ctx, privacyEnv) {
    const { dom, store } = ctx;
    const { h, $, replace } = dom;
    const dialog = /** @type {HTMLDialogElement} */ ($("#eraseDialog"));
    const ack = /** @type {HTMLInputElement} */ ($("#eraseAck"));
    const confirmBtn = /** @type {HTMLButtonElement} */ ($("#eraseConfirmBtn"));

    /** @param {number} bytes */
    function size(bytes) {
        if (bytes < 1024) return ctx.t("privacy.bytes", { n: bytes });
        return ctx.t("privacy.kilobytes", { n: new Intl.NumberFormat(ctx.locale(), { maximumFractionDigits: 1 }).format(bytes / 1024) });
    }

    /**
     * Efface une catégorie de données.
     * @param {string} id
     */
    function eraseCategory(id) {
        const local = privacyEnv.local;
        if (id === "favorites") {
            store.set({ favorites: [], favoriteMeta: {} });
            ctx.persist("favorites");
            ctx.persist("favoriteMeta");
        } else if (id === "favoriteMeta") {
            store.set({ favoriteMeta: {} });
            ctx.persist("favoriteMeta");
        } else if (id === "compare") {
            store.set({ compare: [] });
            ctx.persist("compare");
        } else if (id === "history") {
            store.set({ history: [] });
            ctx.persist("history");
        } else if (id === "saved") {
            store.set({ saved: [] });
            ctx.persist("saved");
        } else if (id === "prefs") {
            local?.removeItem("fce:v2:prefs");
            ctx.updatePrefs(prefsDefaults());
            local?.removeItem("fce:v2:prefs");
        } else if (id === "legacy") {
            for (const key of Object.keys(readAppKeys(local))) if (key.startsWith("fce_")) local?.removeItem(key);
        }
        ctx.toast(ctx.t("privacy.erasedCategory", { category: ctx.t(`privacy.cat.${id}`) }));
        render();
    }

    function render() {
        const t = ctx.t;
        const s = store.get();
        const lines = buildInventory(s, readAppKeys(privacyEnv.local));
        const total = lines.reduce((n, l) => n + l.bytes, 0);
        replace(
            $("#privacyInventory"),
            h(
                "table",
                { class: "compare-table", "data-testid": "privacy-inventory" },
                h("caption", { class: "sr-only" }, t("privacy.inventoryTitle")),
                h(
                    "thead",
                    {},
                    h(
                        "tr",
                        {},
                        h("th", { scope: "col" }, t("privacy.category")),
                        h("th", { scope: "col" }, t("privacy.items")),
                        h("th", { scope: "col" }, t("privacy.size")),
                        h("th", { scope: "col" }, h("span", { class: "sr-only" }, t("privacy.actions")))
                    )
                ),
                h(
                    "tbody",
                    {},
                    ...lines.map(line =>
                        h(
                            "tr",
                            { "data-category": line.id },
                            h("th", { scope: "row" }, t(`privacy.cat.${line.id}`)),
                            h("td", { "data-testid": `privacy-count-${line.id}` }, String(line.count)),
                            h("td", {}, size(line.bytes)),
                            h(
                                "td",
                                {},
                                h(
                                    "button",
                                    {
                                        type: "button",
                                        class: "button secondary",
                                        disabled: line.count === 0,
                                        "data-testid": `privacy-erase-${line.id}`,
                                        "aria-label": t("privacy.eraseCategory", { category: t(`privacy.cat.${line.id}`) }),
                                        onclick: () => eraseCategory(line.id)
                                    },
                                    t("privacy.erase")
                                )
                            )
                        )
                    )
                ),
                h(
                    "tfoot",
                    {},
                    h(
                        "tr",
                        {},
                        h("th", { scope: "row" }, t("privacy.total")),
                        h("td", {}, ""),
                        h("td", { "data-testid": "privacy-total-size" }, size(total)),
                        h("td", {}, "")
                    )
                )
            )
        );
        /** @type {HTMLInputElement} */ ($("#privacyMinimize")).checked = s.prefs.minimizePersonal;
        /** @type {HTMLSelectElement} */ ($("#privacyRetention")).replaceChildren(
            ...RETENTION_OPTIONS.map(days =>
                h("option", { value: String(days) }, days ? t("privacy.retentionDays", { count: days }) : t("privacy.retentionNone"))
            )
        );
        /** @type {HTMLSelectElement} */ ($("#privacyRetention")).value = String(s.prefs.retentionDays);
    }

    function exportData() {
        const s = store.get();
        ctx.download(
            `mes-donnees-fce-${ctx.clock.iso().slice(0, 10)}.json`,
            "application/json;charset=utf-8",
            buildPersonalDataExport(s, ctx.clock.iso(), APP_VERSION)
        );
        ctx.toast(ctx.t("privacy.exported"));
    }

    async function eraseAll() {
        if (!ack.checked) return;
        confirmBtn.disabled = true;
        const result = await eraseAppData({ local: privacyEnv.local, session: privacyEnv.session, caches: /** @type {any} */ (ctx.win).caches || null });
        privacyEnv.resetState();
        dialog.close();
        ctx.toast(ctx.t("privacy.erasedAll", { keys: result.keys, caches: result.caches }));
        $("#privacyStatus").textContent = ctx.t("privacy.erasedAll", { keys: result.keys, caches: result.caches });
        render();
    }

    $("#privacyExportBtn").addEventListener("click", exportData);
    $("#privacyEraseAllBtn").addEventListener("click", () => {
        ack.checked = false;
        confirmBtn.disabled = true;
        dialog.showModal();
    });
    ack.addEventListener("change", () => {
        confirmBtn.disabled = !ack.checked;
    });
    confirmBtn.addEventListener("click", event => {
        event.preventDefault();
        eraseAll();
    });
    $("#privacyRetention").addEventListener("change", () => {
        const retentionDays = Number(/** @type {HTMLSelectElement} */ ($("#privacyRetention")).value);
        ctx.updatePrefs({ retentionDays });
        const history = applyRetention(store.get().history, ctx.clock.now(), store.get().prefs.retentionDays);
        if (history.length !== store.get().history.length) {
            store.set({ history });
            ctx.persist("history");
        }
        render();
    });
    $("#privacyMinimize").addEventListener("change", () => {
        const minimizePersonal = /** @type {HTMLInputElement} */ ($("#privacyMinimize")).checked;
        ctx.updatePrefs({ minimizePersonal });
        if (minimizePersonal) {
            // Application rétroactive aux données déjà enregistrées.
            store.set({
                favorites: store.get().favorites.map(f => minimizeSnapshot(f, true)),
                compare: store.get().compare.map(c => minimizeSnapshot(c, true))
            });
            ctx.persist("favorites");
            ctx.persist("compare");
        }
        render();
    });

    return { render, eraseCategory, eraseAll };
}
