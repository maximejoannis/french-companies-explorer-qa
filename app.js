const API = "https://recherche-entreprises.api.gouv.fr/search";
const GEO_API = "https://geo.api.gouv.fr/communes";
const S = {
    page: 1,
    perPage: 20,
    total: 0,
    results: [],
    rawResults: [],
    requestState: "idle",
    requestId: 0,
    lastSuccessfulCriteria: null,
    favorites: load("fce_favorites", []),
    history: load("fce_history", []),
    compare: load("fce_compare", []),
    favoriteMeta: load("fce_favorite_meta", {}),
    saved: load("fce_saved", []),
    sort: "relevance",
    theme: localStorage.getItem("fce_theme") || "light"
};
let searchController = null;
let autocompleteController = null;
let cityController = null;
let autocompleteTimer = null;
let cityTimer = null;
let activeSuggestion = -1;
let citySuggestionItems = [];
const $ = s => document.querySelector(s),
    $$ = s => [...document.querySelectorAll(s)];
document.documentElement.dataset.theme = S.theme;

function updateThemeButton() {
    const b = $("#themeToggle");
    if (b) {
        b.textContent = S.theme === "dark" ? "☀" : "☾";
        b.setAttribute("aria-label", S.theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre");
        b.setAttribute("aria-pressed", String(S.theme === "dark"));
    }
}
updateThemeButton();
$("#themeToggle")?.addEventListener("click", () => {
    S.theme = S.theme === "dark" ? "light" : "dark";
    localStorage.setItem("fce_theme", S.theme);
    document.documentElement.dataset.theme = S.theme;
    updateThemeButton()
});

function load(k, f) {
    try {
        return JSON.parse(localStorage.getItem(k)) ?? f
    } catch {
        return f
    }
}

function save(k, v) {
    localStorage.setItem(k, JSON.stringify(v))
}

function esc(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;")
}

function toast(m) {
    const e = $("#toast");
    e.textContent = m;
    e.classList.remove("hidden");
    setTimeout(() => e.classList.add("hidden"), 2200)
}

function route(n) {
    ["home", "search", "detail", "favorites", "compare", "history"].forEach(v => $(`#${v}View`)?.classList.toggle("hidden", v !== n));
    if (n === "favorites") renderFavorites();
    if (n === "compare") renderCompare();
    if (n === "history") renderHistory();
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
    const heading = $(`#${n}View h1, #${n}View h2`);
    if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
    }
}
$$("[data-route]").forEach(b => b.onclick = () => route(b.dataset.route));
$$("[data-query]").forEach(b => b.onclick = () => {
    route("search");
    $("#queryInput").value = b.dataset.query;
    search(1)
});
$("#randomDemoBtn").onclick = () => {
    const q = ["La Poste", "Renault", "Université de Strasbourg", "API Restauration"][Math.floor(Math.random() * 4)];
    route("search");
    $("#queryInput").value = q;
    search(1)
};
$("#searchForm").onsubmit = e => {
    e.preventDefault();
    search(1)
};
$("#queryInput").addEventListener("input", () => {
    renderQueryHint();
    scheduleCompanySuggestions();
});
$("#queryInput").addEventListener("keydown", handleSuggestionKeys);
$("#cityFilter").addEventListener("input", scheduleCitySuggestions);
$("#cityFilter").addEventListener("keydown", handleCitySuggestionKeys);
renderQueryHint();
$("#clearSearchBtn").onclick = () => {
    searchController?.abort();
    searchController = null;
    $("#searchForm").reset();
    $("#pageSizeFilter").value = "20";
    $("#sortSelect").value = "relevance";
    S.page = 1;
    S.perPage = 20;
    S.sort = "relevance";
    S.results = [];
    S.rawResults = [];
    S.requestState = "idle";
    S.lastSuccessfulCriteria = null;
    S.total = 0;
    $("#resultsGrid").innerHTML = "";
    $("#resultCount").textContent = "0 résultat";
    $("#resultsTitle").textContent = "Entreprises";
    $("#pagination").classList.add("hidden");
    $("#statsPanel").classList.add("hidden");
    $("#statsPanel").innerHTML = "";
    renderActiveFilters();
    renderQueryHint();
    syncUrl();
    showState("Saisis un nom, un SIREN ou un mot-clé.")
};
$("#prevPage").onclick = () => {
    if (S.page > 1) search(S.page - 1)
};
$("#nextPage").onclick = () => {
    if (S.page < Math.ceil(S.total / S.perPage)) search(S.page + 1)
};
$("#clearFavoritesBtn").onclick = () => {
    S.favorites = [];
    S.favoriteMeta = {};
    save("fce_favorites", S.favorites);
    save("fce_favorite_meta", S.favoriteMeta);
    renderFavorites();
    toast("Favoris supprimés.")
};
$("#clearHistoryBtn").onclick = () => {
    S.history = [];
    save("fce_history", S.history);
    renderHistory()
};
$("#sortSelect").onchange = () => {
    sortResults();
    renderResults();
    renderStats();
    renderActiveFilters();
    syncUrl()
};
$("#pageSizeFilter").onchange = () => {
    if ($("#queryInput").value.trim()) search(1, {recordHistory: false});
    else syncUrl();
};
$("#saveSearchBtn").onclick = saveCurrentSearch;
$("#shareSearchBtn").onclick = shareCurrentSearch;
$("#openExportBtn").onclick = openExportDialog;
$("#confirmExportBtn").onclick = performConfiguredExport;


