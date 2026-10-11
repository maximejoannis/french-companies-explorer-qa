// @ts-check
import { LIMITS } from "../config.js";
import { fromSnapshot } from "../core/company.js";
import { buildCsv, buildJson, DEFAULT_COLUMN_IDS, EXPORT_COLUMNS, exportFileName } from "../core/export.js";
import { isAbortError } from "../services/http.js";
import { setHidden } from "./dom.js";

/**
 * Export étendu (N-10) : périmètres, colonnes, multi-pages plafonné et annulable, avertissement RGPD.
 * @param {import("./app-context.js").AppContext} ctx
 * @param {{ visibleCompanies: () => import("../core/company.js").Company[] }} search
 */
export function createExportDialog(ctx, search) {
    const { dom, store } = ctx;
    const { h, $, $$, replace } = dom;
    const dialog = /** @type {HTMLDialogElement} */ ($("#exportDialog"));
    const confirm = /** @type {HTMLButtonElement} */ ($("#confirmExportBtn"));
    /** @type {Set<string>} */
    let selected = new Set(DEFAULT_COLUMN_IDS);
    /** @type {AbortController|null} */
    let controller = null;

    function scope() {
        return /** @type {HTMLSelectElement} */ ($("#exportScope")).value;
    }

    function renderColumns() {
        replace(
            $("#exportColumns"),
            ...EXPORT_COLUMNS.map(col =>
                h(
                    "label",
                    { class: "inline-check" },
                    h("input", {
                        type: "checkbox",
                        value: col.id,
                        checked: selected.has(col.id),
                        "data-testid": `export-column-${col.id}`,
                        onchange: onColumnChange
                    }),
                    h("span", {}, ctx.t(col.labelKey), col.personal ? h("span", { class: "muted" }, ` (${ctx.t("export.personal")})`) : null)
                )
            )
        );
        setHidden($("#exportPersonalWarning"), !selected.has("directors"));
    }

    function onColumnChange() {
        selected = new Set($$("#exportColumns input:checked").map(i => /** @type {HTMLInputElement} */ (i).value));
        setHidden($("#exportPersonalWarning"), !selected.has("directors"));
        updateAvailability();
    }

    function updateAvailability() {
        const s = store.get();
        const available = s.search.status === "success" && search.visibleCompanies().length > 0;
        const counts = {
            results: available ? search.visibleCompanies().length : 0,
            "all-pages": available ? Math.min(s.search.total, LIMITS.exportMaxRows) : 0,
            compare: s.compare.length,
            favorites: s.favorites.length
        };
        const n = counts[/** @type {keyof typeof counts} */ (scope())] ?? 0;
        confirm.disabled = n === 0 || selected.size === 0 || s.search.status === "loading";
        $("#exportHelp").textContent = n ? ctx.t("export.ready", { count: n }) : ctx.t("export.nothing");
    }

    function open() {
        renderColumns();
        updateAvailability();
        setHidden($("#exportProgress"), true);
        dialog.showModal();
    }

    /** @returns {Promise<any[]>} */
    async function collect() {
        const s = store.get();
        const sc = scope();
        if (sc === "compare") return s.compare.map(fromSnapshot);
        if (sc === "favorites") return s.favorites.map(fromSnapshot);
        if (sc === "results") return s.search.status === "success" ? search.visibleCompanies() : [];
        // Toutes les pages : 25 par page, plafond LIMITS.exportMaxRows, limiteur de débit partagé.
        controller?.abort();
        controller = new AbortController();
        const criteria = { ...s.search.criteria, pageSize: LIMITS.maxPerPage };
        const pages = Math.max(1, Math.min(Math.ceil(Math.min(s.search.total, LIMITS.exportMaxRows) / LIMITS.maxPerPage), s.search.totalPages || 1));
        const progress = /** @type {HTMLProgressElement} */ ($("#exportProgress"));
        progress.max = pages;
        progress.value = 0;
        setHidden(progress, false);
        const all = [];
        for (let page = 1; page <= pages; page += 1) {
            const result = await ctx.api.search(criteria, page, controller.signal);
            all.push(...result.companies);
            progress.value = page;
            $("#exportHelp").textContent = ctx.t("export.progress", { page, pages });
        }
        return all.slice(0, LIMITS.exportMaxRows);
    }

    /** @param {Event} event */
    async function perform(event) {
        event.preventDefault();
        const format = /** @type {"csv"|"json"} */ (/** @type {HTMLSelectElement} */ ($("#exportFormat")).value === "json" ? "json" : "csv");
        confirm.disabled = true;
        try {
            const companies = await collect();
            if (!companies.length) {
                ctx.toast(ctx.t("export.nothing"));
                return;
            }
            const columns = [...selected];
            const exportCtx = { t: ctx.t, metaFor: (/** @type {string} */ siren) => store.get().favoriteMeta[siren] || { note: "", tags: [] } };
            const content = format === "json" ? buildJson(companies, columns, exportCtx) : buildCsv(companies, columns, exportCtx);
            ctx.download(
                exportFileName(format, scope(), store.get().search.criteria.query),
                format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8",
                content
            );
            dialog.close();
            ctx.toast(ctx.t("export.done", { format: format.toUpperCase(), count: companies.length }));
        } catch (error) {
            $("#exportHelp").textContent = isAbortError(error) ? ctx.t("export.cancelled") : ctx.errorMessage(error);
        } finally {
            setHidden($("#exportProgress"), true);
            confirm.disabled = false;
        }
    }

    $("#openExportBtn").addEventListener("click", open);
    confirm.addEventListener("click", perform);
    $("#exportScope").addEventListener("change", updateAvailability);
    $("#exportCancelBtn").addEventListener("click", () => controller?.abort());
    dialog.addEventListener("close", () => controller?.abort());

    return { open, perform };
}
