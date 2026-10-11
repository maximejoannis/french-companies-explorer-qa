// @ts-check
/** Clé de Luhn appliquée aux SIREN (9 chiffres) et SIRET (14 chiffres). */

/**
 * @param {string} digits chaîne composée uniquement de chiffres
 * @returns {boolean}
 */
export function luhnValid(digits) {
    if (!/^\d+$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
        let n = Number(digits[digits.length - 1 - i]);
        if (i % 2 === 1) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
    }
    return sum % 10 === 0;
}

/** SIREN historique de La Poste, dont les SIRET dérogent à la clé de Luhn. */
export const LA_POSTE_SIREN = "356000000";

/** @param {string} value */
export function isValidSiren(value) {
    return /^\d{9}$/.test(value) && luhnValid(value);
}

/**
 * Les SIRET de La Poste suivent une règle dérogatoire documentée par l'INSEE :
 * la somme simple des 14 chiffres doit être un multiple de 5.
 * Règle à reconfirmer auprès d'une source INSEE à jour (voir docs/AUDIT.md).
 * @param {string} value
 */
export function isValidSiret(value) {
    if (!/^\d{14}$/.test(value)) return false;
    if (value.startsWith(LA_POSTE_SIREN)) {
        const sum = [...value].reduce((acc, d) => acc + Number(d), 0);
        return sum % 5 === 0;
    }
    return luhnValid(value);
}
