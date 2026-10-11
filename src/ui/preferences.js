// @ts-check
/**
 * Préférences d'affichage (N-13) appliquées via attributs data-* sur <html> (aucun style inline, CSP).
 * @param {import("./app-context.js").AppContext} ctx
 */
export function createPreferences(ctx) {
    const { dom, store, win } = ctx;
    const { $ } = dom;
    const root = dom.doc.documentElement;
    const media = typeof win.matchMedia === "function" ? win.matchMedia("(prefers-color-scheme: dark)") : null;

    function resolvedTheme() {
        const theme = store.get().prefs.theme;
        if (theme === "system") return media?.matches ? "dark" : "light";
        return theme;
    }

    function apply() {
        const p = store.get().prefs;
        const theme = resolvedTheme();
        root.dataset.theme = theme;
        root.dataset.contrast = p.contrast;
        root.dataset.density = p.density;
        root.dataset.motion = p.motion;
        root.dataset.fontScale = p.fontScale;
        const toggle = $("#themeToggle");
        toggle.textContent = theme === "dark" ? "☀" : "☾";
        toggle.setAttribute("aria-label", ctx.t(theme === "dark" ? "theme.toLight" : "theme.toDark"));
        toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }

    function syncForm() {
        const p = store.get().prefs;
        /** @type {[string, string][]} */
        const map = [
            ["#prefTheme", p.theme],
            ["#prefContrast", p.contrast],
            ["#prefDensity", p.density],
            ["#prefMotion", p.motion],
            ["#prefFontScale", p.fontScale],
            ["#prefLang", p.lang]
        ];
        for (const [sel, value] of map) /** @type {HTMLSelectElement} */ ($(sel)).value = value;
        /** @type {HTMLInputElement} */ ($("#prefShortcuts")).checked = p.shortcuts;
    }

    function readForm() {
        const v = (/** @type {string} */ sel) => /** @type {HTMLSelectElement} */ ($(sel)).value;
        ctx.updatePrefs({
            theme: /** @type {any} */ (v("#prefTheme")),
            contrast: /** @type {any} */ (v("#prefContrast")),
            density: /** @type {any} */ (v("#prefDensity")),
            motion: /** @type {any} */ (v("#prefMotion")),
            fontScale: /** @type {any} */ (v("#prefFontScale")),
            lang: v("#prefLang"),
            shortcuts: /** @type {HTMLInputElement} */ ($("#prefShortcuts")).checked
        });
    }

    $("#preferencesDialog").addEventListener("change", readForm);
    $("#preferencesBtn").addEventListener("click", () => {
        syncForm();
        /** @type {HTMLDialogElement} */ ($("#preferencesDialog")).showModal();
    });
    $("#openShortcutsBtn").addEventListener("click", () => {
        /** @type {HTMLDialogElement} */ ($("#preferencesDialog")).close();
        /** @type {HTMLDialogElement} */ ($("#shortcutsDialog")).showModal();
    });
    $("#themeToggle").addEventListener("click", () => ctx.updatePrefs({ theme: resolvedTheme() === "dark" ? "light" : "dark" }));
    media?.addEventListener?.("change", () => {
        if (store.get().prefs.theme === "system") apply();
    });

    return { apply, syncForm, resolvedTheme };
}
