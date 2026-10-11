// @ts-check
import { CATEGORY_VALUES, FILTER_LABEL_KEYS, LIMITS, SECTION_CODES, SORT_MODES, STATUS_VALUES, WORKFORCE_CODES } from "../config.js";
import { normalizeQuery } from "./query.js";

/**
 * @typedef {Object} SearchCriteria
 * @property {string} query
 * @property {string} postalCode
 * @property {string} city
 * @property {string} cityCode
 * @property {string} status
 * @property {string} naf
 * @property {string} department
 * @property {string} region
 * @property {string} workforce
 * @property {string} category
 * @property {string} legalForm
 * @property {string} section
 * @property {string[]} labels
 * @property {string} revenueMin
 * @property {string} revenueMax
 * @property {string} netMin
 * @property {string} netMax
 * @property {string} personName
 * @property {string} personFirstNames
 * @property {number} pageSize
 * @property {string} sort
 */

/** @returns {SearchCriteria} */
export function criteriaDefaults() {
    return {
        query: "",
        postalCode: "",
        city: "",
        cityCode: "",
        status: "",
        naf: "",
        department: "",
        region: "",
        workforce: "",
        category: "",
        legalForm: "",
        section: "",
        labels: [],
        revenueMin: "",
        revenueMax: "",
        netMin: "",
        netMax: "",
        personName: "",
        personFirstNames: "",
        pageSize: LIMITS.defaultPerPage,
        sort: "relevance"
    };
}

/** Champs filtrants (hors requête, taille de page et tri). */
export const FILTER_FIELDS = Object.freeze([
    "postalCode",
    "city",
    "status",
    "naf",
    "department",
    "region",
    "workforce",
    "category",
    "legalForm",
    "section",
    "labels",
    "revenueMin",
    "revenueMax",
    "netMin",
    "netMax",
    "personName",
    "personFirstNames"
]);

/**
 * @param {unknown} value
 * @param {number} [max]
 */
function text(value, max = 120) {
    return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "";
}

/**
 * @param {unknown} value
 * @param {readonly string[]} allowed
 */
function oneOf(value, allowed) {
    const v = text(value);
    return allowed.includes(v) ? v : "";
}

/**
 * Normalise un objet de critères d'origine non fiable (URL, stockage, formulaire).
 * Ne valide pas les formats fins (voir validateCriteria) mais impose types, longueurs et listes blanches.
 * @param {any} input
 * @returns {SearchCriteria}
 */
export function sanitizeCriteria(input) {
    const src = input && typeof input === "object" ? input : {};
    const d = criteriaDefaults();
    const pageSize = Number(src.pageSize);
    const labels = Array.isArray(src.labels) ? src.labels : typeof src.labels === "string" ? src.labels.split(",") : [];
    return {
        query: normalizeQuery(text(src.query, LIMITS.queryMaxLength * 2)),
        postalCode: text(src.postalCode, 60).replace(/\s+/g, ""),
        city: text(src.city, 80),
        cityCode: text(src.cityCode, 5).toUpperCase(),
        status: oneOf(src.status, STATUS_VALUES),
        naf: text(src.naf, 6).toUpperCase(),
        department: text(src.department, 3).toUpperCase(),
        region: text(src.region, 2),
        workforce: oneOf(src.workforce, ["", ...WORKFORCE_CODES]),
        category: oneOf(src.category, CATEGORY_VALUES),
        legalForm: text(src.legalForm, 4),
        section: oneOf(text(src.section, 1).toUpperCase(), ["", ...SECTION_CODES]),
        labels: [...new Set(labels.map(l => text(l, 40)).filter(l => FILTER_LABEL_KEYS.includes(l)))],
        revenueMin: text(src.revenueMin, 16),
        revenueMax: text(src.revenueMax, 16),
        netMin: text(src.netMin, 16),
        netMax: text(src.netMax, 16),
        personName: text(src.personName, LIMITS.personNameMax),
        personFirstNames: text(src.personFirstNames, LIMITS.personNameMax),
        pageSize: LIMITS.perPageOptions.includes(pageSize) ? pageSize : d.pageSize,
        sort: oneOf(src.sort, SORT_MODES) || d.sort
    };
}

