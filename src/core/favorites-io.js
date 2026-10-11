// @ts-check
import { LIMITS } from "../config.js";
import { sanitizeFavorite, sanitizeMeta } from "./schema.js";

export const FAVORITES_SCHEMA = "fce-favorites";
export const FAVORITES_VERSION = 2;

/**
 * @param {any[]} favorites
 * @param {Record<string, { note: string, tags: string[] }>} meta
 * @param {string} exportedAt
 */
export function serializeFavorites(favorites, meta, exportedAt) {
    return JSON.stringify(
        {
            schema: FAVORITES_SCHEMA,
            version: FAVORITES_VERSION,
            exportedAt,
            items: favorites.map(f => ({ ...f, meta: meta[f.siren] || { note: "", tags: [] } }))
        },
        null,
        2
    );
}

/**
 * @typedef {{ items: any[], meta: Record<string, {note: string, tags: string[]}>, rejected: number, errorKey: string }} ParsedFavorites
 */

/**
 * Analyse un fichier d'import non fiable. N'interprète jamais de HTML ; toute entrée invalide est ignorée et comptée.
 * @param {string} text
 * @param {number} byteSize
 * @returns {ParsedFavorites}
 */
export function parseFavoritesFile(text, byteSize) {
    /** @type {ParsedFavorites} */
    const empty = { items: [], meta: {}, rejected: 0, errorKey: "" };
    if (byteSize > LIMITS.importMaxBytes) return { ...empty, errorKey: "import.tooLarge" };
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return { ...empty, errorKey: "import.invalidJson" };
    }
    if (!data || typeof data !== "object" || data.schema !== FAVORITES_SCHEMA || !Array.isArray(data.items)) {
        return { ...empty, errorKey: "import.invalidSchema" };
    }
    if (typeof data.version !== "number" || data.version > FAVORITES_VERSION) return { ...empty, errorKey: "import.unsupportedVersion" };
    const seen = new Set();
    /** @type {ParsedFavorites} */
    const out = { items: [], meta: {}, rejected: 0, errorKey: "" };
    for (const raw of data.items) {
        const fav = sanitizeFavorite(raw);
        if (!fav || seen.has(fav.siren)) {
            out.rejected += 1;
            continue;
        }
        seen.add(fav.siren);
        out.items.push(fav);
        const meta = sanitizeMeta(raw.meta);
        if (meta.note || meta.tags.length) out.meta[fav.siren] = meta;
    }
    return out;
}

/**
 * @param {any[]} existing
 * @param {any[]} incoming
 * @param {"merge"|"replace"} mode
 * @param {number} max
 * @returns {{ list: any[], added: number, skipped: number }}
 */
export function mergeFavorites(existing, incoming, mode, max) {
    const base = mode === "replace" ? [] : [...existing];
    const sirens = new Set(base.map(f => f.siren));
    let added = 0;
    let skipped = 0;
    for (const fav of incoming) {
        if (sirens.has(fav.siren) || base.length >= max) {
            skipped += 1;
            continue;
        }
        base.push(fav);
        sirens.add(fav.siren);
        added += 1;
    }
    return { list: base, added, skipped };
}