function syncUrl() {
    const p = new URLSearchParams();
    const q = $("#queryInput").value.trim(),
        cp = $("#postalCodeFilter").value.trim(),
        city = $("#cityFilter").value.trim(),
        cityCode = $("#cityCodeFilter").value.trim(),
        naf = $("#nafFilter").value.trim().toUpperCase(),
        department = $("#departmentFilter").value.trim().toUpperCase(),
        region = $("#regionFilter").value.trim(),
        workforce = $("#workforceFilter").value,
        st = $("#statusFilter").value,
        sort = $("#sortSelect").value;
    if (q) p.set("q", q);
    if (cp) p.set("cp", cp);
    if (city) p.set("city", city);
    if (cityCode) p.set("cityCode", cityCode);
    if (naf) p.set("naf", naf);
    if (department) p.set("department", department);
    if (region) p.set("region", region);
    if (workforce) p.set("workforce", workforce);
    if (st) p.set("status", st);
    if (S.page > 1) p.set("page", String(S.page));
    if (S.perPage !== 20) p.set("size", String(S.perPage));
    if (sort !== "relevance") p.set("sort", sort);
    const url = p.toString() ? `${location.pathname}?${p.toString()}` : location.pathname;
    history.replaceState({}, "", url);
}

function restoreFromUrl() {
    const p = new URLSearchParams(location.search);
    if (p.get("q")) $("#queryInput").value = p.get("q");
    if (p.get("cp")) $("#postalCodeFilter").value = p.get("cp");
    if (p.get("city")) $("#cityFilter").value = p.get("city");
    if (/^\d{5}$/.test(p.get("cityCode") || "")) $("#cityCodeFilter").value = p.get("cityCode");
    if (/^\d{2}\.\d{2}[A-Z]$/.test((p.get("naf") || "").toUpperCase())) $("#nafFilter").value = p.get("naf").toUpperCase();
    if (/^(?:\d{2,3}|2A|2B)$/.test((p.get("department") || "").toUpperCase())) $("#departmentFilter").value = p.get("department").toUpperCase();
    if (/^\d{2}$/.test(p.get("region") || "")) $("#regionFilter").value = p.get("region");
    const workforceValues = [...$("#workforceFilter").options].map(o => o.value);
    if (workforceValues.includes(p.get("workforce"))) $("#workforceFilter").value = p.get("workforce");
    if (p.get("status")) $("#statusFilter").value = p.get("status");
    if (["10", "20", "25"].includes(p.get("size"))) $("#pageSizeFilter").value = p.get("size");
    const allowedSorts = ["relevance", "name-asc", "name-desc", "creation-newest", "creation-oldest", "status"];
    if (allowedSorts.includes(p.get("sort"))) $("#sortSelect").value = p.get("sort");
    return {
        hasQuery: !!p.get("q"),
        page: positiveInt(p.get("page"), 1)
    };
}

function positiveInt(value, fallback = 1) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function criteriaFromUi() {
    return {
        query: $("#queryInput").value.trim(),
        postalCode: $("#postalCodeFilter").value.trim(),
        city: $("#cityFilter").value.trim(),
        cityCode: $("#cityCodeFilter").value.trim(),
        status: $("#statusFilter").value,
        naf: $("#nafFilter").value.trim().toUpperCase(),
        department: $("#departmentFilter").value.trim().toUpperCase(),
        region: $("#regionFilter").value.trim(),
        workforce: $("#workforceFilter").value,
        pageSize: positiveInt($("#pageSizeFilter").value, 20),
        sort: $("#sortSelect").value
    };
}

function searchIdentity(c) {
    return [c.query.toLocaleLowerCase("fr"), c.postalCode, c.cityCode || c.city.toLocaleLowerCase("fr"), c.status, c.naf, c.department, c.region, c.workforce].join("|");
}

function getVisibleCompanies() {
    return S.results.map(norm)
}

function sortResults() {
    const mode = $("#sortSelect")?.value || "relevance";
    S.sort = mode;
    const arr = [...S.rawResults];
    if (mode === "relevance") {
        S.results = arr;
        return;
    }
    const n = x => norm(x);
    arr.sort((a, b) => {
        const A = n(a),
            B = n(b);
        if (mode === "name-asc") return A.name.localeCompare(B.name, "fr");
        if (mode === "name-desc") return B.name.localeCompare(A.name, "fr");
        if (mode === "creation-newest") return String(B.creation).localeCompare(String(A.creation));
        if (mode === "creation-oldest") return String(A.creation).localeCompare(String(B.creation));
        if (mode === "status") return String(A.status).localeCompare(String(B.status));
        return 0;
    });
    S.results = arr;
}

function renderStats() {
    const root = $("#statsPanel"),
        c = getVisibleCompanies();
    if (!c.length) {
        root.classList.add("hidden");
        root.innerHTML = "";
        return
    }
    const active = c.filter(x => x.status === "A").length,
        closed = c.filter(x => x.status === "C").length,
        unknown = c.length - active - closed,
        cities = new Set(c.map(x => x.city).filter(Boolean)).size,
        work = c.filter(x => x.workforce && x.workforce !== "Non renseigné").length,
        postal = c.filter(x => x.postalCode).length,
        oldest = c.map(x => x.creation).filter(x => /^\d{4}-\d{2}-\d{2}/.test(x)).sort()[0] || "—";
    root.innerHTML = `<div class="stats-extended"><article><span class="muted">Affichées</span><strong>${c.length}</strong></article><article><span class="muted">En activité</span><strong>${active}</strong><small class="muted">${closed} cessée(s) · ${unknown} non renseigné(s)</small></article><article><span class="muted">Communes distinctes</span><strong>${cities}</strong><small class="muted">${postal} avec code postal</small></article><article><span class="muted">Effectif renseigné</span><strong>${work}</strong><small class="muted">Création la plus ancienne : ${esc(oldest)}</small></article></div>`;
    root.classList.remove("hidden")
}

