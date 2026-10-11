import { describe, expect, it, vi } from "vitest";
import { normalizeCompany, toSnapshot } from "../../src/core/company.js";
import {
    applyRetention,
    buildInventory,
    buildPersonalDataExport,
    isAppStorageKey,
    minimizationReason,
    minimizeSnapshot,
    PERSONAL_EXPORT_SCHEMA
} from "../../src/core/privacy.js";
import { resolveShortcut } from "../../src/core/shortcuts.js";
import { sanitizeSnapshot } from "../../src/core/schema.js";
import { FIXTURE_COMPANIES } from "../../src/qa-lab/fixtures.js";
import { createStorage, eraseAppData, migrateFromV1, readAppKeys } from "../../src/services/storage.js";

const byId = siren => normalizeCompany(FIXTURE_COMPANIES.find(c => c.siren === siren));
const DAY = 24 * 60 * 60 * 1000;

describe("minimisation (RGPD art. 5.1.c)", () => {
    it("lit le statut de diffusion SIRENE", () => {
        expect(byId("900000001").diffusion).toBe("O");
        expect(byId("900000118").diffusion).toBe("P");
        expect(normalizeCompany({ siren: "356000000" }).diffusion).toBe("");
    });
    it.each([
        [{ diffusion: "P", legal: "5499" }, false, "partial"],
        [{ diffusion: "P", legal: "1000" }, true, "partial"],
        [{ diffusion: "O", legal: "1000" }, true, "ei"],
        [{ diffusion: "O", legal: "5499", labels: ["est_entrepreneur_individuel"] }, true, "ei"],
        [{ diffusion: "O", legal: "1000" }, false, ""],
        [{ diffusion: "O", legal: "5710" }, true, ""],
        [{}, true, ""]
    ])("%j (option %s) → %j", (c, option, reason) => expect(minimizationReason(c, option)).toBe(reason));

    it("retire nom, adresse, code postal, SIRET et coordonnées mais garde SIREN, commune et département", () => {
        const snap = minimizeSnapshot(toSnapshot(byId("900000043")), true);
        expect(snap).toMatchObject({
            siren: "900000043",
            name: "",
            address: "",
            postalCode: "",
            siret: "",
            latitude: null,
            longitude: null,
            city: "PARIS",
            department: "75",
            minimized: "ei"
        });
        expect(JSON.stringify(snap)).not.toContain("ASSERTIONS");
    });
    it("applique toujours la minimisation en diffusion partielle, même option désactivée", () => {
        expect(minimizeSnapshot(toSnapshot(byId("900000118")), false).minimized).toBe("partial");
    });
    it("laisse intactes les sociétés et marque l'instantané comme non minimisé", () => {
        const snap = minimizeSnapshot(toSnapshot(byId("900000001")), true);
        expect(snap.name).toBe("BOULANGERIE DES TESTS");
        expect(snap.minimized).toBe("");
    });
    it("survit à la validation de schéma", () => {
        expect(sanitizeSnapshot(minimizeSnapshot(toSnapshot(byId("900000043")), true))).toMatchObject({ minimized: "ei", diffusion: "O" });
        expect(sanitizeSnapshot({ siren: "356000000", minimized: "evil", diffusion: "X" })).toMatchObject({ minimized: "", diffusion: "" });
    });
});

describe("conservation limitée (RGPD art. 5.1.e)", () => {
    const now = Date.parse("2026-10-11T00:00:00Z");
    const entries = [
        { q: "récent", at: new Date(now - 5 * DAY).toISOString() },
        { q: "ancien", at: new Date(now - 100 * DAY).toISOString() },
        { q: "sans date" },
        { q: "invalide", at: "hier" }
    ];
    it("supprime les entrées expirées et celles sans date valide", () => {
        expect(applyRetention(entries, now, 30).map(e => e.q)).toEqual(["récent"]);
        expect(applyRetention(entries, now, 365).map(e => e.q)).toEqual(["récent", "ancien"]);
    });
    it("ne supprime rien sans limite", () => {
        expect(applyRetention(entries, now, 0)).toBe(entries);
    });
    it("inclut la borne exacte", () => {
        expect(applyRetention([{ at: new Date(now - 30 * DAY).toISOString() }], now, 30)).toHaveLength(1);
    });
});

