import { describe, expect, it } from "vitest";
import { groupCount, limitBuckets } from "../../src/core/aggregate.js";
import { addToCompare, moveInCompare, valuesDiffer } from "../../src/core/compare.js";
import { criteriaDefaults } from "../../src/core/criteria.js";
import { diffSnapshots } from "../../src/core/diff.js";
import { addHistoryEntry, upsertSavedSearch } from "../../src/core/history.js";
import { sortCompanies } from "../../src/core/sort.js";
import { computeStats } from "../../src/core/stats.js";

const co = (siren, patch = {}) => ({ siren, name: "", creation: "", status: "", city: "", postalCode: "", workforce: "", ...patch });

describe("sortCompanies", () => {
    const list = [
        co("1", { name: "Émile", creation: "2001-01-01", status: "C" }),
        co("2", { name: "", creation: "", status: "" }),
        co("3", { name: "alpha", creation: "2020-05-05", status: "A" }),
        co("4", { name: "Zoé", creation: "1999-12-31", status: "A" })
    ];
    const ids = l => l.map(x => x.siren).join(",");
    it("conserve l'ordre de pertinence et ne mute pas l'entrée", () => {
        const copy = [...list];
        expect(ids(sortCompanies(list, "relevance"))).toBe("1,2,3,4");
        expect(list).toEqual(copy);
    });
    it("trie par nom avec accents, valeurs manquantes en fin dans les deux sens", () => {
        expect(ids(sortCompanies(list, "name-asc"))).toBe("3,1,4,2");
        expect(ids(sortCompanies(list, "name-desc"))).toBe("4,1,3,2");
    });
    it("régression #12 : les dates manquantes restent en fin de tri", () => {
        expect(ids(sortCompanies(list, "creation-newest"))).toBe("3,1,4,2");
        expect(ids(sortCompanies(list, "creation-oldest"))).toBe("4,1,3,2");
    });
    it("trie par statut (actives, cessées, inconnues) de façon stable", () => {
        expect(ids(sortCompanies(list, "status"))).toBe("3,4,1,2");
    });
    it("trie par distance", () => {
        const d = [co("a", { distanceKm: 5 }), co("b", { distanceKm: null }), co("c", { distanceKm: 1 })];
        expect(ids(sortCompanies(d, "distance"))).toBe("c,a,b");
    });
});

describe("computeStats", () => {
    it("calcule les indicateurs de page", () => {
        const s = computeStats([
            co("1", { status: "A", city: "Paris", postalCode: "75001", workforce: "11", creation: "2001-01-01" }),
            co("2", { status: "C", city: "PARIS", workforce: "NN", creation: "1990-01-01" }),
            co("3", { city: "Lyon" })
        ]);
        expect(s).toEqual({ displayed: 3, active: 1, closed: 1, unknown: 1, cities: 2, withPostalCode: 1, withWorkforce: 1, oldestCreation: "1990-01-01" });
        expect(computeStats([]).oldestCreation).toBe("");
    });
});

describe("aggregate", () => {
    it("regroupe, trie et place « non renseigné » en dernier", () => {
        const b = groupCount(
            [{ k: "A" }, { k: "" }, { k: "B" }, { k: "B" }, { k: "" }, { k: "" }],
            x => x.k,
            k => k || "NR"
        );
        expect(b).toEqual([
            { key: "B", label: "B", count: 2 },
            { key: "A", label: "A", count: 1 },
            { key: "", label: "NR", count: 3 }
        ]);
        expect(
            groupCount(
                [],
                x => x,
                x => x
            )
        ).toEqual([]);
    });
    it("regroupe la traîne dans « Autres »", () => {
        const buckets = [1, 2, 3, 4].map(n => ({ key: String(n), label: String(n), count: 5 - n }));
        expect(limitBuckets(buckets, 3, "Autres")).toEqual([buckets[0], buckets[1], { key: "__other", label: "Autres", count: 3 }]);
        expect(limitBuckets(buckets, 10, "Autres")).toBe(buckets);
    });
});

describe("history", () => {
    const entry = q => ({ ...criteriaDefaults(), query: q });
    it("dédoublonne sans tenir compte de la casse et plafonne", () => {
        let list = [];
        for (const q of ["a", "b", "A", "c", "d"]) list = addHistoryEntry(list, entry(q), 3);
        expect(list.map(x => x.query)).toEqual(["d", "c", "A"]);
    });
    it("met à jour le nom d'une recherche sauvegardée identique en conservant l'id", () => {
        const first = upsertSavedSearch([], { ...entry("x"), id: "1", name: "Un" }, 12);
        expect(first.updated).toBe(false);
        const second = upsertSavedSearch(first.list, { ...entry("X"), id: "2", name: "Deux" }, 12);
        expect(second.updated).toBe(true);
        expect(second.list).toEqual([{ ...entry("x"), id: "1", name: "Deux" }]);
        const third = upsertSavedSearch(second.list, { ...entry("y"), id: "3", name: "Trois" }, 1);
        expect(third.list.map(s => s.id)).toEqual(["3"]);
    });
});

describe("compare", () => {
    it("ajoute, refuse les doublons et respecte la limite", () => {
        let r = addToCompare([], { siren: "1" }, 2);
        expect(r.result).toBe("added");
        expect(addToCompare(r.list, { siren: "1" }, 2).result).toBe("duplicate");
        r = addToCompare(r.list, { siren: "2" }, 2);
        expect(addToCompare(r.list, { siren: "3" }, 2)).toEqual({ list: r.list, result: "full" });
    });
    it("réordonne et ignore les déplacements impossibles", () => {
        const l = [{ siren: "1" }, { siren: "2" }, { siren: "3" }];
        expect(moveInCompare(l, "2", -1).map(x => x.siren)).toEqual(["2", "1", "3"]);
        expect(moveInCompare(l, "3", 1)).toBe(l);
        expect(moveInCompare(l, "x", 1)).toBe(l);
    });
    it("détecte les valeurs différentes", () => {
        expect(valuesDiffer(["a", "a"])).toBe(false);
        expect(valuesDiffer([null, ""])).toBe(false);
        expect(valuesDiffer([1, "1"])).toBe(false);
        expect(valuesDiffer(["a", "b"])).toBe(true);
    });
});

describe("diffSnapshots", () => {
    it("ne signale rien sans changement", () => {
        expect(diffSnapshots({ name: "X", status: "A" }, { name: "X", status: "A" })).toEqual([]);
    });
    it("détecte un passage A → C et un changement d'adresse", () => {
        expect(diffSnapshots({ status: "A", address: "1" }, { status: "C", address: "2" })).toEqual([
            { field: "status", before: "A", after: "C" },
            { field: "address", before: "1", after: "2" }
        ]);
    });
    it("traite les valeurs absentes comme vides", () => {
        expect(diffSnapshots({}, { city: "Paris" }, ["city"])).toEqual([{ field: "city", before: "", after: "Paris" }]);
        expect(diffSnapshots(null, null, ["city"])).toEqual([]);
    });
});
