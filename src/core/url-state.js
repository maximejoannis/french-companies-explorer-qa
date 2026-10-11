// @ts-check
import { LANGS, LIMITS, VIEWS } from "../config.js";
import { criteriaDefaults, sanitizeCriteria } from "./criteria.js";

/**
 * @typedef {import("./criteria.js").SearchCriteria} SearchCriteria
 * @typedef {{ lat: number|null, lon: number|null, radius: number, naf: string, section: string, place: string }} NearbyQuery
 * @typedef {{ view: string, criteria: SearchCriteria, page: number, siren: string, sirens: string[], nearby: NearbyQuery, lang: string }} AppUrlState
 */

/** Correspondance critère → paramètre d'URL (noms v1.1.1 conservés). */
const CRITERIA_PARAMS = /** @type {const} */ ([
    ["query", "q"],
    ["postalCode", "cp"],
    ["city", "city"],
    ["cityCode", "cityCode"],
    ["naf", "naf"],
    ["department", "department"],
    ["region", "region"],
    ["workforce", "workforce"],
    ["status", "status"],
    ["category", "category"],
    ["legalForm", "legal"],
    ["section", "section"],
    ["revenueMin", "caMin"],
    ["revenueMax", "caMax"],
    ["netMin", "netMin"],
    ["netMax", "netMax"],
    ["personName", "person"],
    ["personFirstNames", "firstNames"]
]);

/**
 * @param {unknown} value
 * @param {number} [fallback]
 */
export function positiveInt(value, fallback = 1) {
    if (value === null || value === undefined || value === "") return fallback;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : fallback;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number|null}
 */
function coordinate(value, min, max) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** @returns {NearbyQuery} */
export function nearbyDefaults() {
    return { lat: null, lon: null, radius: LIMITS.radiusDefault, naf: "", section: "", place: "" };
}

/**
 * @param {any} input
 * @returns {NearbyQuery}
 */
export function sanitizeNearby(input) {
    const src = input && typeof input === "object" ? input : {};
    const radius = Number(src.radius);
    const naf = typeof src.naf === "string" ? src.naf.trim().toUpperCase() : "";
    const section = typeof src.section === "string" ? src.section.trim().toUpperCase() : "";
    return {
        lat: coordinate(src.lat, -90, 90),
        lon: coordinate(src.lon, -180, 180),
        radius: Number.isFinite(radius) ? Math.min(LIMITS.radiusMax, Math.max(LIMITS.radiusMin, Math.round(radius))) : LIMITS.radiusDefault,
        naf: /^\d{2}\.\d{2}[A-Z]$/.test(naf) ? naf : "",
        section: /^[A-U]$/.test(section) ? section : "",
        place: typeof src.place === "string" ? src.place.trim().slice(0, 80) : ""
    };
}

/**
 * Lit l'état applicatif depuis une query string. Tout paramètre inconnu ou hors liste blanche est ignoré.
 * @param {URLSearchParams} params
 * @returns {AppUrlState}
 */
export function paramsToState(params) {
    /** @type {Record<string, unknown>} */
    const raw = {};
    for (const [key, param] of CRITERIA_PARAMS) {
        const value = params.get(param);
        if (value !== null) raw[key] = value;
    }
    raw.labels = params.get("labels") || "";
    raw.pageSize = params.get("size") || LIMITS.defaultPerPage;
    raw.sort = params.get("sort") || "relevance";
    const criteria = sanitizeCriteria(raw);
    const requestedView = params.get("view") || "";
    const siren = /^\d{9}$/.test(params.get("siren") || "") ? String(params.get("siren")) : "";
    const sirens = [...new Set((params.get("sirens") || "").split(",").filter(s => /^\d{9}$/.test(s)))].slice(0, LIMITS.compareMax);
    let view = VIEWS.includes(requestedView) ? requestedView : "";
    if (!view) view = criteria.query ? "search" : "home";
    if (view === "detail" && !siren) view = criteria.query ? "search" : "home";
    const lang = LANGS.includes(params.get("lang") || "") ? String(params.get("lang")) : "";
    const nearby = sanitizeNearby({
        lat: params.get("lat"),
        lon: params.get("lon"),
        radius: params.get("radius"),
        naf: params.get("nnaf") || "",
        section: params.get("nsection") || "",
        place: params.get("place") || ""
    });
    return { view, criteria, page: positiveInt(params.get("page"), 1), siren, sirens, nearby, lang };
}

/**
 * Sérialise l'état en query string canonique (valeurs par défaut omises).
 * @param {Partial<AppUrlState>} state
 * @returns {URLSearchParams}
 */
export function stateToParams(state) {
    const p = new URLSearchParams();
    const view = state.view || "home";
    const c = sanitizeCriteria(state.criteria || criteriaDefaults());
    if (view !== "home" && !(view === "search" && c.query)) p.set("view", view);
    if (view === "search" || view === "detail") {
        for (const [key, param] of CRITERIA_PARAMS) if (c[key]) p.set(param, c[key]);
        if (c.labels.length) p.set("labels", c.labels.join(","));
        if (c.pageSize !== LIMITS.defaultPerPage) p.set("size", String(c.pageSize));
        if (c.sort !== "relevance") p.set("sort", c.sort);
        if (view === "search" && (state.page || 1) > 1) p.set("page", String(state.page));
    }
    if (view === "detail" && state.siren) p.set("siren", state.siren);
    if (view === "compare" && state.sirens?.length) p.set("sirens", state.sirens.join(","));
    if (view === "nearby" && state.nearby) {
        const n = sanitizeNearby(state.nearby);
        if (n.lat !== null && n.lon !== null) {
            p.set("lat", String(n.lat));
            p.set("lon", String(n.lon));
        }
        if (n.radius !== LIMITS.radiusDefault) p.set("radius", String(n.radius));
        if (n.naf) p.set("nnaf", n.naf);
        if (n.section) p.set("nsection", n.section);
        if (n.place) p.set("place", n.place);
    }
    if (state.lang && LANGS.includes(state.lang)) p.set("lang", state.lang);
    return p;
}

/**
 * Conserve les paramètres techniques du Labo QA (qa, qaScenario…) d'une URL à l'autre.
 * @param {URLSearchParams} from
 * @param {URLSearchParams} to
 */
export function carryQaParams(from, to) {
    for (const [key, value] of from) if (key === "qa" || key.startsWith("qa")) to.set(key, value);
    return to;
}
