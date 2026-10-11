import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";

export default [
    { ignores: ["node_modules/", "coverage/", "assets/"] },
    js.configs.recommended,
    {
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser } },
        plugins: { "no-unsanitized": noUnsanitized },
        rules: {
            // Garde-fou XSS : interdit innerHTML/outerHTML/insertAdjacentHTML/document.write avec du contenu dynamique.
            "no-unsanitized/method": "error",
            "no-unsanitized/property": "error",
            "no-restricted-properties": [
                "error",
                { object: "document", property: "write", message: "Interdit (XSS)." },
                { property: "innerHTML", message: "Utiliser createDom().h / textContent (garde-fou XSS)." },
                { property: "outerHTML", message: "Utiliser createDom().h / textContent (garde-fou XSS)." }
            ],
            "no-restricted-globals": [
                "error",
                { name: "prompt", message: "Utiliser un <dialog> accessible." },
                { name: "alert", message: "Utiliser un toast." }
            ],
            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",
            eqeqeq: ["error", "always"],
            "no-var": "error",
            "prefer-const": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }]
        }
    },
    {
        // Le domaine reste pur : aucune dépendance vers l'interface, les services ou l'état.
        files: ["src/core/**/*.js"],
        rules: {
            "no-restricted-imports": [
                "error",
                { patterns: [{ group: ["../ui/*", "../services/*", "../state/*", "../app.js", "../qa-lab/*"], message: "src/core doit rester pur." }] }
            ],
            "no-restricted-globals": ["error", "document", "window", "localStorage", "sessionStorage", "fetch", "navigator", "location"]
        }
    },
    { files: ["sw.js"], languageOptions: { globals: { ...globals.serviceworker } } },
    { files: ["scripts/**/*.mjs", "*.config.js"], languageOptions: { globals: { ...globals.node } } },
    { files: ["tests/**/*.js"], languageOptions: { globals: { ...globals.node, ...globals.browser } } }
];
