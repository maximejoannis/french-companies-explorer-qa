// @ts-check
/**
 * Migration des données de la v1.1.1 (clés fce_*) vers le format v2.
 * Fonction pure : reçoit les valeurs brutes déjà parsées, renvoie les valeurs v2 assainies.
 */
import { LIMITS } from "../config.js";
import { sanitizeFavorite, sanitizeHistoryEntry, sanitizeList, sanitizeMetaMap, sanitizeSavedSearch, sanitizeSnapshot } from "./schema.js";

/**
 * Convertit une entreprise « norm() » v1 en instantané v2.
 * @param {any} o
 */
export function legacyCompanyToSnapshot(o) {
    if (!o || typeof o !== "object") return null;
    const clean = (/** @type {unknown} */ v) =>
        typeof v === "string" && !/^(Non renseigné|Non renseignée|Activité non renseignée|Adresse non renseignée|—)$/.test(v) ? v : "";
    return sanitizeSnapshot({
        siren: o.siren,
        name: o.name,
        activity: clean(o.activity),
        activityLabel: clean(o.activityLabel),
        status: o.status,
        creation: o.creation,
        legal: clean(o.legal),
        category: clean(o.category),
        workforce: clean(o.workforce),
        siret: o.siret,
        address: clean(o.address),
        postalCode: o.postalCode,
        city: o.city
    });
}

/**
 * @param {{ favorites?: any, favoriteMeta?: any, history?: any, saved?: any, compare?: any, theme?: any }} legacy
 * @param {string} nowIso
 */
export function migrateLegacy(legacy, nowIso) {
    const favorites = sanitizeList(
        Array.isArray(legacy.favorites) ? legacy.favorites.map(legacyCompanyToSnapshot) : [],
        s => (s ? sanitizeFavorite({ ...s, addedAt: nowIso, changes: [] }) : null),
        LIMITS.favoritesMax,
        f => f.siren
    );
    const compare = sanitizeList(
        Array.isArray(legacy.compare) ? legacy.compare.map(legacyCompanyToSnapshot) : [],
        s => s,
        LIMITS.compareMax,
        s => s.siren
    );
    const history = sanitizeList(legacy.history, sanitizeHistoryEntry, LIMITS.historyMax);
    const saved = sanitizeList(
        Array.isArray(legacy.saved) ? legacy.saved.map(s => (s && typeof s === "object" ? { ...s, id: String(s.id ?? "") } : s)) : [],
        sanitizeSavedSearch,
        LIMITS.savedMax,
        s => s.id
    );
    const theme = legacy.theme === "dark" || legacy.theme === "light" ? legacy.theme : "system";
    return { favorites, favoriteMeta: sanitizeMetaMap(legacy.favoriteMeta), compare, history, saved, theme };
}
