import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { missingKeys } from "../../src/core/i18n.js";
import { en } from "../../src/locales/en.js";
import { fr } from "../../src/locales/fr.js";

describe("dictionnaires", () => {
    it("FR et EN ont exactement les mêmes clés (échoue si une traduction manque)", () => {
        expect(missingKeys(fr, en)).toEqual([]);
        expect(missingKeys(en, fr)).toEqual([]);
    });
    it("aucune valeur vide", () => {
        for (const dict of [fr, en]) for (const [k, v] of Object.entries(dict)) expect(v.trim(), k).not.toBe("");
    });
    it("toutes les clés data-i18n de index.html existent", () => {
        const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
        const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
        const attrKeys = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m => m[1].split(",").map(p => p.split(":")[1]));
        for (const key of [...keys, ...attrKeys]) expect(fr, key).toHaveProperty([key]);
    });
    it("les placeholders {x} sont identiques dans les deux langues", () => {
        const vars = s =>
            [...s.matchAll(/\{(\w+)\}/g)]
                .map(m => m[1])
                .sort()
                .join(",");
        for (const key of Object.keys(fr)) expect(vars(en[key]), key).toBe(vars(fr[key]));
    });
});
