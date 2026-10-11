// @ts-check
import { API, DEMO_QUERIES, LANGS, LIMITS, STORAGE_KEYS } from "./config.js";
import { toSnapshot } from "./core/company.js";
import { addToCompare } from "./core/compare.js";
import { criteriaDefaults } from "./core/criteria.js";
import { createTranslator } from "./core/i18n.js";
import { createRateLimiter, createSleep } from "./core/rate-limiter.js";
import {
    prefsDefaults,
    sanitizeFavorite,
    sanitizeHistoryEntry,
    sanitizeList,
    sanitizeMetaMap,
    sanitizePrefs,
    sanitizeSavedSearch,
    sanitizeSnapshot
} from "./core/schema.js";
import { resolveShortcut } from "./core/shortcuts.js";
import { applyRetention, minimizeSnapshot } from "./core/privacy.js";
import { en } from "./locales/en.js";
import { fr } from "./locales/fr.js";
import { copyText } from "./services/clipboard.js";
import { createCompaniesApi } from "./services/companies-api.js";
import { downloadFile } from "./services/download.js";
import { createGeoApi } from "./services/geo-api.js";
import { createHttp, HttpError } from "./services/http.js";
import { createStorage, migrateFromV1, safeBackend } from "./services/storage.js";
import { createStore } from "./state/store.js";
import { createDom, isEditable, setHidden } from "./ui/dom.js";
import { createExportDialog } from "./ui/export-dialog.js";
import { translateStatic } from "./ui/i18n-dom.js";
import { createPreferences } from "./ui/preferences.js";
import { createRouter } from "./ui/router.js";
import { createToaster } from "./ui/toast.js";
import { createAboutView } from "./ui/views/about.js";
import { createCompareView } from "./ui/views/compare.js";
import { createDetailView } from "./ui/views/detail.js";
import { createFavoritesView } from "./ui/views/favorites.js";
import { createHistoryView } from "./ui/views/history.js";
import { createNearbyView } from "./ui/views/nearby.js";
import { createPrivacyView } from "./ui/views/privacy.js";
import { createSearchView } from "./ui/views/search.js";

const DICTIONARIES = { fr, en };
const VIEW_TITLES = /** @type {Record<string, string>} */ ({
    home: "nav.home",
    search: "nav.search",
    detail: "nav.detail",
    favorites: "nav.favorites",
    compare: "nav.compare",
    history: "nav.history",
    nearby: "nav.nearby",
    about: "nav.about",
    privacy: "nav.privacy"
});

/**
 * @typedef {import("./ui/app-context.js").AppContext} AppContext
 * @typedef {import("./ui/app-context.js").AppState} AppState
 * @typedef {(url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<Response>} Transport
 */

/**
 * Point d'entrée unique de l'application. Toutes les dépendances sont injectables (tests déterministes).
 * @param {{
 *   win: Window & typeof globalThis,
 *   transport?: Transport,
 *   storageBackend?: import("./services/storage.js").StorageBackend|null,
 *   sessionBackend?: import("./services/storage.js").StorageBackend|null,
 *   now?: () => number,
 *   random?: () => number,
 *   timers?: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   idFactory?: () => string,
 *   rateLimit?: boolean
 * }} options
 */
