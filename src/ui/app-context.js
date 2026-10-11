// @ts-check
/**
 * Contrat partagé par les vues (types uniquement).
 *
 * @typedef {import("../core/company.js").Company} Company
 * @typedef {import("../core/schema.js").Prefs} Prefs
 * @typedef {{
 *   prefs: Prefs,
 *   favorites: any[],
 *   favoriteMeta: Record<string, { note: string, tags: string[] }>,
 *   compare: any[],
 *   history: any[],
 *   saved: any[],
 *   search: { status: "idle"|"loading"|"success"|"error", errorKind: string, criteria: import("../core/criteria.js").SearchCriteria, page: number, companies: Company[], total: number, totalPages: number }
 * }} AppState
 *
 * @typedef {{
 *   dom: import("./dom.js").Dom,
 *   win: Window & typeof globalThis,
 *   t: ((key: string, vars?: Record<string, unknown>) => string),
 *   locale: () => string,
 *   store: ReturnType<typeof import("../state/store.js").createStore<AppState>>,
 *   persist: (key: "favorites"|"favoriteMeta"|"compare"|"history"|"saved"|"prefs") => void,
 *   updatePrefs: (patch: Partial<Prefs>) => void,
 *   api: ReturnType<typeof import("../services/companies-api.js").createCompaniesApi>,
 *   geo: ReturnType<typeof import("../services/geo-api.js").createGeoApi>,
 *   http: { getJson: (url: string, o?: { signal?: AbortSignal, retries?: number }) => Promise<any> },
 *   fetchStatic: (url: string) => Promise<Response>,
 *   router: import("./router.js").Router,
 *   toast: (message: string) => void,
 *   announce: (message: string) => void,
 *   clock: { now: () => number, iso: () => string },
 *   ids: { next: () => string },
 *   timers: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   copy: (text: string) => Promise<boolean>,
 *   download: (name: string, mime: string, content: string) => void,
 *   errorMessage: (error: unknown) => string,
 *   cacheCompanies: (list: Company[]) => void,
 *   storedSnapshot: (c: Company) => Record<string, any>,
 *   companyFromCache: (siren: string) => Company|null,
 *   actions: {
 *     openDetail: (siren: string) => void,
 *     toggleFavorite: (siren: string) => void,
 *     addCompare: (siren: string) => void,
 *     isFavorite: (siren: string) => boolean
 *   }
 * }} AppContext
 */

export {};
