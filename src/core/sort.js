// @ts-check
/**
 * @typedef {import("./company.js").Company & { distanceKm?: number|null }} SortableCompany
 */

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/**
 * Compare deux valeurs en plaçant toujours les valeurs manquantes à la fin, quel que soit le sens.
 * @template T
 * @param {T|null|undefined|""} a
 * @param {T|null|undefined|""} b
 * @param {(x: T, y: T) => number} compare
 * @param {1|-1} direction
 */
function missingLast(a, b, compare, direction) {
    const am = a === null || a === undefined || a === "";
    const bm = b === null || b === undefined || b === "";
    if (am && bm) return 0;
    if (am) return 1;
    if (bm) return -1;
    return direction * compare(/** @type {T} */ (a), /** @type {T} */ (b));
}

const STATUS_ORDER = { A: 0, C: 1 };

/**
 * Trie sans muter l'entrée. Tri stable : à égalité, l'ordre de pertinence de l'API est conservé.
 * @param {SortableCompany[]} list
 * @param {string} mode
 * @returns {SortableCompany[]}
 */
export function sortCompanies(list, mode) {
    const arr = [...list];
    const text = (/** @type {string} */ x, /** @type {string} */ y) => collator.compare(x, y);
    const num = (/** @type {number} */ x, /** @type {number} */ y) => x - y;
    /** @type {Record<string, (a: SortableCompany, b: SortableCompany) => number>} */
    const comparators = {
        "name-asc": (a, b) => missingLast(a.name, b.name, text, 1),
        "name-desc": (a, b) => missingLast(a.name, b.name, text, -1),
        "creation-newest": (a, b) => missingLast(a.creation, b.creation, text, -1),
        "creation-oldest": (a, b) => missingLast(a.creation, b.creation, text, 1),
        status: (a, b) => missingLast(STATUS_ORDER[a.status], STATUS_ORDER[b.status], num, 1),
        distance: (a, b) => missingLast(a.distanceKm, b.distanceKm, num, 1)
    };
    const cmp = comparators[mode];
    return cmp ? arr.sort(cmp) : arr;
}