const INTEGER = /^-?\d{1,15}$/;
const PERSON = /^[\p{L}][\p{L}' -]*$/u;

/**
 * Valide les formats ; renvoie une clé de message i18n ou "" si tout est valide.
 * @param {SearchCriteria} c
 * @returns {string}
 */
export function validateCriteria(c) {
    if (c.query.length > LIMITS.queryMaxLength) return "validation.queryTooLong";
    if (c.postalCode && !/^\d{5}(,\d{5})*$/.test(c.postalCode)) return "validation.postalCode";
    if (c.cityCode && !/^(\d{5}|2[AB]\d{3})$/.test(c.cityCode)) return "validation.cityCode";
    if (c.naf && !/^\d{2}\.\d{2}[A-Z]$/.test(c.naf)) return "validation.naf";
    if (c.department && !/^(\d{2}|97\d|2A|2B)$/.test(c.department)) return "validation.department";
    if (c.region && !/^\d{2}$/.test(c.region)) return "validation.region";
    if (c.legalForm && !/^\d{4}$/.test(c.legalForm)) return "validation.legalForm";
    for (const key of ["revenueMin", "revenueMax", "netMin", "netMax"]) {
        if (c[key] && !INTEGER.test(c[key])) return "validation.amount";
    }
    if (c.revenueMin && Number(c.revenueMin) < 0) return "validation.revenueNegative";
    if (c.revenueMax && Number(c.revenueMax) < 0) return "validation.revenueNegative";
    if (c.revenueMin && c.revenueMax && Number(c.revenueMin) > Number(c.revenueMax)) return "validation.revenueRange";
    if (c.netMin && c.netMax && Number(c.netMin) > Number(c.netMax)) return "validation.netRange";
    if (c.personName && !PERSON.test(c.personName)) return "validation.person";
    if (c.personFirstNames && !PERSON.test(c.personFirstNames)) return "validation.person";
    return "";
}

/**
 * Paramètres de l'API /search.
 * @param {SearchCriteria} c
 * @param {number} page
 * @returns {URLSearchParams}
 */
export function toApiParams(c, page) {
    const p = new URLSearchParams({ q: c.query, page: String(page), per_page: String(c.pageSize) });
    /** @type {[string, string][]} */
    const pairs = [
        ["code_postal", c.postalCode],
        ["code_commune", c.cityCode],
        ["etat_administratif", c.status],
        ["activite_principale", c.naf],
        ["departement", c.department],
        ["region", c.region],
        ["tranche_effectif_salarie", c.workforce],
        ["categorie_entreprise", c.category],
        ["nature_juridique", c.legalForm],
        ["section_activite_principale", c.section],
        ["ca_min", c.revenueMin],
        ["ca_max", c.revenueMax],
        ["resultat_net_min", c.netMin],
        ["resultat_net_max", c.netMax],
        ["nom_personne", c.personName],
        ["prenoms_personne", c.personFirstNames]
    ];
    for (const [key, value] of pairs) if (value) p.set(key, value);
    for (const label of c.labels) p.set(label, "true");
    return p;
}

/**
 * Identité d'une recherche pour le dédoublonnage (insensible à la casse de la requête).
 * @param {Partial<SearchCriteria>} input
 */
export function searchIdentity(input) {
    const c = sanitizeCriteria(input);
    return [
        c.query.toLocaleLowerCase("fr"),
        c.postalCode,
        c.cityCode || c.city.toLocaleLowerCase("fr"),
        c.status,
        c.naf,
        c.department,
        c.region,
        c.workforce,
        c.category,
        c.legalForm,
        c.section,
        [...c.labels].sort().join("+"),
        c.revenueMin,
        c.revenueMax,
        c.netMin,
        c.netMax,
        c.personName.toLocaleLowerCase("fr"),
        c.personFirstNames.toLocaleLowerCase("fr"),
        c.pageSize
    ].join("|");
}

/**
 * @param {SearchCriteria} c
 * @returns {boolean}
 */
export function hasActiveFilters(c) {
    return FILTER_FIELDS.some(f => (Array.isArray(c[f]) ? c[f].length > 0 : Boolean(c[f])));
}

/**
 * Nombre de filtres avancés actifs (les labels comptent chacun pour un).
 * @param {SearchCriteria} c
 */
export function countActiveFilters(c) {
    return FILTER_FIELDS.reduce((n, f) => n + (Array.isArray(c[f]) ? c[f].length : c[f] ? 1 : 0), 0);
}
