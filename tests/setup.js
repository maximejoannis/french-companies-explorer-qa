// Compléments jsdom : API navigateur absentes de jsdom mais utilisées par l'application.
import { afterEach } from "vitest";

if (typeof HTMLDialogElement !== "undefined") {
    if (!HTMLDialogElement.prototype.showModal) {
        HTMLDialogElement.prototype.showModal = function showModal() {
            this.setAttribute("open", "");
        };
    }
    if (!HTMLDialogElement.prototype.close) {
        HTMLDialogElement.prototype.close = function close(value) {
            if (value !== undefined) this.returnValue = value;
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    }
}
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
if (typeof window !== "undefined") {
    window.scrollTo = () => {};
    if (!window.matchMedia) {
        window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    }
}

afterEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear();
    if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});
