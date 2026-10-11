// @ts-check
import { VIEWS } from "../config.js";
import { carryQaParams, paramsToState, stateToParams } from "../core/url-state.js";

/**
 * @typedef {import("../core/url-state.js").AppUrlState} AppUrlState
 * @typedef {{ push?: boolean, recordHistory?: boolean, initial?: boolean, fromPopState?: boolean }} NavOptions
 */

/**
 * Routeur basé sur la query string : l'URL est la source de vérité (vue, critères, fiche, comparaison…).
 * pushState pour les navigations utilisateur (le bouton Précédent fonctionne, anomalie #16), replaceState sinon.
 * @param {{ win: Window, onRoute: (state: AppUrlState, options: NavOptions) => void }} deps
 */
export function createRouter({ win, onRoute }) {
    /** @type {AppUrlState} */
    let current = paramsToState(new URLSearchParams(win.location.search));

    /** @param {AppUrlState} state */
    function urlFor(state) {
        const params = carryQaParams(new URLSearchParams(win.location.search), stateToParams(state));
        const query = params.toString();
        return query ? `${win.location.pathname}?${query}` : win.location.pathname;
    }

    /**
     * @param {Partial<AppUrlState> & { view: string }} patch
     * @param {NavOptions} [options]
     */
    function go(patch, options = {}) {
        const view = VIEWS.includes(patch.view) ? patch.view : "home";
        current = { ...current, ...patch, view };
        const url = urlFor(current);
        const same = url === `${win.location.pathname}${win.location.search}`;
        if (options.push && !same) win.history.pushState({}, "", url);
        else win.history.replaceState({}, "", url);
        onRoute(current, options);
    }

    /**
     * Met à jour l'URL sans déclencher de rendu (tri, filtre local…).
     * @param {Partial<AppUrlState>} patch
     */
    function sync(patch) {
        current = { ...current, ...patch };
        win.history.replaceState({}, "", urlFor(current));
    }

    win.addEventListener("popstate", () => {
        current = paramsToState(new URLSearchParams(win.location.search));
        onRoute(current, { fromPopState: true });
    });

    return {
        go,
        sync,
        start() {
            onRoute(current, { initial: true });
        },
        current: () => current,
        href: () => win.location.href
    };
}

/** @typedef {ReturnType<typeof createRouter>} Router */
