// @ts-check
import { LABELS } from "../config.js";
import { normalizeFinances } from "./finances.js";
import { parseCoordinate } from "./geo.js";

/**
 * @typedef {{ siret: string, address: string, city: string, postalCode: string, status: string, isHeadOffice: boolean }} Establishment
 * @typedef {{ kind: "person"|"company", name: string, firstNames: string, role: string, birth: string, siren: string }} Director
 * @typedef {Object} Company
 * @property {string} siren
 * @property {string} name
 * @property {string} acronym
 * @property {string} activity
 * @property {string} activityLabel
 * @property {string} section
 * @property {string} status
 * @property {string} creation  date ISO AAAA-MM-JJ ou ""
 * @property {string} legal
 * @property {string} category
 * @property {string} workforce
 * @property {string} siret
 * @property {string} address
 * @property {string} postalCode
 * @property {string} city
 * @property {string} department
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {number|null} establishmentsCount
 * @property {number|null} openEstablishmentsCount
 * @property {Establishment[]} establishments
 * @property {Director[]} directors
 * @property {import("./finances.js").FinanceYear[]} finances
 * @property {string[]} labels
 * @property {string} vat
 * @property {boolean} vatComputed
 * @property {string} diffusion  statut de diffusion SIRENE : "O" (diffusible), "P" (partielle, suite à opposition) ou ""
 * @property {string} minimized  "" ou motif de minimisation de l'instantané ("ei", "partial")
 */

/**
 * @param {unknown} v
 * @param {number} [max]
 */
function str(v, max = 300) {
    return typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "";
}

/** @param {unknown} v */
function count(v) {
    const n = Number(v);
    return v !== null && v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 ? n : null;
}

