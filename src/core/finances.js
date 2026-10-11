// @ts-check
/**
 * @typedef {{ year: number, revenue: number|null, netIncome: number|null, revenueChange: number|null }} FinanceYear
 */

/** @param {unknown} v */
function amount(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Convertit `finances` ({ "2022": { ca, resultat_net } }) en liste triée par année croissante,
 * avec la variation du CA par rapport à l'exercice précédent.
 * @param {unknown} raw
 * @returns {FinanceYear[]}
 */
export function normalizeFinances(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const years = Object.entries(raw)
        .filter(([year, v]) => /^\d{4}$/.test(year) && v && typeof v === "object")
        .map(([year, v]) => ({ year: Number(year), revenue: amount(v.ca), netIncome: amount(v.resultat_net), revenueChange: null }))
        .filter(y => y.revenue !== null || y.netIncome !== null)
        .sort((a, b) => a.year - b.year);
    for (let i = 1; i < years.length; i += 1) {
        years[i].revenueChange = percentChange(years[i - 1].revenue, years[i].revenue);
    }
    return years;
}

/**
 * Variation en % ; null si non calculable (valeur manquante ou base nulle).
 * @param {number|null} before
 * @param {number|null} after
 */
export function percentChange(before, after) {
    if (before === null || after === null || before === 0) return null;
    return ((after - before) / Math.abs(before)) * 100;
}

/**
 * @param {number|null} value
 * @param {string} [locale]
 */
export function formatEuro(value, locale = "fr-FR") {
    if (value === null || !Number.isFinite(value)) return "";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

/**
 * @param {number|null} value
 * @param {string} [locale]
 */
export function formatPercent(value, locale = "fr-FR") {
    if (value === null || !Number.isFinite(value)) return "";
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
    return `${formatted} %`;
}
