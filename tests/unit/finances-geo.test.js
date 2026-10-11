import { describe, expect, it } from "vitest";
import { formatEuro, formatPercent, normalizeFinances, percentChange } from "../../src/core/finances.js";
import { formatDistance, haversineKm, osmUrl, parseCoordinate, roundCoordinate } from "../../src/core/geo.js";

describe("finances", () => {
    it("renvoie une liste vide sans données exploitables", () => {
        expect(normalizeFinances(null)).toEqual([]);
        expect(normalizeFinances([])).toEqual([]);
        expect(normalizeFinances({ abc: { ca: 1 }, 2020: null, 2021: { ca: null, resultat_net: null } })).toEqual([]);
    });
    it("trie les exercices et calcule la variation du CA", () => {
        const f = normalizeFinances({ 2023: { ca: 110, resultat_net: -5 }, 2022: { ca: 100, resultat_net: 3 } });
        expect(f).toEqual([
            { year: 2022, revenue: 100, netIncome: 3, revenueChange: null },
            { year: 2023, revenue: 110, netIncome: -5, revenueChange: 10 }
        ]);
    });
    it("gère valeurs manquantes et base nulle", () => {
        expect(percentChange(0, 10)).toBeNull();
        expect(percentChange(null, 10)).toBeNull();
        expect(percentChange(-100, -50)).toBe(50);
        const f = normalizeFinances({ 2021: { ca: 0, resultat_net: 1 }, 2022: { ca: 50 } });
        expect(f[1].revenueChange).toBeNull();
    });
    it("formate montants et pourcentages", () => {
        expect(formatEuro(1234567).replace(/\s/g, " ")).toBe("1 234 567 €");
        expect(formatEuro(null)).toBe("");
        expect(formatPercent(12.345)).toBe("+12,3 %");
        expect(formatPercent(-3)).toBe("-3 %");
        expect(formatPercent(null)).toBe("");
        expect(formatEuro(1000, "en-US")).toBe("€1,000");
    });
});

describe("geo", () => {
    it("parse les coordonnées en chaîne et rejette les valeurs invalides", () => {
        expect(parseCoordinate("48.85", 90)).toBe(48.85);
        expect(parseCoordinate("2,35", 180)).toBe(2.35);
        expect(parseCoordinate(3, 180)).toBe(3);
        expect(parseCoordinate("91", 90)).toBeNull();
        expect(parseCoordinate("", 90)).toBeNull();
        expect(parseCoordinate(null, 90)).toBeNull();
        expect(parseCoordinate("abc", 90)).toBeNull();
    });
    it("calcule une distance nulle et Paris ↔ Marseille (~661 km)", () => {
        const paris = { lat: 48.8566, lon: 2.3522 };
        expect(haversineKm(paris, paris)).toBe(0);
        expect(haversineKm(paris, { lat: 43.2965, lon: 5.3698 })).toBeGreaterThan(655);
        expect(haversineKm(paris, { lat: 43.2965, lon: 5.3698 })).toBeLessThan(665);
    });
    it("arrondit les coordonnées pour la vie privée", () => {
        expect(roundCoordinate(48.856613, 2)).toBe(48.86);
        expect(roundCoordinate(-1.55361, 2)).toBe(-1.55);
    });
    it("formate les distances", () => {
        expect(formatDistance(0.25)).toBe("250 m");
        expect(formatDistance(12.345)).toBe("12,3 km");
        expect(formatDistance(Number.NaN)).toBe("");
    });
    it("construit un lien OpenStreetMap", () => {
        expect(osmUrl(48.1, 2.2)).toBe("https://www.openstreetmap.org/?mlat=48.1&mlon=2.2#map=17/48.1/2.2");
    });
});
