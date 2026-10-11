// @ts-check
import { abortError } from "../core/rate-limiter.js";

/**
 * @typedef {"validation"|"not-found"|"rate-limit"|"server"|"network"|"timeout"|"invalid-response"|"http"} HttpErrorKind
 */

export class HttpError extends Error {
    /**
     * @param {HttpErrorKind} kind
     * @param {{ status?: number, retryAfterMs?: number|null, cause?: unknown }} [details]
     */
    constructor(kind, details = {}) {
        super(`HTTP error: ${kind}${details.status ? ` (${details.status})` : ""}`);
        this.name = "HttpError";
        this.kind = kind;
        this.status = details.status ?? 0;
        this.retryAfterMs = details.retryAfterMs ?? null;
        this.cause = details.cause;
    }
    get retryable() {
        return this.kind === "rate-limit" || this.kind === "server" || this.kind === "network" || this.kind === "timeout";
    }
}

/**
 * En-tête Retry-After : secondes ou date HTTP.
 * @param {string|null} value
 * @param {number} now
 * @returns {number|null}
 */
export function parseRetryAfter(value, now) {
    if (!value) return null;
    if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
    const date = Date.parse(value);
    return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * @param {number} status
 * @returns {HttpErrorKind}
 */
export function kindForStatus(status) {
    if (status === 400 || status === 422) return "validation";
    if (status === 404) return "not-found";
    if (status === 429) return "rate-limit";
    if (status >= 500) return "server";
    return "http";
}

/**
 * @typedef {(url: string, init: { signal: AbortSignal, headers: Record<string, string> }) => Promise<Response>} Transport
 * @typedef {{ acquire: (signal?: AbortSignal) => Promise<void> }} Limiter
 */

/**
 * Client HTTP JSON : limiteur de débit, timeout, annulation, erreurs typées, retry borné avec backoff + gigue.
 * @param {{ transport: Transport, limiter?: Limiter|null, timers: { setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout },
 *   sleep: (ms: number, signal?: AbortSignal) => Promise<void>, now: () => number, random?: () => number,
 *   timeoutMs: number, maxRetries: number, baseDelayMs: number, maxRetryAfterMs: number }} deps
 */
export function createHttp(deps) {
    const random = deps.random || Math.random;

    /**
     * @param {string} url
     * @param {AbortSignal} [outer]
     */
    async function attempt(url, outer) {
        if (deps.limiter) await deps.limiter.acquire(outer);
        const controller = new AbortController();
        let timedOut = false;
        const onAbort = () => controller.abort();
        outer?.addEventListener("abort", onAbort, { once: true });
        const timer = deps.timers.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, deps.timeoutMs);
        try {
            let response;
            try {
                response = await deps.transport(url, { signal: controller.signal, headers: { Accept: "application/json" } });
            } catch (error) {
                if (outer?.aborted) throw abortError();
                if (timedOut) throw new HttpError("timeout", { cause: error });
                throw new HttpError("network", { cause: error });
            }
            if (!response.ok) {
                const kind = kindForStatus(response.status);
                throw new HttpError(kind, {
                    status: response.status,
                    retryAfterMs: kind === "rate-limit" ? parseRetryAfter(response.headers.get("Retry-After"), deps.now()) : null
                });
            }
            try {
                return await response.json();
            } catch (error) {
                if (outer?.aborted) throw abortError();
                if (timedOut) throw new HttpError("timeout", { cause: error });
                throw new HttpError("invalid-response", { cause: error });
            }
        } finally {
            deps.timers.clearTimeout(timer);
            outer?.removeEventListener("abort", onAbort);
        }
    }

    /**
     * @param {string} url
     * @param {{ signal?: AbortSignal, retries?: number }} [options]
     * @returns {Promise<any>}
     */
    async function getJson(url, options = {}) {
        const retries = options.retries ?? deps.maxRetries;
        for (let n = 0; ; n += 1) {
            try {
                return await attempt(url, options.signal);
            } catch (error) {
                if (!(error instanceof HttpError) || !error.retryable || n >= retries) throw error;
                const backoff = deps.baseDelayMs * 2 ** n * (1 + random() * 0.5);
                const wait = error.retryAfterMs !== null ? Math.min(error.retryAfterMs, deps.maxRetryAfterMs) : backoff;
                await deps.sleep(wait, options.signal);
            }
        }
    }

    return { getJson };
}

/** @param {unknown} error */
export function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
