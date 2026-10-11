import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureTransport, mountApp, settle, until } from "./harness.js";

let app;
afterEach(async () => {
    await settle(5);
    app?.close();
    app = null;
});

describe("sélecteurs v1.1.1 conservés (compatibilité Playwright)", () => {
    const LEGACY_IDS = [
        "themeToggle",
        "homeView",
        "randomDemoBtn",
        "searchView",
        "searchForm",
        "queryInput",
        "companySuggestions",
        "queryHint",
        "postalCodeFilter",
        "cityFilter",
        "cityCodeFilter",
        "citySuggestions",
        "nafFilter",
        "departmentFilter",
        "regionFilter",
        "workforceFilter",
        "statusFilter",
        "pageSizeFilter",
        "resultsTitle",
        "resultCount",
        "clearSearchBtn",
        "sortSelect",
        "saveSearchBtn",
        "shareSearchBtn",
        "openExportBtn",
        "statsPanel",
        "activeFilters",
        "searchState",
        "resultsGrid",
        "pagination",
        "prevPage",
        "pageLabel",
        "nextPage",
        "detailView",
        "detailRoot",
        "favoritesView",
        "clearFavoritesBtn",
        "favoritesGrid",
        "compareView",
        "compareRoot",
        "historyView",
        "clearHistoryBtn",
        "historyList",
        "savedSearchesList",
        "exportDialog",
        "exportDialogTitle",
        "exportFormat",
        "exportScope",
        "exportHelp",
        "confirmExportBtn",
        "toast"
    ];
    const LEGACY_TESTIDS = ["search-form", "query-input", "search-button", "sort-select", "results-stats", "active-filters", "results-grid"];
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    it.each(LEGACY_IDS)("id #%s présent", id => expect(html).toContain(`id="${id}"`));
    it.each(LEGACY_TESTIDS)("data-testid %s présent", id => expect(html).toContain(`data-testid="${id}"`));

    it("les identifiants dynamiques v1 sont produits (detailFav, detailCompare, copySiren, establishmentList, options)", async () => {
        app = mountApp({ path: "?view=detail&siren=900000001" });
        await settle();
        for (const id of ["detailFav", "detailCompare", "copySiren", "establishmentList"]) expect(app.$(`#${id}`), id).not.toBeNull();
        expect(app.$("[data-detail-fav]")).not.toBeNull();
        expect(app.$$("[data-est-filter]")).toHaveLength(3);
    });

    it("aucun style inline ni gestionnaire inline (CSP)", () => {
        expect(html).not.toMatch(/\sstyle="/);
        expect(html).not.toMatch(/\son[a-z]+="/);
        expect(html).toContain("Content-Security-Policy");
        expect(html).not.toContain("fonts.googleapis.com");
    });
});

describe("navigation", () => {
    it("pushState : le bouton Précédent revient à la vue précédente (#16)", async () => {
        app = mountApp();
        app.click("#mainNav [data-route=favorites]");
        app.click("#mainNav [data-route=history]");
        expect(app.win.location.search).toBe("?view=history");
        expect(app.$("#mainNav [data-route=history]").getAttribute("aria-current")).toBe("page");
        app.win.history.back();
        await until(() => app.visible("#favoritesView"));
        expect(app.doc.title).toBe("Favoris · French Companies Explorer");
        expect(app.text("#routeAnnouncer")).toBe("Page : Favoris");
    });

    it("boutons de démonstration et exemple aléatoire", async () => {
        app = mountApp();
        app.click("[data-query='Renault']");
        await settle();
        expect(app.$("#queryInput").value).toBe("Renault");
        expect(app.stored("history")[0].query).toBe("Renault");
        app.click(".brand");
        app.click("#randomDemoBtn");
        await settle();
        expect(app.$("#queryInput").value).toBe("La Poste");
    });

    it("menu mobile accessible (#24)", () => {
        app = mountApp();
        app.click("#menuToggle");
        expect(app.$("#mainNav").classList.contains("open")).toBe(true);
        expect(app.$("#menuToggle").getAttribute("aria-expanded")).toBe("true");
        app.click("#mainNav [data-route=about]");
        expect(app.$("#mainNav").classList.contains("open")).toBe(false);
    });

    it("raccourcis clavier, désactivables et inactifs dans les champs (N-12)", async () => {
        app = mountApp();
        app.key("g");
        app.key("f");
        expect(app.visible("#favoritesView")).toBe(true);
        app.key("/");
        expect(app.visible("#searchView")).toBe(true);
        expect(app.doc.activeElement.id).toBe("queryInput");
        app.key("g", app.$("#queryInput"));
        app.key("h", app.$("#queryInput"));
        expect(app.visible("#searchView")).toBe(true);
        app.$("#queryInput").blur();
        app.key("?");
        expect(app.$("#shortcutsDialog").hasAttribute("open")).toBe(true);
        app.key("g");
        app.key("h");
        expect(app.visible("#searchView")).toBe(true);
        app.$("#shortcutsDialog").close();
        app.click("#preferencesBtn");
        app.$("#prefShortcuts").checked = false;
        app.$("#preferencesDialog").dispatchEvent(new app.win.Event("change"));
        app.$("#preferencesDialog").close();
        app.key("g");
        app.key("h");
        expect(app.visible("#historyView")).toBe(false);
        expect(app.stored("prefs").shortcuts).toBe(false);
    });
});

describe("préférences, thème et langue (N-13, N-14)", () => {
    it("applique thème, contraste, densité, animations et taille de texte", () => {
        app = mountApp();
        const root = app.doc.documentElement;
        expect(root.dataset.theme).toBe("light");
        app.click("#themeToggle");
        expect(root.dataset.theme).toBe("dark");
        expect(app.$("#themeToggle").getAttribute("aria-pressed")).toBe("true");
        app.click("#preferencesBtn");
        expect(app.$("#prefTheme").value).toBe("dark");
        for (const [sel, value] of [
            ["#prefContrast", "high"],
            ["#prefDensity", "compact"],
            ["#prefMotion", "reduced"],
            ["#prefFontScale", "125"],
            ["#prefTheme", "system"]
        ]) {
            app.$(sel).value = value;
        }
        app.$("#preferencesDialog").dispatchEvent(new app.win.Event("change"));
        expect(root.dataset).toMatchObject({ contrast: "high", density: "compact", motion: "reduced", fontScale: "125", theme: "light" });
        app.click("#openShortcutsBtn");
        expect(app.$("#shortcutsDialog").hasAttribute("open")).toBe(true);
    });

    it("passe en anglais, traduit l'interface statique et dynamique, puis revient", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("#langSwitch");
        expect(app.doc.documentElement.lang).toBe("en");
        expect(app.text("[data-testid=search-button]")).toBe("Search");
        expect(app.text("#resultCount")).toBe("4 results");
        expect(app.$("#queryInput").getAttribute("placeholder")).toContain("e.g.");
        expect(app.$("[data-testid=search-button]").dataset.testid).toBe("search-button");
        expect(app.stored("prefs").lang).toBe("en");
        app.click("#langSwitch");
        expect(app.text("[data-testid=search-button]")).toBe("Rechercher");
    });

    it("respecte ?lang=en et le français par défaut", async () => {
        app = mountApp({ path: "?lang=en&view=about" });
        expect(app.text("#aboutView h2")).toBe("About and release notes");
        await settle();
        app.close();
        app = mountApp();
        expect(app.doc.documentElement.lang).toBe("fr");
    });

    it("affiche la bannière hors ligne", () => {
        app = mountApp({ online: false });
        expect(app.visible("#offlineBanner")).toBe(true);
        Object.defineProperty(app.win.navigator, "onLine", { value: true, configurable: true });
        app.win.dispatchEvent(new app.win.Event("online"));
        expect(app.visible("#offlineBanner")).toBe(false);
    });
});

describe("autocomplétion", () => {
    it("propose des entreprises, navigue au clavier et lance la recherche", async () => {
        app = mountApp({ path: "?view=search" });
        app.type("#queryInput", "atel");
        await until(() => app.$$("#companySuggestions [role=option]").length === 1, 2000);
        const input = app.$("#queryInput");
        expect(input.getAttribute("aria-expanded")).toBe("true");
        app.key("ArrowDown", input);
        expect(input.getAttribute("aria-activedescendant")).toBe("company-option-0");
        app.key("Enter", input);
        await settle();
        expect(input.value).toBe("ATELIER PLAYWRIGHT");
        expect(app.$$("#resultsGrid .company")).toHaveLength(1);
    });

    it("régression #11 : index actif indépendant entre entreprise et commune", async () => {
        app = mountApp({ path: "?view=search" });
        app.type("#queryInput", "pari");
        await until(() => app.$$("#companySuggestions [role=option]").length > 1, 2000);
        app.key("ArrowDown", app.$("#queryInput"));
        app.key("ArrowDown", app.$("#queryInput"));
        app.type("#cityFilter", "pa");
        await until(() => app.$$("#citySuggestions [role=option]").length === 1, 2000);
        app.key("ArrowDown", app.$("#cityFilter"));
        expect(app.$("#cityFilter").getAttribute("aria-activedescendant")).toBe("city-option-0");
        app.key("Enter", app.$("#cityFilter"));
        expect(app.$("#cityCodeFilter").value).toBe("75056");
        expect(app.$$("[data-remove-filter=city]")).toHaveLength(1);
        app.key("Escape", app.$("#queryInput"));
        expect(app.visible("#companySuggestions")).toBe(false);
    });

    it("ferme la liste au clic extérieur, ignore les identifiants et signale l'absence de résultat", async () => {
        app = mountApp({ path: "?view=search" });
        app.type("#queryInput", "356000000");
        await settle(20);
        expect(app.visible("#companySuggestions")).toBe(false);
        app.type("#queryInput", "zzzz");
        await until(() => app.text("#companySuggestions") === "Aucune suggestion.", 2000);
        app.doc.body.click();
        expect(app.visible("#companySuggestions")).toBe(false);
        app.type("#cityFilter", "zz");
        await until(() => app.text("#citySuggestions") === "Aucune commune trouvée.", 2000);
    });

    it("affiche un message si les suggestions échouent", async () => {
        const { transport } = fixtureTransport(url => (url.includes("minimal=true") ? { status: 500, body: {} } : null));
        app = mountApp({ path: "?view=search", transport });
        app.type("#queryInput", "atel");
        await until(() => app.text("#companySuggestions").includes("indisponibles"), 2000);
    });
});

describe("à proximité (N-6)", () => {
    it("recherche autour d'une commune et trie par distance", async () => {
        app = mountApp({ path: "?view=nearby" });
        expect(app.text("#nearbyState")).toContain("Choisis une commune");
        app.submit("#nearbyForm");
        await settle();
        app.type("#nearbyPlaceInput", "Par");
        await until(() => app.$$("#nearbyPlaceSuggestions [role=option]").length === 1, 2000);
        app.$("#nearbyPlaceSuggestions [role=option]").click();
        expect(app.text("#nearbyPoint")).toContain("Paris");
        app.type("#nearbyRadius", "5");
        app.submit("#nearbyForm");
        await settle();
        const distances = app.$$("[data-testid=result-distance]").map(d => d.textContent);
        expect(distances.length).toBeGreaterThan(2);
        expect(app.win.location.search).toContain("view=nearby&lat=48.8589&lon=2.347");
        expect(app.$("[data-testid=result-osm-link]").getAttribute("href")).toMatch(/^https:\/\/www\.openstreetmap\.org/);
        expect(app.text("#nearbyCount")).toMatch(/résultats?/);
    });

    it("utilise la géolocalisation arrondie à ~1 km, sans la stocker", async () => {
        app = mountApp({ path: "?view=nearby" });
        Object.defineProperty(app.win.navigator, "geolocation", {
            value: { getCurrentPosition: success => success({ coords: { latitude: 48.856613, longitude: 2.352222 } }) },
            configurable: true
        });
        app.click("#nearbyLocateBtn");
        expect(app.text("#nearbyPoint")).toContain("48.86, 2.35");
        app.submit("#nearbyForm");
        await settle();
        expect(app.win.location.search).toContain("lat=48.86&lon=2.35");
        expect(JSON.stringify({ ...app.win.localStorage })).not.toContain("48.86");
    });

    it("gère refus de géolocalisation, absence de support et NAF invalide", async () => {
        app = mountApp({ path: "?view=nearby&lat=48.85&lon=2.34" });
        await settle();
        Object.defineProperty(app.win.navigator, "geolocation", { value: { getCurrentPosition: (_, fail) => fail({ code: 1 }) }, configurable: true });
        app.click("#nearbyLocateBtn");
        expect(app.text("#nearbyState")).toContain("refusée");
        Object.defineProperty(app.win.navigator, "geolocation", { value: undefined, configurable: true });
        app.click("#nearbyLocateBtn");
        expect(app.text("#nearbyState")).toContain("ne permet pas");
        app.type("#nearbyNaf", "abc");
        app.submit("#nearbyForm");
        await settle();
        expect(app.text("#nearbyState")).toContain("56.10A");
    });

    it("affiche l'état vide et les erreurs", async () => {
        app = mountApp({ path: "?view=nearby&lat=0&lon=0" });
        await settle();
        expect(app.text("#nearbyState")).toBe("Aucune entreprise dans ce rayon.");
        app.close();
        const { transport } = fixtureTransport(() => ({ status: 400, body: {} }));
        app = mountApp({ path: "?view=nearby&lat=48&lon=2", transport });
        await settle();
        expect(app.text("#nearbyState")).toContain("400");
    });

    it("pagine les résultats de proximité", async () => {
        const many = Array.from({ length: 30 }, (_, i) => ({
            siren: `9${String(i).padStart(8, "0")}`,
            nom_complet: `E${i}`,
            siege: { latitude: "48.85", longitude: "2.35" }
        }));
        const { transport } = fixtureTransport(url => {
            const page = Number(new URL(url).searchParams.get("page"));
            return { status: 200, body: { results: many.slice((page - 1) * 25, page * 25), total_results: 30, total_pages: 2 } };
        });
        app = mountApp({ path: "?view=nearby&lat=48.85&lon=2.35", transport });
        await settle();
        expect(app.text("#nearbyPageLabel")).toBe("Page 1 / 2");
        app.click("#nearbyNext");
        await settle();
        expect(app.$$("#nearbyGrid .company")).toHaveLength(5);
        app.click("#nearbyPrev");
        await settle();
        expect(app.$$("#nearbyGrid .company")).toHaveLength(25);
    });
});

describe("à propos (N-15)", () => {
    it("affiche la version, les nouveautés et teste les API", async () => {
        app = mountApp({ path: "?view=about" });
        await settle();
        expect(app.text("[data-testid=about-version]")).toContain("2.0.0-test");
        expect(app.text("[data-testid=about-version]")).toContain("abcdef1234");
        expect(app.$$("#aboutNews li")).toHaveLength(9);
        app.click("#aboutApiCheckBtn");
        await until(() => app.$$("[data-api-ok]").length === 2);
        expect(app.$$("[data-api-ok=true]")).toHaveLength(2);
    });

    it("se replie sur la version embarquée et signale une API en erreur", async () => {
        const { transport } = fixtureTransport(url => (url.includes("geo.api") ? { status: 500, body: {} } : null));
        app = mountApp({ path: "?view=about", transport });
        app.win.fetch = async () => {
            throw new Error("offline");
        };
        app.click(".brand");
        app.click("#mainNav [data-route=about]");
        await settle();
        app.click("#aboutApiCheckBtn");
        await until(() => app.$$("[data-api-ok]").length === 2);
        expect(app.$$("[data-api-ok=false]")).toHaveLength(1);
    });
});

describe("migration v1.1.1", () => {
    it("reprend favoris, historique, recherches et thème de la v1", async () => {
        app = mountApp({
            storage: {
                fce_favorites: JSON.stringify([{ siren: "900000001", name: "BOULANGERIE V1", activityLabel: "Activité non renseignée", city: "PARIS" }]),
                fce_history: JSON.stringify([{ query: "boulangerie", postalCode: "75015", at: "2026-09-01T00:00:00.000Z" }]),
                fce_saved: JSON.stringify([{ id: 1695000000000, name: "Mes boulangeries", query: "boulangerie" }]),
                fce_theme: "dark"
            }
        });
        expect(app.doc.documentElement.dataset.theme).toBe("dark");
        app.click("#mainNav [data-route=favorites]");
        expect(app.text("#favoritesGrid h3")).toBe("BOULANGERIE V1");
        app.click("#mainNav [data-route=history]");
        expect(app.text("#historyList")).toContain("boulangerie");
        expect(app.text("#savedSearchesList")).toContain("Mes boulangeries");
    });
});

describe("fonctionnement sans stockage", () => {
    it("reste utilisable et prévient l'utilisateur", async () => {
        const { JSDOM } = await import("jsdom");
        const { init } = await import("../../src/app.js");
        const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");
        const dom = new JSDOM(html, { url: "http://localhost/?q=paris" });
        dom.window.HTMLDialogElement.prototype.showModal = function () {};
        dom.window.scrollTo = () => {};
        const { transport } = fixtureTransport();
        const instance = init({ win: dom.window, transport, rateLimit: false, storageBackend: null });
        await settle();
        dom.window.document.querySelector("[data-testid=company-card-900000001] [data-fav]").click();
        await settle(5);
        expect(dom.window.document.querySelector("#toast").textContent).toContain("Stockage du navigateur indisponible");
        expect(instance.store.get().favorites).toHaveLength(1);
        dom.window.close();
    });
});

describe("limiteur de débit intégré", () => {
    it("espace les requêtes vers l'API Recherche d'entreprises", async () => {
        vi.useRealTimers();
        const { JSDOM } = await import("jsdom");
        const { init } = await import("../../src/app.js");
        const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");
        const dom = new JSDOM(html, { url: "http://localhost/?q=*&size=10" });
        dom.window.scrollTo = () => {};
        const times = [];
        const { transport } = fixtureTransport(() => {
            times.push(Date.now());
            return null;
        });
        const instance = init({ win: dom.window, transport });
        await until(() => times.length === 1);
        instance.views.search.render();
        dom.window.document.querySelector("#analyticsPages").value = "2";
        dom.window.document.querySelector("#analyticsRunBtn").click();
        await until(() => times.length === 2);
        expect(times[1] - times[0]).toBeGreaterThanOrEqual(150);
        dom.window.close();
    });
});
