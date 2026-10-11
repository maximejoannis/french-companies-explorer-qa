import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "../../src/pwa.js";

function fakeWin({ protocol = "https:", hostname = "example.org", controller = {}, register } = {}) {
    const listeners = {};
    const serviceWorker = {
        controller,
        register: register || vi.fn(),
        addEventListener: (type, fn) => {
            listeners[type] = fn;
        }
    };
    return { win: { navigator: { serviceWorker }, location: { protocol, hostname, reload: vi.fn() } }, listeners, serviceWorker };
}

function fakeRegistration(waiting = null) {
    const handlers = {};
    return { waiting, installing: null, addEventListener: (t, fn) => (handlers[t] = fn), handlers };
}

describe("registerServiceWorker", () => {
    it("ne fait rien hors HTTPS ou sans support", async () => {
        expect(await registerServiceWorker({ navigator: {}, location: { protocol: "https:" } }, { onUpdate: vi.fn() })).toBeNull();
        const { win, serviceWorker } = fakeWin({ protocol: "http:" });
        expect(await registerServiceWorker(win, { onUpdate: vi.fn() })).toBeNull();
        expect(serviceWorker.register).not.toHaveBeenCalled();
    });
    it("propose une mise à jour en attente et ne recharge qu'après acceptation", async () => {
        const waiting = { postMessage: vi.fn() };
        const registration = fakeRegistration(waiting);
        const { win, listeners } = fakeWin({ register: vi.fn(async () => registration) });
        const onUpdate = vi.fn();
        await registerServiceWorker(win, { onUpdate });
        listeners.controllerchange();
        expect(win.location.reload).not.toHaveBeenCalled();
        onUpdate.mock.calls[0][0]();
        expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
        listeners.controllerchange();
        listeners.controllerchange();
        expect(win.location.reload).toHaveBeenCalledTimes(1);
    });
    it("détecte une nouvelle version installée", async () => {
        const registration = fakeRegistration();
        const { win } = fakeWin({ hostname: "localhost", protocol: "http:", register: vi.fn(async () => registration) });
        const onUpdate = vi.fn();
        await registerServiceWorker(win, { onUpdate });
        let onState;
        registration.installing = { state: "installing", addEventListener: (_, fn) => (onState = fn), postMessage: vi.fn() };
        registration.handlers.updatefound();
        onState();
        expect(onUpdate).not.toHaveBeenCalled();
        registration.installing.state = "installed";
        onState();
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });
    it("n'affiche rien à la première installation (pas de contrôleur) et absorbe les échecs", async () => {
        const registration = fakeRegistration({ postMessage: vi.fn() });
        const first = fakeWin({ controller: null, register: vi.fn(async () => registration) });
        const onUpdate = vi.fn();
        await registerServiceWorker(first.win, { onUpdate });
        expect(onUpdate).not.toHaveBeenCalled();
        const failing = fakeWin({
            register: vi.fn(async () => {
                throw new Error("module SW non supporté");
            })
        });
        expect(await registerServiceWorker(failing.win, { onUpdate })).toBeNull();
    });
});
