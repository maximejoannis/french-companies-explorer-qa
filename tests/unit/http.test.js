import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSleep } from "../../src/core/rate-limiter.js";
import { createHttp, HttpError, isAbortError, kindForStatus, parseRetryAfter } from "../../src/services/http.js";

const json = (body, status = 200, headers = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

function setup(transport, overrides = {}) {
    const sleep = vi.fn(async () => {});
    const http = createHttp({
        transport,
        limiter: null,
        timers: { setTimeout, clearTimeout },
        sleep,
        now: () => 0,
        random: () => 0,
        timeoutMs: 1000,
        maxRetries: 2,
        baseDelayMs: 100,
        maxRetryAfterMs: 5000,
        ...overrides
    });
    return { http, sleep };
}

describe("helpers", () => {
    it.each([
        [400, "validation"],
        [422, "validation"],
        [404, "not-found"],
        [429, "rate-limit"],
        [500, "server"],
        [503, "server"],
        [418, "http"]
    ])("statut %i → %s", (s, k) => {
        expect(kindForStatus(s)).toBe(k);
    });
    it("lit Retry-After en secondes ou en date HTTP", () => {
        expect(parseRetryAfter("3", 0)).toBe(3000);
        expect(parseRetryAfter(null, 0)).toBeNull();
        expect(parseRetryAfter("n'importe quoi", 0)).toBeNull();
        const now = Date.parse("2026-10-11T10:00:00Z");
        expect(parseRetryAfter("Sun, 11 Oct 2026 10:00:05 GMT", now)).toBe(5000);
        expect(parseRetryAfter("Sun, 11 Oct 2026 09:00:00 GMT", now)).toBe(0);
    });
    it("classe les erreurs relançables", () => {
        expect(new HttpError("rate-limit").retryable).toBe(true);
        expect(new HttpError("validation").retryable).toBe(false);
        expect(new HttpError("server", { status: 503 }).message).toContain("503");
        expect(isAbortError(Object.assign(new Error(), { name: "AbortError" }))).toBe(true);
        expect(isAbortError("x")).toBe(false);
    });
});

describe("getJson", () => {
    it("renvoie le JSON et passe le signal et l'en-tête Accept", async () => {
        const transport = vi.fn(async () => json({ ok: 1 }));
        const { http } = setup(transport);
        await expect(http.getJson("https://x.test/a")).resolves.toEqual({ ok: 1 });
        expect(transport.mock.calls[0][1].headers).toEqual({ Accept: "application/json" });
        expect(transport.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });
    it.each([
        [400, "validation"],
        [404, "not-found"]
    ])("ne relance pas une erreur %i", async (status, kind) => {
        const transport = vi.fn(async () => json({}, status));
        const { http } = setup(transport);
        await expect(http.getJson("u")).rejects.toMatchObject({ kind, status });
        expect(transport).toHaveBeenCalledTimes(1);
    });
    it("relance 5xx au plus maxRetries fois avec backoff exponentiel", async () => {
        const transport = vi.fn(async () => json({}, 500));
        const { http, sleep } = setup(transport);
        await expect(http.getJson("u")).rejects.toMatchObject({ kind: "server" });
        expect(transport).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls.map(c => c[0])).toEqual([100, 200]);
    });
    it("respecte Retry-After (plafonné) sur 429 puis réussit", async () => {
        const transport = vi
            .fn()
            .mockResolvedValueOnce(json({}, 429, { "Retry-After": "2" }))
            .mockResolvedValueOnce(json({}, 429, { "Retry-After": "60" }))
            .mockResolvedValueOnce(json({ ok: true }));
        const { http, sleep } = setup(transport);
        await expect(http.getJson("u")).resolves.toEqual({ ok: true });
        expect(sleep.mock.calls.map(c => c[0])).toEqual([2000, 5000]);
    });
    it("transforme une erreur réseau en NetworkError relançable", async () => {
        const transport = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });
        const { http } = setup(transport, { maxRetries: 0 });
        await expect(http.getJson("u")).rejects.toMatchObject({ kind: "network" });
    });
    it("signale un JSON invalide sans relancer", async () => {
        const transport = vi.fn(async () => json("<html>", 200));
        const { http } = setup(transport);
        await expect(http.getJson("u")).rejects.toMatchObject({ kind: "invalid-response" });
        expect(transport).toHaveBeenCalledTimes(1);
    });
    it("respecte un nombre de relances par appel", async () => {
        const transport = vi.fn(async () => json({}, 503));
        const { http } = setup(transport);
        await expect(http.getJson("u", { retries: 0 })).rejects.toMatchObject({ kind: "server" });
        expect(transport).toHaveBeenCalledTimes(1);
    });
    it("passe par le limiteur de débit avant chaque tentative", async () => {
        const limiter = { acquire: vi.fn(async () => {}) };
        const transport = vi
            .fn()
            .mockResolvedValueOnce(json({}, 500))
            .mockResolvedValueOnce(json({ a: 1 }));
        const { http } = setup(transport, { limiter });
        await http.getJson("u");
        expect(limiter.acquire).toHaveBeenCalledTimes(2);
    });

    describe("timeouts et annulation", () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());
        const hanging = (url, init) =>
            new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
        it("lève TimeoutError quand la réponse n'arrive pas à temps", async () => {
            const { http } = setup(vi.fn(hanging), { maxRetries: 0 });
            const p = http.getJson("u");
            const assertion = expect(p).rejects.toMatchObject({ kind: "timeout" });
            await vi.advanceTimersByTimeAsync(1000);
            await assertion;
        });
        it("lève AbortError (jamais affichée) quand l'appelant annule", async () => {
            const { http } = setup(vi.fn(hanging));
            const controller = new AbortController();
            const p = http.getJson("u", { signal: controller.signal });
            controller.abort();
            await expect(p).rejects.toMatchObject({ name: "AbortError" });
        });
        it("annule pendant l'attente de relance", async () => {
            const controller = new AbortController();
            const sleep = createSleep({ setTimeout, clearTimeout });
            const transport = vi.fn(async () => json({}, 500));
            const http = createHttp({
                transport,
                limiter: null,
                timers: { setTimeout, clearTimeout },
                sleep,
                now: () => 0,
                random: () => 0,
                timeoutMs: 1000,
                maxRetries: 2,
                baseDelayMs: 100,
                maxRetryAfterMs: 1000
            });
            const p = http.getJson("u", { signal: controller.signal });
            const assertion = expect(p).rejects.toMatchObject({ name: "AbortError" });
            await vi.advanceTimersByTimeAsync(10);
            controller.abort();
            await assertion;
        });
        it("distingue timeout et annulation pendant la lecture du corps", async () => {
            const slowBody = {
                ok: true,
                status: 200,
                headers: new Headers(),
                json: () => new Promise((_, reject) => setTimeout(() => reject(new Error("body")), 5000))
            };
            const { http } = setup(
                vi.fn(async () => slowBody),
                { maxRetries: 0 }
            );
            const p = http.getJson("u");
            const assertion = expect(p).rejects.toMatchObject({ kind: "timeout" });
            await vi.advanceTimersByTimeAsync(5000);
            await assertion;
            const controller = new AbortController();
            const p2 = http.getJson("u", { signal: controller.signal });
            const a2 = expect(p2).rejects.toMatchObject({ name: "AbortError" });
            controller.abort();
            await vi.advanceTimersByTimeAsync(5000);
            await a2;
        });
    });
});
