// @ts-check
import { API, LIMITS } from "../config.js";
import { normalizeCompany } from "../core/company.js";
import { toApiParams } from "../core/criteria.js";

/**
 * @typedef {{ companies: import("../core/company.js").Company[], total: number, totalPages: number, page: number }} SearchPage
 */

/**
 * @param {any} data
 * @param {number} page
 * @param {number} perPage
 * @returns {SearchPage}
 */
export function toSearchPage(data, page, perPage) {
    const results = Array.isArray(data?.results) ? data.results : [];
    const total = Number.isInteger(data?.total_results) && data.total_results >= 0 ? data.total_results : results.length;
    const totalPages = Number.isInteger(data?.total_pages) && data.total_pages >= 0 ? data.total_pages : Math.ceil(total / perPage);
    return { companies: results.map(normalizeCompany).filter(c => c.siren), total, totalPages, page };
}

/**
 * @param {{ getJson: (url: string, o?: { signal?: AbortSignal, retries?: number }) => Promise<any> }} http
 */
export function createCompaniesApi(http) {
    return {
        /**
         * @param {import("../core/criteria.js").SearchCriteria} criteria
         * @param {number} page
         * @param {AbortSignal} [signal]
         */
        async search(criteria, page, signal) {
            const params = toApiParams(criteria, page);
            const data = await http.getJson(`${API.search}?${params}`, { signal });
            return toSearchPage(data, page, criteria.pageSize);
        },

        /**
         * Fiche par SIREN : vérifie que le résultat correspond exactement (la recherche plein texte peut renvoyer autre chose).
         * @param {string} siren
         * @param {AbortSignal} [signal]
         */
        async getBySiren(siren, signal) {
            const params = new URLSearchParams({ q: siren, per_page: "1", limite_matching_etablissements: String(LIMITS.detailEstablishmentsLimit) });
            const data = await http.getJson(`${API.search}?${params}`, { signal });
            const match = (Array.isArray(data?.results) ? data.results : []).find((/** @type {any} */ r) => String(r?.siren) === siren);
            return match ? normalizeCompany(match) : null;
        },

        /**
         * @param {string} query
         * @param {AbortSignal} [signal]
         */
        async suggest(query, signal) {
            const params = new URLSearchParams({ q: query, per_page: "5", minimal: "true", include: "siege" });
            const data = await http.getJson(`${API.search}?${params}`, { signal, retries: 0 });
            return toSearchPage(data, 1, 5).companies;
        },

        /**
         * @param {{ lat: number, lon: number, radius: number, naf: string, section: string }} q
         * @param {number} page
         * @param {AbortSignal} [signal]
         */
        async nearPoint(q, page, signal) {
            const params = new URLSearchParams({
                lat: String(q.lat),
                long: String(q.lon),
                radius: String(q.radius),
                page: String(page),
                per_page: String(LIMITS.maxPerPage)
            });
            if (q.naf) params.set("activite_principale", q.naf);
            if (q.section) params.set("section_activite_principale", q.section);
            const data = await http.getJson(`${API.nearPoint}?${params}`, { signal });
            return toSearchPage(data, page, LIMITS.maxPerPage);
        }
    };
}
