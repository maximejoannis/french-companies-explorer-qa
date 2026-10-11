// @ts-check
/**
 * Petit store observable, sans variable globale.
 * @template {object} S
 * @param {S} initial
 */
export function createStore(initial) {
    let state = initial;
    /** @type {Set<(s: S, prev: S) => void>} */
    const listeners = new Set();
    return {
        get: () => state,
        /** @param {Partial<S> | ((s: S) => Partial<S>)} patch */
        set(patch) {
            const prev = state;
            const delta = typeof patch === "function" ? patch(state) : patch;
            state = /** @type {S} */ (Object.assign({}, state, delta));
            for (const l of listeners) l(state, prev);
        },
        /** @param {(s: S, prev: S) => void} listener */
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}
