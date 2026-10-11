import { afterEach, describe, expect, it } from "vitest";
import { fixtureTransport, mountApp, settle, until } from "./harness.js";

let app;
afterEach(async () => {
    await settle(5);
    app?.close();
    app = null;
});

async function searchFor(query, extra = () => {}) {
    app.click("#mainNav [data-route=search]");
    app.type("#queryInput", query);
    extra();
    app.submit("#searchForm");
    await settle();
}

describe("recherche", () => {
    it("affiche des cartes, le compteur, les stats et met à jour l'URL et l'historique", async () => {
        app = mountApp();
        await searchFor("paris");
        expect(app.$$("#resultsGrid .company")).toHaveLength(4);
        expect(app.text("#resultCount")).toBe("4 résultats");
        expect(app.text("#resultsTitle")).toBe("Résultats pour “paris”");
        expect(app.visible("#statsPanel")).toBe(true);
        expect(app.win.location.search).toBe("?q=paris");
        expect(app.stored("history")[0].query).toBe("paris");
        expect(app.visible("#searchState")).toBe(false);
        expect(app.$("#openExportBtn").disabled).toBe(false);
    });

    it("restaure une recherche depuis une URL v1.1.1 sans l'ajouter à l'historique", async () => {
        app = mountApp({ path: "?q=paris&status=A&sort=name-asc&size=10" });
        await settle();
        expect(app.visible("#searchView")).toBe(true);
        expect(app.$("#statusFilter").value).toBe("A");
        expect(app.$("#sortSelect").value).toBe("name-asc");
        expect(app.$("#pageSizeFilter").value).toBe("10");
        const names = app.$$("#resultsGrid h3").map(h => h.textContent);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
        expect(app.stored("history")).toBeNull();
        expect(app.doc.activeElement).toBe(app.doc.body);
    });

    it("refuse une saisie invalide sans appeler l'API", async () => {
        app = mountApp();
        const { transport, calls } = fixtureTransport();
        app.close();
        app = mountApp({ transport });
        await searchFor("12345678");
        expect(calls).toHaveLength(0);
        expect(app.text("#searchState")).toContain("9 chiffres");
        expect(app.$("#queryHint").dataset.state).toBe("invalid-length");
        await searchFor("");
        expect(app.text("#searchState")).toBe("Entre un terme de recherche.");
    });

    it("signale une clé de Luhn invalide mais lance quand même la recherche", async () => {
        app = mountApp();
        await searchFor("900000002");
        expect(app.$("#queryHint").dataset.state).toBe("invalid-checksum");
        expect(app.text("#searchState")).toBe("Aucune entreprise ne correspond à cette recherche.");
    });

    it("valide les filtres avancés avant tout appel", async () => {
        const { transport, calls } = fixtureTransport();
        app = mountApp({ transport });
        await searchFor("paris", () => {
            app.type("#revenueMinFilter", "100");
            app.type("#revenueMaxFilter", "10");
        });
        expect(calls).toHaveLength(0);
        expect(app.text("#searchState")).toContain("CA minimum");
    });

    it("avertit qu'une recherche par identifiant ignore les filtres", async () => {
        app = mountApp();
        app.click("#mainNav [data-route=search]");
        app.type("#statusFilter", "A");
        app.type("#queryInput", "900000001");
        expect(app.visible("#identifierWarning")).toBe(true);
        app.type("#queryInput", "Boulangerie");
        expect(app.visible("#identifierWarning")).toBe(false);
    });

    it("applique les filtres étendus, affiche les puces et le compteur, puis les retire", async () => {
        app = mountApp();
        await searchFor("*", () => {
            app.type("#sectionFilter", "I");
            app.$("#labelFilters input[value=est_ess]").checked = true;
            app.$("#labelFilters input[value=est_ess]").dispatchEvent(new app.win.Event("change", { bubbles: true }));
        });
        expect(app.$$("#resultsGrid .company").map(c => c.dataset.siren)).toEqual(["900000050"]);
        expect(app.text("#advancedCount")).toBe("2 actifs");
        expect(app.$$("#activeFilters [data-remove-filter]").map(b => b.dataset.removeFilter)).toEqual(["section", "est_ess"]);
        expect(new URLSearchParams(app.win.location.search).get("labels")).toBe("est_ess");
        app.click("[data-remove-filter=est_ess]");
        await settle();
        expect(app.$$("#resultsGrid .company").length).toBeGreaterThan(1);
        app.click("#resetActiveFilters");
        await settle();
        expect(app.visible("#activeFilters")).toBe(false);
        expect(app.$("#sectionFilter").value).toBe("");
    });

    it("résout une commune saisie sans suggestion en code INSEE", async () => {
        const { transport, calls } = fixtureTransport();
        app = mountApp({ transport });
        await searchFor("paris", () => app.type("#cityFilter", "Paris"));
        expect(calls.some(u => u.includes("geo.api.gouv.fr"))).toBe(true);
        expect(app.$("#cityCodeFilter").value).toBe("75056");
        expect(new URLSearchParams(app.win.location.search).get("cityCode")).toBe("75056");
        await searchFor("paris", () => {
            app.type("#cityFilter", "Atlantide");
        });
        expect(app.text("#searchState")).toContain("Commune introuvable");
    });

    it("pagine et met à jour le libellé de page", async () => {
        app = mountApp({ path: "?q=*&size=10" });
        await settle();
        expect(app.text("#pageLabel")).toBe("Page 1 / 2");
        expect(app.$("#prevPage").disabled).toBe(true);
        app.click("#nextPage");
        await settle();
        expect(app.text("#pageLabel")).toBe("Page 2 / 2");
        expect(app.win.location.search).toContain("page=2");
        app.click("#prevPage");
        await settle();
        expect(app.text("#pageLabel")).toBe("Page 1 / 2");
    });

    it("trie côté client sans nouvel appel et conserve les dates manquantes en fin (#12)", async () => {
        const { transport, calls } = fixtureTransport();
        app = mountApp({ transport });
        await searchFor("paris");
        const before = calls.length;
        app.type("#sortSelect", "creation-newest");
        expect(calls.length).toBe(before);
        expect(app.$$("#resultsGrid .company").at(-1).dataset.siren).toBe("900000043");
        expect(app.win.location.search).toContain("sort=creation-newest");
    });

    it("bascule en vue tableau triable et filtre localement", async () => {
        app = mountApp();
        await searchFor("paris");
        app.click("#viewToggleBtn");
        expect(app.visible("#resultsTable")).toBe(true);
        expect(app.$("#viewToggleBtn").getAttribute("aria-pressed")).toBe("true");
        expect(app.stored("prefs").resultsView).toBe("table");
        app.$("#resultsTable th[aria-sort] button").click();
        expect(app.$("#resultsTable th[aria-sort=ascending]")).not.toBeNull();
        app.$("#resultsTable th[aria-sort=ascending] button").click();
        expect(app.$("#resultsTable th[aria-sort=descending]")).not.toBeNull();
        app.type("#localFilterInput", "café");
        expect(app.$$("#resultsTable tbody tr")).toHaveLength(1);
        expect(app.text("#localFilterStatus")).toBe("1 entreprise affichée");
        app.type("#localFilterInput", "zzz");
        expect(app.text("#searchState")).toContain("filtre local");
        app.$("#resultsTable").querySelector("[data-detail]");
        app.type("#localFilterInput", "");
        app.click("#viewToggleBtn");
        expect(app.visible("#resultsTable")).toBe(false);
    });

    it("réinitialise complètement la recherche", async () => {
        app = mountApp();
        await searchFor("paris", () => app.type("#statusFilter", "A"));
        app.click("#clearSearchBtn");
        expect(app.$("#queryInput").value).toBe("");
        expect(app.$("#statusFilter").value).toBe("");
        expect(app.$$("#resultsGrid .company")).toHaveLength(0);
        expect(app.text("#resultCount")).toBe("0 résultat");
        expect(app.win.location.search).toBe("?view=search");
    });

    it("change la taille de page en relançant la recherche", async () => {
        app = mountApp();
        app.type("#pageSizeFilter", "25");
        expect(app.win.location.search).toContain("size=25");
        await searchFor("*");
        app.type("#pageSizeFilter", "10");
        await settle();
        expect(app.$$("#resultsGrid .company")).toHaveLength(10);
    });
});

