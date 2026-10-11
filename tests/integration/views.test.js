import { afterEach, describe, expect, it } from "vitest";
import { fixtureTransport, mountApp, settle, until } from "./harness.js";

let app;
afterEach(async () => {
    await settle(5);
    app?.close();
    app = null;
});

describe("fiche entreprise (N-1)", () => {
    it("affiche finances, dirigeants, labels, TVA et établissements filtrables (A/F, #23)", async () => {
        app = mountApp({ path: "?view=detail&siren=900000001", clipboard: true });
        await settle();
        expect(app.text("#detailRoot h1")).toBe("BOULANGERIE DES TESTS");
        expect(app.$$("[data-testid=detail-finances-table] tbody tr")).toHaveLength(3);
        expect(app.$("[data-testid=detail-finances-chart]")).not.toBeNull();
        expect(app.text("[data-testid=detail-directors]")).toContain("TESTEUR Alice");
        expect(app.text("[data-testid=detail-labels]")).toContain("Bio");
        expect(app.text("[data-testid=detail-vat]")).toContain("FR68900000001");
        expect(app.$$("#establishmentList .establishment")).toHaveLength(3);
        app.click("[data-est-filter=closed]");
        expect(app.$$("#establishmentList .establishment")).toHaveLength(1);
        expect(app.text("#establishmentList")).toContain("Fermé");
        app.click("[data-est-filter=active]");
        expect(app.$$("#establishmentList .establishment")).toHaveLength(2);
        app.click("#copySiren");
        app.click("[data-testid=copy-vat]");
        await settle();
        expect(app.win.__clipboard).toEqual(["900000001", "FR68900000001"]);
        app.click("[data-testid=print-detail]");
        expect(app.win.__printed).toBe(true);
        expect(app.$(".official-link[href^='https://annuaire-entreprises']").getAttribute("rel")).toContain("noreferrer");
    });

    it("pagine les établissements au-delà de 10", async () => {
        const many = Array.from({ length: 23 }, (_, i) => ({
            siret: `900000001${String(i).padStart(5, "0")}`,
            adresse: `ADRESSE ${i}`,
            etat_administratif: i % 2 ? "F" : "A"
        }));
        const { transport } = fixtureTransport(url =>
            url.includes("q=900000001")
                ? {
                      status: 200,
                      body: {
                          results: [{ siren: "900000001", nom_complet: "MULTI", matching_etablissements: many, nombre_etablissements: 23 }],
                          total_results: 1
                      }
                  }
                : null
        );
        app = mountApp({ path: "?view=detail&siren=900000001", transport });
        await settle();
        expect(app.$$("#establishmentList .establishment")).toHaveLength(10);
        const pager = () => app.$("[data-testid=establishments-pagination]");
        pager().querySelectorAll("button")[1].click();
        expect(app.text("[data-testid=establishments-pagination] .pill")).toBe("Page 2 / 3");
        pager().querySelectorAll("button")[0].click();
        expect(app.text("[data-testid=establishments-pagination] .pill")).toBe("Page 1 / 3");
    });

    it("gère une entreprise sans données (mentions neutres) et un SIREN introuvable (#9)", async () => {
        app = mountApp({ path: "?view=detail&siren=900000118" });
        await settle();
        expect(app.text("[data-testid=detail-finances-empty]")).toBe("Aucune donnée financière publiée.");
        expect(app.text("#detailRoot")).not.toContain("undefined");
        expect(app.text("#detailRoot")).toContain("Non renseigné");
        app.close();
        app = mountApp({ path: "?view=detail&siren=356000000" });
        await settle();
        expect(app.text("[data-testid=detail-state]")).toBe("Entreprise introuvable.");
    });

    it("se replie sur l'instantané d'un favori si l'API échoue", async () => {
        const { transport } = fixtureTransport(() => ({ status: 404, body: {} }));
        const fav = { siren: "900000001", name: "BOULANGERIE (copie locale)", status: "A", lastRevenue: 1, lastFinanceYear: 2023 };
        app = mountApp({ path: "?view=detail&siren=900000001", transport, storage: { "fce:v2:migrated": "x", "fce:v2:favorites": JSON.stringify([fav]) } });
        await settle();
        expect(app.$("[data-testid=detail-cached]")).not.toBeNull();
        expect(app.text("#detailRoot h1")).toBe("BOULANGERIE (copie locale)");
        expect(app.text("[data-testid=detail-directors]")).toContain("jamais enregistrés");
    });

    it("régression #13 : favori et comparaison depuis une fiche ouverte hors des résultats", async () => {
        app = mountApp({ path: "?view=detail&siren=900000001" });
        await settle();
        app.click("#detailFav");
        expect(app.stored("favorites").map(f => f.siren)).toEqual(["900000001"]);
        expect(app.$("#detailFav").getAttribute("aria-pressed")).toBe("true");
        app.click("#detailCompare");
        expect(app.stored("compare").map(c => c.siren)).toEqual(["900000001"]);
        app.click("[data-testid=detail-directors] [data-detail]");
        await settle();
        expect(app.win.location.search).toContain("siren=900000019");
        expect(app.text("#detailRoot h1")).toBe("HOLDING ASSERTION");
    });

    it("ouvre la fiche depuis une carte et revient aux résultats avec le bouton Retour", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-detail]");
        await settle();
        expect(app.visible("#detailView")).toBe(true);
        expect(app.doc.activeElement.tagName).toBe("H1");
        app.click("#detailView > [data-route=search]");
        await settle();
        expect(app.visible("#searchView")).toBe(true);
        expect(app.$$("#resultsGrid .company")).toHaveLength(4);
    });
});

