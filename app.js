const API = "https://recherche-entreprises.api.gouv.fr/search";
const S = {
    page: 1,
    perPage: 20,
    total: 0,
    results: [],
    favorites: load("fce_favorites", []),
    history: load("fce_history", []),
    compare: load("fce_compare", []),
    favoriteMeta: load("fce_favorite_meta", {}),
    saved: load("fce_saved", []),
    sort: "relevance",
    theme: localStorage.getItem("fce_theme") || "light"
};
let searchController = null;
const $ = s => document.querySelector(s),
    $$ = s => [...document.querySelectorAll(s)];
document.documentElement.dataset.theme = S.theme;

function updateThemeButton() {
    const b = $("#themeToggle");
    if (b) b.textContent = S.theme === "dark" ? "☀" : "☾"
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
    })
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
$("#queryInput").addEventListener("input", renderQueryHint);
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
$("#saveSearchBtn").onclick = saveCurrentSearch;
$("#exportJsonBtn").onclick = exportJson;
$("#exportCsvBtn").onclick = exportCsv;


function syncUrl() {
    const p = new URLSearchParams();
    const q = $("#queryInput").value.trim(),
        cp = $("#postalCodeFilter").value.trim(),
        city = $("#cityFilter").value.trim(),
        st = $("#statusFilter").value,
        sort = $("#sortSelect").value;
    if (q) p.set("q", q);
    if (cp) p.set("cp", cp);
    if (city) p.set("city", city);
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
    if (p.get("status")) $("#statusFilter").value = p.get("status");
    if (["10", "20", "25"].includes(p.get("size"))) $("#pageSizeFilter").value = p.get("size");
    const allowedSorts = ["relevance", "name-asc", "name-desc", "creation-newest", "creation-oldest", "status"];
    if (allowedSorts.includes(p.get("sort"))) $("#sortSelect").value = p.get("sort");
    return {
        hasQuery: !!p.get("q"),
        page: Number(p.get("page") || 1)
    };
}

function getVisibleCompanies() {
    return S.results.map(norm)
}

