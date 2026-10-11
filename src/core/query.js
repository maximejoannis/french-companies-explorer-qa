// @ts-check
import { isValidSiren, isValidSiret } from "./luhn.js";
import { LIMITS } from "../config.js";

/**
 * @typedef {"empty"|"text"|"siren"|"siret"|"invalid-length"|"invalid-checksum"|"too-long"} QueryState
 * @typedef {{ type: "empty"|"text"|"siren"|"siret"|"numeric-invalid", state: QueryState, valid: boolean, searchable: boolean, normalized: string, messageKey: string }} QueryInfo
 */

/**
 * Supprime les espaces d'une saisie purement numérique (« 356 000 000 » → « 356000000 »).
 * @param {unknown} value
 */
export function normalizeQuery(value) {
    const text = String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");
    return /^[\d ]+$/.test(text) ? text.replace(/ /g, "") : text;
}

/**
 * Détecte la nature d'une saisie de recherche.
 * `valid` : saisie plausible ; `searchable` : la recherche peut être lancée.
 * Une clé de Luhn incorrecte reste recherchable (l'API est la source de vérité), avec avertissement.
 * @param {unknown} value
 * @returns {QueryInfo}
 */
export function detectQueryType(value) {
    const normalized = normalizeQuery(value);
    if (!normalized) return { type: "empty", state: "empty", valid: false, searchable: false, normalized, messageKey: "query.empty" };
    if (normalized.length > LIMITS.queryMaxLength) {
        return { type: "text", state: "too-long", valid: false, searchable: false, normalized, messageKey: "query.tooLong" };
    }
    if (/^\d{9}$/.test(normalized)) {
        return isValidSiren(normalized)
            ? { type: "siren", state: "siren", valid: true, searchable: true, normalized, messageKey: "query.siren" }
            : { type: "siren", state: "invalid-checksum", valid: false, searchable: true, normalized, messageKey: "query.sirenChecksum" };
    }
    if (/^\d{14}$/.test(normalized)) {
        return isValidSiret(normalized)
            ? { type: "siret", state: "siret", valid: true, searchable: true, normalized, messageKey: "query.siret" }
            : { type: "siret", state: "invalid-checksum", valid: false, searchable: true, normalized, messageKey: "query.siretChecksum" };
    }
    if (/^\d+$/.test(normalized)) {
        return { type: "numeric-invalid", state: "invalid-length", valid: false, searchable: false, normalized, messageKey: "query.invalidLength" };
    }
    return { type: "text", state: "text", valid: true, searchable: true, normalized, messageKey: "query.text" };
}

/** @param {QueryInfo} info */
export function isIdentifierQuery(info) {
    return info.type === "siren" || info.type === "siret";
}
