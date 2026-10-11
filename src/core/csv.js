// @ts-check
/**
 * Protection contre l'injection de formules (OWASP « CSV Injection ») :
 * toute cellule commençant par = + - @ tabulation ou retour chariot est préfixée d'une apostrophe.
 * @param {unknown} value
 */
export function neutralizeCsvFormula(value) {
    const text = String(value ?? "");
    return /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
}

/** @param {unknown} value */
export function csvEscape(value) {
    return `"${neutralizeCsvFormula(value).replaceAll('"', '""')}"`;
}

/**
 * CSV compatible Excel FR : BOM UTF-8, séparateur « ; », fins de ligne CRLF.
 * @param {unknown[][]} rows
 */
export function toCsv(rows) {
    return `\uFEFF${rows.map(r => r.map(csvEscape).join(";")).join("\r\n")}`;
}
