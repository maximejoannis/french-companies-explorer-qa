// @ts-check
/**
 * Validateurs des données relues depuis le stockage du navigateur.
 * Le stockage est partagé par toutes les pages de l'origine *.github.io : tout est considéré non fiable.
 */
import { LANGS, LIMITS, RETENTION_OPTIONS } from "../config.js";
import { sanitizeCriteria } from "./criteria.js";
import { WATCHED_FIELDS } from "./diff.js";

/**
 * @param {unknown} v
 * @param {number} max
 */
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
/** @param {unknown} v */
const numOrNull = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** @param {unknown} v */
const isoOrEmpty = v => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v) ? v : "");
/** @param {unknown} v */
const isObj = v => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * @param {any} o
 * @returns {Record<string, any>|null}
 */
export function sanitizeSnapshot(o) {
    if (!isObj(o) || !/^\d{9}$/.test(String(o.siren))) return null;
    const lat = numOrNull(o.latitude);
    const lon = numOrNull(o.longitude);
    return {
        siren: String(o.siren),
        name: str(o.name, 250),
        activity: str(o.activity, 6),
        activityLabel: str(o.activityLabel, 200),
        section: str(o.section, 1),
        status: ["A", "C"].includes(o.status) ? o.status : "",
        creation: /^\d{4}-\d{2}-\d{2}$/.test(String(o.creation)) ? String(o.creation) : "",
        legal: str(o.legal, 4),
        category: str(o.category, 3),
        workforce: str(o.workforce, 2),
        siret: /^\d{14}$/.test(String(o.siret)) ? String(o.siret) : "",
        address: str(o.address, 300),
        postalCode: str(o.postalCode, 5),
        city: str(o.city, 120),
        department: str(o.department, 3),
        latitude: lat !== null && Math.abs(lat) <= 90 ? lat : null,
        longitude: lon !== null && Math.abs(lon) <= 180 ? lon : null,
        establishmentsCount: numOrNull(o.establishmentsCount),
        openEstablishmentsCount: numOrNull(o.openEstablishmentsCount),
        labels: Array.isArray(o.labels) ? o.labels.filter(l => typeof l === "string" && /^[a-z_]{3,40}$/.test(l)).slice(0, 20) : [],
        lastRevenue: numOrNull(o.lastRevenue),
        lastNetIncome: numOrNull(o.lastNetIncome),
        lastFinanceYear: numOrNull(o.lastFinanceYear),
        diffusion: ["O", "P"].includes(o.diffusion) ? o.diffusion : "",
        minimized: ["ei", "partial"].includes(o.minimized) ? o.minimized : ""
    };
}

/**
 * @param {any} o
 * @returns {Record<string, any>|null}
 */
export function sanitizeFavorite(o) {
    const snap = sanitizeSnapshot(o);
    if (!snap) return null;
    const changes = Array.isArray(o.changes)
        ? o.changes
              .filter(c => isObj(c) && WATCHED_FIELDS.includes(c.field))
              .map(c => ({ field: c.field, before: str(c.before, 300), after: str(c.after, 300) }))
              .slice(0, WATCHED_FIELDS.length)
        : [];
    return { ...snap, addedAt: isoOrEmpty(o.addedAt), refreshedAt: isoOrEmpty(o.refreshedAt), changes };
}

/**
 * @param {unknown} value chaîne « a, b, c » ou tableau
 * @returns {string[]}
 */
export function normalizeTags(value) {
    const parts = Array.isArray(value) ? value : String(value ?? "").split(",");
    return [...new Set(parts.map(x => str(x, 200).trim().slice(0, LIMITS.tagLength)).filter(Boolean))].slice(0, LIMITS.tagsMax);
}

/**
 * @param {any} o
 * @returns {{ note: string, tags: string[] }}
 */
export function sanitizeMeta(o) {
    if (!isObj(o)) return { note: "", tags: [] };
    return { note: str(o.note, LIMITS.noteMax), tags: normalizeTags(o.tags) };
}

