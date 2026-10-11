// @ts-check
/**
 * Règles RGPD appliquées côté navigateur (fonctions pures, testées) :
 * - minimisation des instantanés enregistrés (entrepreneurs individuels, diffusion partielle) ;
 * - limitation de la durée de conservation de l'historique ;
 * - inventaire, export (portabilité) et périmètre d'effacement des données locales.
 */

/** Catégorie juridique INSEE « entrepreneur individuel ». */
export const EI_LEGAL_CODE = "1000";

/** Préfixes des clés de stockage appartenant à l'application (v2 et v1). */
export const APP_KEY_PREFIXES = Object.freeze(["fce:", "fce_"]);

/** Préfixe des caches du service worker. */
export const APP_CACHE_PREFIX = "fce-";

export const PERSONAL_EXPORT_SCHEMA = "fce-personal-data";

/**
 * Motif de minimisation d'une entreprise, ou "" si aucune.
 * - "partial" : diffusion partielle SIRENE (la personne s'est opposée à la diffusion de certaines données) — toujours appliqué ;
 * - "ei" : entrepreneur individuel (le nom de l'entreprise est celui d'une personne) — appliqué si l'option est active.
 * @param {{ diffusion?: string, legal?: string, labels?: string[] }} c
 * @param {boolean} minimizeIndividuals
 * @returns {""|"partial"|"ei"}
 */
export function minimizationReason(c, minimizeIndividuals) {
    if (c.diffusion === "P") return "partial";
    if (minimizeIndividuals && (c.legal === EI_LEGAL_CODE || (c.labels || []).includes("est_entrepreneur_individuel"))) return "ei";
    return "";
}

/**
 * Retire d'un instantané ce qui identifie directement une personne physique : nom, adresse, code postal, coordonnées.
 * La commune et le département (granularité grossière) et le SIREN (identifiant public) sont conservés.
 * @template {Record<string, any>} T
 * @param {T} snapshot
 * @param {boolean} minimizeIndividuals
 * @returns {T}
 */
export function minimizeSnapshot(snapshot, minimizeIndividuals) {
    const reason = minimizationReason(snapshot, minimizeIndividuals);
    if (!reason) return { ...snapshot, minimized: "" };
    return { ...snapshot, name: "", address: "", postalCode: "", siret: "", latitude: null, longitude: null, minimized: reason };
}

/**
 * Supprime les entrées d'historique plus anciennes que la durée de conservation.
 * Une entrée sans date valide est considérée comme expirée dès qu'une durée est fixée (principe de prudence).
 * @template {{ at?: string }} T
 * @param {T[]} entries
 * @param {number} nowMs
 * @param {number} retentionDays 0 = sans limite
 * @returns {T[]}
 */
export function applyRetention(entries, nowMs, retentionDays) {
    if (!retentionDays) return entries;
    const limit = nowMs - retentionDays * 24 * 60 * 60 * 1000;
    return entries.filter(e => {
        const t = Date.parse(e.at || "");
        return Number.isFinite(t) && t >= limit;
    });
}

/**
 * @param {string} key
 */
export function isAppStorageKey(key) {
    return APP_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * @typedef {{ id: string, count: number, bytes: number }} InventoryLine
 */

/**
 * Inventaire des données locales par catégorie (affiché dans « Mes données »).
 * @param {{ favorites: any[], favoriteMeta: Record<string, any>, compare: any[], history: any[], saved: any[], prefs: object }} state
 * @param {Record<string, string>} rawStorage contenu brut des clés de l'application (clé → valeur)
 * @returns {InventoryLine[]}
 */
export function buildInventory(state, rawStorage) {
    /** @param {string} suffix */
    const bytes = suffix => {
        const value = rawStorage[`fce:v2:${suffix}`];
        return value ? new TextEncoder().encode(value).length : 0;
    };
    const legacy = Object.entries(rawStorage).filter(([k]) => k.startsWith("fce_"));
    return [
        { id: "favorites", count: state.favorites.length, bytes: bytes("favorites") },
        { id: "favoriteMeta", count: Object.keys(state.favoriteMeta).length, bytes: bytes("favorite-meta") },
        { id: "compare", count: state.compare.length, bytes: bytes("compare") },
        { id: "history", count: state.history.length, bytes: bytes("history") },
        { id: "saved", count: state.saved.length, bytes: bytes("saved-searches") },
        { id: "prefs", count: rawStorage["fce:v2:prefs"] ? 1 : 0, bytes: bytes("prefs") },
        { id: "legacy", count: legacy.length, bytes: legacy.reduce((n, [, v]) => n + new TextEncoder().encode(v).length, 0) }
    ];
}

/**
 * Export complet des données personnelles locales (droit à la portabilité, art. 20 RGPD).
 * @param {{ favorites: any[], favoriteMeta: Record<string, any>, compare: any[], history: any[], saved: any[], prefs: object }} state
 * @param {string} exportedAt
 * @param {string} appVersion
 */
export function buildPersonalDataExport(state, exportedAt, appVersion) {
    return JSON.stringify(
        {
            schema: PERSONAL_EXPORT_SCHEMA,
            version: 1,
            app: `French Companies Explorer ${appVersion}`,
            exportedAt,
            notice: "Données enregistrées uniquement dans ce navigateur. Aucune copie n'existe sur un serveur.",
            data: {
                favorites: state.favorites,
                favoriteMeta: state.favoriteMeta,
                compare: state.compare,
                history: state.history,
                savedSearches: state.saved,
                preferences: state.prefs
            }
        },
        null,
        2
    );
}
