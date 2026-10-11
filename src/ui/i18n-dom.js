// @ts-check
/**
 * Applique les traductions aux éléments statiques portant data-i18n / data-i18n-attr.
 * Les data-testid ne sont jamais traduits.
 * @param {ParentNode} root
 * @param {(key: string) => string} t
 */
export function translateStatic(root, t) {
    for (const el of root.querySelectorAll("[data-i18n]")) {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = t(key);
    }
    for (const el of root.querySelectorAll("[data-i18n-attr]")) {
        for (const pair of (el.getAttribute("data-i18n-attr") || "").split(",")) {
            const [attr, key] = pair.split(":").map(s => s.trim());
            if (attr && key) el.setAttribute(attr, t(key));
        }
    }
}
