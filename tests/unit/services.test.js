import { describe, expect, it, vi } from "vitest";
import { copyText } from "../../src/services/clipboard.js";
import { createCompaniesApi, toSearchPage } from "../../src/services/companies-api.js";
import { downloadFile } from "../../src/services/download.js";
import { createGeoApi, normalizeCity } from "../../src/services/geo-api.js";
import { createStorage, migrateFromV1, safeBackend } from "../../src/services/storage.js";
import { createStore } from "../../src/state/store.js";
import { criteriaDefaults } from "../../src/core/criteria.js";
import { respondWithFixtures } from "../../src/qa-lab/fixtures.js";
import { sanitizePrefs } from "../../src/core/schema.js";

const fixtureHttp = () => ({ getJson: vi.fn(async url => respondWithFixtures(url).body) });

describe("companies api", () => {
    it("toSearchPage tolère une réponse incomplète", () => {
        expect(toSearchPage(null, 1, 20)).toEqual({ companies: [], total: 0, totalPages: 0, page: 1 });
        expect(toSearchPage({ results: [{ siren: "356000000" }, { siren: "bad" }], total_results: -1 }, 2, 1)).toMatchObject({
            total: 2,
            totalPages: 2,
            page: 2
        });
    });
    it("recherche avec les paramètres traduits", async () => {
        const http = fixtureHttp();
        const api = createCompaniesApi(http);
        const page = await api.search({ ...criteriaDefaults(), query: "paris", status: "A", pageSize: 10 }, 1);
        expect(http.getJson.mock.calls[0][0]).toMatch(
            /^https:\/\/recherche-entreprises\.api\.gouv\.fr\/search\?q=paris&page=1&per_page=10&etat_administratif=A$/
        );
        expect(page.companies.length).toBeGreaterThan(0);
        expect(page.companies.every(c => c.status === "A")).toBe(true);
    });
    it("régression #9 : getBySiren vérifie la correspondance exacte", async () => {
        const api = createCompaniesApi({ getJson: async () => ({ results: [{ siren: "552120222" }] }) });
        await expect(api.getBySiren("356000000")).resolves.toBeNull();
        const ok = createCompaniesApi(fixtureHttp());
        await expect(ok.getBySiren("900000001")).resolves.toMatchObject({ siren: "900000001", name: "BOULANGERIE DES TESTS" });
        const bad = createCompaniesApi({ getJson: async () => ({}) });
        await expect(bad.getBySiren("356000000")).resolves.toBeNull();
    });
    it("suggest demande une réponse minimale sans relance", async () => {
        const http = fixtureHttp();
        const list = await createCompaniesApi(http).suggest("atelier");
        expect(http.getJson.mock.calls[0][1]).toMatchObject({ retries: 0 });
        expect(http.getJson.mock.calls[0][0]).toContain("minimal=true");
        expect(list[0].name).toBe("ATELIER PLAYWRIGHT");
        expect(list[0].directors).toEqual([]);
    });
    it("nearPoint transmet lat, long, rayon et filtres", async () => {
        const http = fixtureHttp();
        const page = await createCompaniesApi(http).nearPoint({ lat: 48.8589, lon: 2.347, radius: 5, naf: "56.10A", section: "I" }, 1);
        const url = new URL(http.getJson.mock.calls[0][0]);
        expect(Object.fromEntries(url.searchParams)).toEqual({
            lat: "48.8589",
            long: "2.347",
            radius: "5",
            page: "1",
            per_page: "25",
            activite_principale: "56.10A",
            section_activite_principale: "I"
        });
        expect(page.companies.map(c => c.siren)).toEqual(["900000050"]);
        await createCompaniesApi(http).nearPoint({ lat: 1, lon: 1, radius: 5, naf: "", section: "" }, 1);
        expect(http.getJson.mock.calls[1][0]).not.toContain("activite_principale");
    });
});

describe("geo api", () => {
    it("normalise et filtre les communes", () => {
        expect(normalizeCity({ nom: "Ajaccio", code: "2A004", codesPostaux: ["20000", "bad"], centre: { coordinates: [8.7, 41.9] } })).toEqual({
            name: "Ajaccio",
            code: "2A004",
            postalCodes: ["20000"],
            lat: 41.9,
            lon: 8.7
        });
        expect(normalizeCity({ nom: "X", code: "<b>" })).toBeNull();
        expect(normalizeCity(null)).toBeNull();
        expect(normalizeCity({ nom: "X", code: "75056" })).toMatchObject({ postalCodes: [], lat: null });
    });
    it("résout une commune par correspondance exacte insensible aux accents", async () => {
        const geo = createGeoApi(fixtureHttp());
        await expect(geo.resolveCity("PARIS")).resolves.toMatchObject({ code: "75056" });
        await expect(geo.resolveCity("Lyo")).resolves.toMatchObject({ code: "69123" });
        await expect(geo.resolveCity("Zzz")).resolves.toBeNull();
        const weird = createGeoApi({ getJson: async () => ({ not: "array" }) });
        await expect(weird.searchCities("x")).resolves.toEqual([]);
    });
});

