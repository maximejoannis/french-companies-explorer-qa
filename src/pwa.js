// @ts-check
/**
 * Enregistrement du service worker (N-11). Ne fait rien hors HTTPS/localhost ou si non supporté.
 * @param {Window & typeof globalThis} win
 * @param {{ onUpdate: (apply: () => void) => void }} hooks
 */
export async function registerServiceWorker(win, hooks) {
    const nav = win.navigator;
    if (!("serviceWorker" in nav) || !(win.location.protocol === "https:" || win.location.hostname === "localhost" || win.location.hostname === "127.0.0.1"))
        return null;
    try {
        const registration = await nav.serviceWorker.register("./sw.js", { type: "module", scope: "./" });
        // Rechargement uniquement après acceptation explicite d'une mise à jour :
        // la prise de contrôle initiale (clients.claim) ne doit jamais recharger la page.
        let accepted = false;
        const offer = (/** @type {ServiceWorker|null} */ worker) => {
            if (!worker || !nav.serviceWorker.controller) return;
            hooks.onUpdate(() => {
                accepted = true;
                worker.postMessage({ type: "SKIP_WAITING" });
            });
        };
        offer(registration.waiting);
        registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
                if (worker.state === "installed") offer(worker);
            });
        });
        nav.serviceWorker.addEventListener("controllerchange", () => {
            if (!accepted) return;
            accepted = false;
            win.location.reload();
        });
        return registration;
    } catch {
        // Navigateur sans service worker de type module : l'application reste pleinement utilisable en ligne.
        return null;
    }
}