describe("erreurs réseau", () => {
    it.each([
        [400, "400"],
        [429, "429"],
        [503, "5xx"]
    ])("affiche un message dédié pour HTTP %i et propose Réessayer", async (status, fragment) => {
        let fail = true;
        const { transport } = fixtureTransport(() => (fail ? { status, body: {}, headers: status === 429 ? { "Retry-After": "0" } : {} } : null));
        app = mountApp({ transport });
        await searchFor("paris");
        await until(() => app.visible("#retryBtn"));
        expect(app.text("#searchState")).toContain(fragment);
        expect(app.text("#resultCount")).toBe("Erreur API");
        expect(app.visible("#retryBtn")).toBe(true);
        fail = false;
        app.click("#retryBtn");
        await settle();
        expect(app.$$("#resultsGrid .company")).toHaveLength(4);
        expect(app.visible("#retryBtn")).toBe(false);
    });

    it("distingue l'erreur réseau et la réponse illisible", async () => {
        const { transport } = fixtureTransport(url => {
            if (url.includes("q=reseau")) throw new TypeError("Failed to fetch");
            return { status: 200, body: "<html>" };
        });
        app = mountApp({ transport });
        await searchFor("reseau");
        await until(() => app.visible("#retryBtn"));
        expect(app.text("#searchState")).toContain("Impossible de joindre l’API");
        await searchFor("illisible");
        expect(app.text("#searchState")).toContain("illisible");
    });

    it("ignore une réponse obsolète quand une nouvelle recherche est lancée", async () => {
        let release;
        const { transport } = fixtureTransport(url =>
            url.includes("q=lente")
                ? new Promise(r => {
                      release = () => r(null);
                  })
                : null
        );
        app = mountApp({ transport });
        await searchFor("lente");
        await searchFor("paris");
        release();
        await settle();
        expect(app.text("#resultsTitle")).toBe("Résultats pour “paris”");
    });
});