describe("storage", () => {
    it("safeBackend renvoie null si l'accès lève une exception", () => {
        expect(
            safeBackend(() => {
                throw new Error("SecurityError");
            })
        ).toBeNull();
        expect(safeBackend(() => localStorage)).toBe(localStorage);
    });
    it("lit en validant et retombe sur la valeur par défaut si corrompu", () => {
        const s = createStorage(localStorage);
        localStorage.setItem("fce:v2:prefs", "{corrompu");
        expect(s.read("prefs", sanitizePrefs).theme).toBe("system");
        expect(s.write("prefs", { theme: "dark" })).toBe(true);
        expect(s.read("prefs", sanitizePrefs).theme).toBe("dark");
        s.remove("prefs");
        expect(localStorage.getItem("fce:v2:prefs")).toBeNull();
    });
    it("régression #10 : une écriture refusée (quota) est signalée sans exception", () => {
        const onError = vi.fn();
        const backend = {
            getItem: () => null,
            setItem: () => {
                const e = new Error("full");
                e.name = "QuotaExceededError";
                throw e;
            },
            removeItem: () => {
                throw new Error("x");
            }
        };
        const s = createStorage(backend, { onError });
        expect(s.write("k", 1)).toBe(false);
        expect(onError).toHaveBeenCalledWith("quota", "k");
        backend.setItem = () => {
            throw new Error("autre");
        };
        s.write("k", 1);
        expect(onError).toHaveBeenLastCalledWith("write", "k");
        expect(() => s.remove("k")).not.toThrow();
    });
    it("fonctionne en mode dégradé sans stockage", () => {
        const onError = vi.fn();
        const s = createStorage(null, { onError });
        expect(s.available).toBe(false);
        expect(s.read("k", v => v ?? "défaut")).toBe("défaut");
        expect(s.write("k", 1)).toBe(false);
        expect(onError).toHaveBeenCalledWith("unavailable", "k");
        createStorage(null).write("k", 1);
    });
    it("migre une seule fois les données v1 puis supprime les clés v1 (#27)", () => {
        localStorage.setItem("fce_favorites", JSON.stringify([{ siren: "356000000", name: "LA POSTE" }]));
        localStorage.setItem("fce_theme", "dark");
        localStorage.setItem("fce_history", "{corrompu");
        const s = createStorage(localStorage);
        expect(migrateFromV1(localStorage, s, "2026-10-11T00:00:00.000Z")).toBe(true);
        expect(JSON.parse(localStorage.getItem("fce:v2:favorites"))[0].siren).toBe("356000000");
        expect(JSON.parse(localStorage.getItem("fce:v2:prefs"))).toEqual({ theme: "dark" });
        expect(localStorage.getItem("fce_favorites")).toBeNull();
        expect(localStorage.getItem("fce_theme")).toBeNull();
        expect(migrateFromV1(localStorage, s, "x")).toBe(false);
        expect(migrateFromV1(null, s, "x")).toBe(false);
    });
    it("pose le marqueur même sans données v1 et absorbe les erreurs", () => {
        const s = createStorage(localStorage);
        expect(migrateFromV1(localStorage, s, "now")).toBe(false);
        expect(localStorage.getItem("fce:v2:migrated")).toBe("now");
        const broken = {
            getItem: () => {
                throw new Error("x");
            }
        };
        expect(migrateFromV1(broken, s, "now")).toBe(false);
    });
});

describe("clipboard", () => {
    it("utilise l'API Clipboard si disponible", async () => {
        const writeText = vi.fn(async () => {});
        await expect(copyText("x", { navigator: { clipboard: { writeText } }, document })).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("x");
    });
    it("régression #14 : se replie sur execCommand si l'API échoue, sans exception", async () => {
        document.execCommand = vi.fn(() => true);
        const writeText = vi.fn(async () => {
            throw new Error("denied");
        });
        await expect(copyText("x", { navigator: { clipboard: { writeText } }, document })).resolves.toBe(true);
        document.execCommand = vi.fn(() => false);
        await expect(copyText("x", { navigator: {}, document })).resolves.toBe(false);
        await expect(
            copyText("x", {
                navigator: {},
                document: {
                    createElement: () => {
                        throw new Error();
                    }
                }
            })
        ).resolves.toBe(false);
        delete document.execCommand;
    });
});

describe("download & store", () => {
    it("crée un lien temporaire et libère l'URL", () => {
        const env = { document, Blob, URL: { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() } };
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        downloadFile(env, "a.csv", "text/csv", "x");
        expect(click).toHaveBeenCalled();
        expect(env.URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
        expect(document.querySelector("a[download]")).toBeNull();
    });
    it("notifie les abonnés et accepte un patch fonctionnel", () => {
        const store = createStore({ a: 1, b: 1 });
        const listener = vi.fn();
        const off = store.subscribe(listener);
        store.set({ a: 2 });
        store.set(s => ({ b: s.a + 1 }));
        expect(store.get()).toEqual({ a: 2, b: 3 });
        expect(listener).toHaveBeenCalledTimes(2);
        off();
        store.set({ a: 0 });
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
