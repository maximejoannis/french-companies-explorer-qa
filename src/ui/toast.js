// @ts-check
/**
 * Toasts : un seul timer actif, annulé à chaque nouveau message (anomalie #15).
 * @param {HTMLElement} el
 * @param {{ setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout }} timers
 * @param {number} duration
 */
export function createToaster(el, timers, duration) {
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    return {
        /** @param {string} message */
        show(message) {
            if (timer !== null) timers.clearTimeout(timer);
            el.textContent = message;
            el.classList.remove("hidden");
            timer = timers.setTimeout(() => {
                el.classList.add("hidden");
                timer = null;
            }, duration);
        }
    };
}