describe("sécurité", () => {
    it("rend les contenus hostiles de l'API comme du texte (aucune balise injectée)", async () => {
        app = mountApp();
        await searchFor("societe");
        const card = app.$("[data-testid=company-card-900000076]");
        expect(card.querySelector("h3").textContent).toBe("Société <img src=x onerror=alert(1)> & Cie");
        expect(app.doc.querySelector("#resultsGrid img, #resultsGrid script")).toBeNull();
    });

    it("régression #1 : un favori stocké hostile est rejeté à la lecture", async () => {
        app = mountApp({
            storage: {
                "fce:v2:migrated": "x",
                "fce:v2:favorites": JSON.stringify([
                    { siren: '1" onmouseover="alert(1)', name: "x" },
                    { siren: "900000001", name: "<img src=x>" }
                ])
            }
        });
        app.click("#mainNav [data-route=favorites]");
        expect(app.$$("#favoritesGrid .company")).toHaveLength(1);
        expect(app.doc.querySelector("[onmouseover], #favoritesGrid img")).toBeNull();
        expect(app.text("#favoritesGrid h3")).toBe("<img src=x>");
    });

    it("régression #3 : un stockage corrompu ne casse pas l'application", async () => {
        app = mountApp({ storage: { fce_favorites: '"oops"', fce_history: "{", fce_theme: '"><img>' } });
        app.click("#mainNav [data-route=favorites]");
        expect(app.text("#favoritesGrid")).toContain("Aucun favori");
        expect(app.doc.documentElement.dataset.theme).toBe("light");
    });

    it("affiche un avertissement si le stockage est plein (#10)", async () => {
        app = mountApp();
        await searchFor("paris");
        app.win.Storage.prototype.setItem = () => {
            const e = new Error("full");
            e.name = "QuotaExceededError";
            throw e;
        };
        app.click("[data-testid=company-card-900000001] [data-fav]");
        await settle(5);
        expect(app.text("#toast")).toContain("Stockage du navigateur plein");
    });
});
