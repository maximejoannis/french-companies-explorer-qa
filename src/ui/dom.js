// @ts-check
/**
 * Construction du DOM sans innerHTML : tout texte passe par des nœuds texte (échappement natif).
 * Garde-fou XSS : seuls des schémas d'URL sûrs sont acceptés pour href/src.
 */

const SAFE_URL = /^(https:\/\/|\.\/|#|blob:|mailto:)/i;
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * @typedef {string|number|Node|null|undefined|false} Child
 * @typedef {Record<string, unknown>} Attrs
 */

/**
 * @param {Element} el
 * @param {Attrs} attrs
 */
function applyAttrs(el, attrs) {
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === null || value === false) continue;
        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2).toLowerCase(), /** @type {EventListener} */ (value));
            continue;
        }
        if (key === "style") throw new Error("Attribut style interdit (CSP) : utiliser une classe");
        if ((key === "href" || key === "src") && !SAFE_URL.test(String(value))) throw new Error(`URL non autorisée : ${String(value)}`);
        if (key === "value" && "value" in el) {
            /** @type {HTMLInputElement} */ (el).value = String(value);
            continue;
        }
        if (key === "checked" && "checked" in el) {
            /** @type {HTMLInputElement} */ (el).checked = Boolean(value);
            continue;
        }
        el.setAttribute(key, value === true ? "" : String(value));
    }
}

/**
 * Test indépendant du « realm » (iframe, fenêtre de test) contrairement à instanceof Node.
 * @param {unknown} value
 * @returns {value is Node}
 */
export function isNode(value) {
    return typeof value === "object" && value !== null && typeof (/** @type {any} */ (value).nodeType) === "number";
}

/**
 * @param {Element} el
 * @param {Child[]} children
 */
function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(isNode(child) ? child : el.ownerDocument.createTextNode(String(child)));
    }
}

/**
 * Crée une fabrique d'éléments liée à un document.
 * @param {Document} doc
 */
export function createDom(doc) {
    /**
     * @param {string} tag
     * @param {Attrs} [attrs]
     * @param {...(Child|Child[])} children
     * @returns {HTMLElement}
     */
    function h(tag, attrs = {}, ...children) {
        const el = doc.createElement(tag);
        applyAttrs(el, attrs);
        append(el, /** @type {Child[]} */ (children));
        return el;
    }
    /**
     * @param {string} tag
     * @param {Attrs} [attrs]
     * @param {...(Child|Child[])} children
     * @returns {SVGElement}
     */
    function svg(tag, attrs = {}, ...children) {
        const el = /** @type {SVGElement} */ (doc.createElementNS(SVG_NS, tag));
        applyAttrs(el, attrs);
        append(el, /** @type {Child[]} */ (children));
        return el;
    }
    /**
     * @param {string} selector
     * @param {ParentNode} [root]
     * @returns {HTMLElement}
     */
    function $(selector, root = doc) {
        const el = root.querySelector(selector);
        if (!el) throw new Error(`Élément introuvable : ${selector}`);
        return /** @type {HTMLElement} */ (el);
    }
    /**
     * @param {string} selector
     * @param {ParentNode} [root]
     * @returns {HTMLElement[]}
     */
    function $$(selector, root = doc) {
        return /** @type {HTMLElement[]} */ ([...root.querySelectorAll(selector)]);
    }
    /**
     * @param {Element} el
     * @param {...(Child|Child[])} children
     */
    function replace(el, ...children) {
        el.replaceChildren();
        append(el, /** @type {Child[]} */ (children));
        return el;
    }
    return { h, svg, $, $$, replace, doc };
}

/** @typedef {ReturnType<typeof createDom>} Dom */

/**
 * @param {HTMLElement} el
 * @param {boolean} hidden
 */
export function setHidden(el, hidden) {
    el.classList.toggle("hidden", hidden);
}

/**
 * @param {EventTarget|null} target
 */
export function isEditable(target) {
    if (!isNode(target) || target.nodeType !== 1) return false;
    return /** @type {Element} */ (target).matches("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}
