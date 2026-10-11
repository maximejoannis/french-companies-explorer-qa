import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/setup.js"],
        include: ["tests/**/*.test.js"],
        restoreMocks: true,
        coverage: {
            provider: "v8",
            include: ["src/**/*.js"],
            exclude: ["src/main.js"],
            reporter: ["text", "html", "lcov", "json-summary"],
            reportsDirectory: "coverage",
            thresholds: {
                lines: 80,
                branches: 80,
                functions: 80,
                statements: 80,
                "src/core/**": { lines: 90, branches: 90, functions: 90, statements: 90 }
            }
        }
    }
});