describe("favoris (N-4)", () => {
    async function withFavorites() {
        app = mountApp({ path: "?q=paris", clipboard: true });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=company-card-900000050] [data-fav]");
        app.click("#mainNav [data-route=favorites]");
    }

    it("ajoute/retire depuis les cartes sans persister de données personnelles", async () => {
        await withFavorites();
        expect(app.$$("#favoritesGrid .company")).toHaveLength(2);
        expect(JSON.stringify(app.stored("favorites"))).not.toContain("TESTEUR");
        app.click("[data-testid=favorite-card-900000050] [data-remove]");
        expect(app.$$("#favoritesGrid .company")).toHaveLength(1);
        expect(app.text("#toast")).toBe("Retiré des favoris.");
    });

    it("enregistre notes et tags, filtre par tag et par texte", async () => {
        await withFavorites();
        const card = sel => app.$(`[data-testid=favorite-card-900000001] ${sel}`);
        card("[data-testid=favorite-note]").value = "Fournisseur pain";
        card("[data-testid=favorite-tags]").value = "client, vip, client";
        card("[data-testid=favorite-save-meta]").click();
        expect(app.stored("favorite-meta")).toEqual({ 900000001: { note: "Fournisseur pain", tags: ["client", "vip"] } });
        expect(app.$$("#favoritesTagFilter option").map(o => o.value)).toEqual(["", "client", "vip"]);
        app.type("#favoritesTagFilter", "vip");
        expect(app.$$("#favoritesGrid .company")).toHaveLength(1);
        app.type("#favoritesTagFilter", "");
        app.type("#favoritesSearch", "pain");
        expect(app.$$("#favoritesGrid .company")).toHaveLength(1);
        app.type("#favoritesSearch", "introuvable");
        expect(app.text("#favoritesGrid")).toContain("Aucun favori ne correspond");
        app.type("#favoritesSearch", "");
        app.type("#favoritesSort", "name");
        expect(app.$$("#favoritesGrid h3").map(h => h.textContent)).toEqual(["BOULANGERIE DES TESTS", "RESTAURANT LE FLAKY"]);
        card("[data-testid=favorite-note]").value = "";
        card("[data-testid=favorite-tags]").value = "";
        card("[data-testid=favorite-save-meta]").click();
        expect(app.stored("favorite-meta")).toEqual({});
    });

    it("veille : détecte un changement de statut à l'actualisation puis l'acquitte", async () => {
        let closed = false;
        const { transport } = fixtureTransport(url =>
            closed && url.includes("q=900000001")
                ? {
                      status: 200,
                      body: {
                          results: [
                              {
                                  siren: "900000001",
                                  nom_complet: "BOULANGERIE DES TESTS",
                                  etat_administratif: "C",
                                  siege: { libelle_commune: "PARIS", code_postal: "75015", adresse: "12 RUE DU CAS NOMINAL 75015 PARIS" },
                                  tranche_effectif_salarie: "11",
                                  activite_principale: "10.71C",
                                  categorie_entreprise: "PME"
                              }
                          ],
                          total_results: 1
                      }
                  }
                : null
        );
        app = mountApp({ path: "?q=paris", transport });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=company-card-900000050] [data-fav]");
        app.click("#mainNav [data-route=favorites]");
        closed = true;
        app.click("#favoritesRefreshBtn");
        await until(() => app.text("#favoritesStatus").includes("modifié"));
        expect(app.text("#favoritesStatus")).toBe("2 actualisé(s), 1 modifié(s), 0 introuvable(s).");
        expect(app.$("[data-testid=favorite-card-900000001] [data-testid=favorite-changed-badge]")).not.toBeNull();
        expect(app.text("[data-testid=favorite-card-900000001] [data-testid=favorite-changes]")).toContain("A → C");
        app.type("#favoritesSort", "changed");
        expect(app.$$("#favoritesGrid .company")[0].dataset.testid).toBe("favorite-card-900000001");
        app.click("[data-testid=favorite-card-900000001] [data-testid=favorite-ack]");
        expect(app.stored("favorites").find(f => f.siren === "900000001").changes).toEqual([]);
        app.click("[data-testid=favorite-card-900000050] [data-testid=favorite-refresh]");
        await until(() => app.text("#favoritesStatus").startsWith("1 actualisé"));
    });

    it("exporte puis réimporte (fusion / remplacement) avec validation", async () => {
        await withFavorites();
        app.click("#favoritesExportBtn");
        expect(app.win.__lastDownload).toBe("favoris-fce-2026-10-11.json");
        const exported = await app.lastDownloadText();
        expect(JSON.parse(exported).schema).toBe("fce-favorites");
        app.click("#clearFavoritesBtn");
        expect(app.text("#favoritesGrid")).toContain("Aucun favori");
        const input = app.$("#favoritesImportInput");
        const importText = async (text, mode = "merge") => {
            app.type("#favoritesImportMode", mode);
            const file = new app.win.File([text], "f.json", { type: "application/json" });
            Object.defineProperty(input, "files", { value: [file], configurable: true });
            input.dispatchEvent(new app.win.Event("change"));
            await settle(5);
        };
        await importText(exported);
        expect(app.$$("#favoritesGrid .company")).toHaveLength(2);
        expect(app.text("#favoritesStatus")).toBe("2 favori(s) importé(s), 0 ignoré(s).");
        await importText("{pas du json");
        expect(app.text("#favoritesStatus")).toBe("Fichier illisible : JSON invalide.");
        const one = JSON.stringify({
            schema: "fce-favorites",
            version: 2,
            items: [{ siren: "900000027", name: "ATELIER", meta: { note: "n", tags: ["t"] } }, { siren: "<b>" }]
        });
        await importText(one, "replace");
        expect(app.$$("#favoritesGrid .company").map(c => c.dataset.testid)).toEqual(["favorite-card-900000027"]);
        expect(app.text("#favoritesStatus")).toBe("1 favori(s) importé(s), 1 ignoré(s).");
        expect(app.stored("favorite-meta")).toEqual({ 900000027: { note: "n", tags: ["t"] } });
    });

    it("annule une actualisation groupée et gère l'export vide", async () => {
        app = mountApp({ path: "?view=favorites" });
        app.click("#favoritesExportBtn");
        expect(app.text("#toast")).toBe("Aucun favori pour le moment.");
        app.click("#favoritesRefreshBtn");
        expect(app.text("#toast")).toBe("Aucun favori pour le moment.");
    });
});