export function init(options) {
    const win = options.win;
    const doc = win.document;
    const dom = createDom(doc);
    const { $, $$ } = dom;
    const timers = options.timers || { setTimeout: win.setTimeout.bind(win), clearTimeout: win.clearTimeout.bind(win) };
    const now = options.now || (() => Date.now());
    const clock = { now, iso: () => new Date(now()).toISOString() };
    const ids = {
        next:
            options.idFactory ||
            (() =>
                typeof win.crypto?.randomUUID === "function"
                    ? win.crypto.randomUUID()
                    : `${now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`)
    };
    const transport = options.transport || ((url, init) => win.fetch(url, init));
    const sleep = createSleep(timers);
    const toaster = createToaster($("#toast"), timers, LIMITS.toastDurationMs);

    // --- Stockage : accès protégé, migration v1, lecture validée ---
    const backend = options.storageBackend !== undefined ? options.storageBackend : safeBackend(() => win.localStorage);
    let storageWarned = false;
    const storage = createStorage(backend, {
        onError: kind => {
            if (storageWarned) return;
            storageWarned = true;
            // Différé : la traduction n'est pas encore prête pendant la migration initiale.
            timers.setTimeout(() => toaster.show(translate(kind === "quota" ? "storage.quota" : "storage.unavailable")), 0);
        }
    });
    migrateFromV1(backend, storage, clock.iso());

    /** @type {AppState} */
    const initial = {
        prefs: { ...prefsDefaults(), ...storage.read(STORAGE_KEYS.prefs, sanitizePrefs) },
        favorites: storage.read(STORAGE_KEYS.favorites, v => sanitizeList(v, sanitizeFavorite, LIMITS.favoritesMax, f => f.siren)),
        favoriteMeta: storage.read(STORAGE_KEYS.favoriteMeta, sanitizeMetaMap),
        compare: storage.read(STORAGE_KEYS.compare, v => sanitizeList(v, sanitizeSnapshot, LIMITS.compareMax, s => s.siren)),
        history: storage.read(STORAGE_KEYS.history, v => sanitizeList(v, sanitizeHistoryEntry, LIMITS.historyMax)),
        saved: storage.read(STORAGE_KEYS.saved, v => sanitizeList(v, sanitizeSavedSearch, LIMITS.savedMax, s => s.id)),
        search: { status: "idle", errorKind: "", criteria: criteriaDefaults(), page: 1, companies: [], total: 0, totalPages: 0 }
    };
    // Durée de conservation : l'historique expiré est purgé dès le chargement.
    const retained = applyRetention(initial.history, now(), initial.prefs.retentionDays);
    if (retained.length !== initial.history.length) {
        initial.history = retained;
        storage.write(STORAGE_KEYS.history, retained);
    }
    const store = createStore(initial);
    const sessionBackend = options.sessionBackend !== undefined ? options.sessionBackend : safeBackend(() => win.sessionStorage);

    // --- Langue ---
    const urlLang = new URLSearchParams(win.location.search).get("lang") || "";
    // Français par défaut (compatibilité des tests Playwright existants, locale en-US par défaut) ; anglais sur choix explicite.
    let lang = LANGS.includes(urlLang) ? urlLang : store.get().prefs.lang || "fr";
    let translator = createTranslator(DICTIONARIES, lang);
    /**
     * @param {string} key
     * @param {Record<string, unknown>} [vars]
     */
    function translate(key, vars) {
        return translator(key, vars);
    }
    const locale = () => (lang === "en" ? "en-GB" : "fr-FR");

    // --- Réseau : limiteur partagé pour recherche-entreprises, timeout, retry ---
    const httpDeps = {
        timers,
        sleep,
        now,
        random: options.random,
        timeoutMs: LIMITS.timeoutMs,
        maxRetries: LIMITS.maxRetries,
        baseDelayMs: LIMITS.retryBaseDelayMs,
        maxRetryAfterMs: LIMITS.maxRetryAfterMs
    };
    const limiter = options.rateLimit === false ? null : createRateLimiter({ perSecond: LIMITS.requestsPerSecond, now, sleep });
    const apiHttp = createHttp({ ...httpDeps, transport, limiter });
    const geoHttp = createHttp({ ...httpDeps, transport, limiter: null });
    const routedHttp = {
        /** @param {string} url @param {{ signal?: AbortSignal, retries?: number }} [o] */
        getJson: (url, o) => (url.startsWith(API.communes) ? geoHttp : apiHttp).getJson(url, o)
    };
    const api = createCompaniesApi(apiHttp);
    const geo = createGeoApi(geoHttp);

    /** @type {Map<string, import("./core/company.js").Company>} */
    const companyCache = new Map();
    /** @param {unknown} error */
    function errorMessage(error) {
        if (error instanceof HttpError) return translate(`error.${error.kind}`);
        return translate("error.network");
    }

    /** @type {AppContext} */
    const ctx = /** @type {any} */ ({
        dom,
        win,
        store,
        api,
        geo,
        http: routedHttp,
        clock,
        ids,
        timers,
        t: translate,
        locale,
        fetchStatic: (/** @type {string} */ url) => win.fetch(url, { cache: "no-store" }),
        persist: (/** @type {keyof typeof STORAGE_KEYS} */ key) => storage.write(STORAGE_KEYS[key], store.get()[key]),
        updatePrefs,
        toast: (/** @type {string} */ message) => toaster.show(message),
        announce: (/** @type {string} */ message) => {
            $("#routeAnnouncer").textContent = message;
        },
        copy: (/** @type {string} */ text) => copyText(text, { navigator: win.navigator, document: doc }),
        download: (/** @type {string} */ name, /** @type {string} */ mime, /** @type {string} */ content) =>
            downloadFile({ document: doc, URL: win.URL, Blob: win.Blob }, name, mime, content),
        errorMessage,
        cacheCompanies: (/** @type {import("./core/company.js").Company[]} */ list) => list.forEach(c => companyCache.set(c.siren, c)),
        companyFromCache: (/** @type {string} */ siren) => companyCache.get(siren) || null,
        actions: {}
    });

    // --- Actions partagées (anomalie #13 : fonctionnent hors des résultats courants grâce au cache) ---
    /**
     * Instantané persistable, minimisé selon les règles RGPD (diffusion partielle, entrepreneur individuel).
     * @param {import("./core/company.js").Company} c
     */
    function storedSnapshot(c) {
        return minimizeSnapshot(toSnapshot(c), store.get().prefs.minimizePersonal);
    }
    ctx.storedSnapshot = storedSnapshot;

    /** @param {string} siren */
    function knownSnapshot(siren) {
        const c = companyCache.get(siren);
        if (c) return storedSnapshot(c);
        const s = store.get();
        return s.favorites.find(f => f.siren === siren) || s.compare.find(f => f.siren === siren) || null;
    }
    ctx.actions.isFavorite = siren => store.get().favorites.some(f => f.siren === siren);
    ctx.actions.toggleFavorite = siren => {
        const s = store.get();
        if (s.favorites.some(f => f.siren === siren)) {
            const meta = { ...s.favoriteMeta };
            delete meta[siren];
            store.set({ favorites: s.favorites.filter(f => f.siren !== siren), favoriteMeta: meta });
            ctx.persist("favoriteMeta");
            ctx.toast(translate("favorite.removed"));
        } else {
            const snap = knownSnapshot(siren);
            if (!snap) return ctx.toast(translate("favorite.unknown"));
            if (s.favorites.length >= LIMITS.favoritesMax) return ctx.toast(translate("favorite.full", { max: LIMITS.favoritesMax }));
            const fav = sanitizeFavorite({ ...snap, addedAt: clock.iso(), changes: [] });
            if (!fav) return ctx.toast(translate("favorite.unknown"));
            store.set({ favorites: [...s.favorites, fav] });
            ctx.toast(translate("favorite.added"));
        }
        ctx.persist("favorites");
        rerenderCurrent();
    };
    ctx.actions.addCompare = siren => {
        const snap = knownSnapshot(siren);
        if (!snap) return ctx.toast(translate("compare.unknown"));
        const { list, result } = addToCompare(store.get().compare, snap, LIMITS.compareMax);
        if (result === "duplicate") ctx.toast(translate("compare.duplicate"));
        else if (result === "full") ctx.toast(translate("compare.full", { max: LIMITS.compareMax }));
        else {
            store.set({ compare: list });
            ctx.persist("compare");
            ctx.toast(translate("compare.added"));
        }
        if (result !== "added") navigate("compare");
    };
    ctx.actions.openDetail = siren => {
        const s = store.get().search;
        ctx.router.go({ view: "detail", siren, criteria: s.criteria, page: s.page }, { push: true });
    };

    // --- Vues ---
    let initialRoute = true;
    let currentView = "";
    const router = createRouter({ win, onRoute });
    ctx.router = router;
    const prefsUi = createPreferences(ctx);
    const search = createSearchView(ctx);
    const detail = createDetailView(ctx);
    const favorites = createFavoritesView(ctx);
    const compare = createCompareView(ctx);
    const history = createHistoryView(ctx);
    const nearby = createNearbyView(ctx);
    const about = createAboutView(ctx);
    const privacy = createPrivacyView(ctx, {
        local: backend,
        session: sessionBackend,
        resetState() {
            companyCache.clear();
            store.set({ favorites: [], favoriteMeta: {}, compare: [], history: [], saved: [], prefs: prefsDefaults() });
            prefsUi.apply();
            if (lang !== "fr") setLang("fr");
        }
    });
    createExportDialog(ctx, search);

    /** @param {Partial<import("./core/schema.js").Prefs>} patch */
    function updatePrefs(patch) {
        const prefs = sanitizePrefs({ ...store.get().prefs, ...patch });
        const langChanged = prefs.lang !== store.get().prefs.lang;
        store.set({ prefs });
        ctx.persist("prefs");
        prefsUi.apply();
        if (langChanged) setLang(prefs.lang || "fr");
    }

    /** @param {string} next */
    function setLang(next) {
        lang = LANGS.includes(next) ? next : "fr";
        translator = createTranslator(DICTIONARIES, lang);
        applyLanguage();
        search.refreshLanguage();
        nearby.refreshLanguage();
        about.refreshLanguage();
        rerenderCurrent();
    }

    function applyLanguage() {
        doc.documentElement.lang = lang;
        translateStatic(doc, translate);
        $("#langSwitch").textContent = lang === "fr" ? "EN" : "FR";
        $("#langSwitch").setAttribute("aria-label", translate("nav.switchLang"));
        prefsUi.apply();
        updateTitle();
    }

    function updateTitle() {
        doc.title = currentView && currentView !== "home" ? `${translate(VIEW_TITLES[currentView])} · French Companies Explorer` : "French Companies Explorer";
    }

    function rerenderCurrent() {
        if (currentView === "search") search.render();
        if (currentView === "detail") detail.render();
        if (currentView === "favorites") favorites.render();
        if (currentView === "compare") compare.render();
        if (currentView === "history") history.render();
        if (currentView === "privacy") privacy.render();
    }

    /**
     * @param {import("./core/url-state.js").AppUrlState} state
     * @param {import("./ui/router.js").NavOptions} navOptions
     */
    function onRoute(state, navOptions) {
        const view = state.view;
        currentView = view;
        for (const el of $$("main > .view")) setHidden(el, el.id !== `${view}View`);
        for (const btn of $$("#mainNav [data-route]")) {
            if (btn.dataset.route === view) btn.setAttribute("aria-current", "page");
            else btn.removeAttribute("aria-current");
        }
        closeMenu();
        if (view === "search") search.show(state, navOptions);
        if (view === "detail") detail.show(state.siren);
        if (view === "favorites") favorites.render();
        if (view === "compare") compare.show(state.sirens);
        if (view === "history") history.render();
        if (view === "nearby") nearby.show(state.nearby);
        if (view === "about") about.show();
        if (view === "privacy") privacy.render();
        updateTitle();
        if (!navOptions.initial) {
            win.scrollTo?.({ top: 0, behavior: store.get().prefs.motion === "reduced" ? "auto" : "smooth" });
            // Anomalie #20 : pas de déplacement de focus au premier chargement.
            const heading = /** @type {HTMLElement|null} */ (doc.querySelector(`#${view}View h1, #${view}View h2`));
            if (heading && !navOptions.fromPopState) {
                heading.tabIndex = -1;
                heading.focus({ preventScroll: true });
            }
            ctx.announce(translate("nav.announce", { view: translate(VIEW_TITLES[view]) }));
        }
        initialRoute = false;
    }

    /** @param {string} view */
    function navigate(view) {
        const s = store.get();
        if (view === "compare") return router.go({ view, sirens: s.compare.map(c => c.siren) }, { push: true });
        if (view === "search") return router.go({ view, criteria: s.search.criteria, page: s.search.page }, { push: true });
        router.go({ view }, { push: true });
    }

    function closeMenu() {
        $("#mainNav").classList.remove("open");
        $("#menuToggle").setAttribute("aria-expanded", "false");
    }

    // --- Écouteurs globaux ---
    for (const btn of $$("[data-route]")) btn.addEventListener("click", () => navigate(btn.dataset.route || "home"));
    for (const btn of $$("[data-query]")) {
        btn.addEventListener("click", () =>
            router.go({ view: "search", criteria: { ...criteriaDefaults(), query: btn.dataset.query || "" }, page: 1 }, { push: true, recordHistory: true })
        );
    }
    $("#randomDemoBtn").addEventListener("click", () => {
        const query = DEMO_QUERIES[Math.floor((options.random || Math.random)() * DEMO_QUERIES.length)];
        router.go({ view: "search", criteria: { ...criteriaDefaults(), query }, page: 1 }, { push: true, recordHistory: true });
    });
    $("#menuToggle").addEventListener("click", () => {
        const open = !$("#mainNav").classList.contains("open");
        $("#mainNav").classList.toggle("open", open);
        $("#menuToggle").setAttribute("aria-expanded", String(open));
    });
    $("#langSwitch").addEventListener("click", () => updatePrefs({ lang: lang === "fr" ? "en" : "fr" }));

    // Raccourcis clavier (N-12, WCAG 2.1.4).
    let pendingGo = false;
    doc.addEventListener("keydown", event => {
        if (doc.querySelector("dialog[open]")) return;
        const result = resolveShortcut(event, { enabled: store.get().prefs.shortcuts, inField: isEditable(event.target), pendingGo });
        pendingGo = result.pendingGo;
        if (!result.action) return;
        event.preventDefault();
        if (result.action.action === "focus-search") {
            if (currentView !== "search") navigate("search");
            search.focusInput();
        } else if (result.action.action === "help") /** @type {HTMLDialogElement} */ ($("#shortcutsDialog")).showModal();
        else if (result.action.view) navigate(result.action.view);
    });

    // Bannière hors ligne.
    function renderOnline() {
        const banner = $("#offlineBanner");
        banner.textContent = translate("pwa.offline");
        setHidden(banner, win.navigator.onLine !== false);
    }
    win.addEventListener("online", renderOnline);
    win.addEventListener("offline", renderOnline);

    applyLanguage();
    renderOnline();
    router.start();
    // Signal de disponibilité pour l'automatisation (Playwright : attendre html[data-ready="true"]).
    doc.documentElement.dataset.ready = "true";

    return {
        ctx,
        store,
        router,
        views: { search, detail, favorites, compare, history, nearby, about, privacy },
        setLang,
        get initialRoute() {
            return initialRoute;
        }
    };
}
