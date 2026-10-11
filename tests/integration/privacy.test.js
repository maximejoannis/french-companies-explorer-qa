import { afterEach, describe, expect, it } from "vitest";
import { mountApp, settle, until } from "./harness.js";

let app;
afterEach(async () => {
    await settle(5);
    app?.close();
    app = null;
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-11T10:00:00.000Z");

describe("page Confidentialité (N-16)", () => {
    it("est accessible depuis le pied de page, la page À propos et le raccourci g p", async () => {
        app = mountApp();
        app.click("[data-testid=footer-privacy]");
        expect(app.visible("#privacyView")).toBe(true);
        expect(app.win.location.search).toBe("?view=privacy");
        expect(app.doc.title).toBe("Confidentialité · French Companies Explorer");
        app.click(".brand");
        app.key("g");
        app.key("p");
        expect(app.visible("#privacyView")).toBe(true);
        expect(app.$$("[data-testid=privacy-recipients] tbody tr")).toHaveLength(4);
        expect(app.text("[data-testid=privacy-legal]")).toContain("GitHub, Inc.");
        expect(app.$("[data-testid=footer-license]").getAttribute("href")).toBe("./LICENSE");
    });

    it("affiche un inventaire en temps réel des données locales", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=company-card-900000050] [data-compare]");
        app.click("[data-testid=footer-privacy]");
        expect(app.text("[data-testid=privacy-count-favorites]")).toBe("1");
        expect(app.text("[data-testid=privacy-count-compare]")).toBe("1");
        expect(app.text("[data-testid=privacy-count-history]")).toBe("0");
        expect(app.$("[data-testid=privacy-erase-history]").disabled).toBe(true);
        expect(app.text("[data-testid=privacy-total-size]")).toMatch(/\d+ (o|Ko)$/);
    });

    it("exporte toutes les données personnelles locales (portabilité)", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=footer-privacy]");
        app.click("[data-testid=privacy-export]");
        expect(app.win.__lastDownload).toBe("mes-donnees-fce-2026-10-11.json");
        const data = JSON.parse(await app.lastDownloadText());
        expect(data.schema).toBe("fce-personal-data");
        expect(data.data.favorites.map(f => f.siren)).toEqual(["900000001"]);
        expect(data.data.history).toHaveLength(0);
    });

    it("efface une catégorie à la fois", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=company-card-900000001] [data-compare]");
        app.click("[data-testid=footer-privacy]");
        app.click("[data-testid=privacy-erase-favorites]");
        expect(app.text("[data-testid=privacy-count-favorites]")).toBe("0");
        expect(app.text("[data-testid=privacy-count-compare]")).toBe("1");
        expect(app.stored("favorites")).toEqual([]);
        expect(app.text("#toast")).toBe("Données effacées : Favoris (avec notes et tags).");
        app.click("[data-testid=privacy-erase-compare]");
        expect(app.stored("compare")).toEqual([]);
    });

    it("efface les préférences et les anciennes données v1 séparément", async () => {
        app = mountApp({ storage: { "fce:v2:migrated": "x", fce_compare: "[]", "fce:v2:prefs": JSON.stringify({ theme: "dark", lang: "en" }) } });
        expect(app.doc.documentElement.lang).toBe("en");
        app.click("[data-testid=footer-privacy]");
        // La 2.1.0 supprime les clés v1 d'une installation déjà migrée : il ne reste rien à effacer.
        expect(app.text("[data-testid=privacy-count-legacy]")).toBe("0");
        app.click("[data-testid=privacy-erase-prefs]");
        expect(app.win.localStorage.getItem("fce:v2:prefs")).toBeNull();
        expect(app.doc.documentElement.lang).toBe("fr");
        expect(app.doc.documentElement.dataset.theme).toBe("light");
    });

    it("efface tout après confirmation explicite, y compris session, v1 et caches, sans toucher aux autres applications", async () => {
        const deleted = [];
        app = mountApp({ path: "?q=paris" });
        app.win.caches = { keys: async () => ["fce-api-v1", "fce-shell-2.1.0", "autre"], delete: async n => (deleted.push(n), true) };
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.win.localStorage.setItem("fce_history", "[]");
        app.win.localStorage.setItem("autre-app", "conserve");
        app.win.sessionStorage.setItem("fce:qa", "{}");
        app.click("[data-testid=footer-privacy]");
        app.click("[data-testid=privacy-erase-all]");
        expect(app.$("#eraseDialog").hasAttribute("open")).toBe(true);
        expect(app.$("[data-testid=erase-confirm]").disabled).toBe(true);
        app.$("[data-testid=erase-ack]").checked = true;
        app.$("[data-testid=erase-ack]").dispatchEvent(new app.win.Event("change"));
        expect(app.$("[data-testid=erase-confirm]").disabled).toBe(false);
        app.click("[data-testid=erase-confirm]");
        await until(() => !app.$("#eraseDialog").hasAttribute("open"));
        const remaining = Object.keys({ ...app.win.localStorage }).filter(k => k.startsWith("fce"));
        expect(remaining).toEqual([]);
        expect(app.win.localStorage.getItem("autre-app")).toBe("conserve");
        expect(app.win.sessionStorage.getItem("fce:qa")).toBeNull();
        expect(deleted).toEqual(["fce-api-v1", "fce-shell-2.1.0"]);
        expect(app.text("[data-testid=privacy-status]")).toMatch(/effacées \(\d+ entrée\(s\) de stockage, 2 cache\(s\)\)/);
        expect(app.text("[data-testid=privacy-count-favorites]")).toBe("0");
        app.click("#mainNav [data-route=favorites]");
        expect(app.text("#favoritesGrid")).toContain("Aucun favori");
    });

    it("ne fait rien si l'utilisateur annule ou ne coche pas la confirmation", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.click("[data-testid=company-card-900000001] [data-fav]");
        app.click("[data-testid=footer-privacy]");
        app.click("[data-testid=privacy-erase-all]");
        await app.app.views.privacy.eraseAll();
        expect(app.stored("favorites")).toHaveLength(1);
        app.$("#eraseDialog").close();
        expect(app.stored("favorites")).toHaveLength(1);
    });
});