describe("comparaison (N-8)", () => {
    it("ajoute jusqu'à 3, refuse doublons et 4e, réordonne, filtre les différences et partage", async () => {
        app = mountApp({ path: "?q=*", clipboard: true });
        await settle();
        for (const siren of ["900000001", "900000019", "900000027"]) app.click(`[data-testid=company-card-${siren}] [data-compare]`);
        app.click("[data-testid=company-card-900000001] [data-compare]");
        expect(app.text("#toast")).toBe("Déjà dans la comparaison.");
        await settle();
        expect(app.visible("#compareView")).toBe(true);
        app.click("#mainNav [data-route=search]");
        await settle();
        app.click("[data-testid=company-card-900000035] [data-compare]");
        expect(app.text("#toast")).toBe("La comparaison est limitée à 3 entreprises.");
        await settle();
        expect(app.$$("#compareRoot .compare-panel")).toHaveLength(3);
        const rows = app.$$("[data-testid=compare-table] tbody tr").length;
        app.$("#compareDiffOnly").checked = true;
        app.$("#compareDiffOnly").dispatchEvent(new app.win.Event("change"));
        expect(app.$$("[data-testid=compare-table] tbody tr").length).toBeLessThan(rows);
        expect(app.$$("[data-testid=compare-table] tbody tr[data-differs=false]")).toHaveLength(0);
        app.click("[data-testid=compare-panel-900000019] [data-testid=compare-move-left]");
        expect(app.stored("compare").map(c => c.siren)).toEqual(["900000019", "900000001", "900000027"]);
        app.click("[data-testid=compare-panel-900000019] [data-testid=compare-move-right]");
        expect(app.stored("compare")[1].siren).toBe("900000019");
        app.click("#compareShareBtn");
        await settle();
        expect(app.win.__clipboard.at(-1)).toContain("view=compare&sirens=900000001%2C900000019%2C900000027");
        app.click('[data-rm="900000027"]');
        app.click('[data-rm="900000019"]');
        expect(app.text("#compareRoot")).toContain("Ajoute une seconde entreprise");
        app.click("#compareShareBtn");
        expect(app.text("#toast")).toContain("au moins deux");
        app.click('[data-rm="900000001"]');
        expect(app.text("#compareRoot")).toContain("Ajoute jusqu’à 3 entreprises");
    });

    it("charge une comparaison partagée par URL", async () => {
        app = mountApp({ path: "?view=compare&sirens=900000001,900000084" });
        await settle();
        expect(app.$$("#compareRoot .compare-panel")).toHaveLength(2);
        expect(app.text("#toast")).toBe("2 entreprise(s) chargée(s) dans la comparaison.");
        expect(app.text("[data-testid=compare-table]")).toContain("880 000");
    });

    it("affiche une erreur si la comparaison partagée ne peut être chargée", async () => {
        const { transport } = fixtureTransport(() => ({ status: 400, body: {} }));
        app = mountApp({ path: "?view=compare&sirens=900000001,900000084", transport });
        await settle();
        expect(app.text("#compareRoot")).toContain("400");
    });
});

