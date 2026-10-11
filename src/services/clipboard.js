// @ts-check
/**
 * Copie un texte : API Clipboard, sinon repli execCommand ; ne lève jamais.
 * @param {string} text
 * @param {{ navigator: Navigator, document: Document }} env
 * @returns {Promise<boolean>}
 */
export async function copyText(text, env) {
    try {
        if (env.navigator.clipboard?.writeText) {
            await env.navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        /* repli ci-dessous */
    }
    try {
        const area = env.document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.className = "visually-hidden-input";
        env.document.body.appendChild(area);
        area.select();
        const ok = typeof env.document.execCommand === "function" && env.document.execCommand("copy");
        area.remove();
        return Boolean(ok);
    } catch {
        return false;
    }
}
