// @ts-check
import { toCsv } from "./csv.js";

/**
 * @typedef {import("./company.js").Company & { distanceKm?: number|null }} ExportCompany
 * @typedef {{ t: (key: string, vars?: Record<string, unknown>) => string, metaFor?: (siren: string) => { note: string, tags: string[] } }} ExportContext
 * @typedef {{ id: string, labelKey: string, personal?: boolean, defaultOn: boolean, get: (c: ExportCompany, ctx: ExportContext) => string|number|null }} ExportColumn
 */

/** @param {ExportCompany} c */
const latest = c => (c.finances.length ? c.finances[c.finances.length - 1] : null);

/** @type {ExportColumn[]} */
export const EXPORT_COLUMNS = [
    { id: "siren", labelKey: "field.siren", defaultOn: true, get: c => c.siren },
    { id: "name", labelKey: "field.name", defaultOn: true, get: c => c.name },
    {
        id: "status",
        labelKey: "field.status",
        defaultOn: true,
        get: (c, ctx) => ctx.t(c.status === "A" ? "status.active" : c.status === "C" ? "status.closed" : "status.unknown")
    },
    { id: "activity", labelKey: "field.activityCode", defaultOn: true, get: c => c.activity },
    { id: "activityLabel", labelKey: "field.activity", defaultOn: false, get: c => c.activityLabel },
    { id: "city", labelKey: "field.city", defaultOn: true, get: c => c.city },
    { id: "postalCode", labelKey: "field.postalCode", defaultOn: true, get: c => c.postalCode },
    { id: "creation", labelKey: "field.creation", defaultOn: true, get: c => c.creation },
    { id: "siret", labelKey: "field.siret", defaultOn: true, get: c => c.siret },
    { id: "category", labelKey: "field.category", defaultOn: false, get: c => c.category },
    { id: "workforce", labelKey: "field.workforce", defaultOn: false, get: c => c.workforce },
    { id: "legal", labelKey: "field.legal", defaultOn: false, get: c => c.legal },
    { id: "revenue", labelKey: "field.lastRevenue", defaultOn: false, get: c => latest(c)?.revenue ?? null },
    { id: "netIncome", labelKey: "field.lastNetIncome", defaultOn: false, get: c => latest(c)?.netIncome ?? null },
    { id: "labels", labelKey: "field.labels", defaultOn: false, get: (c, ctx) => c.labels.map(l => ctx.t(`label.${l}`)).join(", ") },
    { id: "vat", labelKey: "field.vat", defaultOn: false, get: c => c.vat },
    {
        id: "distance",
        labelKey: "field.distance",
        defaultOn: false,
        get: c => (typeof c.distanceKm === "number" ? Math.round(c.distanceKm * 100) / 100 : null)
    },
    { id: "note", labelKey: "field.note", defaultOn: false, get: (c, ctx) => ctx.metaFor?.(c.siren).note ?? "" },
    { id: "tags", labelKey: "field.tags", defaultOn: false, get: (c, ctx) => (ctx.metaFor?.(c.siren).tags ?? []).join(", ") },
    {
        id: "directors",
        labelKey: "field.directors",
        personal: true,
        defaultOn: false,
        get: c => c.directors.map(d => [d.name, d.firstNames].filter(Boolean).join(" ") + (d.role ? ` (${d.role})` : "")).join(" ; ")
    }
];

export const DEFAULT_COLUMN_IDS = EXPORT_COLUMNS.filter(c => c.defaultOn).map(c => c.id);

/**
 * @param {string[]} ids
 * @returns {ExportColumn[]}
 */
export function resolveColumns(ids) {
    const wanted = new Set(ids);
    const cols = EXPORT_COLUMNS.filter(c => wanted.has(c.id));
    return cols.length ? cols : EXPORT_COLUMNS.filter(c => c.defaultOn);
}

/**
 * @param {ExportCompany[]} companies
 * @param {string[]} columnIds
 * @param {ExportContext} ctx
 */
export function buildCsv(companies, columnIds, ctx) {
    const cols = resolveColumns(columnIds);
    const rows = [cols.map(c => ctx.t(c.labelKey)), ...companies.map(company => cols.map(col => col.get(company, ctx) ?? ""))];
    return toCsv(rows);
}

/**
 * @param {ExportCompany[]} companies
 * @param {string[]} columnIds
 * @param {ExportContext} ctx
 */
export function buildJson(companies, columnIds, ctx) {
    const cols = resolveColumns(columnIds);
    const items = companies.map(company => Object.fromEntries(cols.map(col => [col.id, col.get(company, ctx) ?? null])));
    return JSON.stringify(items, null, 2);
}

/**
 * Transforme un texte en segment de nom de fichier sûr.
 * @param {unknown} value
 * @param {string} fallback
 */
export function slugify(value, fallback = "entreprises") {
    const slug = String(value ?? "")
        .toLocaleLowerCase("fr")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)
        .replace(/-$/, "");
    return slug || fallback;
}

/**
 * @param {"csv"|"json"} format
 * @param {string} scope
 * @param {string} query
 */
export function exportFileName(format, scope, query) {
    return `entreprises-${slugify(scope, "export")}-${slugify(query)}.${format}`;
}
