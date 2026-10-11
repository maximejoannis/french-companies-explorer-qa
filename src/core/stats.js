// @ts-check
/**
 * @param {import("./company.js").Company[]} list
 */
export function computeStats(list) {
    const active = list.filter(c => c.status === "A").length;
    const closed = list.filter(c => c.status === "C").length;
    const dates = list
        .map(c => c.creation)
        .filter(Boolean)
        .sort();
    return {
        displayed: list.length,
        active,
        closed,
        unknown: list.length - active - closed,
        cities: new Set(list.map(c => c.city.toLocaleLowerCase("fr")).filter(Boolean)).size,
        withPostalCode: list.filter(c => c.postalCode).length,
        withWorkforce: list.filter(c => c.workforce && c.workforce !== "NN").length,
        oldestCreation: dates[0] || ""
    };
}
