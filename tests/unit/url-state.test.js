import { describe, expect, it } from "vitest";
import { criteriaDefaults } from "../../src/core/criteria.js";
import { carryQaParams, nearbyDefaults, paramsToState, positiveInt, sanitizeNearby, stateToParams } from "../../src/core/url-state.js";

describe("positiveInt", () => {
    it.each([
        ["3", 3],
        ["0", 1],
        ["-2", 1],
        ["1.5", 1],
        ["abc", 1],
        [null, 1],
        ["", 1]
    ])("%j → %j", (v, e) => expect(positiveInt(v)).toBe(e));
});

describe("paramsToState", () => {
    it("reste compatible avec les liens v1.1.1", () => {
        const s = paramsToState(new URLSearchParams("q=Renault&cp=75015&status=A&size=10&sort=name-asc&page=3"));
        expect(s.view).toBe("search");
        expect(s.page).toBe(3);
        expect(s.criteria).toMatchObject({ query: "Renault", postalCode: "75015", status: "A", pageSize: 10, sort: "name-asc" });
    });
    it("ignore les paramètres inconnus et les valeurs hors liste blanche", () => {
        const s = paramsToState(new URLSearchParams("q=x&status=<b>&sort=drop&view=admin&size=1000&evil=1&lang=de"));
        expect(s.criteria.status).toBe("");
        expect(s.criteria.sort).toBe("relevance");
        expect(s.criteria.pageSize).toBe(20);
        expect(s.view).toBe("search");
        expect(s.lang).toBe("");
    });
    it("renvoie l'accueil sans requête ni vue", () => {
        expect(paramsToState(new URLSearchParams("")).view).toBe("home");
    });
    it("rejette une fiche sans SIREN valide", () => {
        expect(paramsToState(new URLSearchParams("view=detail&siren=abc")).view).toBe("home");
        expect(paramsToState(new URLSearchParams("view=detail&siren=abc&q=x")).view).toBe("search");
        expect(paramsToState(new URLSearchParams("view=detail&siren=356000000")).siren).toBe("356000000");
    });
    it("lit la comparaison partagée (SIREN valides, dédoublonnés, 3 max)", () => {
        const s = paramsToState(new URLSearchParams("view=compare&sirens=356000000,356000000,abc,552120222,130025265,441639465"));
        expect(s.sirens).toEqual(["356000000", "552120222", "130025265"]);
    });
    it("lit et borne la recherche à proximité", () => {
        const s = paramsToState(new URLSearchParams("view=nearby&lat=48.85&lon=2.35&radius=500&nnaf=56.10a&nsection=i&place=Paris"));
        expect(s.nearby).toEqual({ lat: 48.85, lon: 2.35, radius: 50, naf: "56.10A", section: "I", place: "Paris" });
        expect(paramsToState(new URLSearchParams("view=nearby&lat=200&lon=x")).nearby.lat).toBeNull();
    });
});

describe("stateToParams", () => {
    it("produit une URL canonique sans valeurs par défaut", () => {
        expect(stateToParams({ view: "home" }).toString()).toBe("");
        expect(stateToParams({ view: "search", criteria: { ...criteriaDefaults(), query: "La Poste" }, page: 1 }).toString()).toBe("q=La+Poste");
    });
    it("fait l'aller-retour criteria → params → criteria", () => {
        const samples = [
            { query: "Renault", status: "A", labels: ["est_ess"], pageSize: 25, sort: "creation-oldest", revenueMin: "1000", section: "C" },
            { query: "356000000", postalCode: "75015,69001", cityCode: "2A004", city: "Ajaccio", department: "2A", personName: "Martin" },
            { query: "café crème", naf: "56.10A", region: "11", workforce: "12", category: "PME", legalForm: "5710", netMin: "-10", netMax: "10" }
        ];
        for (const sample of samples) {
            const criteria = { ...criteriaDefaults(), ...sample };
            const back = paramsToState(stateToParams({ view: "search", criteria, page: 2 }));
            expect(back.criteria).toEqual(criteria);
            expect(back.page).toBe(2);
        }
    });
    it("sérialise fiche, comparaison, proximité et langue", () => {
        expect(stateToParams({ view: "detail", siren: "356000000", criteria: { ...criteriaDefaults(), query: "x" } }).toString()).toBe(
            "view=detail&q=x&siren=356000000"
        );
        expect(stateToParams({ view: "compare", sirens: ["356000000", "552120222"] }).toString()).toBe("view=compare&sirens=356000000%2C552120222");
        expect(
            stateToParams({
                view: "nearby",
                nearby: { ...nearbyDefaults(), lat: 48.85, lon: 2.35, radius: 10, naf: "56.10A", section: "I", place: "Paris" }
            }).toString()
        ).toBe("view=nearby&lat=48.85&lon=2.35&radius=10&nnaf=56.10A&nsection=I&place=Paris");
        expect(stateToParams({ view: "nearby", nearby: nearbyDefaults() }).toString()).toBe("view=nearby");
        expect(stateToParams({ view: "favorites", lang: "en" }).toString()).toBe("view=favorites&lang=en");
        expect(stateToParams({ view: "about", lang: "xx" }).toString()).toBe("view=about");
    });
    it("sanitizeNearby tolère une entrée invalide", () => {
        expect(sanitizeNearby(null)).toEqual(nearbyDefaults());
        expect(sanitizeNearby({ radius: "abc", naf: 3 }).radius).toBe(5);
        expect(sanitizeNearby({ radius: 0 }).radius).toBe(1);
    });
    it("conserve les paramètres du Labo QA", () => {
        const to = carryQaParams(new URLSearchParams("qa=1&qaScenario=429&q=x"), new URLSearchParams("view=about"));
        expect(to.toString()).toBe("view=about&qa=1&qaScenario=429");
    });
});