describe("durée de conservation", () => {
    it("purge l'historique expiré au chargement (90 jours par défaut)", () => {
        const history = [
            { query: "récente", at: new Date(NOW - 10 * DAY).toISOString() },
            { query: "expirée", at: new Date(NOW - 120 * DAY).toISOString() }
        ];
        app = mountApp({ storage: { "fce:v2:migrated": "x", "fce:v2:history": JSON.stringify(history) } });
        expect(app.stored("history").map(h => h.query)).toEqual(["récente"]);
        app.click("#mainNav [data-route=history]");
        expect(app.text("#historyList")).not.toContain("expirée");
    });

    it("applique immédiatement une durée plus courte et l'enregistre", () => {
        const history = [
            { query: "hier", at: new Date(NOW - DAY).toISOString() },
            { query: "mois dernier", at: new Date(NOW - 45 * DAY).toISOString() }
        ];
        app = mountApp({ path: "?view=privacy", storage: { "fce:v2:migrated": "x", "fce:v2:history": JSON.stringify(history) } });
        expect(app.$("[data-testid=privacy-retention]").value).toBe("90");
        expect(app.$$("[data-testid=privacy-retention] option").map(o => o.textContent)).toEqual(["30 jours", "90 jours", "365 jours", "Sans limite"]);
        app.type("[data-testid=privacy-retention]", "30");
        expect(app.stored("history").map(h => h.query)).toEqual(["hier"]);
        expect(app.stored("prefs").retentionDays).toBe(30);
        app.type("[data-testid=privacy-retention]", "0");
        expect(app.stored("prefs").retentionDays).toBe(0);
    });
});

