// @ts-check
import { API } from "../config.js";

/**
 * @typedef {{ name: string, code: string, postalCodes: string[], lat: number|null, lon: number|null }} City
 */

/**
 * @param {any} item
 * @returns {City|null}
 */
export function normalizeCity(item) {
    if (!item || typeof item !== "object" || typeof item.nom !== "string" || !/^(\d{5}|2[AB]\d{3})$/.test(String(item.code))) return null;
    const coords = Array.isArray(item.centre?.coordinates) ? item.centre.coordinates : [];
    return {
        name: item.nom.slice(0, 120),
        code: String(item.code),
        postalCodes: Array.isArray(item.codesPostaux)
            ? item.codesPostaux.filter((/** @type {unknown} */ c) => typeof c === "string" && /^\d{5}$/.test(c)).slice(0, 20)
            : [],
        lat: typeof coords[1] === "number" ? coords[1] : null,
        lon: typeof coords[0] === "number" ? coords[0] : null
    };
}

/**
 * @param {{ getJson: (url: string, o?: { signal?: AbortSignal, retries?: number }) => Promise<any> }} http
 */
export function createGeoApi(http) {
    /**
     * @param {string} name
     * @param {AbortSignal} [signal]
     * @returns {Promise<City[]>}
     */
    async function searchCities(name, signal) {
        const url = new URL(API.communes);
        url.searchParams.set("nom", name);
        url.searchParams.set("boost", "population");
        url.searchParams.set("fields", "nom,code,codesPostaux,centre");
        url.searchParams.set("limit", "8");
        const data = await http.getJson(url.toString(), { signal, retries: 1 });
        return (Array.isArray(data) ? data : []).map(normalizeCity).filter(/** @returns {c is City} */ c => c !== null);
    }
    return {
        searchCities,
        /**
         * Résout un nom de commune en code INSEE : correspondance exacte (insensible aux accents) prioritaire.
         * @param {string} name
         * @param {AbortSignal} [signal]
         */
        async resolveCity(name, signal) {
            const cities = await searchCities(name, signal);
            return cities.find(c => c.name.localeCompare(name, "fr", { sensitivity: "base" }) === 0) || cities[0] || null;
        }
    };
}
