// @ts-check
/**
 * @template {{ siren: string }} T
 * @param {T[]} list
 * @param {T} item
 * @param {number} max
 * @returns {{ list: T[], result: "added"|"duplicate"|"full" }}
 */
export function addToCompare(list, item, max) {
    if (list.some(x => x.siren === item.siren)) return { list, result: "duplicate" };
    if (list.length >= max) return { list, result: "full" };
    return { list: [...list, item], result: "added" };
}

/**
 * Déplace un élément d'une position vers la gauche (-1) ou la droite (+1).
 * @template {{ siren: string }} T
 * @param {T[]} list
 * @param {string} siren
 * @param {-1|1} direction
 * @returns {T[]}
 */
export function moveInCompare(list, siren, direction) {
    const i = list.findIndex(x => x.siren === siren);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}

/**
 * @param {unknown[]} values
 */
export function valuesDiffer(values) {
    return new Set(values.map(v => (v === null || v === undefined ? "" : String(v)))).size > 1;
}
