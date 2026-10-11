// @ts-check
/**
 * Mode « Labo QA » (N-5) — chargé dynamiquement UNIQUEMENT si l'URL contient ?qa=1.
 * Injecte des scénarios au niveau du transport HTTP ; bannière toujours visible ; état en sessionStorage seulement.
 */
import { createDom } from "../ui/dom.js";
import { respondWithFixtures } from "./fixtures.js";

export const SCENARIOS = Object.freeze(["none", "fixtures", "400", "404", "429", "500", "timeout", "invalid-json", "empty", "offline"]);
export const MAX_LATENCY_MS = 10000;
/** Modes de stockage simulés (s'appliquent au chargement suivant). */
export const STORAGE_MODES = Object.freeze(["normal", "blocked", "quota"]);
const SESSION_KEY = "fce:qa";

/**
 * @typedef {{ scenario: string, latency: number, storage: string }} QaConfig
 * @typedef {(url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<Response>} Transport
 */

/**
 * @param {URLSearchParams} params
 * @param {Storage|null} session
 * @returns {QaConfig}
 */
export function readQaConfig(params, session) {
    /** @type {Partial<QaConfig>} */
    let stored = {};
    try {
        stored = JSON.parse(session?.getItem(SESSION_KEY) || "{}") || {};
    } catch {
        stored = {};
    }
    const scenario = params.get("qaScenario") ?? stored.scenario ?? "none";
    const latency = Number(params.get("qaLatency") ?? stored.latency ?? 0);
    const storage = String(params.get("qaStorage") ?? stored.storage ?? "normal");
    return {
        scenario: SCENARIOS.includes(String(scenario)) ? String(scenario) : "none",
        storage: STORAGE_MODES.includes(storage) ? storage : "normal",
        latency: Number.isFinite(latency) ? Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(latency))) : 0
    };
}

/**
 * @param {unknown} body
 * @param {number} status
 * @param {Record<string, string>} [headers]
 */
function jsonResponse(body, status, headers = {}) {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/**
 * @param {AbortSignal} signal
 * @returns {Promise<never>}
 */
function never(signal) {
    return new Promise((_, reject) => {
        const fail = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal.aborted) fail();
        signal.addEventListener("abort", fail, { once: true });
    });
}

/**
 * @param {() => QaConfig} getConfig
 * @param {Transport} real
 * @param {(ms: number, signal?: AbortSignal) => Promise<void>} sleep
 * @returns {Transport}
 */
export function createQaTransport(getConfig, real, sleep) {
    return async (url, init) => {
        const { scenario, latency } = getConfig();
        if (latency > 0) await sleep(latency, init.signal);
        const isGeo = new URL(url).hostname === "geo.api.gouv.fr";
        switch (scenario) {
            case "fixtures": {
                const { status, body } = respondWithFixtures(url);
                return jsonResponse(body, status);
            }
            case "400":
            case "404":
            case "500":
                return jsonResponse({ erreur: `Erreur simulée ${scenario}` }, Number(scenario));
            case "429":
                return jsonResponse({ erreur: "Trop de requêtes (simulé)" }, 429, { "Retry-After": "1" });
            case "timeout":
                return never(init.signal);
            case "invalid-json":
                return new Response("<html>Réponse HTML inattendue</html>", { status: 200 });
            case "empty":
                return jsonResponse(isGeo ? [] : { results: [], total_results: 0, page: 1, per_page: 10, total_pages: 0 }, 200);
            case "offline":
                throw new TypeError("Failed to fetch (simulé)");
            default:
                return real(url, init);
        }
    };
}

/**
 * Bannière + panneau de contrôle.
 * @param {Document} doc
 * @param {QaConfig} config objet muté en place (lu à chaque requête)
 * @param {{ session: Storage|null, history: History, location: Location, reload?: () => void }} env
 */
