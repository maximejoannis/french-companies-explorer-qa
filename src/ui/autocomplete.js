// @ts-check
import { isAbortError } from "../services/http.js";

/**
 * Combobox ARIA 1.2 réutilisable. L'index actif est propre à chaque instance (anomalie #11).
 * @template T
 * @param {{
 *   input: HTMLInputElement, list: HTMLElement, idPrefix: string, minLength: number, delay: number,
 *   timers: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   accept?: (query: string) => boolean,
 *   load: (query: string, signal: AbortSignal) => Promise<T[]>,
 *   renderOption: (item: T) => (string|Node)[],
 *   onSelect: (item: T) => void,
 *   onInput?: () => void,
 *   messages: () => { loading: string, empty: string, error: string },
 *   h: import("./dom.js").Dom["h"]
 * }} options
 */
export function createAutocomplete(options) {
    const { input, list, timers, h } = options;
    let active = -1;
    /** @type {T[]} */
    let items = [];
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    /** @type {AbortController|null} */
    let controller = null;

    function close() {
        list.classList.add("hidden");
        list.replaceChildren();
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        active = -1;
        items = [];
    }

    /** @param {string|Node} content */
    function showStatus(content) {
        list.replaceChildren(h("div", { class: "muted", role: "status" }, content));
        list.classList.remove("hidden");
        input.setAttribute("aria-expanded", "true");
    }

    function options$() {
        return /** @type {HTMLElement[]} */ ([...list.querySelectorAll("[role=option]")]);
    }

    /** @param {number} delta */
    function move(delta) {
        const opts = options$();
        if (!opts.length) return;
        active = (active + delta + opts.length) % opts.length;
        opts.forEach((o, i) => o.setAttribute("aria-selected", String(i === active)));
        input.setAttribute("aria-activedescendant", opts[active].id);
        opts[active].scrollIntoView({ block: "nearest" });
    }

    /** @param {T} item */
    function select(item) {
        close();
        options.onSelect(item);
    }

    /** @param {string} query */
    async function load(query) {
        controller?.abort();
        controller = new AbortController();
        const mine = controller;
        const msg = options.messages();
        showStatus(msg.loading);
        try {
            const result = await options.load(query, mine.signal);
            if (mine !== controller || input.value.trim() !== query) return;
            items = result;
            active = -1;
            if (!items.length) return showStatus(msg.empty);
            list.replaceChildren(
                ...items.map((item, i) =>
                    h(
                        "button",
                        {
                            type: "button",
                            role: "option",
                            id: `${options.idPrefix}-${i}`,
                            "aria-selected": "false",
                            tabindex: "-1",
                            "data-option-index": String(i),
                            onclick: () => select(item)
                        },
                        ...options.renderOption(item)
                    )
                )
            );
            list.classList.remove("hidden");
            input.setAttribute("aria-expanded", "true");
        } catch (error) {
            if (!isAbortError(error) && mine === controller) showStatus(msg.error);
        }
    }

    function schedule() {
        if (timer !== null) timers.clearTimeout(timer);
        controller?.abort();
        options.onInput?.();
        const query = input.value.trim();
        if (query.length < options.minLength || (options.accept && !options.accept(query))) return close();
        timer = timers.setTimeout(() => {
            timer = null;
            load(query);
        }, options.delay);
    }

    /** @param {KeyboardEvent} event */
    function onKeyDown(event) {
        if (event.key === "Escape") {
            if (!list.classList.contains("hidden")) event.preventDefault();
            return close();
        }
        if (list.classList.contains("hidden")) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Enter" && active >= 0 && items[active]) {
            event.preventDefault();
            select(items[active]);
        }
    }

    input.addEventListener("input", schedule);
    input.addEventListener("keydown", onKeyDown);
    input.ownerDocument.addEventListener("click", event => {
        const target = /** @type {Node} */ (event.target);
        if (!input.contains(target) && !list.contains(target)) close();
    });

    return {
        close,
        cancel() {
            if (timer !== null) timers.clearTimeout(timer);
            timer = null;
            controller?.abort();
            close();
        },
        get activeIndex() {
            return active;
        }
    };
}
