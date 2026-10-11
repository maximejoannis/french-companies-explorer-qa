// @ts-check
/**
 * Limiteur de débit par espacement : deux départs de requête sont séparés d'au moins 1000/perSecond ms.
 * Horloge et attente injectées pour des tests déterministes.
 * @param {{ perSecond: number, now: () => number, sleep: (ms: number, signal?: AbortSignal) => Promise<void> }} deps
 */
export function createRateLimiter({ perSecond, now, sleep }) {
    const interval = 1000 / perSecond;
    let nextSlot = 0;
    return {
        /**
         * Attend un créneau libre. Rejette avec AbortError si le signal est annulé pendant l'attente.
         * @param {AbortSignal} [signal]
         */
        async acquire(signal) {
            const t = now();
            const slot = Math.max(t, nextSlot);
            nextSlot = slot + interval;
            const wait = slot - t;
            if (wait > 0) await sleep(wait, signal);
            if (signal?.aborted) throw abortError();
        },
        get interval() {
            return interval;
        }
    };
}

export function abortError() {
    const e = new Error("Requête annulée");
    e.name = "AbortError";
    return e;
}

/**
 * Attente annulable basée sur des timers injectés.
 * @param {{ setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout }} timers
 */
export function createSleep(timers) {
    /**
     * @param {number} ms
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    return (ms, signal) =>
        new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(abortError());
            const id = timers.setTimeout(() => {
                signal?.removeEventListener("abort", onAbort);
                resolve();
            }, ms);
            function onAbort() {
                timers.clearTimeout(id);
                reject(abortError());
            }
            signal?.addEventListener("abort", onAbort, { once: true });
        });
}