export function mountQaPanel(doc, config, env) {
    const { h } = createDom(doc);
    const save = () => {
        try {
            env.session?.setItem(SESSION_KEY, JSON.stringify(config));
        } catch {
            /* sessionStorage indisponible : la configuration reste en mémoire */
        }
        const params = new URLSearchParams(env.location.search);
        params.set("qa", "1");
        params.set("qaScenario", config.scenario);
        params.set("qaLatency", String(config.latency));
        params.set("qaStorage", config.storage);
        env.history.replaceState({}, "", `${env.location.pathname}?${params}`);
        status.textContent = `Scénario : ${config.scenario} · latence ${config.latency} ms · stockage ${config.storage}`;
    };
    const select = /** @type {HTMLSelectElement} */ (
        h("select", { id: "qaScenario", "data-testid": "qa-lab-scenario" }, ...SCENARIOS.map(s => h("option", { value: s }, s)))
    );
    select.value = config.scenario;
    const latency = /** @type {HTMLInputElement} */ (
        h("input", {
            id: "qaLatency",
            type: "number",
            min: "0",
            max: String(MAX_LATENCY_MS),
            step: "100",
            value: String(config.latency),
            "data-testid": "qa-lab-latency"
        })
    );
    const storageSelect = /** @type {HTMLSelectElement} */ (
        h("select", { id: "qaStorage", "data-testid": "qa-lab-storage" }, ...STORAGE_MODES.map(m => h("option", { value: m }, m)))
    );
    storageSelect.value = config.storage;
    const status = h("span", { class: "qa-status", role: "status" });
    storageSelect.addEventListener("change", () => {
        config.storage = STORAGE_MODES.includes(storageSelect.value) ? storageSelect.value : "normal";
        save();
        env.reload?.();
    });
    select.addEventListener("change", () => {
        config.scenario = SCENARIOS.includes(select.value) ? select.value : "none";
        save();
    });
    latency.addEventListener("change", () => {
        const n = Number(latency.value);
        config.latency = Number.isFinite(n) ? Math.min(MAX_LATENCY_MS, Math.max(0, Math.round(n))) : 0;
        latency.value = String(config.latency);
        save();
    });
    const banner = h(
        "div",
        { class: "qa-banner", role: "region", "aria-label": "Labo QA", "data-testid": "qa-lab-banner" },
        h("strong", {}, "🧪 Mode Labo QA actif"),
        h(
            "details",
            { class: "qa-panel", "data-testid": "qa-lab-panel" },
            h("summary", {}, "Configurer"),
            h("label", { for: "qaScenario" }, "Scénario"),
            select,
            h("label", { for: "qaLatency" }, "Latence (ms)"),
            latency,
            h("label", { for: "qaStorage" }, "Stockage (recharge la page)"),
            storageSelect,
            h(
                "p",
                { class: "small" },
                "« fixtures » sert des données fictives déterministes, sans appel réseau. « blocked » simule un stockage refusé, « quota » un stockage plein."
            )
        ),
        status
    );
    doc.body.prepend(banner);
    doc.documentElement.dataset.qa = "1";
    save();
    return banner;
}

/**
 * Initialise le labo : renvoie le transport instrumenté.
 * @param {Window & typeof globalThis} win
 * @param {Transport} real
 * @param {(ms: number, signal?: AbortSignal) => Promise<void>} sleep
 */
export function setupQaLab(win, real, sleep) {
    let session = null;
    try {
        session = win.sessionStorage;
    } catch {
        session = null;
    }
    const config = readQaConfig(new URLSearchParams(win.location.search), session);
    mountQaPanel(win.document, config, { session, history: win.history, location: win.location, reload: () => win.location.reload() });
    let real$ = null;
    try {
        real$ = win.localStorage;
    } catch {
        real$ = null;
    }
    return { transport: createQaTransport(() => config, real, sleep), storageBackend: createQaStorage(config.storage, real$) };
}

/**
 * Stockage simulé pour tester la robustesse et les messages RGPD/stockage.
 * - "blocked" : aucun stockage (comme des cookies bloqués) ;
 * - "quota" : lecture possible, toute écriture lève QuotaExceededError ;
 * - "normal" : undefined (l'application utilise le vrai localStorage).
 * @param {string} mode
 * @param {Storage|null} real
 * @returns {import("../services/storage.js").StorageBackend|null|undefined}
 */
export function createQaStorage(mode, real) {
    if (mode === "blocked") return null;
    if (mode !== "quota" || !real) return undefined;
    return {
        getItem: key => real.getItem(key),
        setItem: () => {
            const error = new Error("Quota simulé par le Labo QA");
            error.name = "QuotaExceededError";
            throw error;
        },
        removeItem: key => real.removeItem(key),
        key: i => real.key(i),
        get length() {
            return real.length;
        }
    };
}
