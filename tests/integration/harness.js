// Monte l'application complète dans une fenêtre jsdom isolée, avec l'API simulée par les fixtures.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { init } from "../../src/app.js";
import { respondWithFixtures } from "../../src/qa-lab/fixtures.js";

const HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf8").replace(/<script[^>]*><\/script>/g, "");

/** @param {any} win */
function polyfill(win) {
    const proto = win.HTMLDialogElement.prototype;
    proto.showModal = function showModal() {
        this.setAttribute("open", "");
    };
    proto.close = function close() {
        if (!this.hasAttribute("open")) return;
        this.removeAttribute("open");
        this.dispatchEvent(new win.Event("close"));
    };
    win.Element.prototype.scrollIntoView = function scrollIntoView() {};
    win.scrollTo = () => {};
    win.print = () => {
        win.__printed = true;
    };
    win.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
    win.__downloads = [];
    win.URL.createObjectURL = blob => {
        win.__downloads.push(blob);
        return "blob:test";
    };
    win.URL.revokeObjectURL = () => {};
    win.HTMLAnchorElement.prototype.click = function click() {
        win.__lastDownload = this.getAttribute("download");
    };
    win.fetch = async () => new Response(JSON.stringify({ version: "2.0.0-test", date: "2026-10-11", commit: "abcdef1234" }), { status: 200 });
}

/**
 * Transport simulé : fixtures par défaut, surcharge possible (erreurs, latence…).
 * @param {(url: string) => ({ status: number, body: unknown, headers?: Record<string, string> } | Promise<any> | null)} [override]
 */
export function fixtureTransport(override) {
    const calls = [];
    const transport = async (url, init) => {
        calls.push(url);
        const custom = override ? await override(url, init) : null;
        if (custom instanceof Response) return custom;
        const { status, body, headers } = custom || respondWithFixtures(url);
        return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
    };
    return { transport, calls };
}

/**
 * @param {{ path?: string, storage?: Record<string, string>, transport?: Function, clipboard?: boolean, online?: boolean }} [options]
 */
export function mountApp(options = {}) {
    const dom = new JSDOM(HTML, { url: `http://localhost/${options.path || ""}`, pretendToBeVisual: true });
    const win = dom.window;
    polyfill(win);
    for (const [k, v] of Object.entries(options.storage || {})) win.localStorage.setItem(k, v);
    if (options.clipboard) {
        win.__clipboard = [];
        Object.defineProperty(win.navigator, "clipboard", { value: { writeText: async text => win.__clipboard.push(text) }, configurable: true });
    }
    if (options.online === false) Object.defineProperty(win.navigator, "onLine", { value: false, configurable: true });
    const fixture = fixtureTransport();
    let n = 0;
    const app = init({
        win,
        transport: options.transport || fixture.transport,
        rateLimit: false,
        now: () => Date.parse("2026-10-11T10:00:00.000Z") + n++,
        random: () => 0,
        idFactory: () => `id-${++n}`
    });
    const $ = sel => win.document.querySelector(sel);
    const $$ = sel => [...win.document.querySelectorAll(sel)];
    return {
        win,
        doc: win.document,
        app,
        calls: fixture.calls,
        $,
        $$,
        text: sel => ($(sel)?.textContent || "").replace(/\s+/g, " ").trim(),
        visible: sel => Boolean($(sel)) && !$(sel).classList.contains("hidden") && !$(sel).closest(".hidden"),
        click: sel => {
            const el = $(sel);
            if (!el) throw new Error(`absent : ${sel}`);
            el.click();
        },
        type: (sel, value) => {
            const el = $(sel);
            el.value = value;
            el.dispatchEvent(new win.Event("input", { bubbles: true }));
            el.dispatchEvent(new win.Event("change", { bubbles: true }));
        },
        submit: sel => $(sel).dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true })),
        key: (key, target) => (target || win.document.body).dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
        lastDownloadText: () =>
            new Promise(resolveText => {
                const reader = new win.FileReader();
                reader.onload = () => resolveText(String(reader.result));
                reader.readAsText(win.__downloads.at(-1));
            }),
        stored: key => JSON.parse(win.localStorage.getItem(`fce:v2:${key}`) || "null"),
        close: () => win.close()
    };
}

/** Laisse s'exécuter les promesses en attente (réponses simulées). */
export async function settle(ms = 0) {
    for (let i = 0; i < 5; i += 1) await new Promise(r => setTimeout(r, ms));
}

/**
 * Attend qu'une condition devienne vraie (relances avec backoff réel, debounce…).
 * @param {() => boolean} condition
 * @param {number} [timeout]
 */
export async function until(condition, timeout = 4000) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) throw new Error("Condition non atteinte à temps");
        await new Promise(r => setTimeout(r, 20));
    }
}
