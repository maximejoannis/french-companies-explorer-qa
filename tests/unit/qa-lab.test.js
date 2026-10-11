import { describe, expect, it, vi } from "vitest";
import { createQaStorage, createQaTransport, MAX_LATENCY_MS, mountQaPanel, readQaConfig, SCENARIOS, setupQaLab } from "../../src/qa-lab/index.js";
import { respondWithFixtures } from "../../src/qa-lab/fixtures.js";

const API = "https://recherche-entreprises.api.gouv.fr/search?q=paris&per_page=10";
const GEO = "https://geo.api.gouv.fr/communes?nom=par";
const init = () => ({ signal: new AbortController().signal, headers: {} });

describe("configuration", () => {
    it("lit l'URL en priorité, puis la session, et borne les valeurs", () => {
        const session = { getItem: () => JSON.stringify({ scenario: "500", latency: 200 }) };
        expect(readQaConfig(new URLSearchParams("qaScenario=429"), session)).toEqual({ scenario: "429", latency: 200, storage: "normal" });
        expect(readQaConfig(new URLSearchParams("qaScenario=evil&qaLatency=999999"), null)).toEqual({
            scenario: "none",
            latency: MAX_LATENCY_MS,
            storage: "normal"
        });
        expect(readQaConfig(new URLSearchParams("qaLatency=abc"), { getItem: () => "{corrompu" })).toEqual({ scenario: "none", latency: 0, storage: "normal" });
        expect(readQaConfig(new URLSearchParams("qaLatency=-5"), null).latency).toBe(0);
    });
});

describe("transport instrumenté", () => {
    const real = vi.fn(async () => new Response("{}", { status: 200 }));
    const run = (scenario, url = API, latency = 0, sleep = async () => {}) => createQaTransport(() => ({ scenario, latency }), real, sleep)(url, init());

    it("délègue au transport réel sans scénario", async () => {
        await run("none");
        expect(real).toHaveBeenCalledTimes(1);
    });
    it.each([
        ["400", 400],
        ["404", 404],
        ["500", 500],
        ["429", 429]
    ])("simule HTTP %s", async (scenario, status) => {
        const r = await run(scenario);
        expect(r.status).toBe(status);
        if (scenario === "429") expect(r.headers.get("Retry-After")).toBe("1");
    });
    it("sert les fixtures, le vide (API et géo) et un JSON invalide", async () => {
        expect((await (await run("fixtures")).json()).total_results).toBe(4);
        expect(await (await run("empty")).json()).toMatchObject({ results: [], total_results: 0 });
        expect(await (await run("empty", GEO)).json()).toEqual([]);
        await expect((await run("invalid-json")).json()).rejects.toThrow();
    });
    it("simule une coupure réseau et un timeout annulable", async () => {
        await expect(run("offline")).rejects.toThrow(TypeError);
        const controller = new AbortController();
        const p = createQaTransport(
            () => ({ scenario: "timeout", latency: 0 }),
            real,
            async () => {}
        )(API, { signal: controller.signal, headers: {} });
        controller.abort();
        await expect(p).rejects.toMatchObject({ name: "AbortError" });
        const aborted = new AbortController();
        aborted.abort();
        await expect(
            createQaTransport(
                () => ({ scenario: "timeout", latency: 0 }),
                real,
                async () => {}
            )(API, { signal: aborted.signal, headers: {} })
        ).rejects.toMatchObject({ name: "AbortError" });
    });
    it("applique la latence configurée", async () => {
        const sleep = vi.fn(async () => {});
        await run("fixtures", API, 1500, sleep);
        expect(sleep).toHaveBeenCalledWith(1500, expect.anything());
    });
    it("expose la liste des scénarios", () => expect(SCENARIOS).toContain("fixtures"));
});