function sortResults() {
    const mode = $("#sortSelect")?.value || "relevance";
    S.sort = mode;
    if (mode === "relevance") return;
    const arr = [...S.results];
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
        closed = c.length - active,
        cities = new Set(c.map(x => x.city).filter(Boolean)).size,
        work = c.filter(x => x.workforce && x.workforce !== "Non renseigné").length,
        postal = c.filter(x => x.postalCode).length,
        oldest = c.map(x => x.creation).filter(x => /^\d{4}-\d{2}-\d{2}/.test(x)).sort()[0] || "—";
    root.innerHTML = `<div class="stats-extended"><article><span class="muted">Affichées</span><strong>${c.length}</strong></article><article><span class="muted">En activité</span><strong>${active}</strong><small class="muted">${closed} cessée(s)</small></article><article><span class="muted">Communes distinctes</span><strong>${cities}</strong><small class="muted">${postal} avec code postal</small></article><article><span class="muted">Effectif renseigné</span><strong>${work}</strong><small class="muted">Création la plus ancienne : ${esc(oldest)}</small></article></div>`;
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

function exportJson() {
    downloadFile("companies-results.json", "application/json;charset=utf-8", JSON.stringify(getVisibleCompanies(), null, 2))
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

function exportCsv() {
    const rows = [
        ["SIREN", "Nom", "Statut", "Activité", "Ville", "Code postal", "Création", "SIRET siège"]
    ];
    getVisibleCompanies().forEach(c => rows.push([c.siren, c.name, c.status, c.activityLabel, c.city, c.postalCode, c.creation, c.siret]));
    downloadFile("companies-results.csv", "text/csv;charset=utf-8", "\uFEFF" + rows.map(r => r.map(csvEscape).join(";")).join("\n"));
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

    if (!name) return;

    const entry = {
        id: Date.now(),
        name,
        query: q,
        postalCode:
            $("#postalCodeFilter").value.trim(),
        city:
            $("#cityFilter").value.trim(),
        status:
            $("#statusFilter").value,
        pageSize:
            +$("#pageSizeFilter").value || 20
    };

    const existingSearch = S.saved.find(saved =>
        saved.query === entry.query &&
        saved.postalCode === entry.postalCode &&
        saved.city === entry.city &&
        saved.status === entry.status &&
        saved.pageSize === entry.pageSize
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
    r.innerHTML = items.map(([k, l, v]) => `<span class="filter-chip">${l}: ${esc(v)} <button data-remove-filter="${k}" aria-label="Supprimer ${esc(l)}">×</button></span>`).join("") + `<button id="resetActiveFilters" class="button secondary">Réinitialiser les filtres</button>`;
    r.querySelectorAll("[data-remove-filter]").forEach(b => b.onclick = () => removeFilter(b.dataset.removeFilter));
    $("#resetActiveFilters").onclick = resetFiltersOnly
}

function removeFilter(k) {
    if (k === "cp") $("#postalCodeFilter").value = "";
    if (k === "city") $("#cityFilter").value = "";
    if (k === "status") $("#statusFilter").value = "";
    if (k === "size") $("#pageSizeFilter").value = "20";
    if (k === "sort" && $("#sortSelect")) $("#sortSelect").value = "relevance";
    renderActiveFilters();
    if ($("#queryInput").value.trim()) search(1);
    else syncUrl()
}

function resetFiltersOnly() {
    $("#postalCodeFilter").value = "";
    $("#cityFilter").value = "";
    $("#statusFilter").value = "";
    $("#pageSizeFilter").value = "20";
    if ($("#sortSelect")) $("#sortSelect").value = "relevance";
    renderActiveFilters();
    if ($("#queryInput").value.trim()) search(1);
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
    if (m === "closed") return a.filter(e => establishmentStatus(e) !== "A");
    return a
}

async function search(page) {
    const q = $("#queryInput").value.trim();
    const detected = detectQueryType(q);
    renderQueryHint();
    if (!q) return showState("Entre un terme de recherche.");
    if (!detected.valid) return showState(detected.label);
    S.page = page;
    S.perPage = +$("#pageSizeFilter").value || 20;
    const p = new URLSearchParams({
        q,
        page: String(page),
        per_page: String(S.perPage)
    });
    const cp = $("#postalCodeFilter").value.trim(),
        city = $("#cityFilter").value.trim(),
        st = $("#statusFilter").value;
    if (cp) p.set("code_postal", cp);
    if (city) p.set("commune", city);
    if (st) p.set("etat_administratif", st);
    searchController?.abort();
    searchController = new AbortController();
    const controller = searchController;
    showState("Recherche en cours…");
    $("#resultsGrid").innerHTML = "";
    $("#pagination").classList.add("hidden");
    try {
        const r = await fetch(`${API}?${p}`, {signal: controller.signal});
        if (!r.ok) throw new Error();
        const d = await r.json();
        S.results = d.results || [];
        S.total = d.total_results ?? S.results.length;
        syncUrl();
        sortResults();
        addHistory({
            query: q,
            postalCode: cp,
            city,
            status: st,
            at: new Date().toISOString()
        });
        $("#resultsTitle").textContent = `Résultats pour “${q}”`;
        $("#resultCount").textContent = `${S.total} résultat(s)`;
        $("#searchState").classList.add("hidden");
        renderResults();
        renderPagination();
        renderStats();
        renderActiveFilters();
    } catch (error) {
        if (error.name === "AbortError") return;
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

function renderResults() {
    const root = $("#resultsGrid");
    if (!S.results.length) return showState("Aucune entreprise ne correspond à cette recherche.");
    root.innerHTML = S.results.map(raw => {
        const c = norm(raw),
            fav = S.favorites.some(x => x.siren === c.siren);
        return `<article class="company" data-testid="company-card-${c.siren}"><div class="company-top"><div><span class="status ${c.status==="A"?"active":"closed"}">${c.status==="A"?"En activité":"Cessée"}</span><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p></div><button class="fav ${fav?"active":""}" data-fav="${c.siren}">♥</button></div><div class="company-meta"><div class="meta-line"><b>Activité :</b> ${esc(c.activityLabel)}</div><div class="meta-line"><b>Siège :</b> ${esc(c.city||c.address)}</div><div class="meta-line"><b>Création :</b> ${esc(c.creation)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-detail="${c.siren}">Voir la fiche</button></div></article>`
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
    root.innerHTML = list.length ? list.map(e => `<div class="establishment"><b>${valueOrMissing(e.siret,"SIRET non renseigné")}</b><p>${valueOrMissing(e.adresse||e.libelle_commune,"Adresse non renseignée")}</p><span class="status ${establishmentStatus(e)==="A"?"active":"closed"}">${establishmentStatus(e)==="A"?"En activité":"Fermé"}</span></div>`).join("") : `<p class="muted">Aucun établissement pour ce filtre.</p>`
}

function renderDetail(c) {
    const fav = S.favorites.some(x => x.siren === c.siren);
    $("#detailRoot").innerHTML = `<section class="detail-hero"><article class="panel detail-main"><div class="detail-heading"><div><p class="eyebrow">ENTREPRISE</p><h1 class="detail-title">${esc(c.name)}</h1><p class="muted">${esc(c.activityLabel)}</p></div><button id="detailFav" class="fav ${fav?"active":""}">♥</button></div><div class="actions"><span class="status ${c.status==="A"?"active":"closed"}">${c.status==="A"?"En activité":"Cessée"}</span><span class="pill">SIREN ${c.siren}</span></div></article><article class="panel detail-side"><p class="eyebrow">IDENTIFIANTS</p><dl class="definition"><div><dt>SIREN</dt><dd>${c.siren}</dd></div><div><dt>SIRET du siège</dt><dd>${esc(c.siret)}</dd></div><div><dt>Code activité</dt><dd>${esc(c.activity)}</dd></div></dl></article></section><section class="detail-grid"><article class="panel detail-section"><p class="eyebrow">SIÈGE SOCIAL</p><h3>${esc(c.city||"Localisation")}</h3><p>${esc(c.address)}</p><p class="muted">${esc(c.postalCode)}</p></article><article class="panel detail-section"><p class="eyebrow">STRUCTURE</p><dl class="definition"><div><dt>Catégorie</dt><dd>${esc(c.category)}</dd></div><div><dt>Nature juridique</dt><dd>${esc(c.legal)}</dd></div><div><dt>Effectif</dt><dd>${esc(c.workforce)}</dd></div></dl></article><article class="panel detail-section"><p class="eyebrow">CRÉATION</p><h3>${esc(c.creation)}</h3></article><article class="panel detail-section"><p class="eyebrow">ACTIONS</p><div class="actions"><button id="detailCompare" class="button secondary">Comparer</button><button id="copySiren" class="button">Copier le SIREN</button><a class="official-link" href="${officialUrl(c.siren)}" target="_blank" rel="noopener">Voir sur l’Annuaire des Entreprises ↗</a></div></article><article class="panel detail-section" style="grid-column:1/-1"><p class="eyebrow">ÉTABLISSEMENTS</p><div class="establishment-toolbar"><button class="button secondary active" data-est-filter="all">Tous</button><button class="button secondary" data-est-filter="active">Actifs</button><button class="button secondary" data-est-filter="closed">Fermés</button></div><div id="establishmentList" class="establishments"></div></article></section>`;
    $("#detailFav").onclick = () => toggleFav(c.siren);
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
    root.innerHTML = S.favorites.map(c => `<article class="company"><div class="company-top"><div><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p></div><button class="fav active" data-remove="${c.siren}">♥</button></div><div class="company-meta"><div class="meta-line">${esc(c.activityLabel)}</div><div class="meta-line">${esc(c.city||c.address)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-open="${c.siren}">Voir la fiche</button></div></article>`).join("");
    root.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => toggleFav(b.dataset.remove));
    root.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openDetail(b.dataset.open));
    root.querySelectorAll("[data-compare]").forEach(b => b.onclick = () => addCompare(b.dataset.compare))
}

function addHistory(e) {
    S.history = [e, ...S.history.filter(x => x.query !== e.query || x.postalCode !== e.postalCode || x.city !== e.city)].slice(0, 12);
    save("fce_history", S.history)
}

function renderHistory() {
    const root = $("#historyList"),
        savedRoot = $("#savedSearchesList");
    if (!S.history.length) {
        root.innerHTML = '<div class="state">Aucune recherche enregistrée.</div>';
    } else {
        root.innerHTML = S.history.map((x, i) => `<article><div><p><b>${esc(x.query)}</b></p><small class="muted">${esc([x.postalCode,x.city].filter(Boolean).join(" · ")||"Sans filtre géographique")}</small></div><button class="button secondary" data-h="${i}">Relancer</button></article>`).join("");
    }
    root.querySelectorAll("[data-h]").forEach(b => b.onclick = () => {
        const x = S.history[+b.dataset.h];
        route("search");
        $("#queryInput").value = x.query || "";
        $("#postalCodeFilter").value = x.postalCode || "";
        $("#cityFilter").value = x.city || "";
        $("#statusFilter").value = x.status || "";
        search(1)
    });
    savedRoot.innerHTML = S.saved.length ? S.saved.map((x, i) => `<article><div><p class="saved-name">${esc(x.name)}</p><small class="muted">${esc(x.query)}</small></div><div class="actions"><button class="button secondary" data-saved="${i}">Lancer</button><button class="button secondary" data-del-saved="${x.id}">×</button></div></article>`).join("") : `<div class="state">Aucune recherche sauvegardée.</div>`;
    savedRoot.querySelectorAll("[data-saved]").forEach(b => b.onclick = () => {
        const x = S.saved[+b.dataset.saved];
        route("search");
        $("#queryInput").value = x.query || "";
        $("#postalCodeFilter").value = x.postalCode || "";
        $("#cityFilter").value = x.city || "";
        $("#statusFilter").value = x.status || "";
        $("#pageSizeFilter").value = String(x.pageSize || 20);
        search(1)
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
    root.innerHTML = `<div class="compare-picker">${S.compare.map((c,i)=>`<article class="compare-panel"><p class="eyebrow">ENTREPRISE ${i+1}</p><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p><button class="button secondary" data-rm="${c.siren}">Retirer</button></article>`).join("")}${S.compare.length===1?'<article class="compare-panel"><p class="muted">Ajoute une seconde entreprise.</p></article>':""}</div>${S.compare.length>=2?tableMany(S.compare):""}`;
    root.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
        S.compare = S.compare.filter(x => x.siren !== b.dataset.rm);
        save("fce_compare", S.compare);
        renderCompare()
    })
}

function tableMany(items) {
    const defs = [
        ["SIREN", c => c.siren],
        ["Statut", c => c.status === "A" ? "En activité" : "Cessée"],
        ["Activité", c => c.activityLabel],
        ["Ville", c => c.city || "—"],
        ["Code postal", c => c.postalCode || "—"],
        ["Création", c => c.creation],
        ["Catégorie", c => c.category],
        ["Effectif", c => c.workforce]
    ];
    return `<table class="compare-table"><thead><tr><th>Critère</th>${items.map(c=>`<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${defs.map(([label,get])=>`<tr><th>${label}</th>${items.map(c=>`<td>${esc(get(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`
}

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
