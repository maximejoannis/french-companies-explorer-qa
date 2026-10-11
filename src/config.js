// @ts-check
/**
 * Constantes de l'application.
 * Limites de l'API vérifiées dans https://recherche-entreprises.api.gouv.fr/openapi.json (octobre 2026) :
 * 7 req/s par IP, HTTP 429 + Retry-After, per_page ≤ 25, radius ≤ 50 km,
 * `include` uniquement avec `minimal=true`, recherche SIREN/SIRET => filtres ignorés.
 */

export const APP_VERSION = "2.1.0";

export const API = Object.freeze({
    search: "https://recherche-entreprises.api.gouv.fr/search",
    nearPoint: "https://recherche-entreprises.api.gouv.fr/near_point",
    communes: "https://geo.api.gouv.fr/communes"
});

export const LIMITS = Object.freeze({
    /** Marge volontaire sous la limite documentée de 7 req/s. */
    requestsPerSecond: 5,
    timeoutMs: 8000,
    maxRetries: 2,
    retryBaseDelayMs: 400,
    maxRetryAfterMs: 10000,
    perPageOptions: [10, 20, 25],
    defaultPerPage: 20,
    maxPerPage: 25,
    queryMaxLength: 100,
    historyMax: 12,
    savedMax: 12,
    savedNameMax: 80,
    favoritesMax: 100,
    compareMax: 3,
    noteMax: 500,
    tagsMax: 8,
    tagLength: 30,
    importMaxBytes: 1024 * 1024,
    personNameMax: 60,
    radiusMin: 1,
    radiusMax: 50,
    radiusDefault: 5,
    analyticsMaxPages: 4,
    exportMaxRows: 500,
    establishmentsPageSize: 10,
    detailEstablishmentsLimit: 100,
    toastDurationMs: 2600,
    autocompleteDelayMs: 300,
    cityAutocompleteDelayMs: 250,
    geolocationDecimals: 2
});

export const STORAGE_PREFIX = "fce:v2:";

export const STORAGE_KEYS = Object.freeze({
    favorites: "favorites",
    favoriteMeta: "favorite-meta",
    history: "history",
    saved: "saved-searches",
    compare: "compare",
    prefs: "prefs"
});

/** Clés de la v1.1.1, lues une seule fois pour la migration. */
export const LEGACY_KEYS = Object.freeze({
    favorites: "fce_favorites",
    favoriteMeta: "fce_favorite_meta",
    history: "fce_history",
    saved: "fce_saved",
    compare: "fce_compare",
    theme: "fce_theme"
});

export const SORT_MODES = Object.freeze(["relevance", "name-asc", "name-desc", "creation-newest", "creation-oldest", "status", "distance"]);
export const STATUS_VALUES = Object.freeze(["", "A", "C"]);
export const CATEGORY_VALUES = Object.freeze(["", "PME", "ETI", "GE"]);
export const VIEWS = Object.freeze(["home", "search", "detail", "favorites", "compare", "history", "nearby", "about", "privacy"]);
/** Durées de conservation de l'historique proposées (jours ; 0 = sans limite). */
export const RETENTION_OPTIONS = Object.freeze([30, 90, 365, 0]);
export const LANGS = Object.freeze(["fr", "en"]);

export const WORKFORCE = Object.freeze([
    ["NN", "Non renseigné"],
    ["00", "0 salarié"],
    ["01", "1–2"],
    ["02", "3–5"],
    ["03", "6–9"],
    ["11", "10–19"],
    ["12", "20–49"],
    ["21", "50–99"],
    ["22", "100–199"],
    ["31", "200–249"],
    ["32", "250–499"],
    ["41", "500–999"],
    ["42", "1 000–1 999"],
    ["51", "2 000–4 999"],
    ["52", "5 000–9 999"],
    ["53", "10 000 et plus"]
]);
export const WORKFORCE_CODES = Object.freeze(WORKFORCE.map(([code]) => code));

/** Sections NAF rév. 2 (A à U). */
export const SECTIONS = Object.freeze([
    ["A", "Agriculture, sylviculture et pêche"],
    ["B", "Industries extractives"],
    ["C", "Industrie manufacturière"],
    ["D", "Électricité, gaz, vapeur"],
    ["E", "Eau, assainissement, déchets"],
    ["F", "Construction"],
    ["G", "Commerce, réparation d'automobiles"],
    ["H", "Transports et entreposage"],
    ["I", "Hébergement et restauration"],
    ["J", "Information et communication"],
    ["K", "Activités financières et d'assurance"],
    ["L", "Activités immobilières"],
    ["M", "Activités spécialisées, scientifiques et techniques"],
    ["N", "Services administratifs et de soutien"],
    ["O", "Administration publique"],
    ["P", "Enseignement"],
    ["Q", "Santé humaine et action sociale"],
    ["R", "Arts, spectacles et activités récréatives"],
    ["S", "Autres activités de services"],
    ["T", "Activités des ménages employeurs"],
    ["U", "Activités extra-territoriales"]
]);
export const SECTION_CODES = Object.freeze(SECTIONS.map(([code]) => code));

/** Formes juridiques fréquentes (catégories juridiques INSEE, niveau III). */
export const LEGAL_FORMS = Object.freeze([
    ["1000", "Entrepreneur individuel"],
    ["5499", "SARL"],
    ["5498", "EURL"],
    ["5710", "SAS"],
    ["5720", "SASU"],
    ["5599", "SA à conseil d'administration"],
    ["6540", "Société civile immobilière"],
    ["9220", "Association déclarée"],
    ["7210", "Commune"],
    ["7389", "Établissement public national administratif"],
    ["7383", "Université"]
]);

/** Labels et statuts booléens exposés par l'API (`est_*`, `*_renseignee`). */
export const LABELS = Object.freeze([
    ["est_ess", "ESS"],
    ["est_rge", "RGE"],
    ["est_bio", "Bio"],
    ["est_qualiopi", "Qualiopi"],
    ["est_siae", "SIAE"],
    ["est_societe_mission", "Société à mission"],
    ["est_association", "Association"],
    ["est_entrepreneur_individuel", "Entrepreneur individuel"],
    ["est_service_public", "Service public"],
    ["est_organisme_formation", "Organisme de formation"],
    ["est_patrimoine_vivant", "Entreprise du patrimoine vivant"],
    ["est_achats_responsables", "Achats responsables"],
    ["egapro_renseignee", "Index Egapro renseigné"],
    ["convention_collective_renseignee", "Convention collective renseignée"]
]);
export const LABEL_KEYS = Object.freeze(LABELS.map(([key]) => key));
/** Sous-ensemble proposé comme filtre de recherche. */
export const FILTER_LABEL_KEYS = Object.freeze([
    "est_ess",
    "est_rge",
    "est_bio",
    "est_qualiopi",
    "est_siae",
    "est_societe_mission",
    "est_association",
    "est_entrepreneur_individuel"
]);

export const DEMO_QUERIES = Object.freeze(["La Poste", "Renault", "Université de Strasbourg", "API Restauration"]);
