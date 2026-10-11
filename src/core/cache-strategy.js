// @ts-check
/**
 * Logique pure du service worker (sw.js reste une coquille mince).
 */

export const API_HOSTS = Object.freeze(["recherche-entreprises.api.gouv.fr", "geo.api.gouv.fr"]);
export const API_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ method: string, url: string }} request
 * @param {string} scopeOrigin
 * @returns {"shell"|"api"|"bypass"}
 */
export function strategyFor(request, scopeOrigin) {
    if (request.method !== "GET") return "bypass";
    let url;
    try {
        url = new URL(request.url);
    } catch {
        return "bypass";
    }
    if (url.origin === scopeOrigin) return url.pathname.endsWith("/version.json") ? "bypass" : "shell";
    if (API_HOSTS.includes(url.hostname)) return "api";
    return "bypass";
}

/**
 * @param {number} storedAt
 * @param {number} now
 * @param {number} [maxAge]
 */
export function isFresh(storedAt, now, maxAge = API_CACHE_MAX_AGE_MS) {
    return Number.isFinite(storedAt) && now - storedAt >= 0 && now - storedAt <= maxAge;
}

/**
 * Retire les données personnelles (dirigeants) avant mise en cache d'une réponse API.
 * @param {any} payload
 */
export function stripPersonalData(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const clone = structuredClone(payload);
    if (Array.isArray(clone.results)) {
        for (const r of clone.results) if (r && typeof r === "object") delete r.dirigeants;
    }
    return clone;
}