describe("minimisation des données enregistrées", () => {
    it("n'enregistre ni nom ni adresse d'un entrepreneur individuel (option active par défaut)", async () => {
        app = mountApp({ path: "?q=cafe" });
        await settle();
        app.click("[data-testid=company-card-900000043] [data-fav]");
        const fav = app.stored("favorites")[0];
        expect(fav).toMatchObject({ siren: "900000043", name: "", address: "", minimized: "ei", city: "PARIS" });
        app.click("#mainNav [data-route=favorites]");
        expect(app.text("[data-testid=favorite-card-900000043] h3")).toBe("Entrepreneur individuel (SIREN 900000043)");
        expect(app.$("[data-testid=favorite-card-900000043] [data-testid=favorite-minimized]")).not.toBeNull();
    });

    it("enregistre le nom si l'option est désactivée, puis minimise rétroactivement quand elle est réactivée", async () => {
        app = mountApp({ path: "?view=privacy" });
        app.$("[data-testid=privacy-minimize]").checked = false;
        app.$("[data-testid=privacy-minimize]").dispatchEvent(new app.win.Event("change"));
        app.click("#mainNav [data-route=search]");
        app.type("#queryInput", "cafe");
        app.submit("#searchForm");
        await settle();
        app.click("[data-testid=company-card-900000043] [data-fav]");
        app.click("[data-testid=company-card-900000043] [data-compare]");
        expect(app.stored("favorites")[0].name).toBe("CAFÉ DES ASSERTIONS");
        app.click("[data-testid=footer-privacy]");
        app.$("[data-testid=privacy-minimize]").checked = true;
        app.$("[data-testid=privacy-minimize]").dispatchEvent(new app.win.Event("change"));
        expect(app.stored("favorites")[0]).toMatchObject({ name: "", minimized: "ei" });
        expect(app.stored("compare")[0]).toMatchObject({ name: "", minimized: "ei" });
    });

    it("respecte la diffusion partielle : bandeau sur la fiche et jamais de nom enregistré, même option désactivée", async () => {
        app = mountApp({
            path: "?view=detail&siren=900000118",
            storage: { "fce:v2:migrated": "x", "fce:v2:prefs": JSON.stringify({ minimizePersonal: false }) }
        });
        await settle();
        expect(app.$("[data-testid=detail-partial-diffusion]")).not.toBeNull();
        app.click("#detailFav");
        expect(app.stored("favorites")[0]).toMatchObject({ name: "", minimized: "partial" });
        app.click("#mainNav [data-route=favorites]");
        expect(app.text("#favoritesGrid h3")).toBe("Diffusion partielle (SIREN 900000118)");
    });

    it("ne signale pas de faux changement lors de la veille d'un favori minimisé", async () => {
        app = mountApp({ path: "?q=cafe" });
        await settle();
        app.click("[data-testid=company-card-900000043] [data-fav]");
        app.click("#mainNav [data-route=favorites]");
        app.click("[data-testid=favorite-card-900000043] [data-testid=favorite-refresh]");
        await until(() => app.text("#favoritesStatus").startsWith("1 actualisé"));
        expect(app.text("#favoritesStatus")).toContain("0 modifié");
    });
});

describe("Labo QA : stockage simulé", () => {
    it("fonctionne avec un stockage plein et l'inventaire reste cohérent", async () => {
        app = mountApp({ path: "?q=paris" });
        await settle();
        app.win.Storage.prototype.setItem = () => {
            const e = new Error("full");
            e.name = "QuotaExceededError";
            throw e;
        };
        app.click("[data-testid=company-card-900000001] [data-fav]");
        await settle(5);
        expect(app.text("#toast")).toContain("Stockage du navigateur plein");
        app.click("[data-testid=footer-privacy]");
        expect(app.text("[data-testid=privacy-count-favorites]")).toBe("1");
    });
});
