// Service worker (module) — coquille mince, logique testée dans src/core/cache-strategy.js.
import { isFresh, strategyFor, stripPersonalData } from "./src/core/cache-strategy.js";

const VERSION = "2.1.0";
const SHELL_CACHE = `fce-shell-${VERSION}`;
const API_CACHE = "fce-api-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./src/main.js", "./manifest.webmanifest", "./assets/icons/icon.svg"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
});

/** Limitation de conservation : supprime les réponses API mises en cache depuis plus de 24 h. */
async function purgeExpiredApiResponses() {
    const cache = await caches.open(API_CACHE);
    const now = Date.now();
    for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (!response || !isFresh(Number(response.headers.get("X-FCE-Cached-At")), now)) await cache.delete(request);
    }
}

self.addEventListener("activate", event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith("fce-shell-") && k !== SHELL_CACHE).map(k => caches.delete(k))))
            .then(purgeExpiredApiResponses)
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", event => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
    if (event.data?.type === "PURGE_EXPIRED") event.waitUntil(purgeExpiredApiResponses());
});

async function shell(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    const network = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached || caches.match("./index.html"));
    return cached || network;
}

async function api(request) {
    const cache = await caches.open(API_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            const payload = stripPersonalData(await response.clone().json());
            const headers = new Headers({ "Content-Type": "application/json", "X-FCE-Cached-At": String(Date.now()) });
            await cache.put(request, new Response(JSON.stringify(payload), { headers }));
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached && isFresh(Number(cached.headers.get("X-FCE-Cached-At")), Date.now())) return cached;
        throw error;
    }
}

self.addEventListener("fetch", event => {
    const kind = strategyFor(event.request, self.location.origin);
    if (kind === "shell") event.respondWith(shell(event.request));
    else if (kind === "api") event.respondWith(api(event.request));
});
