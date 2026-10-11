import { describe, expect, it } from "vitest";
import { normalizeCompany } from "../../src/core/company.js";
import { csvEscape, neutralizeCsvFormula, toCsv } from "../../src/core/csv.js";
import { buildCsv, buildJson, DEFAULT_COLUMN_IDS, EXPORT_COLUMNS, exportFileName, resolveColumns, slugify } from "../../src/core/export.js";
import { FIXTURE_COMPANIES } from "../../src/qa-lab/fixtures.js";

describe("csv", () => {
    it.each([
        ["=1+1", "'=1+1"],
        ["+33", "'+33"],
        ["-2", "'-2"],
        ["@SUM(A1)", "'@SUM(A1)"],
        ["  =x", "'  =x"],
        ["\tcmd", "'\tcmd"],
        ["\r=1", "'\r=1"],
        ["\rabc", "'\rabc"],
        ["Renault", "Renault"],
        [null, ""],
        [undefined, ""],
        [42, "42"]
    ])("neutralise %j", (input, expected) => expect(neutralizeCsvFormula(input)).toBe(expected));
    it("échappe guillemets, séparateurs et retours à la ligne", () => {
        expect(csvEscape('Dit "bonjour"; ok\nfin')).toBe('"Dit ""bonjour""; ok\nfin"');
    });
    it("ajoute le BOM et utilise ; et CRLF", () => {
        expect(
            toCsv([
                ["a", "b"],
                ["c", "d"]
            ])
        ).toBe('﻿"a";"b"\r\n"c";"d"');
    });
});

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

describe("export", () => {
    const companies = FIXTURE_COMPANIES.slice(0, 3).map(normalizeCompany);
    it("utilise les colonnes par défaut si aucune colonne valide n'est demandée", () => {
        expect(resolveColumns(["inconnue"]).map(c => c.id)).toEqual(DEFAULT_COLUMN_IDS);
        expect(DEFAULT_COLUMN_IDS).not.toContain("directors");
    });
    it("marque la colonne dirigeants comme personnelle et désactivée par défaut", () => {
        const directors = EXPORT_COLUMNS.find(c => c.id === "directors");
        expect(directors.personal).toBe(true);
        expect(directors.defaultOn).toBe(false);
    });
    it("produit un CSV avec en-têtes traduits et valeurs neutralisées", () => {
        const csv = buildCsv([normalizeCompany(FIXTURE_COMPANIES[8])], ["siren", "name", "status"], { t });
        expect(csv.split("\r\n")).toEqual(['﻿"field.siren";"field.name";"field.status"', `"900000084";"'=CMD|' /C calc'!A0 CONSEIL";"status.active"`]);
    });
    it("produit un JSON restreint aux colonnes choisies", () => {
        const json = JSON.parse(
            buildJson(companies, ["siren", "revenue", "labels", "directors", "distance", "note", "tags"], {
                t,
                metaFor: s => ({ note: `n${s}`, tags: ["x", "y"] })
            })
        );
        expect(json[0]).toEqual({
            siren: "900000001",
            revenue: 880000,
            labels: "label.est_bio, label.convention_collective_renseignee",
            directors: "TESTEUR Alice (Gérant) ; HOLDING ASSERTION (Associé)",
            distance: null,
            note: "n900000001",
            tags: "x, y"
        });
        expect(json[2].revenue).toBeNull();
    });
    it("couvre toutes les colonnes sans erreur, y compris sans métadonnées", () => {
        const all = EXPORT_COLUMNS.map(c => c.id);
        const row = JSON.parse(
            buildJson([{ ...companies[0], distanceKm: 1.23456 }, normalizeCompany({ siren: "356000000", etat_administratif: "C" })], all, { t })
        );
        expect(Object.keys(row[0])).toEqual(all);
        expect(row[0].distance).toBe(1.23);
        expect(row[0].note).toBe("");
        expect(row[1].status).toBe("status.closed");
        expect(JSON.parse(buildJson([normalizeCompany({ siren: "356000000" })], ["status"], { t }))[0].status).toBe("status.unknown");
    });
    it("construit des noms de fichiers sûrs", () => {
        expect(slugify("Café « Crème » & Co !")).toBe("cafe-creme-co");
        expect(slugify("")).toBe("entreprises");
        expect(slugify("a".repeat(60))).toHaveLength(40);
        expect(slugify("----")).toBe("entreprises");
        expect(exportFileName("csv", "results", "La Poste")).toBe("entreprises-results-la-poste.csv");
        expect(exportFileName("json", "", "")).toBe("entreprises-export-entreprises.json");
    });
});
