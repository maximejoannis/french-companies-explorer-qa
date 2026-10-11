import { describe, expect, it } from "vitest";
import { computeVatNumber, extractLabels, fromSnapshot, normalizeCompany, statusView, toSnapshot } from "../../src/core/company.js";
import { FIXTURE_COMPANIES } from "../../src/qa-lab/fixtures.js";

describe("normalizeCompany", () => {
    it("normalise une unité légale complète", () => {
        const c = normalizeCompany(FIXTURE_COMPANIES[0]);
        expect(c).toMatchObject({
            siren: "900000001",
            name: "BOULANGERIE DES TESTS",
            acronym: "BDT",
            activity: "10.71C",
            section: "C",
            status: "A",
            creation: "2012-03-14",
            legal: "5499",
            category: "PME",
            workforce: "11",
            siret: "90000000100009",
            postalCode: "75015",
            city: "PARIS",
            department: "75",
            latitude: 48.8412,
            longitude: 2.3003,
            establishmentsCount: 3,
            openEstablishmentsCount: 2,
            labels: ["est_bio", "convention_collective_renseignee"]
        });
        expect(c.establishments).toHaveLength(3);
        expect(c.directors).toEqual([
            { kind: "person", name: "TESTEUR", firstNames: "Alice", role: "Gérant", birth: "1980-05", siren: "" },
            { kind: "company", name: "HOLDING ASSERTION", firstNames: "", role: "Associé", birth: "", siren: "900000019" }
        ]);
        expect(c.finances.map(f => f.year)).toEqual([2021, 2022, 2023]);
        expect(c.vat).toBe(computeVatNumber("900000001"));
        expect(c.vatComputed).toBe(true);
    });
    it("ne laisse aucun champ indéfini quand le siège et les données manquent", () => {
        const c = normalizeCompany({ siren: "356000000" });
        for (const [k, v] of Object.entries(c)) expect(v, k).not.toBeUndefined();
        expect(c.name).toBe("");
        expect(c.address).toBe("");
        expect(c.latitude).toBeNull();
        expect(c.establishmentsCount).toBeNull();
    });
    it("rejette un SIREN invalide et des types inattendus", () => {
        expect(normalizeCompany({ siren: "<b>" }).siren).toBe("");
        expect(normalizeCompany(null).siren).toBe("");
        expect(normalizeCompany({ siren: "356000000", date_creation: "hier", nombre_etablissements: -2 }).creation).toBe("");
    });
    it("utilise etablissements si matching_etablissements est absent et reconstruit l'adresse", () => {
        const c = normalizeCompany({
            siren: "356000000",
            etablissements: [{ siret: "x" }],
            siege: { numero_voie: "9", type_voie: "RUE", libelle_voie: "X", code_postal: "75001", libelle_commune: "PARIS" }
        });
        expect(c.establishments).toHaveLength(1);
        expect(c.establishments[0].siret).toBe("");
        expect(c.address).toBe("9 RUE X 75001 PARIS");
    });
    it("prend la TVA fournie par l'API sous ses différentes formes", () => {
        expect(normalizeCompany({ siren: "356000000", tva: "FR00356000000" }).vat).toBe("FR00356000000");
        expect(normalizeCompany({ siren: "356000000", tva: ["FR11356000000"] }).vat).toBe("FR11356000000");
        expect(normalizeCompany({ siren: "356000000", tva: { numero_tva_intra: "FR22356000000" } }).vatComputed).toBe(false);
        expect(normalizeCompany({ siren: "356000000", tva: 42 }).vat).toBe("FR39356000000");
    });
    it("met le statut en majuscules et reconnaît une personne morale par sa dénomination", () => {
        const c = normalizeCompany({
            siren: "356000000",
            etat_administratif: "a",
            dirigeants: [
                { denomination: "X", siren: "bad" },
                { nom: "Y", annee_de_naissance: "19xx" }
            ]
        });
        expect(c.status).toBe("A");
        expect(c.directors[0]).toMatchObject({ kind: "company", siren: "" });
        expect(c.directors[1]).toMatchObject({ kind: "person", birth: "" });
    });
});

describe("TVA, labels, statut", () => {
    it("calcule la clé TVA à partir du SIREN", () => {
        expect(computeVatNumber("356000000")).toBe("FR39356000000");
        expect(computeVatNumber("abc")).toBe("");
    });
    it("n'extrait que les labels connus à true", () => {
        expect(extractLabels({ est_ess: true, est_bio: "true", inconnu: true })).toEqual(["est_ess"]);
        expect(extractLabels(null)).toEqual([]);
    });
    it.each([
        ["A", "company", "active", "status.active"],
        ["c", "company", "closed", "status.closed"],
        ["F", "company", "unknown", "status.unknown"],
        ["F", "establishment", "closed", "status.closedEstablishment"],
        ["C", "establishment", "closed", "status.closedEstablishment"],
        [undefined, "company", "unknown", "status.unknown"]
    ])("statusView(%j, %s)", (v, kind, tone, key) => {
        expect(statusView(v, kind)).toMatchObject({ tone, labelKey: key });
    });
});

describe("instantanés", () => {
    it("n'incluent ni dirigeants ni établissements et gardent le dernier exercice", () => {
        const snap = toSnapshot(normalizeCompany(FIXTURE_COMPANIES[0]));
        expect(snap).not.toHaveProperty("directors");
        expect(snap).not.toHaveProperty("establishments");
        expect(JSON.stringify(snap)).not.toContain("TESTEUR");
        expect(snap).toMatchObject({ lastFinanceYear: 2023, lastRevenue: 880000, lastNetIncome: -12000 });
        expect(toSnapshot(normalizeCompany({ siren: "356000000" })).lastRevenue).toBeNull();
    });
    it("font l'aller-retour vers un objet Company complet", () => {
        const original = normalizeCompany(FIXTURE_COMPANIES[0]);
        const back = fromSnapshot(toSnapshot(original));
        expect(back).toMatchObject({ siren: original.siren, name: original.name, city: original.city, latitude: original.latitude });
        expect(back.finances).toEqual([{ year: 2023, revenue: 880000, netIncome: -12000, revenueChange: null }]);
        expect(back.directors).toEqual([]);
    });
    it("tolèrent un instantané vide ou partiel", () => {
        const c = fromSnapshot(null);
        expect(c.siren).toBe("");
        expect(c.labels).toEqual([]);
        expect(fromSnapshot({ siren: "356000000", labels: [1, "est_ess"], latitude: "x" })).toMatchObject({ labels: ["est_ess"], latitude: null });
    });
});