function downloadFile(name, mime, content) {
    const blob = new Blob([content], {
            type: mime
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportCompanies(scope) {
    if (scope === "compare") return S.compare.map(c => ({...c}));
    return S.requestState === "success" ? getVisibleCompanies() : [];
}

function exportFileName(format, scope) {
    const query = (S.lastSuccessfulCriteria?.query || "entreprises").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "entreprises";
    return `entreprises-${scope}-${query}.${format}`;
}

function exportJson(companies, scope = "results") {
    downloadFile(exportFileName("json", scope), "application/json;charset=utf-8", JSON.stringify(companies, null, 2))
}

function neutralizeCsvFormula(value) {
    const text = String(value ?? "");

    /*
     * Les tableurs peuvent interpréter comme formule toute
     * cellule commençant, éventuellement après des espaces,
     * par =, +, -, ou @.
     */
    if (/^\s*[=+\-@]/.test(text)) {
        return `'${text}`;
    }

    return text;
}

function csvEscape(value) {
    const safeValue =
        neutralizeCsvFormula(value);

    return `"${safeValue.replaceAll('"', '""')}"`;
}

function exportCsv(companies, scope = "results") {
    const rows = [
        ["SIREN", "Nom", "Statut", "Activité", "Ville", "Code postal", "Création", "SIRET siège"]
    ];
    companies.forEach(c => rows.push([c.siren, c.name, statusView(c.status).label, c.activityLabel, c.city, c.postalCode, c.creation, c.siret]));
    downloadFile(exportFileName("csv", scope), "text/csv;charset=utf-8", "\uFEFF" + rows.map(r => r.map(csvEscape).join(";")).join("\r\n"));
}

function openExportDialog() {
    const dialog = $("#exportDialog");
    const available = S.requestState === "success" && S.results.length > 0;
    const scope = $("#exportScope").value;
    $("#confirmExportBtn").disabled = scope === "results" ? !available : !S.compare.length;
    $("#exportHelp").textContent = available ? `${S.results.length} résultat(s) de la page courante sont prêts à être exportés.` : "Aucun résultat courant exportable.";
    dialog.showModal();
}

function performConfiguredExport(event) {
    event.preventDefault();
    const format = $("#exportFormat").value;
    const scope = $("#exportScope").value;
    const companies = exportCompanies(scope);
    if (!companies.length) return toast("Aucune donnée à exporter pour ce périmètre.");
    if (format === "json") exportJson(companies, scope);
    else exportCsv(companies, scope);
    $("#exportDialog").close();
    toast(`Export ${format.toUpperCase()} téléchargé.`);
}

function saveCurrentSearch() {
    const q = $("#queryInput").value.trim();

    if (!q) {
        toast("Aucune recherche à sauvegarder.");
        return;
    }

    const name = prompt(
        "Nom de la recherche sauvegardée :",
        q
    );

    const cleanName = name?.trim();
    if (!cleanName) {
        toast("Le nom de la recherche ne peut pas être vide.");
        return;
    }

    const entry = {
        id: Date.now(),
        name: cleanName,
        query: q,
        postalCode:
            $("#postalCodeFilter").value.trim(),
        city:
            $("#cityFilter").value.trim(),
        cityCode: $("#cityCodeFilter").value.trim(),
        status:
            $("#statusFilter").value,
        pageSize:
            +$("#pageSizeFilter").value || 20,
        naf: $("#nafFilter").value.trim().toUpperCase(),
        department: $("#departmentFilter").value.trim().toUpperCase(),
        region: $("#regionFilter").value.trim(),
        workforce: $("#workforceFilter").value
    };

    const existingSearch = S.saved.find(saved =>
        saved.query === entry.query &&
        saved.postalCode === entry.postalCode &&
        saved.city === entry.city &&
        (saved.cityCode || "") === entry.cityCode &&
        saved.status === entry.status &&
        saved.pageSize === entry.pageSize &&
        (saved.naf || "") === entry.naf &&
        (saved.department || "") === entry.department &&
        (saved.region || "") === entry.region &&
        (saved.workforce || "") === entry.workforce
    );

    if (existingSearch) {
        /*
         * Mise à jour de l’entrée existante :
         * l’identifiant est conservé et le nouveau nom est appliqué.
         */
        const updatedSearch = {
            ...existingSearch,
            name: entry.name
        };

        S.saved = [
            updatedSearch,
            ...S.saved.filter(
                saved =>
                    saved.id !== existingSearch.id
            )
        ];

        save("fce_saved", S.saved);
        toast("Recherche sauvegardée mise à jour.");
        return;
    }

    S.saved.unshift(entry);
    S.saved = S.saved.slice(0, 12);

    save("fce_saved", S.saved);
    toast("Recherche sauvegardée.");
}


function detectQueryType(v) {
    v = String(v || "").trim();
    if (/^\d{9}$/.test(v)) return {
        type: "siren",
        valid: true,
        label: "SIREN détecté"
    };
    if (/^\d{14}$/.test(v)) return {
        type: "siret",
        valid: true,
        label: "SIRET détecté"
    };
    if (/^\d+$/.test(v)) return {
        type: "numeric-invalid",
        valid: false,
        label: "Identifiant invalide : un SIREN contient 9 chiffres et un SIRET 14 chiffres"
    };
    return {
        type: "text",
        valid: !!v,
        label: v ? "Recherche textuelle" : "Saisis un nom, un mot-clé, un SIREN ou un SIRET"
    }
}

function renderQueryHint() {
    const h = $("#queryHint");
    if (!h) return;
    const d = detectQueryType($("#queryInput").value);
    h.textContent = d.label;
    h.className = `input-hint ${d.valid?"valid":d.type==="numeric-invalid"?"invalid":""}`
}

function activeFilterData() {
    return [
        ["cp", "Code postal", $("#postalCodeFilter").value.trim()],
        ["city", "Commune", $("#cityFilter").value.trim()],
        ["naf", "Code NAF", $("#nafFilter").value.trim().toUpperCase()],
        ["department", "Département", $("#departmentFilter").value.trim().toUpperCase()],
        ["region", "Région", $("#regionFilter").value.trim()],
        ["workforce", "Effectif", $("#workforceFilter").selectedOptions[0]?.textContent && $("#workforceFilter").value ? $("#workforceFilter").selectedOptions[0].textContent : ""],
        ["status", "État", $("#statusFilter").value],
        ["size", "Taille", $("#pageSizeFilter").value !== "20" ? $("#pageSizeFilter").value : ""],
        ["sort", "Tri", $("#sortSelect")?.value && $("#sortSelect").value !== "relevance" ? $("#sortSelect").value : ""]
    ].filter(([, , v]) => v)
}

function renderActiveFilters() {
    const r = $("#activeFilters");
    if (!r) return;
    const items = activeFilterData();
    if (!items.length) {
        r.classList.add("hidden");
        r.innerHTML = "";
        return
    }
    r.classList.remove("hidden");
    r.innerHTML = items.map(([k, l, v]) => `<span class="filter-chip">${l}: ${esc(v)} <button type="button" data-remove-filter="${k}" aria-label="Supprimer le filtre ${esc(l)} : ${esc(v)}">×</button></span>`).join("") + `<button id="resetActiveFilters" class="button secondary">Effacer tous les filtres</button>`;
    r.querySelectorAll("[data-remove-filter]").forEach(b => b.onclick = () => removeFilter(b.dataset.removeFilter));
    $("#resetActiveFilters").onclick = resetFiltersOnly
}

function removeFilter(k) {
    if (k === "cp") $("#postalCodeFilter").value = "";
    if (k === "city") { $("#cityFilter").value = ""; $("#cityCodeFilter").value = ""; }
    if (k === "naf") $("#nafFilter").value = "";
    if (k === "department") $("#departmentFilter").value = "";
    if (k === "region") $("#regionFilter").value = "";
    if (k === "workforce") $("#workforceFilter").value = "";
    if (k === "status") $("#statusFilter").value = "";
    if (k === "size") $("#pageSizeFilter").value = "20";
    if (k === "sort" && $("#sortSelect")) $("#sortSelect").value = "relevance";
    renderActiveFilters();
    if ($("#queryInput").value.trim()) search(1, {recordHistory: true});
    else syncUrl()
}

function resetFiltersOnly() {
    $("#postalCodeFilter").value = "";
    $("#cityFilter").value = "";
    $("#cityCodeFilter").value = "";
    $("#nafFilter").value = "";
    $("#departmentFilter").value = "";
    $("#regionFilter").value = "";
    $("#workforceFilter").value = "";
    $("#statusFilter").value = "";
    $("#pageSizeFilter").value = "20";
    if ($("#sortSelect")) $("#sortSelect").value = "relevance";
    renderActiveFilters();
    if ($("#queryInput").value.trim()) search(1, {recordHistory: true});
    else syncUrl()
}

function valueOrMissing(v, l = "Non renseigné") {
    return v && String(v).trim() && !["Non renseignée", "Non renseigné"].includes(v) ? esc(v) : `<span class="missing-data">— ${esc(l)}</span>`
}

function favoriteMetaFor(s) {
    return S.favoriteMeta[s] || {
        note: "",
        tags: []
    }
}

function saveFavoriteMeta(s, n, t) {
    S.favoriteMeta[s] = {
        note: n || "",
        tags: t || []
    };
    save("fce_favorite_meta", S.favoriteMeta)
}

function normalizeTags(v) {
    return [...new Set(String(v || "").split(",").map(x => x.trim()).filter(Boolean))].slice(0, 8)
}

function officialUrl(s) {
    return `https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(s)}`
}

function establishmentStatus(e) {
    return (e.etat_administratif || e.etat_administratif_etablissement || "").toUpperCase()
}

function filteredEstablishments(c, m) {
    const a = c.matchingEstablishments || [];
    if (m === "active") return a.filter(e => establishmentStatus(e) === "A");
    if (m === "closed") return a.filter(e => establishmentStatus(e) === "C");
    return a
}

async function resolveCityCode(name) {
    if (!name) return "";
    const url = new URL(GEO_API);
    url.searchParams.set("nom", name);
    url.searchParams.set("boost", "population");
    url.searchParams.set("fields", "nom,code,codesPostaux");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Commune introuvable");
    const items = await response.json();
    const exact = items.find(item => item.nom.localeCompare(name, "fr", {sensitivity: "base"}) === 0) || items[0];
    return exact?.code || "";
}

function validateAdvancedCriteria(criteria) {
    if (criteria.postalCode && !/^\d{5}(,\d{5})*$/.test(criteria.postalCode)) return "Le code postal doit contenir 5 chiffres.";
    if (criteria.naf && !/^\d{2}\.\d{2}[A-Z]$/.test(criteria.naf)) return "Le code NAF attendu suit le format 56.10A.";
    if (criteria.department && !/^(?:\d{2,3}|2A|2B)$/.test(criteria.department)) return "Le code département est invalide.";
    if (criteria.region && !/^\d{2}$/.test(criteria.region)) return "Le code région doit contenir 2 chiffres.";
    return "";
}

async function search(page, {recordHistory = page === 1} = {}) {
    const q = $("#queryInput").value.trim();
    const detected = detectQueryType(q);
    renderQueryHint();
    if (!q) return showState("Entre un terme de recherche.");
    if (!detected.valid) return showState(detected.label);
    const safePage = positiveInt(page, 1);
    const criteria = criteriaFromUi();
    const validationError = validateAdvancedCriteria(criteria);
    if (validationError) return showState(validationError);
    S.page = safePage;
    S.perPage = criteria.pageSize;
    const p = new URLSearchParams({
        q,
        page: String(safePage),
        per_page: String(S.perPage)
    });
    if (criteria.city && !criteria.cityCode) {
        showState("Validation de la commune…");
        try {
            criteria.cityCode = await resolveCityCode(criteria.city);
            if (!criteria.cityCode) return showState("Commune introuvable. Sélectionne une suggestion valide.");
            $("#cityCodeFilter").value = criteria.cityCode;
        } catch {
            return showState("Impossible de valider la commune. Réessaie ou sélectionne une suggestion.");
        }
    }
    if (criteria.postalCode) p.set("code_postal", criteria.postalCode);
    if (criteria.cityCode) p.set("code_commune", criteria.cityCode);
    if (criteria.status) p.set("etat_administratif", criteria.status);
    if (criteria.naf) p.set("activite_principale", criteria.naf);
    if (criteria.department) p.set("departement", criteria.department);
    if (criteria.region) p.set("region", criteria.region);
    if (criteria.workforce) p.set("tranche_effectif_salarie", criteria.workforce);
    searchController?.abort();
    searchController = new AbortController();
    const controller = searchController;
    const requestId = ++S.requestId;
    S.requestState = "loading";
    S.results = [];
    S.rawResults = [];
    S.total = 0;
    updateExportAvailability();
    showState("Recherche en cours…");
    $("#resultsGrid").innerHTML = "";
    $("#pagination").classList.add("hidden");
    try {
        const r = await fetch(`${API}?${p}`, {signal: controller.signal});
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (requestId !== S.requestId) return;
        S.rawResults = Array.isArray(d.results) ? d.results : [];
        S.results = [...S.rawResults];
        S.total = d.total_results ?? S.results.length;
        S.requestState = "success";
        S.lastSuccessfulCriteria = {...criteria, page: safePage};
        syncUrl();
        sortResults();
        if (recordHistory) addHistory({...criteria, at: new Date().toISOString()});
        $("#resultsTitle").textContent = `Résultats pour “${q}”`;
        $("#resultCount").textContent = `${S.total} résultat(s)`;
        $("#searchState").classList.add("hidden");
        renderResults();
        renderPagination();
        renderStats();
        renderActiveFilters();
        updateExportAvailability();
    } catch (error) {
        if (error.name === "AbortError") return;
        if (requestId !== S.requestId) return;
        S.requestState = "error";
        S.results = [];
        S.rawResults = [];
        S.total = 0;
        updateExportAvailability();
        $("#resultCount").textContent = "Erreur API";
        showState("Impossible de joindre l'API. Réessaie dans quelques instants.")
    } finally {
        if (searchController === controller) searchController = null;
    }
}

function norm(x) {
    const s = x.siege || {};
    return {
        siren: x.siren || "—",
        name: x.nom_complet || x.nom_raison_sociale || x.nom || "Entreprise sans nom",
        activity: x.activite_principale || s.activite_principale || "Non renseignée",
        activityLabel: x.libelle_activite_principale || "Activité non renseignée",
        status: x.etat_administratif || s.etat_administratif || "",
        creation: x.date_creation || "Non renseignée",
        legal: x.nature_juridique || "Non renseignée",
        category: x.categorie_entreprise || "Non renseignée",
        workforce: x.tranche_effectif_salarie || "Non renseigné",
        siret: s.siret || "Non renseigné",
        address: s.adresse || [s.numero_voie, s.type_voie, s.libelle_voie, s.code_postal, s.libelle_commune].filter(Boolean).join(" ") || "Adresse non renseignée",
        postalCode: s.code_postal || "",
        city: s.libelle_commune || "",
        matchingEstablishments: x.matching_etablissements || x.etablissements || []
    }
}

function statusView(value, closedLabel = "Cessée") {
    const code = String(value || "").toUpperCase();
    if (code === "A") return {code, label: "En activité", tone: "active"};
    if (code === "C") return {code, label: closedLabel, tone: "closed"};
    return {code: "", label: "Non renseigné", tone: "unknown"};
}

function favoriteButton(c, active, attribute = "data-fav") {
    const action = active ? "Retirer" : "Ajouter";
    const id = attribute === "data-detail-fav" ? ' id="detailFav"' : "";
    return `<button${id} type="button" class="fav ${active ? "active" : ""}" ${attribute}="${esc(c.siren)}" aria-pressed="${active}" aria-label="${action} ${esc(c.name)} ${active ? "des" : "aux"} favoris">♥</button>`;
}

function renderResults() {
    const root = $("#resultsGrid");
    if (!S.results.length) return showState("Aucune entreprise ne correspond à cette recherche.");
    root.innerHTML = S.results.map(raw => {
        const c = norm(raw),
            fav = S.favorites.some(x => x.siren === c.siren),
            status = statusView(c.status);
        return `<article class="company" data-testid="company-card-${c.siren}"><div class="company-top"><div><span class="status ${status.tone}">${status.label}</span><h3>${esc(c.name)}</h3><p class="muted">SIREN ${esc(c.siren)}</p></div>${favoriteButton(c, fav)}</div><div class="company-meta"><div class="meta-line"><b>Activité :</b> ${esc(c.activityLabel)}</div><div class="meta-line"><b>Siège :</b> ${esc(c.city||c.address)}</div><div class="meta-line"><b>Création :</b> ${esc(c.creation)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-detail="${c.siren}">Voir la fiche</button></div></article>`
    }).join("");
    root.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => openDetail(b.dataset.detail));
    root.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => toggleFav(b.dataset.fav));
    root.querySelectorAll("[data-compare]").forEach(b => b.onclick = () => addCompare(b.dataset.compare))
}

function renderPagination() {
    const max = Math.max(1, Math.ceil(S.total / S.perPage));
    $("#pageLabel").textContent = `Page ${S.page} / ${max}`;
    $("#prevPage").disabled = S.page <= 1;
    $("#nextPage").disabled = S.page >= max;
    $("#pagination").classList.toggle("hidden", S.total <= S.perPage)
}

function current(siren) {
    const r = S.results.find(x => String(x.siren) === String(siren));
    return r ? norm(r) : null
}
async function openDetail(siren) {
    let c = current(siren) || S.favorites.find(x => x.siren === siren);
    if (!c) {
        try {
            const r = await fetch(`${API}?q=${encodeURIComponent(siren)}&per_page=1`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            if (d.results?.[0]) c = norm(d.results[0])
        } catch {}
    }
    if (!c) return toast("Entreprise introuvable.");
    route("detail");
    renderDetail(c)
}

function renderEstablishments(c, mode = "all") {
    const root = $("#establishmentList");
    if (!root) return;
    const list = filteredEstablishments(c, mode);
    root.innerHTML = list.length ? list.map(e => { const status = statusView(establishmentStatus(e), "Fermé"); return `<div class="establishment"><b>${valueOrMissing(e.siret,"SIRET non renseigné")}</b><p>${valueOrMissing(e.adresse||e.libelle_commune,"Adresse non renseignée")}</p><span class="status ${status.tone}">${status.label}</span></div>`; }).join("") : `<p class="muted">Aucun établissement pour ce filtre.</p>`
}

function renderDetail(c) {
    const fav = S.favorites.some(x => x.siren === c.siren);
    const status = statusView(c.status);
    $("#detailRoot").innerHTML = `<section class="detail-hero"><article class="panel detail-main"><div class="detail-heading"><div><p class="eyebrow">ENTREPRISE</p><h1 class="detail-title">${esc(c.name)}</h1><p class="muted">${esc(c.activityLabel)}</p></div>${favoriteButton(c, fav, "data-detail-fav")}</div><div class="actions"><span class="status ${status.tone}">${status.label}</span><span class="pill">SIREN ${esc(c.siren)}</span></div></article><article class="panel detail-side"><p class="eyebrow">IDENTIFIANTS</p><dl class="definition"><div><dt>SIREN</dt><dd>${esc(c.siren)}</dd></div><div><dt>SIRET du siège</dt><dd>${esc(c.siret)}</dd></div><div><dt>Code activité</dt><dd>${esc(c.activity)}</dd></div></dl></article></section><section class="detail-grid"><article class="panel detail-section"><p class="eyebrow">SIÈGE SOCIAL</p><h3>${esc(c.city||"Localisation")}</h3><p>${esc(c.address)}</p><p class="muted">${esc(c.postalCode)}</p></article><article class="panel detail-section"><p class="eyebrow">STRUCTURE</p><dl class="definition"><div><dt>Catégorie</dt><dd>${esc(c.category)}</dd></div><div><dt>Nature juridique</dt><dd>${esc(c.legal)}</dd></div><div><dt>Effectif</dt><dd>${esc(c.workforce)}</dd></div></dl></article><article class="panel detail-section"><p class="eyebrow">CRÉATION</p><h3>${esc(c.creation)}</h3></article><article class="panel detail-section"><p class="eyebrow">ACTIONS</p><div class="actions"><button id="detailCompare" class="button secondary">Comparer</button><button id="copySiren" class="button">Copier le SIREN</button><a class="official-link" href="${officialUrl(c.siren)}" target="_blank" rel="noopener">Voir sur l’Annuaire des Entreprises ↗</a></div></article><article class="panel detail-section" style="grid-column:1/-1"><p class="eyebrow">ÉTABLISSEMENTS</p><div class="establishment-toolbar"><button class="button secondary active" data-est-filter="all">Tous</button><button class="button secondary" data-est-filter="active">Actifs</button><button class="button secondary" data-est-filter="closed">Fermés</button></div><div id="establishmentList" class="establishments"></div></article></section>`;
    $("[data-detail-fav]").onclick = () => { toggleFav(c.siren); renderDetail(c); };
    $("#detailCompare").onclick = () => addCompare(c.siren);
    $("#copySiren").onclick = async () => {
        await navigator.clipboard.writeText(c.siren);
        toast("SIREN copié.")
    };
    renderEstablishments(c, "all");
    $$("[data-est-filter]").forEach(b => b.onclick = () => {
        $$("[data-est-filter]").forEach(x => x.classList.toggle("active", x === b));
        renderEstablishments(c, b.dataset.estFilter)
    })
}

function toggleFav(siren) {
    const old = S.favorites.find(x => x.siren === siren);
    if (old) {
        S.favorites = S.favorites.filter(x => x.siren !== siren);
        delete S.favoriteMeta[siren];
        save("fce_favorite_meta", S.favoriteMeta);
        toast("Retiré des favoris.")
    } else {
        const c = current(siren);
        if (!c) return;
        S.favorites.push(c);
        toast("Ajouté aux favoris.")
    }
    save("fce_favorites", S.favorites);
    if (!$("#searchView").classList.contains("hidden")) renderResults();
    if (!$("#favoritesView").classList.contains("hidden")) renderFavorites()
}

function renderFavorites() {
    const root = $("#favoritesGrid");
    if (!S.favorites.length) {
        root.innerHTML = '<div class="state">Aucun favori pour le moment.</div>';
        return
    }
    root.innerHTML = S.favorites.map(c => `<article class="company"><div class="company-top"><div><h3>${esc(c.name)}</h3><p class="muted">SIREN ${esc(c.siren)}</p></div>${favoriteButton(c, true, "data-remove")}</div><div class="company-meta"><div class="meta-line">${esc(c.activityLabel)}</div><div class="meta-line">${esc(c.city||c.address)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-open="${c.siren}">Voir la fiche</button></div></article>`).join("");
    root.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => toggleFav(b.dataset.remove));
    root.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openDetail(b.dataset.open));
    root.querySelectorAll("[data-compare]").forEach(b => b.onclick = () => addCompare(b.dataset.compare))
}