describe("inventaire et portabilité (RGPD art. 15 et 20)", () => {
    const state = { favorites: [{ siren: "1" }], favoriteMeta: { 1: { note: "n" } }, compare: [], history: [{}, {}], saved: [], prefs: { theme: "dark" } };
    it("reconnaît uniquement les clés de l'application", () => {
        expect(isAppStorageKey("fce:v2:favorites")).toBe(true);
        expect(isAppStorageKey("fce_theme")).toBe(true);
        expect(isAppStorageKey("fce:qa")).toBe(true);
        expect(isAppStorageKey("autre-app")).toBe(false);
        expect(isAppStorageKey("fcex")).toBe(false);
    });
    it("compte les éléments et la taille par catégorie, y compris les données v1", () => {
        const raw = { "fce:v2:favorites": '[{"siren":"1"}]', "fce:v2:prefs": '{"theme":"dark"}', fce_theme: "dark", "fce:v2:history": "[{},{}]" };
        const inv = Object.fromEntries(buildInventory(state, raw).map(l => [l.id, l]));
        expect(inv.favorites).toEqual({ id: "favorites", count: 1, bytes: 15 });
        expect(inv.history.count).toBe(2);
        expect(inv.prefs.count).toBe(1);
        expect(inv.legacy).toEqual({ id: "legacy", count: 1, bytes: 4 });
        expect(inv.compare.bytes).toBe(0);
        expect(buildInventory(state, {}).find(l => l.id === "prefs").count).toBe(0);
    });
    it("exporte toutes les catégories dans un format documenté", () => {
        const data = JSON.parse(buildPersonalDataExport(state, "2026-10-11T00:00:00Z", "2.1.0"));
        expect(data.schema).toBe(PERSONAL_EXPORT_SCHEMA);
        expect(data.app).toBe("French Companies Explorer 2.1.0");
        expect(Object.keys(data.data)).toEqual(["favorites", "favoriteMeta", "compare", "history", "savedSearches", "preferences"]);
        expect(data.data.history).toHaveLength(2);
    });
});

describe("effacement (RGPD art. 17)", () => {
    it("liste les clés de l'application seulement", () => {
        localStorage.setItem("fce:v2:history", "[]");
        localStorage.setItem("fce_theme", "dark");
        localStorage.setItem("autre-app", "x");
        expect(readAppKeys(localStorage)).toEqual({ "fce:v2:history": "[]", fce_theme: "dark" });
        expect(readAppKeys(null)).toEqual({});
        expect(readAppKeys({ getItem: () => null })).toEqual({});
        expect(
            readAppKeys({
                key: () => {
                    throw new Error("x");
                },
                length: 1,
                getItem: () => null
            })
        ).toEqual({});
    });
    it("efface stockage local, session et caches de l'application sans toucher au reste", async () => {
        localStorage.setItem("fce:v2:favorites", "[]");
        localStorage.setItem("fce_favorites", "[]");
        localStorage.setItem("autre-app", "x");
        sessionStorage.setItem("fce:qa", "{}");
        const deleted = [];
        const caches = { keys: async () => ["fce-shell-2.1.0", "fce-api-v1", "autre-cache"], delete: async name => (deleted.push(name), true) };
        const result = await eraseAppData({ local: localStorage, session: sessionStorage, caches });
        expect(result).toEqual({ keys: 3, caches: 2 });
        expect(Object.keys(readAppKeys(localStorage))).toEqual([]);
        expect(localStorage.getItem("autre-app")).toBe("x");
        expect(sessionStorage.getItem("fce:qa")).toBeNull();
        expect(deleted).toEqual(["fce-shell-2.1.0", "fce-api-v1"]);
    });
    it("tolère l'absence de stockage, une clé non supprimable et Cache Storage indisponible", async () => {
        const stubborn = {
            key: () => "fce:v2:x",
            length: 1,
            getItem: () => "1",
            removeItem: () => {
                throw new Error("x");
            }
        };
        await expect(
            eraseAppData({
                local: stubborn,
                session: null,
                caches: {
                    keys: async () => {
                        throw new Error("insecure");
                    },
                    delete: vi.fn()
                }
            })
        ).resolves.toEqual({ keys: 0, caches: 0 });
        await expect(eraseAppData({ local: null, session: null })).resolves.toEqual({ keys: 0, caches: 0 });
    });
    it("supprime les clés v1 restantes d'une installation déjà migrée par la 2.0.0 (#27)", () => {
        localStorage.setItem("fce:v2:migrated", "2026-10-01");
        localStorage.setItem("fce_favorites", "[]");
        expect(migrateFromV1(localStorage, createStorage(localStorage), "now")).toBe(false);
        expect(localStorage.getItem("fce_favorites")).toBeNull();
    });
    it("garde les clés v1 si la migration n'a pas pu être écrite (nouvel essai au prochain chargement)", () => {
        localStorage.setItem("fce_favorites", JSON.stringify([{ siren: "356000000", name: "LA POSTE" }]));
        const failing = createStorage({
            getItem: k => localStorage.getItem(k),
            setItem: () => {
                throw new Error("quota");
            },
            removeItem: k => localStorage.removeItem(k)
        });
        expect(migrateFromV1(localStorage, failing, "now")).toBe(false);
        expect(localStorage.getItem("fce_favorites")).not.toBeNull();
        expect(localStorage.getItem("fce:v2:migrated")).toBeNull();
    });
});

describe("raccourci confidentialité", () => {
    it("g puis p ouvre la page Confidentialité", () => {
        expect(resolveShortcut({ key: "p" }, { enabled: true, inField: false, pendingGo: true }).action).toEqual({ action: "navigate", view: "privacy" });
    });
});