/**
 * @param {any} o
 * @returns {Record<string, { note: string, tags: string[] }>}
 */
export function sanitizeMetaMap(o) {
    if (!isObj(o)) return {};
    /** @type {Record<string, { note: string, tags: string[] }>} */
    const out = {};
    for (const [siren, meta] of Object.entries(o)) {
        if (!/^\d{9}$/.test(siren)) continue;
        const m = sanitizeMeta(meta);
        if (m.note || m.tags.length) out[siren] = m;
    }
    return out;
}

/** @param {any} o */
export function sanitizeHistoryEntry(o) {
    if (!isObj(o)) return null;
    const c = sanitizeCriteria(o);
    if (!c.query) return null;
    return { ...c, at: isoOrEmpty(o.at) };
}

/** @param {any} o */
export function sanitizeSavedSearch(o) {
    if (!isObj(o)) return null;
    const c = sanitizeCriteria(o);
    const name = str(o.name, LIMITS.savedNameMax).trim();
    const id = str(o.id, 64);
    if (!c.query || !name || !/^[\w-]{1,64}$/.test(id)) return null;
    return { ...c, id, name, createdAt: isoOrEmpty(o.createdAt) };
}

/**
 * @template T
 * @param {unknown} value
 * @param {(item: any) => T|null} sanitize
 * @param {number} max
 * @param {(item: T) => string} [keyOf] clé de dédoublonnage
 * @returns {T[]}
 */
export function sanitizeList(value, sanitize, max, keyOf) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    /** @type {T[]} */
    const out = [];
    for (const item of value) {
        const clean = sanitize(item);
        if (clean === null) continue;
        if (keyOf) {
            const k = keyOf(clean);
            if (seen.has(k)) continue;
            seen.add(k);
        }
        out.push(clean);
        if (out.length >= max) break;
    }
    return out;
}

/**
 * @typedef {{ theme: "system"|"light"|"dark", contrast: "normal"|"high", density: "comfortable"|"compact", motion: "system"|"reduced", fontScale: "100"|"112"|"125", shortcuts: boolean, resultsView: "cards"|"table", lang: string, retentionDays: number, minimizePersonal: boolean }} Prefs
 */

/** @returns {Prefs} */
export function prefsDefaults() {
    return {
        theme: "system",
        contrast: "normal",
        density: "comfortable",
        motion: "system",
        fontScale: "100",
        shortcuts: true,
        resultsView: "cards",
        lang: "",
        retentionDays: 90,
        minimizePersonal: true
    };
}

/**
 * @param {any} o
 * @returns {Prefs}
 */
export function sanitizePrefs(o) {
    const d = prefsDefaults();
    if (!isObj(o)) return d;
    /**
     * @template {string} T
     * @param {unknown} v
     * @param {readonly T[]} allowed
     * @param {T} fallback
     * @returns {T}
     */
    const pick = (v, allowed, fallback) => (allowed.includes(/** @type {T} */ (v)) ? /** @type {T} */ (v) : fallback);
    return {
        theme: pick(o.theme, /** @type {const} */ (["system", "light", "dark"]), d.theme),
        contrast: pick(o.contrast, /** @type {const} */ (["normal", "high"]), d.contrast),
        density: pick(o.density, /** @type {const} */ (["comfortable", "compact"]), d.density),
        motion: pick(o.motion, /** @type {const} */ (["system", "reduced"]), d.motion),
        fontScale: pick(o.fontScale, /** @type {const} */ (["100", "112", "125"]), d.fontScale),
        shortcuts: typeof o.shortcuts === "boolean" ? o.shortcuts : d.shortcuts,
        resultsView: pick(o.resultsView, /** @type {const} */ (["cards", "table"]), d.resultsView),
        lang: LANGS.includes(o.lang) ? o.lang : "",
        retentionDays: RETENTION_OPTIONS.includes(o.retentionDays) ? o.retentionDays : d.retentionDays,
        minimizePersonal: typeof o.minimizePersonal === "boolean" ? o.minimizePersonal : d.minimizePersonal
    };
}