/** @param {unknown} v */
function isoDate(v) {
    const s = str(v, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/**
 * Numéro de TVA intracommunautaire calculé à partir du SIREN (clé = (12 + 3 × (SIREN mod 97)) mod 97).
 * @param {string} siren
 */
export function computeVatNumber(siren) {
    if (!/^\d{9}$/.test(siren)) return "";
    const key = (12 + 3 * (Number(siren) % 97)) % 97;
    return `FR${String(key).padStart(2, "0")}${siren}`;
}

/** @param {any} e */
function normalizeEstablishment(e) {
    const src = e && typeof e === "object" ? e : {};
    return {
        siret: /^\d{14}$/.test(str(src.siret)) ? str(src.siret) : "",
        address: str(src.adresse),
        city: str(src.libelle_commune),
        postalCode: str(src.code_postal, 5),
        status: str(src.etat_administratif || src.etat_administratif_etablissement, 1).toUpperCase(),
        isHeadOffice: src.est_siege === true
    };
}

/** @param {any} d */
function normalizeDirector(d) {
    const src = d && typeof d === "object" ? d : {};
    const isCompany = str(src.type_dirigeant).toLowerCase().includes("morale") || Boolean(src.denomination);
    if (isCompany) {
        return {
            kind: /** @type {const} */ ("company"),
            name: str(src.denomination, 200),
            firstNames: "",
            role: str(src.qualite, 120),
            birth: "",
            siren: /^\d{9}$/.test(str(src.siren)) ? str(src.siren) : ""
        };
    }
    const birth = str(src.date_de_naissance, 7) || str(src.annee_de_naissance, 4);
    return {
        kind: /** @type {const} */ ("person"),
        name: str(src.nom, 120),
        firstNames: str(src.prenoms, 120),
        role: str(src.qualite, 120),
        birth: /^\d{4}(-\d{2})?$/.test(birth) ? birth : "",
        siren: ""
    };
}

/**
 * @param {any} complements
 * @returns {string[]}
 */
export function extractLabels(complements) {
    if (!complements || typeof complements !== "object") return [];
    return LABELS.map(([key]) => key).filter(key => complements[key] === true);
}

/** @param {any} tva */
function vatFrom(tva) {
    if (typeof tva === "string") return tva;
    if (Array.isArray(tva)) return str(tva.find(v => typeof v === "string"));
    if (tva && typeof tva === "object") return str(tva.numero_tva_intra || tva.numero);
    return "";
}

/**
 * Transforme une unité légale brute de l'API en objet Company sûr (aucun champ indéfini).
 * @param {any} raw
 * @returns {Company}
 */
export function normalizeCompany(raw) {
    const x = raw && typeof raw === "object" ? raw : {};
    const s = x.siege && typeof x.siege === "object" ? x.siege : {};
    const siren = /^\d{9}$/.test(str(x.siren)) ? str(x.siren) : "";
    const establishmentsRaw = Array.isArray(x.matching_etablissements) ? x.matching_etablissements : Array.isArray(x.etablissements) ? x.etablissements : [];
    const apiVat = vatFrom(x.tva);
    const address =
        str(s.adresse) ||
        [s.numero_voie, s.type_voie, s.libelle_voie, s.code_postal, s.libelle_commune]
            .map(v => str(v))
            .filter(Boolean)
            .join(" ");
    return {
        siren,
        name: str(x.nom_complet || x.nom_raison_sociale || x.nom, 250),
        acronym: str(x.sigle, 60),
        activity: str(x.activite_principale || s.activite_principale, 6),
        activityLabel: str(x.libelle_activite_principale || s.libelle_activite_principale, 200),
        section: str(x.section_activite_principale, 1),
        status: str(x.etat_administratif || s.etat_administratif, 1).toUpperCase(),
        creation: isoDate(x.date_creation),
        legal: str(x.nature_juridique, 4),
        category: str(x.categorie_entreprise, 3),
        workforce: str(x.tranche_effectif_salarie, 2),
        siret: /^\d{14}$/.test(str(s.siret)) ? str(s.siret) : "",
        address,
        postalCode: str(s.code_postal, 5),
        city: str(s.libelle_commune, 120),
        department: str(s.departement, 3),
        latitude: parseCoordinate(s.latitude, 90),
        longitude: parseCoordinate(s.longitude, 180),
        establishmentsCount: count(x.nombre_etablissements),
        openEstablishmentsCount: count(x.nombre_etablissements_ouverts),
        establishments: establishmentsRaw.map(normalizeEstablishment),
        directors: Array.isArray(x.dirigeants) ? x.dirigeants.map(normalizeDirector) : [],
        finances: normalizeFinances(x.finances),
        labels: extractLabels(x.complements),
        vat: apiVat || computeVatNumber(siren),
        vatComputed: !apiVat && Boolean(siren),
        diffusion: str(x.statut_diffusion, 1).toUpperCase(),
        minimized: ""
    };
}

/**
 * @param {unknown} value
 * @param {"company"|"establishment"} [kind]
 * @returns {{ code: string, labelKey: string, tone: "active"|"closed"|"unknown" }}
 */
export function statusView(value, kind = "company") {
    const code = String(value ?? "").toUpperCase();
    if (code === "A") return { code, labelKey: "status.active", tone: "active" };
    // SIRENE : unité légale A/C (cessée), établissement A/F (fermé). La v1 ignorait « F » (anomalie #23).
    if (code === "C" || (kind === "establishment" && code === "F")) {
        return { code: "C", labelKey: kind === "establishment" ? "status.closedEstablishment" : "status.closed", tone: "closed" };
    }
    return { code: "", labelKey: "status.unknown", tone: "unknown" };
}

/**
 * Sous-ensemble persistable d'une entreprise.
 * Exclut volontairement dirigeants (données personnelles) et établissements (volumineux).
 * @param {Company} c
 */
export function toSnapshot(c) {
    const latest = c.finances.length ? c.finances[c.finances.length - 1] : null;
    return {
        siren: c.siren,
        name: c.name,
        activity: c.activity,
        activityLabel: c.activityLabel,
        section: c.section,
        status: c.status,
        creation: c.creation,
        legal: c.legal,
        category: c.category,
        workforce: c.workforce,
        siret: c.siret,
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
        department: c.department,
        latitude: c.latitude,
        longitude: c.longitude,
        establishmentsCount: c.establishmentsCount,
        openEstablishmentsCount: c.openEstablishmentsCount,
        labels: [...c.labels],
        lastRevenue: latest ? latest.revenue : null,
        lastNetIncome: latest ? latest.netIncome : null,
        lastFinanceYear: latest ? latest.year : null,
        diffusion: c.diffusion,
        minimized: c.minimized
    };
}

/**
 * Recompose un objet Company complet à partir d'un instantané (champs manquants vides).
 * @param {any} snap
 * @returns {Company}
 */
export function fromSnapshot(snap) {
    const s = snap && typeof snap === "object" ? snap : {};
    const finances = s.lastFinanceYear
        ? [{ year: Number(s.lastFinanceYear), revenue: s.lastRevenue ?? null, netIncome: s.lastNetIncome ?? null, revenueChange: null }]
        : [];
    return {
        siren: str(s.siren),
        name: str(s.name),
        acronym: "",
        activity: str(s.activity),
        activityLabel: str(s.activityLabel),
        section: str(s.section),
        status: str(s.status),
        creation: isoDate(s.creation),
        legal: str(s.legal),
        category: str(s.category),
        workforce: str(s.workforce),
        siret: str(s.siret),
        address: str(s.address),
        postalCode: str(s.postalCode),
        city: str(s.city),
        department: str(s.department),
        latitude: typeof s.latitude === "number" ? s.latitude : null,
        longitude: typeof s.longitude === "number" ? s.longitude : null,
        establishmentsCount: count(s.establishmentsCount),
        openEstablishmentsCount: count(s.openEstablishmentsCount),
        establishments: [],
        directors: [],
        finances,
        labels: Array.isArray(s.labels) ? s.labels.filter(l => typeof l === "string") : [],
        vat: computeVatNumber(str(s.siren)),
        vatComputed: true,
        diffusion: str(s.diffusion, 1),
        minimized: str(s.minimized, 10)
    };
}
