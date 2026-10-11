// @ts-check
/** Seul module à effets de bord : branche l'application sur la vraie fenêtre. */
import { init } from "./app.js";
import { createSleep } from "./core/rate-limiter.js";
import { registerServiceWorker } from "./pwa.js";

const params = new URLSearchParams(window.location.search);
/** @type {((url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<Response>) | undefined} */
let transport;
/** @type {import("./services/storage.js").StorageBackend|null|undefined} */
let storageBackend;
if (params.get("qa") === "1") {
    const qa = await import("./qa-lab/index.js");
    ({ transport, storageBackend } = qa.setupQaLab(
        window,
        (url, options) => window.fetch(url, options),
        createSleep({ setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) })
    ));
}

init({ win: window, transport, storageBackend });

registerServiceWorker(window, {
    onUpdate(apply) {
        const banner = document.getElementById("updateBanner");
        const button = document.getElementById("updateReloadBtn");
        if (!banner || !button) return;
        banner.classList.remove("hidden");
        button.addEventListener("click", apply, { once: true });
    }
});
