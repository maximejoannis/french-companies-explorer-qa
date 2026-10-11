import { describe, expect, it, vi } from "vitest";
import { isFresh, strategyFor, stripPersonalData } from "../../src/core/cache-strategy.js";
import { createTranslator, missingKeys } from "../../src/core/i18n.js";
import { abortError, createRateLimiter, createSleep } from "../../src/core/rate-limiter.js";
import { resolveShortcut } from "../../src/core/shortcuts.js";

describe("rate limiter", () => {
    it("espace les départs selon le débit autorisé", async () => {
        let now = 1000;
        const waits = [];
        const limiter = createRateLimiter({
            perSecond: 5,
            now: () => now,
            sleep: async ms => {
                waits.push(ms);
            }
        });
        await limiter.acquire();
        await limiter.acquire();
        await limiter.acquire();
        expect(waits).toEqual([200, 400]);
        now = 5000;
        await limiter.acquire();
        expect(waits).toHaveLength(2);
        expect(limiter.interval).toBe(200);
    });
    it("rejette si le signal est annulé", async () => {
        const controller = new AbortController();
        controller.abort();
        const limiter = createRateLimiter({ perSecond: 5, now: () => 0, sleep: async () => {} });
        await expect(limiter.acquire(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    });
    it("createSleep attend puis résout, ou rejette à l'annulation", async () => {
        vi.useFakeTimers();
        const sleep = createSleep({ setTimeout, clearTimeout });
        const done = vi.fn();
        sleep(100).then(done);
        await vi.advanceTimersByTimeAsync(99);
        expect(done).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(done).toHaveBeenCalled();
        const c = new AbortController();
        const p = sleep(1000, c.signal);
        c.abort();
        await expect(p).rejects.toMatchObject({ name: "AbortError" });
        const c2 = new AbortController();
        c2.abort();
        await expect(sleep(10, c2.signal)).rejects.toMatchObject({ name: "AbortError" });
        vi.useRealTimers();
        expect(abortError().name).toBe("AbortError");
    });
});

describe("i18n", () => {
    const dicts = {
        fr: { hello: "Bonjour {name}", "items.one": "{count} élément", "items.other": "{count} éléments", only: "fr" },
        en: { hello: "Hello {name}", "items.one": "{count} item", "items.other": "{count} items" }
    };
    it("interpole et choisit le pluriel", () => {
        const t = createTranslator(dicts, "fr");
        expect(t("hello", { name: "Ada" })).toBe("Bonjour Ada");
        expect(t("items", { count: 1 })).toBe("1 élément");
        expect(t("items", { count: 0 })).toBe("0 élément");
        expect(t("items", { count: 3 })).toBe("3 éléments");
        expect(t("hello", { name: null })).toBe("Bonjour ");
        expect(t.lang).toBe("fr");
    });
    it("se replie sur le français puis sur la clé", () => {
        const t = createTranslator(dicts, "en");
        expect(t("items", { count: 0 })).toBe("0 items");
        expect(t("only")).toBe("fr");
        expect(t("absent")).toBe("absent");
        expect(createTranslator(dicts, "de").lang).toBe("fr");
        expect(createTranslator({}, "de")("x")).toBe("x");
        expect(createTranslator({ fr: { "n.other": "{count} n" }, en: {} }, "en")("n", { count: 2 })).toBe("2 n");
    });
    it("détecte les clés manquantes", () => {
        expect(missingKeys(dicts.fr, dicts.en)).toEqual(["only"]);
    });
});

describe("cache strategy", () => {
    const origin = "https://maximejoannis.github.io";
    it.each([
        [{ method: "GET", url: `${origin}/french-companies-explorer-qa/index.html` }, "shell"],
        [{ method: "GET", url: `${origin}/french-companies-explorer-qa/version.json` }, "bypass"],
        [{ method: "GET", url: "https://recherche-entreprises.api.gouv.fr/search?q=x" }, "api"],
        [{ method: "GET", url: "https://geo.api.gouv.fr/communes?nom=x" }, "api"],
        [{ method: "POST", url: "https://geo.api.gouv.fr/communes" }, "bypass"],
        [{ method: "GET", url: "https://evil.example/x" }, "bypass"],
        [{ method: "GET", url: "not a url" }, "bypass"]
    ])("%j → %s", (req, expected) => expect(strategyFor(req, origin)).toBe(expected));
    it("évalue la fraîcheur", () => {
        expect(isFresh(0, 1000, 2000)).toBe(true);
        expect(isFresh(0, 3000, 2000)).toBe(false);
        expect(isFresh(5000, 1000, 2000)).toBe(false);
        expect(isFresh(Number.NaN, 1000)).toBe(false);
    });
    it("retire les dirigeants avant mise en cache sans muter l'original", () => {
        const payload = { results: [{ siren: "1", dirigeants: [{ nom: "X" }] }, null] };
        const stripped = stripPersonalData(payload);
        expect(stripped.results[0]).toEqual({ siren: "1" });
        expect(payload.results[0].dirigeants).toHaveLength(1);
        expect(stripPersonalData(null)).toBeNull();
        expect(stripPersonalData([{ a: 1 }])).toEqual([{ a: 1 }]);
    });
});

describe("raccourcis", () => {
    const ctx = { enabled: true, inField: false, pendingGo: false };
    it("résout / ? et la séquence g + lettre", () => {
        expect(resolveShortcut({ key: "/" }, ctx).action).toEqual({ action: "focus-search" });
        expect(resolveShortcut({ key: "?" }, ctx).action).toEqual({ action: "help" });
        expect(resolveShortcut({ key: "g" }, ctx)).toEqual({ action: null, pendingGo: true });
        expect(resolveShortcut({ key: "f" }, { ...ctx, pendingGo: true }).action).toEqual({ action: "navigate", view: "favorites" });
        expect(resolveShortcut({ key: "z" }, { ...ctx, pendingGo: true })).toEqual({ action: null, pendingGo: false });
        expect(resolveShortcut({ key: "x" }, ctx).action).toBeNull();
    });
    it("est inactif si désactivé, dans un champ ou avec un modificateur (WCAG 2.1.4)", () => {
        expect(resolveShortcut({ key: "/" }, { ...ctx, enabled: false }).action).toBeNull();
        expect(resolveShortcut({ key: "/" }, { ...ctx, inField: true }).action).toBeNull();
        expect(resolveShortcut({ key: "/", ctrlKey: true }, ctx).action).toBeNull();
    });
});