function addHistory(e) {
    const identity = searchIdentity(e);
    S.history = [e, ...S.history.filter(x => searchIdentity({...criteriaDefaults(), ...x}) !== identity)].slice(0, 12);
    save("fce_history", S.history)
}

function criteriaDefaults() {
    return {query: "", postalCode: "", city: "", cityCode: "", status: "", naf: "", department: "", region: "", workforce: "", pageSize: 20, sort: "relevance"};
}

function applyCriteria(criteria) {
    const c = {...criteriaDefaults(), ...criteria};
    $("#queryInput").value = c.query;
    $("#postalCodeFilter").value = c.postalCode;
    $("#cityFilter").value = c.city;
    $("#cityCodeFilter").value = c.cityCode;
    $("#statusFilter").value = c.status;
    $("#nafFilter").value = c.naf;
    $("#departmentFilter").value = c.department;
    $("#regionFilter").value = c.region;
    $("#workforceFilter").value = c.workforce;
    $("#pageSizeFilter").value = String(c.pageSize || 20);
    $("#sortSelect").value = c.sort || "relevance";
}

function renderHistory() {
    const root = $("#historyList"),
        savedRoot = $("#savedSearchesList");
    if (!S.history.length) {
        root.innerHTML = '<div class="state">Aucune recherche enregistrée.</div>';
    } else {
        root.innerHTML = S.history.map((x, i) => `<article><div><p><b>${esc(x.query)}</b></p><small class="muted">${esc([x.postalCode,x.city,x.status ? `Statut ${x.status}` : "",x.naf ? `NAF ${x.naf}` : ""].filter(Boolean).join(" · ")||"Sans filtre")}</small></div><button class="button secondary" data-h="${i}">Relancer</button></article>`).join("");
    }
    root.querySelectorAll("[data-h]").forEach(b => b.onclick = () => {
        const x = S.history[+b.dataset.h];
        route("search");
        applyCriteria(x);
        search(1, {recordHistory: true})
    });
    savedRoot.innerHTML = S.saved.length ? S.saved.map((x, i) => `<article><div><p class="saved-name">${esc(x.name)}</p><small class="muted">${esc(x.query)}</small></div><div class="actions"><button class="button secondary" data-saved="${i}">Lancer</button><button class="button secondary" data-del-saved="${x.id}" aria-label="Supprimer la recherche ${esc(x.name)}">×</button></div></article>`).join("") : `<div class="state">Aucune recherche sauvegardée.</div>`;
    savedRoot.querySelectorAll("[data-saved]").forEach(b => b.onclick = () => {
        const x = S.saved[+b.dataset.saved];
        route("search");
        applyCriteria(x);
        search(1, {recordHistory: true})
    });
    savedRoot.querySelectorAll("[data-del-saved]").forEach(b => b.onclick = () => {
        S.saved = S.saved.filter(x => String(x.id) !== b.dataset.delSaved);
        save("fce_saved", S.saved);
        renderHistory()
    })
}

