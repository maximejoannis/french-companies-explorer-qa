// @ts-check
import { CATEGORY_VALUES, FILTER_LABEL_KEYS, LEGAL_FORMS, LIMITS, SECTIONS, WORKFORCE } from "../../config.js";
import { groupCount, limitBuckets } from "../../core/aggregate.js";
import { countActiveFilters, criteriaDefaults, hasActiveFilters, sanitizeCriteria, searchIdentity, validateCriteria } from "../../core/criteria.js";
import { addHistoryEntry, upsertSavedSearch } from "../../core/history.js";
import { applyRetention } from "../../core/privacy.js";
import { detectQueryType, isIdentifierQuery } from "../../core/query.js";
import { sortCompanies } from "../../core/sort.js";
import { computeStats } from "../../core/stats.js";
import { isAbortError } from "../../services/http.js";
import { createAutocomplete } from "../autocomplete.js";
import { barChart } from "../charts.js";
import { setHidden } from "../dom.js";
import { companyCard, companyTable, sectionLabel, workforceLabel } from "../render.js";

/**
 * @typedef {import("../../core/criteria.js").SearchCriteria} SearchCriteria
 * @typedef {import("../../core/company.js").Company} Company
 */

/** Champs de formulaire ↔ critères. */
const FIELDS = /** @type {const} */ ([
    ["postalCode", "#postalCodeFilter"],
    ["city", "#cityFilter"],
    ["cityCode", "#cityCodeFilter"],
    ["naf", "#nafFilter"],
    ["department", "#departmentFilter"],
    ["region", "#regionFilter"],
    ["workforce", "#workforceFilter"],
    ["status", "#statusFilter"],
    ["category", "#categoryFilter"],
    ["legalForm", "#legalFormFilter"],
    ["section", "#sectionFilter"],
    ["revenueMin", "#revenueMinFilter"],
    ["revenueMax", "#revenueMaxFilter"],
    ["netMin", "#netMinFilter"],
    ["netMax", "#netMaxFilter"],
    ["personName", "#personNameFilter"],
    ["personFirstNames", "#personFirstNamesFilter"]
]);

/** Libellé de puce et clé « remove-filter » (clés v1.1.1 conservées : cp, city, naf…). */
const CHIP_KEYS = /** @type {Record<string, string>} */ ({
    postalCode: "cp",
    city: "city",
    naf: "naf",
    department: "department",
    region: "region",
    workforce: "workforce",
    status: "status",
    category: "category",
    legalForm: "legal",
    section: "section",
    revenueMin: "caMin",
    revenueMax: "caMax",
    netMin: "netMin",
    netMax: "netMax",
    personName: "person",
    personFirstNames: "firstNames"
});

