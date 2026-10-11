// @ts-check
/**
 * Résolution pure des raccourcis clavier (WCAG 2.1.4 : désactivables, inactifs dans les champs).
 * @typedef {{ action: string, view?: string } | null} ShortcutAction
 */

const GO_TARGETS = Object.freeze({ s: "search", f: "favorites", c: "compare", h: "history", n: "nearby", a: "about", o: "home", p: "privacy" });

/**
 * @param {{ key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }} event
 * @param {{ enabled: boolean, inField: boolean, pendingGo: boolean }} context
 * @returns {{ action: ShortcutAction, pendingGo: boolean }}
 */
export function resolveShortcut(event, context) {
    if (!context.enabled || context.inField || event.ctrlKey || event.metaKey || event.altKey) return { action: null, pendingGo: false };
    if (context.pendingGo) {
        const view = GO_TARGETS[event.key.toLowerCase()];
        return { action: view ? { action: "navigate", view } : null, pendingGo: false };
    }
    if (event.key === "/") return { action: { action: "focus-search" }, pendingGo: false };
    if (event.key === "?") return { action: { action: "help" }, pendingGo: false };
    if (event.key === "g") return { action: null, pendingGo: true };
    return { action: null, pendingGo: false };
}