function addCompare(siren) {
    const c =
        current(siren) ||
        S.favorites.find(x => x.siren === siren);

    if (!c) {
        toast("Recherche d'abord cette entreprise.");
        return;
    }

    if (S.compare.some(x => x.siren === siren)) {
        toast("Déjà dans la comparaison.");
        route("compare");
        return;
    }

    if (S.compare.length >= 3) {
        toast(
            "La comparaison est limitée à trois entreprises."
        );
        route("compare");
        return;
    }

    S.compare.push(c);
    save("fce_compare", S.compare);
    toast("Ajoutée à la comparaison.");
    renderCompare();
}

function renderCompare() {
    const root = $("#compareRoot");
    if (!S.compare.length) {
        root.innerHTML = '<div class="state">Ajoute jusqu’à trois entreprises pour les comparer.</div>';
        return
    }
    root.innerHTML = `<div class="compare-picker">${S.compare.map((c,i)=>`<article class="compare-panel"><p class="eyebrow">ENTREPRISE ${i+1}</p><h3>${esc(c.name)}</h3><p class="muted">SIREN ${esc(c.siren)}</p><button class="button secondary" data-rm="${c.siren}" aria-label="Retirer ${esc(c.name)} de la comparaison">Retirer</button></article>`).join("")}${S.compare.length===1?'<article class="compare-panel"><p class="muted">Ajoute une seconde entreprise.</p></article>':""}</div>${S.compare.length>=2?tableMany(S.compare):""}`;
    root.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
        S.compare = S.compare.filter(x => x.siren !== b.dataset.rm);
        save("fce_compare", S.compare);
        renderCompare()
    })
}