describe("historique et recherches sauvegardées", () => {
    it("sauvegarde via un dialogue accessible (#17), relance et supprime", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("#saveSearchBtn");
        expect(app.$("#saveSearchDialog").hasAttribute("open")).toBe(true);
        expect(app.$("#saveSearchName").value).toBe("paris");
        app.$("#saveSearchName").value = "  ";
        app.click("#saveSearchConfirm");
        expect(app.text("#saveSearchError")).toContain("ne peut pas être vide");
        app.$("#saveSearchName").value = "Boulangeries parisiennes";
        app.click("#saveSearchConfirm");
        expect(app.$("#saveSearchDialog").hasAttribute("open")).toBe(false);
        expect(app.stored("saved-searches")[0]).toMatchObject({ name: "Boulangeries parisiennes", query: "paris" });
        app.click("#saveSearchBtn");
        app.$("#saveSearchName").value = "Renommée";
        app.click("#saveSearchConfirm");
        expect(app.text("#toast")).toBe("Recherche sauvegardée mise à jour.");
        app.click("#mainNav [data-route=history]");
        expect(app.text("#savedSearchesList")).toContain("Renommée");
        app.click("[data-saved='0']");
        await settle();
        expect(app.visible("#searchView")).toBe(true);
        app.click("#mainNav [data-route=history]");
        app.click("[data-h='0']");
        await settle();
        expect(app.$("#queryInput").value).toBe("paris");
        app.click("#mainNav [data-route=history]");
        app.click("[data-del-saved]");
        expect(app.text("#savedSearchesList")).toContain("Aucune recherche sauvegardée");
        app.click("#clearHistoryBtn");
        expect(app.text("#historyList")).toContain("Aucune recherche enregistrée");
    });

    it("refuse de sauvegarder une recherche vide", () => {
        app = mountApp({ path: "?view=search" });
        app.click("#saveSearchBtn");
        expect(app.text("#toast")).toBe("Aucune recherche à sauvegarder.");
    });

    it("partage le lien de la recherche (repli si presse-papiers refusé)", async () => {
        app = mountApp({ path: "?q=paris&qa=1" });
        await settle();
        app.click("#shareSearchBtn");
        await settle();
        expect(app.text("#toast")).toContain("Copie impossible");
        app.close();
        app = mountApp({ path: "?q=paris", clipboard: true });
        await settle();
        app.click("#shareSearchBtn");
        await settle();
        expect(app.win.__clipboard[0]).toBe("http://localhost/?q=paris");
    });
});

