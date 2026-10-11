// @ts-check
const EARTH_RADIUS_KM = 6371;

/**
 * Parse une coordonnée renvoyée en chaîne par l'API ; null si invalide.
 * @param {unknown} value
 * @param {number} limit 90 (latitude) ou 180 (longitude)
 */
export function parseCoordinate(value, limit) {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** @param {number} deg */
const rad = deg => (deg * Math.PI) / 180;

/**
 * Distance orthodromique (formule de haversine), en kilomètres.
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 */
export function haversineKm(a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Arrondit une coordonnée (protection de la vie privée : 2 décimales ≈ 1 km).
 * @param {number} value
 * @param {number} decimals
 */
export function roundCoordinate(value, decimals) {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
}

/**
 * @param {number} km
 * @param {string} [locale]
 */
export function formatDistance(km, locale = "fr-FR") {
    if (!Number.isFinite(km)) return "";
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)} km`;
}

/**
 * @param {number} lat
 * @param {number} lon
 */
export function osmUrl(lat, lon) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