function tableMany(items) {
    const defs = [
        ["SIREN", c => c.siren],
        ["Statut", c => statusView(c.status).label],
        ["Activité", c => c.activityLabel],
        ["Ville", c => c.city || "—"],
        ["Code postal", c => c.postalCode || "—"],
        ["Création", c => c.creation],
        ["Catégorie", c => c.category],
        ["Effectif", c => c.workforce]
    ];
    return `<div class="compare-scroll" tabindex="0" aria-label="Tableau comparatif défilable"><table class="compare-table"><thead><tr><th>Critère</th>${items.map(c=>`<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${defs.map(([label,get])=>{ const values = items.map(get); const differs = new Set(values.map(String)).size > 1; return `<tr><th>${label}${differs ? ' <span class="sr-only">— valeurs différentes</span><span aria-hidden="true"> ≠</span>' : ""}</th>${values.map(value=>`<td>${valueOrMissing(value)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>`
}

function updateExportAvailability() {
    const button = $("#openExportBtn");
    if (button) button.disabled = S.requestState === "loading";
}

async function shareCurrentSearch() {
    syncUrl();
    const url = location.href;
    try {
        await navigator.clipboard.writeText(url);
        toast("Lien de la recherche copié.");
    } catch {
        const area = document.createElement("textarea");
        area.value = url;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand("copy");
        area.remove();
        toast(copied ? "Lien de la recherche copié." : "Copie impossible : copie l’adresse depuis la barre du navigateur.");
    }
}

function closeSuggestions(rootId, inputId) {
    const root = $(rootId);
    const input = $(inputId);
    root.classList.add("hidden");
    root.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeSuggestion = -1;
}

function scheduleCompanySuggestions() {
    clearTimeout(autocompleteTimer);
    autocompleteController?.abort();
    const query = $("#queryInput").value.trim();
    if (query.length < 3 || /^\d+$/.test(query)) return closeSuggestions("#companySuggestions", "#queryInput");
    autocompleteTimer = setTimeout(() => loadCompanySuggestions(query), 300);
}

async function loadCompanySuggestions(query) {
    autocompleteController = new AbortController();
    const controller = autocompleteController;
    const root = $("#companySuggestions");
    root.innerHTML = '<div class="muted" role="status">Chargement des suggestions…</div>';
    root.classList.remove("hidden");
    $("#queryInput").setAttribute("aria-expanded", "true");
    try {
        const params = new URLSearchParams({q: query, per_page: "5", minimal: "true"});
        const response = await fetch(`${API}?${params}`, {signal: controller.signal});
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (controller !== autocompleteController || $("#queryInput").value.trim() !== query) return;
        const items = (data.results || []).map(norm);
        if (!items.length) {
            root.innerHTML = '<div class="muted" role="status">Aucune suggestion.</div>';
            return;
        }
        root.innerHTML = items.map((c, index) => `<button type="button" role="option" id="company-option-${index}" aria-selected="false" data-suggestion-index="${index}"><b>${esc(c.name)}</b><br><small>SIREN ${esc(c.siren)}${c.city ? ` · ${esc(c.city)}` : ""}</small></button>`).join("");
        root.querySelectorAll("[data-suggestion-index]").forEach(button => button.onclick = () => selectCompanySuggestion(items[Number(button.dataset.suggestionIndex)]));
        root._items = items;
    } catch (error) {
        if (error.name !== "AbortError") root.innerHTML = '<div class="muted" role="status">Suggestions indisponibles. La recherche classique reste disponible.</div>';
    }
}

function selectCompanySuggestion(company) {
    $("#queryInput").value = company.name;
    closeSuggestions("#companySuggestions", "#queryInput");
    search(1, {recordHistory: true});
}

function moveSuggestion(delta, rootId, inputId, selector) {
    const options = [...$(rootId).querySelectorAll(selector)];
    if (!options.length) return;
    activeSuggestion = (activeSuggestion + delta + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute("aria-selected", String(index === activeSuggestion)));
    $(inputId).setAttribute("aria-activedescendant", options[activeSuggestion].id);
    options[activeSuggestion].scrollIntoView({block: "nearest"});
}

function handleSuggestionKeys(event) {
    const root = $("#companySuggestions");
    if (event.key === "Escape") return closeSuggestions("#companySuggestions", "#queryInput");
    if (root.classList.contains("hidden")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(event.key === "ArrowDown" ? 1 : -1, "#companySuggestions", "#queryInput", "[role=option]");
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
        event.preventDefault();
        const items = root._items || [];
        if (items[activeSuggestion]) selectCompanySuggestion(items[activeSuggestion]);
    }
}

function scheduleCitySuggestions() {
    clearTimeout(cityTimer);
    cityController?.abort();
    $("#cityCodeFilter").value = "";
    const query = $("#cityFilter").value.trim();
    if (query.length < 2) return closeSuggestions("#citySuggestions", "#cityFilter");
    cityTimer = setTimeout(() => loadCitySuggestions(query), 250);
}

async function loadCitySuggestions(query) {
    cityController = new AbortController();
    const controller = cityController;
    try {
        const url = new URL(GEO_API);
        url.searchParams.set("nom", query);
        url.searchParams.set("boost", "population");
        url.searchParams.set("fields", "nom,code,codesPostaux,departement,region");
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) throw new Error();
        const items = (await response.json()).slice(0, 8);
        if (controller !== cityController || $("#cityFilter").value.trim() !== query) return;
        citySuggestionItems = items;
        const root = $("#citySuggestions");
        root.innerHTML = items.length ? items.map((city, index) => `<button type="button" role="option" id="city-option-${index}" aria-selected="false" data-city-index="${index}"><b>${esc(city.nom)}</b> <small>${esc(city.code)} · ${(city.codesPostaux || []).map(esc).join(", ")}</small></button>`).join("") : '<span class="muted" role="status">Aucune commune trouvée.</span>';
        root.classList.remove("hidden");
        $("#cityFilter").setAttribute("aria-expanded", "true");
        activeSuggestion = -1;
        root.querySelectorAll("[data-city-index]").forEach(button => button.onclick = () => selectCitySuggestion(items[Number(button.dataset.cityIndex)]));
    } catch (error) {
        if (error.name !== "AbortError") closeSuggestions("#citySuggestions", "#cityFilter");
    }
}

function selectCitySuggestion(city) {
    $("#cityFilter").value = city.nom;
    $("#cityCodeFilter").value = city.code;
    closeSuggestions("#citySuggestions", "#cityFilter");
    renderActiveFilters();
}

function handleCitySuggestionKeys(event) {
    const root = $("#citySuggestions");
    if (event.key === "Escape") return closeSuggestions("#citySuggestions", "#cityFilter");
    if (root.classList.contains("hidden")) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveSuggestion(event.key === "ArrowDown" ? 1 : -1, "#citySuggestions", "#cityFilter", "[role=option]");
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
        event.preventDefault();
        if (citySuggestionItems[activeSuggestion]) selectCitySuggestion(citySuggestionItems[activeSuggestion]);
    }
}

$("#exportScope").addEventListener("change", () => {
    const scope = $("#exportScope").value;
    $("#confirmExportBtn").disabled = scope === "results" ? !(S.requestState === "success" && S.results.length) : !S.compare.length;
});

document.addEventListener("click", event => {
    if (!event.target.closest("#queryInput, #companySuggestions")) closeSuggestions("#companySuggestions", "#queryInput");
    if (!event.target.closest("#cityFilter, #citySuggestions")) closeSuggestions("#citySuggestions", "#cityFilter");
});

function showState(m) {
    $("#searchState").textContent = m;
    $("#searchState").classList.remove("hidden")
}
showState("Saisis un nom, un SIREN ou un mot-clé.");
const restored = restoreFromUrl();
if (restored.hasQuery) {
    route("search");
    search(restored.page)
} else {
    route("home")
}

window.addEventListener("popstate", () => {
    const r = restoreFromUrl();
    if (r.hasQuery) {
        route("search");
        search(r.page || 1)
    } else route("home")
});