describe("panneau", () => {
    it("monte une bannière visible et persiste les changements en session et dans l'URL", () => {
        window.history.replaceState({}, "", "/?qa=1");
        const config = { scenario: "none", latency: 0, storage: "normal" };
        const reload = vi.fn();
        const banner = mountQaPanel(document, config, { session: sessionStorage, history: window.history, location: window.location, reload });
        expect(document.querySelector("[data-testid=qa-lab-banner]")).toBe(banner);
        expect(document.documentElement.dataset.qa).toBe("1");
        const select = banner.querySelector("[data-testid=qa-lab-scenario]");
        select.value = "429";
        select.dispatchEvent(new Event("change"));
        const latency = banner.querySelector("[data-testid=qa-lab-latency]");
        latency.value = "99999";
        latency.dispatchEvent(new Event("change"));
        expect(config).toEqual({ scenario: "429", latency: MAX_LATENCY_MS, storage: "normal" });
        expect(JSON.parse(sessionStorage.getItem("fce:qa"))).toEqual(config);
        expect(window.location.search).toBe(`?qa=1&qaScenario=429&qaLatency=${MAX_LATENCY_MS}&qaStorage=normal`);
        const storageSelect = banner.querySelector("[data-testid=qa-lab-storage]");
        storageSelect.value = "quota";
        storageSelect.dispatchEvent(new Event("change"));
        expect(config.storage).toBe("quota");
        expect(reload).toHaveBeenCalledTimes(1);
        storageSelect.value = "inconnu";
        storageSelect.dispatchEvent(new Event("change"));
        expect(config.storage).toBe("normal");
        latency.value = "abc";
        latency.dispatchEvent(new Event("change"));
        expect(config.latency).toBe(0);
        select.value = "inconnu";
        select.dispatchEvent(new Event("change"));
        expect(config.scenario).toBe("none");
        banner.remove();
    });
    it("tolère un sessionStorage qui lève", () => {
        const config = { scenario: "none", latency: 0 };
        const banner = mountQaPanel(document, config, {
            session: {
                setItem: () => {
                    throw new Error("x");
                }
            },
            history: window.history,
            location: window.location
        });
        expect(banner).toBeTruthy();
        banner.remove();
    });
    it("setupQaLab renvoie un transport utilisant la configuration de l'URL", async () => {
        window.history.replaceState({}, "", "/?qa=1&qaScenario=fixtures");
        const { transport, storageBackend } = setupQaLab(window, vi.fn(), async () => {});
        expect(storageBackend).toBeUndefined();
        const r = await transport(API, init());
        expect((await r.json()).results).toHaveLength(4);
        document.querySelector("[data-testid=qa-lab-banner]").remove();
        const broken = Object.create(window, {
            sessionStorage: {
                get() {
                    throw new Error("SecurityError");
                }
            }
        });
        expect(() => setupQaLab(broken, vi.fn(), async () => {})).not.toThrow();
        document.querySelector("[data-testid=qa-lab-banner]")?.remove();
        window.history.replaceState({}, "", "/");
    });
});

describe("fixtures", () => {
    it.each([
        ["https://recherche-entreprises.api.gouv.fr/search?q=", 400],
        ["https://recherche-entreprises.api.gouv.fr/near_point?lat=x&long=2", 400]
    ])("valide les paramètres obligatoires %s", (url, status) => expect(respondWithFixtures(url).status).toBe(status));
    it("filtre par SIRET, catégorie, CA, nature juridique, effectif, NAF, département et dirigeant", () => {
        const sirens = url => respondWithFixtures(`https://recherche-entreprises.api.gouv.fr/search?${url}`).body.results.map(r => r.siren);
        expect(sirens("q=90000000100009")).toEqual(["900000001"]);
        expect(sirens("q=*&categorie_entreprise=GE")).toEqual(["900000100"]);
        expect(sirens("q=*&ca_min=10000000&ca_max=20000000")).toEqual(["900000019"]);
        expect(sirens("q=*&nature_juridique=9220")).toEqual(["900000092"]);
        expect(sirens("q=*&tranche_effectif_salarie=22")).toEqual(["900000019"]);
        expect(sirens("q=*&activite_principale=56.10A&departement=75")).toEqual(["900000050"]);
        expect(sirens("q=*&nom_personne=testeur")).toEqual(["900000001"]);
        expect(sirens("q=*&code_commune=69123&code_postal=69002")).toEqual(["900000019"]);
        expect(respondWithFixtures("https://recherche-entreprises.api.gouv.fr/search?q=paris&minimal=true&include=siege").body.results[0]).not.toHaveProperty(
            "dirigeants"
        );
    });
});

describe("stockage simulé", () => {
    it("bloque, sature ou laisse passer le stockage", () => {
        expect(createQaStorage("blocked", localStorage)).toBeNull();
        expect(createQaStorage("normal", localStorage)).toBeUndefined();
        expect(createQaStorage("quota", null)).toBeUndefined();
        localStorage.setItem("fce:v2:x", "1");
        const quota = createQaStorage("quota", localStorage);
        expect(quota.getItem("fce:v2:x")).toBe("1");
        expect(() => quota.setItem("a", "b")).toThrow(expect.objectContaining({ name: "QuotaExceededError" }));
        expect(quota.length).toBe(1);
        expect(quota.key(0)).toBe("fce:v2:x");
        quota.removeItem("fce:v2:x");
        expect(localStorage.getItem("fce:v2:x")).toBeNull();
    });
    it("lit le mode de stockage depuis l'URL", () => {
        expect(readQaConfig(new URLSearchParams("qaStorage=quota"), null).storage).toBe("quota");
        expect(readQaConfig(new URLSearchParams("qaStorage=evil"), null).storage).toBe("normal");
    });
});
