// @ts-check
import { searchIdentity } from "./criteria.js";

/**
 * Ajoute une entrée en tête, supprime les doublons (même identité de recherche) et plafonne.
 * @template {object} T
 * @param {T[]} list
 * @param {T} entry
 * @param {number} max
 * @returns {T[]}
 */
export function addHistoryEntry(list, entry, max) {
    const id = searchIdentity(entry);
    return [entry, ...list.filter(x => searchIdentity(x) !== id)].slice(0, max);
}

/**
 * Crée ou renomme une recherche sauvegardée (même identité => mise à jour, identifiant conservé).
 * @template {{ id: string, name: string }} T
 * @param {T[]} list
 * @param {T} entry
 * @param {number} max
 * @returns {{ list: T[], updated: boolean }}
 */
export function upsertSavedSearch(list, entry, max) {
    const id = searchIdentity(/** @type {any} */ (entry));
    const existing = list.find(x => searchIdentity(/** @type {any} */ (x)) === id);
    if (existing) {
        return { list: [{ ...existing, name: entry.name }, ...list.filter(x => x !== existing)], updated: true };
    }
    return { list: [entry, ...list].slice(0, max), updated: false };
}