describe("export (N-10)", () => {
    it("exporte la page courante en CSV avec colonnes choisies et neutralisation des formules", async () => {
        app = mountApp({ path: "?q=conseil" });
        await settle();
        app.click("#openExportBtn");
        expect(app.$("#exportDialog").hasAttribute("open")).toBe(true);
        expect(app.text("#exportHelp")).toBe("1 ligne(s) prête(s) à être exportée(s).");
        app.$("[data-testid=export-column-directors]").checked = true;
        app.$("[data-testid=export-column-directors]").dispatchEvent(new app.win.Event("change"));
        expect(app.visible("#exportPersonalWarning")).toBe(true);
        app.click("#confirmExportBtn");
        await settle();
        expect(app.win.__lastDownload).toBe("entreprises-results-conseil.csv");
        const csv = await app.lastDownloadText();
        expect(csv).toContain(`"'=CMD|' /C calc'!A0 CONSEIL"`);
        expect(csv.split("\r\n")[0]).toContain("Dirigeants");
        expect(app.text("#toast")).toBe("Export CSV téléchargé (1 lignes).");
    });

    it("exporte toutes les pages en JSON, la comparaison et les favoris", async () => {
        const { transport, calls } = fixtureTransport();
        app = mountApp({ path: "?q=*&size=10", transport });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("#openExportBtn");
        app.type("#exportFormat", "json");
        app.type("#exportScope", "all-pages");
        const before = calls.length;
        app.click("#confirmExportBtn");
        await until(() => app.win.__lastDownload === "entreprises-all-pages-entreprises.json");
        expect(calls.length - before).toBe(1);
        expect(JSON.parse(await app.lastDownloadText())).toHaveLength(12);
        app.click("#openExportBtn");
        app.type("#exportScope", "compare");
        expect(app.$("#confirmExportBtn").disabled).toBe(true);
        app.type("#exportScope", "favorites");
        expect(app.$("#confirmExportBtn").disabled).toBe(false);
        app.$("[data-testid=export-column-note]").checked = true;
        app.$("[data-testid=export-column-note]").dispatchEvent(new app.win.Event("change"));
        app.click("#confirmExportBtn");
        await until(() => app.win.__lastDownload === "entreprises-favorites-entreprises.json");
        expect(JSON.parse(await app.lastDownloadText())[0]).toMatchObject({ siren: "900000001", note: "" });
    });

    it("désactive l'export sans résultat et sans colonne", async () => {
        app = mountApp({ path: "?view=search" });
        app.click("#openExportBtn");
        expect(app.$("#confirmExportBtn").disabled).toBe(true);
        expect(app.text("#exportHelp")).toBe("Aucune donnée à exporter pour ce périmètre.");
    });

    it("affiche l'erreur réseau d'un export multi-pages", async () => {
        let fail = false;
        const { transport } = fixtureTransport(() => (fail ? { status: 400, body: {} } : null));
        app = mountApp({ path: "?q=paris", transport });
        await settle();
        fail = true;
        app.click("#openExportBtn");
        app.type("#exportScope", "all-pages");
        app.click("#confirmExportBtn");
        await until(() => app.text("#exportHelp").includes("400"));
        app.click("#exportCancelBtn");
    });
});

describe("analyse (N-7)", () => {
    it("génère des graphiques accessibles avec tableau alternatif", async () => {
        app = mountApp({ path: "?q=*&size=10" });
        await settle();
        app.click("#analyticsBtn");
        expect(app.$("#analyticsBtn").getAttribute("aria-expanded")).toBe("true");
        app.type("#analyticsPages", "2");
        app.click("#analyticsRunBtn");
        await until(() => app.text("#analyticsStatus").startsWith("Analyse de 12"));
        for (const axis of ["status", "category", "workforce", "department", "section"]) {
            expect(app.$(`[data-testid=analytics-chart-${axis}]`).getAttribute("role")).toBe("img");
            expect(app.$(`[data-testid=analytics-table-${axis}]`)).not.toBeNull();
        }
        expect(app.text("[data-testid=analytics-table-status] tfoot")).toContain("12");
    });

    it("exige une recherche préalable et signale les erreurs", async () => {
        app = mountApp({ path: "?view=search" });
        app.click("#analyticsRunBtn");
        expect(app.text("#analyticsStatus")).toBe("Lance d’abord une recherche.");
        app.close();
        let fail = false;
        const { transport } = fixtureTransport(() => (fail ? { status: 404, body: {} } : null));
        app = mountApp({ path: "?q=*&size=10", transport });
        await settle();
        fail = true;
        app.type("#analyticsPages", "2");
        app.click("#analyticsRunBtn");
        app.click("#analyticsCancelBtn");
        await until(() => app.text("#analyticsStatus") !== "" && !app.text("#analyticsStatus").startsWith("Analyse de la page"));
    });
});