/**
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createSearchView(ctx) {
    const { dom, store } = ctx;
    const { h, $, $$, replace } = dom;
    const input = /** @type {HTMLInputElement} */ ($("#queryInput"));
    /** @type {AbortController|null} */
    let controller = null;
    /** @type {AbortController|null} */
    let analyticsController = null;
    let requestId = 0;

    /** @param {string} sel */
    const field = sel => /** @type {HTMLInputElement|HTMLSelectElement} */ ($(sel));

    function fillSelects() {
        const t = ctx.t;
        const keep = (/** @type {HTMLSelectElement} */ sel, /** @type {HTMLElement[]} */ options) => {
            const value = sel.value;
            replace(sel, ...options);
            sel.value = value;
        };
        keep(/** @type {HTMLSelectElement} */ ($("#workforceFilter")), [
            h("option", { value: "" }, t("filter.allFem")),
            ...WORKFORCE.map(([code]) => h("option", { value: code }, t(`workforce.${code}`)))
        ]);
        keep(
            /** @type {HTMLSelectElement} */ ($("#categoryFilter")),
            CATEGORY_VALUES.map(v => h("option", { value: v }, v ? t(`category.${v}`) : t("filter.allFem")))
        );
        keep(/** @type {HTMLSelectElement} */ ($("#legalFormFilter")), [
            h("option", { value: "" }, t("filter.allFem")),
            ...LEGAL_FORMS.map(([code]) => h("option", { value: code }, `${t(`legal.${code}`)} (${code})`))
        ]);
        const sections = [h("option", { value: "" }, t("filter.all")), ...SECTIONS.map(([code]) => h("option", { value: code }, sectionLabel(ctx, code)))];
        keep(/** @type {HTMLSelectElement} */ ($("#sectionFilter")), sections);
        const checked = new Set($$("#labelFilters input:checked").map(i => /** @type {HTMLInputElement} */ (i).value));
        replace(
            $("#labelFilters"),
            ...FILTER_LABEL_KEYS.map(key =>
                h(
                    "label",
                    { class: "inline-check" },
                    h("input", { type: "checkbox", value: key, checked: checked.has(key), "data-testid": `filter-label-${key}`, onchange: onFiltersChanged }),
                    h("span", {}, t(`label.${key}`))
                )
            )
        );
    }

    /** @returns {SearchCriteria} */
    function readForm() {
        /** @type {Record<string, unknown>} */
        const raw = { query: input.value };
        for (const [key, sel] of FIELDS) raw[key] = field(sel).value;
        raw.labels = $$("#labelFilters input:checked").map(i => /** @type {HTMLInputElement} */ (i).value);
        raw.pageSize = field("#pageSizeFilter").value;
        raw.sort = field("#sortSelect").value;
        return sanitizeCriteria(raw);
    }

    /** @param {SearchCriteria} c */
    function writeForm(c) {
        input.value = c.query;
        for (const [key, sel] of FIELDS) field(sel).value = /** @type {string} */ (c[key]);
        for (const el of $$("#labelFilters input")) {
            const box = /** @type {HTMLInputElement} */ (el);
            box.checked = c.labels.includes(box.value);
        }
        field("#pageSizeFilter").value = String(c.pageSize);
        field("#sortSelect").value = c.sort;
        renderHint();
        renderAdvancedCount();
    }

    function renderHint() {
        const info = detectQueryType(input.value);
        const hint = $("#queryHint");
        hint.textContent = ctx.t(info.messageKey);
        hint.dataset.state = info.state;
        hint.className = `input-hint ${info.valid ? "valid" : info.state === "invalid-checksum" ? "warning" : info.state === "empty" || info.state === "text" ? "" : "invalid"}`;
        setHidden($("#identifierWarning"), !(isIdentifierQuery(info) && hasActiveFilters(readForm())));
    }

    function renderAdvancedCount() {
        const n = countActiveFilters(readForm());
        const badge = $("#advancedCount");
        badge.textContent = n ? ctx.t("search.activeFilters", { count: n }) : "";
        setHidden(badge, n === 0);
    }

    /** @param {string} message */
    function showState(message) {
        const state = $("#searchState");
        state.textContent = message;
        setHidden(state, false);
    }

    function setExportEnabled() {
        /** @type {HTMLButtonElement} */ ($("#openExportBtn")).disabled = store.get().search.status === "loading";
    }

    /** Liste triée puis filtrée localement (sans appel réseau). */
    function visibleCompanies() {
        const s = store.get().search;
        const sorted = sortCompanies(s.companies, field("#sortSelect").value);
        const q = /** @type {HTMLInputElement} */ ($("#localFilterInput")).value.trim().toLocaleLowerCase(ctx.locale());
        if (!q) return sorted;
        return sorted.filter(c => `${c.name} ${c.siren} ${c.city} ${c.activityLabel} ${c.activity}`.toLocaleLowerCase(ctx.locale()).includes(q));
    }

    function renderStats(/** @type {Company[]} */ list) {
        const root = $("#statsPanel");
        if (!list.length) {
            root.replaceChildren();
            return setHidden(root, true);
        }
        const s = computeStats(list);
        const t = ctx.t;
        replace(
            root,
            h(
                "div",
                { class: "stats-extended" },
                h("article", {}, h("span", { class: "muted" }, t("stats.displayed")), h("strong", {}, String(s.displayed))),
                h(
                    "article",
                    {},
                    h("span", { class: "muted" }, t("stats.active")),
                    h("strong", {}, String(s.active)),
                    h("small", { class: "muted" }, t("stats.closedUnknown", { closed: s.closed, unknown: s.unknown }))
                ),
                h(
                    "article",
                    {},
                    h("span", { class: "muted" }, t("stats.cities")),
                    h("strong", {}, String(s.cities)),
                    h("small", { class: "muted" }, t("stats.withPostal", { count: s.withPostalCode }))
                ),
                h(
                    "article",
                    {},
                    h("span", { class: "muted" }, t("stats.workforce")),
                    h("strong", {}, String(s.withWorkforce)),
                    h("small", { class: "muted" }, t("stats.oldest", { date: s.oldestCreation || "—" }))
                )
            )
        );
        setHidden(root, false);
    }

    function renderActiveFilters() {
        const root = $("#activeFilters");
        const c = readForm();
        const t = ctx.t;
        /** @type {{ key: string, label: string, value: string, remove: () => void }[]} */
        const chips = [];
        for (const [key] of FIELDS) {
            if (key === "cityCode" || !c[key]) continue;
            let value = /** @type {string} */ (c[key]);
            if (key === "workforce") value = workforceLabel(ctx, value);
            if (key === "status") value = t(value === "A" ? "status.active" : "status.closed");
            if (key === "section") value = sectionLabel(ctx, value);
            chips.push({ key: CHIP_KEYS[key], label: t(`chip.${key}`), value, remove: () => clearField(key) });
        }
        for (const label of c.labels) chips.push({ key: label, label: t("chip.label"), value: t(`label.${label}`), remove: () => toggleLabel(label, false) });
        if (c.pageSize !== LIMITS.defaultPerPage)
            chips.push({ key: "size", label: t("chip.size"), value: String(c.pageSize), remove: () => clearField("pageSize") });
        if (c.sort !== "relevance") chips.push({ key: "sort", label: t("chip.sort"), value: t(`sort.${c.sort}`), remove: () => clearField("sort") });
        if (!chips.length) {
            root.replaceChildren();
            return setHidden(root, true);
        }
        replace(
            root,
            ...chips.map(chip =>
                h(
                    "span",
                    { class: "filter-chip" },
                    `${chip.label}: ${chip.value} `,
                    h(
                        "button",
                        {
                            type: "button",
                            "data-remove-filter": chip.key,
                            "aria-label": t("chip.remove", { label: chip.label, value: chip.value }),
                            onclick: chip.remove
                        },
                        "×"
                    )
                )
            ),
            h("button", { id: "resetActiveFilters", type: "button", class: "button secondary", onclick: resetFiltersOnly }, t("chip.resetAll"))
        );
        setHidden(root, false);
    }

    /** @param {string} key */
    function clearField(key) {
        if (key === "city") {
            field("#cityFilter").value = "";
            field("#cityCodeFilter").value = "";
        } else if (key === "pageSize") field("#pageSizeFilter").value = String(LIMITS.defaultPerPage);
        else if (key === "sort") field("#sortSelect").value = "relevance";
        else {
            const entry = FIELDS.find(([k]) => k === key);
            if (entry) field(entry[1]).value = "";
        }
        afterFilterRemoval();
    }

    /**
     * @param {string} label
     * @param {boolean} checked
     */
    function toggleLabel(label, checked) {
        const box = /** @type {HTMLInputElement|null} */ (dom.doc.querySelector(`#labelFilters input[value="${label}"]`));
        if (box) box.checked = checked;
        afterFilterRemoval();
    }

    function resetFiltersOnly() {
        const current = readForm();
        writeForm({ ...criteriaDefaults(), query: current.query });
        afterFilterRemoval();
    }

    function afterFilterRemoval() {
        renderActiveFilters();
        renderAdvancedCount();
        renderHint();
        if (input.value.trim()) submit({ recordHistory: true });
        else ctx.router.sync({ view: "search", criteria: readForm(), page: 1 });
    }

    function onFiltersChanged() {
        renderAdvancedCount();
        renderHint();
    }

    function render() {
        const s = store.get().search;
        const grid = $("#resultsGrid");
        const table = $("#resultsTable");
        const t = ctx.t;
        setHidden($("#retryBtn"), s.status !== "error");
        setExportEnabled();
        if (s.status !== "success") {
            grid.replaceChildren();
            table.replaceChildren();
            setHidden(table, true);
            renderStats([]);
            setHidden($("#pagination"), true);
            return;
        }
        const list = visibleCompanies();
        const asTable = store.get().prefs.resultsView === "table";
        const toggle = $("#viewToggleBtn");
        toggle.setAttribute("aria-pressed", String(asTable));
        toggle.textContent = t(asTable ? "results.cardView" : "results.tableView");
        $("#resultsTitle").textContent = t("results.titleFor", { query: s.criteria.query });
        $("#resultCount").textContent = t("results.count", { count: s.total });
        if (!s.companies.length) showState(t("results.empty"));
        else if (!list.length) showState(t("results.localEmpty"));
        else setHidden($("#searchState"), true);
        const handlers = {
            onDetail: (/** @type {string} */ siren) => ctx.actions.openDetail(siren),
            onFavorite: (/** @type {string} */ siren) => ctx.actions.toggleFavorite(siren),
            onCompare: (/** @type {string} */ siren) => ctx.actions.addCompare(siren)
        };
        if (asTable) {
            grid.replaceChildren();
            replace(table, companyTable(ctx, list, { sort: field("#sortSelect").value, onSort: changeSort, onDetail: handlers.onDetail }));
        } else {
            table.replaceChildren();
            replace(grid, ...list.map(c => companyCard(ctx, c, { ...handlers, isFavorite: ctx.actions.isFavorite(c.siren) })));
        }
        setHidden(table, !asTable || !list.length);
        renderStats(list);
        renderActiveFilters();
        const max = Math.max(1, s.totalPages);
        $("#pageLabel").textContent = t("pagination.label", { page: s.page, max });
        /** @type {HTMLButtonElement} */ ($("#prevPage")).disabled = s.page <= 1;
        /** @type {HTMLButtonElement} */ ($("#nextPage")).disabled = s.page >= max;
        setHidden($("#pagination"), max <= 1);
    }

    /** @param {string} mode */
    function changeSort(mode) {
        field("#sortSelect").value = mode;
        onSortChange();
    }

    function onSortChange() {
        const s = store.get().search;
        store.set({ search: { ...s, criteria: { ...s.criteria, sort: field("#sortSelect").value } } });
        ctx.router.sync({ view: "search", criteria: readForm(), page: s.page });
        render();
    }

    /**
     * @param {unknown} error
     */
    function errorText(error) {
        return ctx.errorMessage(error);
    }

    /**
     * Exécute une recherche. Une seule requête active ; les réponses obsolètes sont ignorées (y compris la résolution de commune, anomalie #8).
     * @param {SearchCriteria} criteria
     * @param {number} page
     * @param {{ recordHistory?: boolean }} [options]
     */
    async function run(criteria, page, options = {}) {
        const info = detectQueryType(criteria.query);
        renderHint();
        if (!info.searchable) {
            controller?.abort();
            store.set({ search: { ...store.get().search, status: "idle", companies: [] } });
            render();
            return showState(ctx.t(info.state === "empty" ? "search.enterQuery" : info.messageKey));
        }
        const validation = validateCriteria(criteria);
        if (validation) {
            store.set({ search: { ...store.get().search, status: "idle", companies: [] } });
            render();
            return showState(ctx.t(validation));
        }
        controller?.abort();
        controller = new AbortController();
        const mine = controller;
        const id = ++requestId;
        const c = { ...criteria, query: info.normalized };
        store.set({ search: { ...store.get().search, status: "loading", criteria: c, page, companies: [], total: 0, totalPages: 0, errorKind: "" } });
        render();
        showState(ctx.t("search.loading"));
        try {
            if (c.city && !c.cityCode) {
                showState(ctx.t("search.validatingCity"));
                const city = await ctx.geo.resolveCity(c.city, mine.signal);
                if (id !== requestId) return;
                if (!city) {
                    store.set({ search: { ...store.get().search, status: "idle" } });
                    render();
                    return showState(ctx.t("search.cityNotFound"));
                }
                c.cityCode = city.code;
                field("#cityCodeFilter").value = city.code;
            }
            const result = await ctx.api.search(c, page, mine.signal);
            if (id !== requestId) return;
            ctx.cacheCompanies(result.companies);
            store.set({
                search: {
                    ...store.get().search,
                    status: "success",
                    criteria: c,
                    page,
                    companies: result.companies,
                    total: result.total,
                    totalPages: result.totalPages
                }
            });
            ctx.router.sync({ view: "search", criteria: c, page });
            if (options.recordHistory) recordHistory(c);
            render();
            ctx.announce(ctx.t("results.count", { count: result.total }));
        } catch (error) {
            if (isAbortError(error) || id !== requestId) return;
            const kind = /** @type {any} */ (error)?.kind || "network";
            store.set({ search: { ...store.get().search, status: "error", errorKind: kind, companies: [] } });
            $("#resultCount").textContent = ctx.t("results.apiError");
            render();
            showState(errorText(error));
        } finally {
            if (controller === mine) controller = null;
        }
    }

    /** @param {SearchCriteria} c */
    function recordHistory(c) {
        const history = addHistoryEntry(store.get().history, { ...c, at: ctx.clock.iso() }, LIMITS.historyMax);
        store.set({ history: applyRetention(history, ctx.clock.now(), store.get().prefs.retentionDays) });
        ctx.persist("history");
    }

    /** @param {{ recordHistory?: boolean, page?: number }} [options] */
    function submit(options = {}) {
        const criteria = readForm();
        if (!criteria.query) {
            controller?.abort();
            store.set({ search: { ...store.get().search, status: "idle", companies: [] } });
            render();
            ctx.router.sync({ view: "search", criteria, page: 1 });
            return showState(ctx.t("search.enterQuery"));
        }
        ctx.router.go({ view: "search", criteria, page: options.page || 1 }, { push: true, recordHistory: options.recordHistory ?? true });
    }

    /**
     * Point d'entrée du routeur.
     * @param {import("../../core/url-state.js").AppUrlState} state
     * @param {import("../router.js").NavOptions} options
     */
    function show(state, options) {
        const s = store.get().search;
        const formCriteria = readForm();
        if (searchIdentity(formCriteria) !== searchIdentity(state.criteria) || formCriteria.sort !== state.criteria.sort) writeForm(state.criteria);
        if (!state.criteria.query) {
            if (s.status === "idle" && !input.value) showState(ctx.t("search.prompt"));
            renderActiveFilters();
            return render();
        }
        const same = s.status !== "error" && s.status !== "idle" && searchIdentity(s.criteria) === searchIdentity(state.criteria) && s.page === state.page;
        if (same) {
            if (options.recordHistory) recordHistory(s.criteria);
            return render();
        }
        run(state.criteria, state.page, { recordHistory: Boolean(options.recordHistory) });
    }

    function reset() {
        controller?.abort();
        analyticsController?.abort();
        companyAutocomplete.cancel();
        cityAutocomplete.cancel();
        /** @type {HTMLFormElement} */ ($("#searchForm")).reset();
        writeForm(criteriaDefaults());
        /** @type {HTMLInputElement} */ ($("#localFilterInput")).value = "";
        store.set({ search: { ...store.get().search, status: "idle", criteria: criteriaDefaults(), page: 1, companies: [], total: 0, totalPages: 0 } });
        $("#resultCount").textContent = ctx.t("results.count", { count: 0 });
        $("#resultsTitle").textContent = ctx.t("results.title");
        replace($("#analyticsCharts"));
        render();
        renderActiveFilters();
        ctx.router.sync({ view: "search", criteria: criteriaDefaults(), page: 1 });
        showState(ctx.t("search.prompt"));
    }

    // --- Recherches sauvegardées (dialogue accessible, remplace prompt(), anomalie #17) ---
    function openSaveDialog() {
        const c = readForm();
        if (!c.query) return ctx.toast(ctx.t("save.nothing"));
        const dialog = /** @type {HTMLDialogElement} */ ($("#saveSearchDialog"));
        /** @type {HTMLInputElement} */ ($("#saveSearchName")).value = c.query;
        setHidden($("#saveSearchError"), true);
        dialog.showModal();
        /** @type {HTMLInputElement} */ ($("#saveSearchName")).select();
    }

    /** @param {Event} event */
    function confirmSave(event) {
        event.preventDefault();
        const name = /** @type {HTMLInputElement} */ ($("#saveSearchName")).value.trim();
        if (!name) {
            const err = $("#saveSearchError");
            err.textContent = ctx.t("save.empty");
            return setHidden(err, false);
        }
        const c = readForm();
        const { list, updated } = upsertSavedSearch(
            store.get().saved,
            { ...c, id: ctx.ids.next(), name: name.slice(0, LIMITS.savedNameMax), createdAt: ctx.clock.iso() },
            LIMITS.savedMax
        );
        store.set({ saved: list });
        ctx.persist("saved");
        /** @type {HTMLDialogElement} */ ($("#saveSearchDialog")).close();
        ctx.toast(ctx.t(updated ? "save.updated" : "save.done"));
    }

    async function share() {
        ctx.router.sync({ view: "search", criteria: readForm(), page: store.get().search.page });
        const ok = await ctx.copy(ctx.router.href());
        ctx.toast(ctx.t(ok ? "share.copied" : "share.failed"));
    }

    // --- Analyse multi-pages (N-7) ---
    async function runAnalytics() {
        const s = store.get().search;
        if (s.status !== "success") return ($("#analyticsStatus").textContent = ctx.t("analytics.needResults"));
        const pages = Math.min(LIMITS.analyticsMaxPages, Number(field("#analyticsPages").value) || 1, Math.max(1, s.totalPages));
        analyticsController?.abort();
        analyticsController = new AbortController();
        const mine = analyticsController;
        const progress = /** @type {HTMLProgressElement} */ ($("#analyticsProgress"));
        progress.max = pages;
        progress.value = 0;
        setHidden(progress, false);
        setHidden($("#analyticsCancelBtn"), false);
        /** @type {Company[]} */
        const all = [];
        try {
            for (let page = 1; page <= pages; page += 1) {
                // Même taille de page que la recherche affichée : sinon les pages se chevauchent ou se perdent.
                const companies = page === s.page ? s.companies : (await ctx.api.search(s.criteria, page, mine.signal)).companies;
                all.push(...companies);
                progress.value = page;
                $("#analyticsStatus").textContent = ctx.t("analytics.progress", { page, pages });
            }
            renderCharts(dedupe(all));
            $("#analyticsStatus").textContent = ctx.t("analytics.done", { count: dedupe(all).length });
        } catch (error) {
            $("#analyticsStatus").textContent = isAbortError(error) ? ctx.t("analytics.cancelled") : errorText(error);
        } finally {
            setHidden(progress, true);
            setHidden($("#analyticsCancelBtn"), true);
        }
    }

    /** @param {Company[]} list */
    function dedupe(list) {
        const seen = new Set();
        return list.filter(c => (seen.has(c.siren) ? false : (seen.add(c.siren), true)));
    }

    /** @param {Company[]} list */
    function renderCharts(list) {
        const t = ctx.t;
        const missing = t("common.missing");
        /** @type {[string, (c: Company) => string, (k: string) => string][]} */
        const axes = [
            ["status", c => c.status, k => (k ? t(k === "A" ? "status.active" : "status.closed") : missing)],
            ["category", c => c.category, k => (k ? t(`category.${k}`) : missing)],
            ["workforce", c => (c.workforce === "NN" ? "" : c.workforce), k => (k ? workforceLabel(ctx, k) : missing)],
            ["department", c => c.department, k => k || missing],
            ["section", c => c.section, k => (k ? sectionLabel(ctx, k) : missing)]
        ];
        replace(
            $("#analyticsCharts"),
            ...axes.map(([id, keyOf, labelOf]) =>
                barChart(dom, {
                    id,
                    title: t(`analytics.axis.${id}`),
                    buckets: limitBuckets(groupCount(list, keyOf, labelOf), 10, t("analytics.other")),
                    valueLabel: t("analytics.count"),
                    tableLabel: t("analytics.showTable")
                })
            )
        );
    }

    // --- Autocomplétion ---
    const companyAutocomplete = createAutocomplete({
        input,
        list: $("#companySuggestions"),
        idPrefix: "company-option",
        minLength: 3,
        delay: LIMITS.autocompleteDelayMs,
        timers: ctx.timers,
        h,
        accept: q => !/^[\d ]+$/.test(q),
        load: (q, signal) => ctx.api.suggest(q, signal),
        renderOption: c => [h("b", {}, c.name || c.siren), h("br"), h("small", {}, `SIREN ${c.siren}${c.city ? ` · ${c.city}` : ""}`)],
        onSelect: c => {
            input.value = c.name || c.siren;
            submit({ recordHistory: true });
        },
        onInput: renderHint,
        messages: () => ({ loading: ctx.t("autocomplete.loading"), empty: ctx.t("autocomplete.empty"), error: ctx.t("autocomplete.error") })
    });
    const cityInput = /** @type {HTMLInputElement} */ ($("#cityFilter"));
    const cityAutocomplete = createAutocomplete({
        input: cityInput,
        list: $("#citySuggestions"),
        idPrefix: "city-option",
        minLength: 2,
        delay: LIMITS.cityAutocompleteDelayMs,
        timers: ctx.timers,
        h,
        load: (q, signal) => ctx.geo.searchCities(q, signal),
        renderOption: city => [h("b", {}, city.name), " ", h("small", {}, `${city.code} · ${city.postalCodes.join(", ")}`)],
        onSelect: city => {
            cityInput.value = city.name;
            field("#cityCodeFilter").value = city.code;
            renderActiveFilters();
            renderAdvancedCount();
        },
        onInput: () => {
            field("#cityCodeFilter").value = "";
        },
        messages: () => ({ loading: ctx.t("autocomplete.loading"), empty: ctx.t("autocomplete.noCity"), error: ctx.t("autocomplete.error") })
    });

    // --- Écouteurs ---
    $("#searchForm").addEventListener("submit", event => {
        event.preventDefault();
        companyAutocomplete.cancel();
        submit({ recordHistory: true });
    });
    $("#advancedFilters").addEventListener("input", onFiltersChanged);
    $("#advancedFilters").addEventListener("change", onFiltersChanged);
    $("#clearSearchBtn").addEventListener("click", reset);
    $("#prevPage").addEventListener("click", () => {
        const s = store.get().search;
        if (s.page > 1) ctx.router.go({ view: "search", criteria: s.criteria, page: s.page - 1 }, { push: true });
    });
    $("#nextPage").addEventListener("click", () => {
        const s = store.get().search;
        if (s.page < s.totalPages) ctx.router.go({ view: "search", criteria: s.criteria, page: s.page + 1 }, { push: true });
    });
    $("#sortSelect").addEventListener("change", onSortChange);
    $("#pageSizeFilter").addEventListener("change", () => {
        if (input.value.trim()) submit({ recordHistory: false });
        else ctx.router.sync({ view: "search", criteria: readForm(), page: 1 });
    });
    $("#retryBtn").addEventListener("click", () => {
        const s = store.get().search;
        run(s.criteria, s.page);
    });
    $("#saveSearchBtn").addEventListener("click", openSaveDialog);
    $("#saveSearchConfirm").addEventListener("click", confirmSave);
    $("#shareSearchBtn").addEventListener("click", share);
    $("#viewToggleBtn").addEventListener("click", () => {
        ctx.updatePrefs({ resultsView: store.get().prefs.resultsView === "table" ? "cards" : "table" });
        render();
    });
    $("#localFilterInput").addEventListener("input", () => {
        render();
        $("#localFilterStatus").textContent = ctx.t("results.localCount", { count: visibleCompanies().length });
    });
    $("#analyticsBtn").addEventListener("click", () => {
        const panel = $("#analyticsPanel");
        const open = panel.classList.contains("hidden");
        setHidden(panel, !open);
        $("#analyticsBtn").setAttribute("aria-expanded", String(open));
    });
    $("#analyticsRunBtn").addEventListener("click", runAnalytics);
    $("#analyticsCancelBtn").addEventListener("click", () => analyticsController?.abort());

    fillSelects();

    return {
        show,
        render,
        refreshLanguage() {
            fillSelects();
            renderHint();
            renderAdvancedCount();
            render();
            const s = store.get().search;
            if (s.status === "idle") showState(ctx.t("search.prompt"));
            if (s.status === "success") $("#resultsTitle").textContent = ctx.t("results.titleFor", { query: s.criteria.query });
            else if (s.status === "idle") $("#resultsTitle").textContent = ctx.t("results.title");
        },
        visibleCompanies,
        readForm,
        focusInput: () => input.focus()
    };
}
