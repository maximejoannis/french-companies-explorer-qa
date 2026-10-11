import { describe, expect, it } from "vitest";
import { normalizeCompany, toSnapshot } from "../../src/core/company.js";
import { mergeFavorites, parseFavoritesFile, serializeFavorites } from "../../src/core/favorites-io.js";
import { legacyCompanyToSnapshot, migrateLegacy } from "../../src/core/migration.js";
import {
    normalizeTags,
    prefsDefaults,
    sanitizeFavorite,
    sanitizeHistoryEntry,
    sanitizeList,
    sanitizeMeta,
    sanitizeMetaMap,
    sanitizePrefs,
    sanitizeSavedSearch,
    sanitizeSnapshot
} from "../../src/core/schema.js";
import { FIXTURE_COMPANIES } from "../../src/qa-lab/fixtures.js";

const snap = toSnapshot(normalizeCompany(FIXTURE_COMPANIES[0]));

describe("schema", () => {
    it("rejette un instantané sans SIREN valide", () => {
        expect(sanitizeSnapshot(null)).toBeNull();
        expect(sanitizeSnapshot([])).toBeNull();
        expect(sanitizeSnapshot({ siren: '1" onmouseover="alert(1)' })).toBeNull();
    });
    it("nettoie les champs d'un instantané hostile", () => {
        const s = sanitizeSnapshot({
            siren: "356000000",
            status: "X",
            creation: "<b>",
            siret: "1",
            latitude: 999,
            longitude: "2",
            labels: ["est_ess", "<img>", 3],
            name: "x".repeat(400)
        });
        expect(s).toMatchObject({ status: "", creation: "", siret: "", latitude: null, longitude: null, labels: ["est_ess"] });
        expect(s.name).toHaveLength(250);
        expect(sanitizeSnapshot(snap)).toEqual(snap);
    });
    it("valide les favoris et leurs changements", () => {
        const f = sanitizeFavorite({
            ...snap,
            addedAt: "2026-10-01T10:00:00.000Z",
            changes: [{ field: "status", before: "A", after: "C" }, { field: "evil", before: 1 }, null]
        });
        expect(f.changes).toEqual([{ field: "status", before: "A", after: "C" }]);
        expect(f.addedAt).toBe("2026-10-01T10:00:00.000Z");
        expect(sanitizeFavorite({ ...snap, addedAt: "jamais", changes: "x" })).toMatchObject({ addedAt: "", changes: [] });
        expect(sanitizeFavorite({ siren: "bad" })).toBeNull();
    });
    it("normalise notes et tags (dédoublonnés, tronqués, plafonnés)", () => {
        expect(normalizeTags(" a, b ,a,, " + "x".repeat(50))).toEqual(["a", "b", "x".repeat(30)]);
        expect(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(8);
        expect(normalizeTags(undefined)).toEqual([]);
        expect(sanitizeMeta({ note: "n".repeat(600), tags: "a,b" })).toEqual({ note: "n".repeat(500), tags: ["a", "b"] });
        expect(sanitizeMeta("x")).toEqual({ note: "", tags: [] });
        expect(sanitizeMetaMap({ 356000000: { note: "ok" }, bad: { note: "x" }, 552120222: { note: "" } })).toEqual({ 356000000: { note: "ok", tags: [] } });
        expect(sanitizeMetaMap(null)).toEqual({});
    });
    it("valide historique et recherches sauvegardées", () => {
        expect(sanitizeHistoryEntry({ query: "", at: "x" })).toBeNull();
        expect(sanitizeHistoryEntry("x")).toBeNull();
        expect(sanitizeHistoryEntry({ query: "Renault", at: "2026-01-01T00:00:00Z", status: "Z" })).toMatchObject({
            query: "Renault",
            status: "",
            at: "2026-01-01T00:00:00Z"
        });
        expect(sanitizeSavedSearch({ query: "x", name: "Nom", id: "abc-1" })).toMatchObject({ id: "abc-1", name: "Nom" });
        expect(sanitizeSavedSearch({ query: "x", name: "Nom", id: '"><img>' })).toBeNull();
        expect(sanitizeSavedSearch({ query: "x", name: "  ", id: "1" })).toBeNull();
        expect(sanitizeSavedSearch(1)).toBeNull();
    });
    it("sanitizeList filtre, dédoublonne et plafonne ; régression #3 : une valeur non tableau donne []", () => {
        expect(sanitizeList("oops", sanitizeSnapshot, 10)).toEqual([]);
        expect(sanitizeList({ a: 1 }, sanitizeSnapshot, 10)).toEqual([]);
        const list = sanitizeList([snap, snap, { siren: "x" }, { ...snap, siren: "356000000" }], sanitizeSnapshot, 10, s => s.siren);
        expect(list.map(s => s.siren)).toEqual(["900000001", "356000000"]);
        expect(sanitizeList([snap, { ...snap, siren: "356000000" }], sanitizeSnapshot, 1)).toHaveLength(1);
    });
    it("régression #4 : préférences en liste blanche", () => {
        expect(sanitizePrefs(null)).toEqual(prefsDefaults());
        expect(sanitizePrefs({ theme: '"><img>', lang: "de", shortcuts: "yes" })).toEqual(prefsDefaults());
        const all = {
            theme: "dark",
            contrast: "high",
            density: "compact",
            motion: "reduced",
            fontScale: "125",
            shortcuts: false,
            resultsView: "table",
            lang: "en",
            retentionDays: 30,
            minimizePersonal: false
        };
        expect(sanitizePrefs(all)).toEqual(all);
        expect(sanitizePrefs({ retentionDays: 7, minimizePersonal: "non" })).toMatchObject({ retentionDays: 90, minimizePersonal: true });
    });
});

describe("favorites-io", () => {
    const fav = { ...snap, addedAt: "", refreshedAt: "", changes: [] };
    it("fait l'aller-retour export → import avec les métadonnées", () => {
        const text = serializeFavorites([fav], { 900000001: { note: "Client", tags: ["vip"] } }, "2026-10-11T00:00:00Z");
        const parsed = parseFavoritesFile(text, text.length);
        expect(parsed.errorKey).toBe("");
        expect(parsed.items).toEqual([fav]);
        expect(parsed.meta).toEqual({ 900000001: { note: "Client", tags: ["vip"] } });
        expect(JSON.parse(serializeFavorites([fav], {}, "x")).items[0].meta).toEqual({ note: "", tags: [] });
    });
    it.each([
        ["{", 10, "import.invalidJson"],
        ['{"schema":"autre","items":[]}', 10, "import.invalidSchema"],
        ["null", 10, "import.invalidSchema"],
        ['{"schema":"fce-favorites","version":99,"items":[]}', 10, "import.unsupportedVersion"],
        ['{"schema":"fce-favorites","items":[]}', 10, "import.unsupportedVersion"],
        ["{}", 2 * 1024 * 1024, "import.tooLarge"]
    ])("refuse %j", (text, size, key) => expect(parseFavoritesFile(text, size).errorKey).toBe(key));
    it("ignore et compte les entrées invalides ou en double", () => {
        const text = JSON.stringify({ schema: "fce-favorites", version: 2, items: [fav, fav, { siren: "<img>" }, "x"] });
        const parsed = parseFavoritesFile(text, text.length);
        expect(parsed.items).toHaveLength(1);
        expect(parsed.rejected).toBe(3);
    });
    it("fusionne ou remplace en respectant le plafond", () => {
        const a = { siren: "1" };
        const b = { siren: "2" };
        const c = { siren: "3" };
        expect(mergeFavorites([a], [a, b], "merge", 10)).toEqual({ list: [a, b], added: 1, skipped: 1 });
        expect(mergeFavorites([a], [b, c], "replace", 10)).toEqual({ list: [b, c], added: 2, skipped: 0 });
        expect(mergeFavorites([a], [b, c], "merge", 2)).toEqual({ list: [a, b], added: 1, skipped: 1 });
    });
});

describe("migration v1 → v2", () => {
    it("convertit une entreprise v1 en remplaçant les libellés « Non renseigné »", () => {
        const s = legacyCompanyToSnapshot({
            siren: "356000000",
            name: "LA POSTE",
            activity: "Non renseignée",
            activityLabel: "Activité non renseignée",
            workforce: "Non renseigné",
            siret: "Non renseigné",
            status: "A",
            creation: "1991-01-01",
            city: "PARIS"
        });
        expect(s).toMatchObject({
            siren: "356000000",
            name: "LA POSTE",
            activity: "",
            activityLabel: "",
            workforce: "",
            siret: "",
            status: "A",
            creation: "1991-01-01"
        });
        expect(legacyCompanyToSnapshot(null)).toBeNull();
    });
    it("migre et assainit l'ensemble des clés v1, y compris corrompues", () => {
        const m = migrateLegacy(
            {
                favorites: [{ siren: "356000000", name: "LA POSTE" }, { siren: "—", name: "invalide" }, { siren: "356000000" }],
                favoriteMeta: { 356000000: { note: "x", tags: ["a"] } },
                history: [{ query: "Renault", at: "2026-09-01T00:00:00Z" }, { query: "" }],
                saved: [{ id: 1695312000000, name: "Mes boulangeries", query: "boulangerie" }],
                compare: "oops",
                theme: "dark"
            },
            "2026-10-11T00:00:00.000Z"
        );
        expect(m.favorites.map(f => f.siren)).toEqual(["356000000"]);
        expect(m.favorites[0].addedAt).toBe("2026-10-11T00:00:00.000Z");
        expect(m.favoriteMeta).toEqual({ 356000000: { note: "x", tags: ["a"] } });
        expect(m.history).toHaveLength(1);
        expect(m.saved[0]).toMatchObject({ id: "1695312000000", name: "Mes boulangeries" });
        expect(m.compare).toEqual([]);
        expect(m.theme).toBe("dark");
        expect(migrateLegacy({ saved: [null], theme: "<x>" }, "x")).toMatchObject({ saved: [], theme: "system" });
    });
});
