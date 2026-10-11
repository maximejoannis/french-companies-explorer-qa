// @ts-check
/**
 * @typedef {{ key: string, label: string, count: number }} Bucket
 */

/**
 * Compte les occurrences par clé ; les valeurs vides sont regroupées sous la clé "".
 * Tri : effectif décroissant puis libellé ; le groupe « non renseigné » est toujours en dernier.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} keyOf
 * @param {(key: string) => string} labelOf
 * @returns {Bucket[]}
 */
export function groupCount(items, keyOf, labelOf) {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const item of items) {
        const key = keyOf(item) || "";
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([key, count]) => ({ key, label: labelOf(key), count }))
        .sort((a, b) => Number(a.key === "") - Number(b.key === "") || b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

/**
 * Regroupe les catégories au-delà de `max` dans un groupe « Autres ».
 * @param {Bucket[]} buckets
 * @param {number} max
 * @param {string} otherLabel
 */
export function limitBuckets(buckets, max, otherLabel) {
    if (buckets.length <= max) return buckets;
    const kept = buckets.slice(0, max - 1);
    const rest = buckets.slice(max - 1).reduce((n, b) => n + b.count, 0);
    return [...kept, { key: "__other", label: otherLabel, count: rest }];
}
