import { describe, expect, it } from "vitest";
import {
    countActiveFilters,
    criteriaDefaults,
    hasActiveFilters,
    sanitizeCriteria,
    searchIdentity,
    toApiParams,
    validateCriteria
} from "../../src/core/criteria.js";

const make = (patch = {}) => ({ ...criteriaDefaults(), query: "test", ...patch });

describe("sanitizeCriteria", () => {
    it("renvoie les valeurs par défaut pour une entrée non objet", () => {
        expect(sanitizeCriteria(null)).toEqual(criteriaDefaults());
        expect(sanitizeCriteria("x")).toEqual(criteriaDefaults());
    });
    it("applique les listes blanches et ignore les types inattendus", () => {
        const c = sanitizeCriteria({
            status: "Z",
            workforce: "99",
            category: "XXL",
            sort: "evil",
            pageSize: 999,
            section: "z",
            labels: ["est_ess", "est_ess", "evil"],
            query: { a: 1 }
        });
        expect(c.status).toBe("");
        expect(c.workforce).toBe("");
        expect(c.category).toBe("");
        expect(c.sort).toBe("relevance");
        expect(c.pageSize).toBe(20);
        expect(c.section).toBe("");
        expect(c.labels).toEqual(["est_ess"]);
        expect(c.query).toBe("");
    });
    it("accepte les valeurs valides et normalise la casse", () => {
        const c = sanitizeCriteria({
            status: "A",
            naf: "56.10a",
            department: "2a",
            section: "c",
            labels: "est_rge,est_bio",
            pageSize: "25",
            sort: "name-asc",
            cityCode: "2a004",
            query: 12345
        });
        expect(c).toMatchObject({
            status: "A",
            naf: "56.10A",
            department: "2A",
            section: "C",
            labels: ["est_rge", "est_bio"],
            pageSize: 25,
            sort: "name-asc",
            cityCode: "2A004",
            query: "12345"
        });
    });
    it("tronque les champs libres", () => {
        expect(sanitizeCriteria({ personName: "a".repeat(200) }).personName).toHaveLength(60);
    });
});

describe("validateCriteria", () => {
    it.each([
        [{}, ""],
        [{ postalCode: "75015" }, ""],
        [{ postalCode: "75015,69001" }, ""],
        [{ postalCode: "7501" }, "validation.postalCode"],
        [{ cityCode: "2A004" }, ""],
        [{ cityCode: "75056" }, ""],
        [{ cityCode: "ABCDE" }, "validation.cityCode"],
        [{ naf: "56.10A" }, ""],
        [{ naf: "5610A" }, "validation.naf"],
        [{ department: "75" }, ""],
        [{ department: "974" }, ""],
        [{ department: "2A" }, ""],
        [{ department: "2B" }, ""],
        [{ department: "2C" }, "validation.department"],
        [{ department: "999" }, "validation.department"],
        [{ region: "11" }, ""],
        [{ region: "1" }, "validation.region"],
        [{ legalForm: "5710" }, ""],
        [{ legalForm: "57" }, "validation.legalForm"],
        [{ revenueMin: "abc" }, "validation.amount"],
        [{ revenueMin: "-5" }, "validation.revenueNegative"],
        [{ revenueMax: "-5" }, "validation.revenueNegative"],
        [{ revenueMin: "100", revenueMax: "10" }, "validation.revenueRange"],
        [{ revenueMin: "10", revenueMax: "100" }, ""],
        [{ netMin: "-100", netMax: "-200" }, "validation.netRange"],
        [{ netMin: "-200", netMax: "100" }, ""],
        [{ personName: "Dupont-Durand" }, ""],
        [{ personName: "D'Artagnan" }, ""],
        [{ personName: "<script>" }, "validation.person"],
        [{ personFirstNames: "123" }, "validation.person"],
        [{ query: "a".repeat(101) }, "validation.queryTooLong"]
    ])("%j → %j", (patch, expected) => {
        expect(validateCriteria(make(patch))).toBe(expected);
    });
});

describe("toApiParams", () => {
    it("ne transmet que les critères renseignés", () => {
        const p = toApiParams(make(), 2);
        expect(Object.fromEntries(p)).toEqual({ q: "test", page: "2", per_page: "20" });
    });
    it("traduit chaque critère vers le paramètre API documenté", () => {
        const p = toApiParams(
            make({
                postalCode: "75015",
                cityCode: "75056",
                status: "A",
                naf: "56.10A",
                department: "75",
                region: "11",
                workforce: "11",
                category: "PME",
                legalForm: "5710",
                section: "I",
                labels: ["est_ess", "est_bio"],
                revenueMin: "1",
                revenueMax: "2",
                netMin: "-1",
                netMax: "3",
                personName: "Martin",
                personFirstNames: "Anne",
                pageSize: 25
            }),
            1
        );
        expect(Object.fromEntries(p)).toEqual({
            q: "test",
            page: "1",
            per_page: "25",
            code_postal: "75015",
            code_commune: "75056",
            etat_administratif: "A",
            activite_principale: "56.10A",
            departement: "75",
            region: "11",
            tranche_effectif_salarie: "11",
            categorie_entreprise: "PME",
            nature_juridique: "5710",
            section_activite_principale: "I",
            ca_min: "1",
            ca_max: "2",
            resultat_net_min: "-1",
            resultat_net_max: "3",
            nom_personne: "Martin",
            prenoms_personne: "Anne",
            est_ess: "true",
            est_bio: "true"
        });
    });
});

describe("searchIdentity / filtres actifs", () => {
    it("est insensible à la casse de la requête et à l'ordre des labels", () => {
        expect(searchIdentity(make({ query: "RENAULT", labels: ["est_bio", "est_ess"] }))).toBe(
            searchIdentity(make({ query: "renault", labels: ["est_ess", "est_bio"] }))
        );
    });
    it("distingue deux recherches aux filtres différents", () => {
        expect(searchIdentity(make({ status: "A" }))).not.toBe(searchIdentity(make({ status: "C" })));
    });
    it("tolère une entrée ancienne sans champs récents", () => {
        expect(searchIdentity({ query: "x" })).toBe(searchIdentity(make({ query: "x" })));
    });
    it("compte les filtres actifs, chaque label comptant pour un", () => {
        expect(hasActiveFilters(make())).toBe(false);
        expect(countActiveFilters(make())).toBe(0);
        const c = make({ status: "A", labels: ["est_ess", "est_rge"] });
        expect(hasActiveFilters(c)).toBe(true);
        expect(countActiveFilters(c)).toBe(3);
    });
});
