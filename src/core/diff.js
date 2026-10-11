// @ts-check
/** Champs surveillés par la veille des favoris (aucune donnée personnelle). */
export const WATCHED_FIELDS = Object.freeze(["name", "status", "address", "postalCode", "city", "workforce", "activity", "category"]);

/**
 * @typedef {{ field: string, before: string, after: string }} FieldChange
 */

/**
 * @param {Record<string, any>} before
 * @param {Record<string, any>} after
 * @param {readonly string[]} [fields]
 * @returns {FieldChange[]}
 */
export function diffSnapshots(before, after, fields = WATCHED_FIELDS) {
    /** @type {FieldChange[]} */
    const changes = [];
    for (const field of fields) {
        const a = before?.[field] ?? "";
        const b = after?.[field] ?? "";
        if (String(a) !== String(b)) changes.push({ field, before: String(a), after: String(b) });
    }
    return changes;
}
