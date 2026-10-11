// @ts-check
/**
 * @typedef {Record<string, string>} Dictionary
 */

/**
 * Crée une fonction de traduction. Les clés `xxx.one` / `xxx.other` sont choisies via Intl.PluralRules
 * quand la variable `count` est fournie. Clé absente => la clé elle-même (visible en test).
 * @param {Record<string, Dictionary>} dictionaries
 * @param {string} lang
 * @param {string} [fallbackLang]
 */
export function createTranslator(dictionaries, lang, fallbackLang = "fr") {
    const dict = dictionaries[lang] || dictionaries[fallbackLang] || {};
    const fallback = dictionaries[fallbackLang] || {};
    const plural = new Intl.PluralRules(lang);
    /**
     * @param {string} key
     * @param {Record<string, unknown>} [vars]
     */
    function t(key, vars = {}) {
        let template;
        if (typeof vars.count === "number") {
            const form = plural.select(vars.count);
            template = dict[`${key}.${form}`] ?? dict[`${key}.other`] ?? fallback[`${key}.${form}`] ?? fallback[`${key}.other`];
        }
        template = template ?? dict[key] ?? fallback[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined || vars[name] === null ? "" : String(vars[name])));
    }
    return Object.assign(t, { lang: dictionaries[lang] ? lang : fallbackLang });
}

/**
 * Liste les clés présentes dans `a` mais absentes de `b`.
 * @param {Dictionary} a
 * @param {Dictionary} b
 */
export function missingKeys(a, b) {
    return Object.keys(a).filter(k => !(k in b));
}
