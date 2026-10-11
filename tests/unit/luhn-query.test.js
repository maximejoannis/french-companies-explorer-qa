import { describe, expect, it } from "vitest";
import { isValidSiren, isValidSiret, luhnValid } from "../../src/core/luhn.js";
import { detectQueryType, isIdentifierQuery, normalizeQuery } from "../../src/core/query.js";

describe("luhn", () => {
    it("valide des SIREN réels connus", () => {
        expect(isValidSiren("356000000")).toBe(true);
        expect(isValidSiren("552120222")).toBe(true);
        expect(isValidSiren("130025265")).toBe(true);
    });
    it("rejette une clé erronée d'un chiffre et une transposition", () => {
        expect(isValidSiren("552120223")).toBe(false);
        expect(isValidSiren("525120222")).toBe(false);
    });
    it("rejette les formats non numériques ou de mauvaise longueur", () => {
        expect(luhnValid("12a")).toBe(false);
        expect(isValidSiren("12345678")).toBe(false);
        expect(isValidSiret("1234")).toBe(false);
    });
    it("valide un SIRET standard par la clé de Luhn", () => {
        expect(isValidSiret("55212022200013")).toBe(true);
        expect(isValidSiret("55212022200014")).toBe(false);
    });
    it("applique la règle dérogatoire La Poste (somme des chiffres multiple de 5)", () => {
        expect(isValidSiret("35600000000010")).toBe(true);
        expect(isValidSiret("35600000000048")).toBe(false);
    });
});

describe("query", () => {
    it("normalise les identifiants saisis avec espaces", () => {
        expect(normalizeQuery(" 356 000 000 ")).toBe("356000000");
        expect(normalizeQuery("  La   Poste ")).toBe("La Poste");
        expect(normalizeQuery(null)).toBe("");
    });
    it.each([
        ["", "empty", false, false],
        ["   ", "empty", false, false],
        ["356000000", "siren", true, true],
        ["356 000 000", "siren", true, true],
        ["356000001", "invalid-checksum", false, true],
        ["55212022200013", "siret", true, true],
        ["55212022200014", "invalid-checksum", false, true],
        ["12345678", "invalid-length", false, false],
        ["1234567890", "invalid-length", false, false],
        ["123456789012345", "invalid-length", false, false],
        ["Renault", "text", true, true],
        ["Renault 2024", "text", true, true]
    ])("détecte %j comme %s", (input, state, valid, searchable) => {
        const info = detectQueryType(input);
        expect(info.state).toBe(state);
        expect(info.valid).toBe(valid);
        expect(info.searchable).toBe(searchable);
    });
    it("refuse une requête trop longue", () => {
        const info = detectQueryType("a".repeat(101));
        expect(info.state).toBe("too-long");
        expect(info.searchable).toBe(false);
    });
    it("identifie les recherches par identifiant", () => {
        expect(isIdentifierQuery(detectQueryType("356000000"))).toBe(true);
        expect(isIdentifierQuery(detectQueryType("55212022200013"))).toBe(true);
        expect(isIdentifierQuery(detectQueryType("Renault"))).toBe(false);
    });
});
