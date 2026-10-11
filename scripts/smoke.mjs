// Test de fumée navigateur (Chromium) en mode Labo QA « fixtures » : aucun appel réseau réel.
// Usage : npm run smoke  (PLAYWRIGHT_CHROMIUM=/chemin/vers/chrome pour un binaire spécifique)
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright-core";

const PORT = 4321;
const BASE = `http://localhost:${PORT}/`;

function findChromium() {
    if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
    if (!existsSync(root)) return undefined;
    for (const dir of readdirSync(root).filter(d => d.startsWith("chromium-"))) {
        const candidate = `${root}/${dir}/chrome-linux/chrome`;
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}

const server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise(r => setTimeout(r, 600));

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
const problems = [];
page.on("console", msg => {
    if (msg.type() === "error" || /Content Security Policy/i.test(msg.text())) problems.push(`console: ${msg.text()}`);
});
page.on("pageerror", err => problems.push(`pageerror: ${err.message}`));
page.on("dialog", async d => {
    problems.push(`dialog inattendu (XSS ?) : ${d.message()}`);
    await d.dismiss();
});
page.on("request", req => {
    const url = req.url();
    if (!url.startsWith(BASE) && !url.startsWith("data:")) problems.push(`requête externe : ${url}`);
});

const step = async (name, fn) => {
    try {
        await fn();
        console.log(`✔ ${name}`);
    } catch (error) {
        problems.push(`${name} : ${error.message.split("\n")[0]}`);
        console.log(`✘ ${name}`);
    }
};
const ready = async () => page.locator("html[data-ready=true]").waitFor({ state: "attached", timeout: 8000 });
const expectVisible = async (selector, timeout = 4000) => page.locator(selector).first().waitFor({ state: "visible", timeout });

await step("accueil + bannière Labo QA", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures`);
    await ready();
    await expectVisible("[data-testid=qa-lab-banner]");
    await expectVisible("#homeView h1");
});
await step("recherche « paris » → cartes", async () => {
    await page.click("#mainNav [data-route=search]");
    await page.fill("#queryInput", "paris");
    await page.click("[data-testid=search-button]");
    await expectVisible("[data-testid=company-card-900000001]");
    if (!(await page.locator("#resultCount").textContent()).match(/\d+ résultat/)) throw new Error("compteur absent");
});
await step("tri par date : dates manquantes en fin", async () => {
    await page.selectOption("#sortSelect", "creation-newest");
    const sirens = await page.locator("#resultsGrid [data-siren]").evaluateAll(els => els.map(e => e.getAttribute("data-siren")));
    if (sirens.at(-1) !== "900000043") throw new Error(`ordre : ${sirens.join(",")}`);
});
await step("vue tableau + filtre local", async () => {
    await page.click("[data-testid=view-toggle]");
    await expectVisible("[data-testid=results-table] table");
    await page.fill("[data-testid=local-filter]", "café");
    if ((await page.locator("[data-testid=results-table] tbody tr").count()) !== 1) throw new Error("filtre local");
    await page.fill("[data-testid=local-filter]", "");
    await page.click("[data-testid=view-toggle]");
});
await step("analyse graphique", async () => {
    await page.click("[data-testid=analytics-toggle]");
    await page.click("#analyticsRunBtn");
    await expectVisible("[data-testid=analytics-chart-status]");
});
await step("fiche détaillée enrichie", async () => {
    await page.click("[data-testid=company-card-900000001] [data-detail]");
    await expectVisible("[data-testid=detail-finances-table]");
    await expectVisible("[data-testid=detail-directors]");
    await expectVisible("[data-testid=detail-vat]");
    await page.click("[data-est-filter=closed]");
    if ((await page.locator("#establishmentList .establishment").count()) !== 1) throw new Error("filtre établissements fermés (A/F)");
});
await step("favori depuis la fiche puis notes/tags", async () => {
    await page.click("#detailFav");
    await page.click("#mainNav [data-route=favorites]");
    await expectVisible("[data-testid=favorite-card-900000001]");
    await page.click("[data-testid=favorite-card-900000001] summary");
    await page.fill("[data-testid=favorite-card-900000001] [data-testid=favorite-tags]", "client, vip");
    await page.click("[data-testid=favorite-card-900000001] [data-testid=favorite-save-meta]");
    await expectVisible("[data-testid=favorite-card-900000001] .personal-tag");
    const stored = await page.evaluate(() => localStorage.getItem("fce:v2:favorites"));
    if (stored.includes("TESTEUR")) throw new Error("donnée personnelle persistée");
});
await step("comparaison à deux + différences", async () => {
    await page.goto(`${BASE}?qa=1&view=compare&sirens=900000001,900000019`);
    await ready();
    await expectVisible("[data-testid=compare-table]");
    await page.check("[data-testid=compare-diff-only]");
});
await step("payload XSS rendu en texte", async () => {
    await page.goto(`${BASE}?qa=1&q=societe`);
    await ready();
    await expectVisible("[data-testid=company-card-900000076]");
    if ((await page.locator("#resultsGrid img").count()) !== 0) throw new Error("balise img injectée");
});
await step("erreur 429 → message + Réessayer", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=429&q=paris`);
    await ready();
    await expectVisible("[data-testid=error-retry]", 12000);
    if (!(await page.locator("#searchState").textContent()).includes("429")) throw new Error("message 429");
});
await step("timeout simulé", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=timeout&q=paris`);
    await ready();
    await expectVisible("[data-testid=error-retry]", 40000);
});
await step("à proximité via commune", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures&view=nearby&lat=48.8589&lon=2.347&radius=5&place=Paris`);
    await ready();
    await expectVisible("[data-testid=result-distance]");
});
await step("anglais + préférences", async () => {
    await page.goto(`${BASE}?qa=1&lang=en&view=about`);
    await ready();
    await expectVisible("[data-testid=about-version] dd");
    if ((await page.locator("html").getAttribute("lang")) !== "en") throw new Error("lang");
    await page.click("[data-testid=preferences-open]");
    await page.selectOption("[data-testid=pref-theme]", "dark");
    if ((await page.locator("html").getAttribute("data-theme")) !== "dark") throw new Error("thème");
});
await step("bouton Précédent du navigateur", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures`);
    await ready();
    await page.click("#mainNav [data-route=favorites]");
    await page.click("#mainNav [data-route=history]");
    await page.goBack();
    await expectVisible("#favoritesView:not(.hidden)");
});
await step("menu mobile", async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${BASE}?qa=1`);
    await ready();
    await page.click("[data-testid=menu-toggle]");
    await expectVisible("#mainNav [data-route=favorites]");
    await page.screenshot({ path: "coverage/smoke-mobile.png" }).catch(() => {});
    await page.setViewportSize({ width: 1280, height: 900 });
});
await step("confidentialité : inventaire, export et effacement total", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures&q=paris`);
    await ready();
    const fav = page.locator("[data-testid=company-card-900000001] [data-fav]");
    if ((await fav.getAttribute("aria-pressed")) !== "true") await fav.click();
    await page.click("[data-testid=footer-privacy]");
    await expectVisible("[data-testid=privacy-inventory]");
    if ((await page.locator("[data-testid=privacy-count-favorites]").textContent()) !== "1") throw new Error("inventaire");
    await page.click("[data-testid=privacy-erase-all]");
    await page.check("[data-testid=erase-ack]");
    await page.click("[data-testid=erase-confirm]");
    await page.locator("[data-testid=privacy-status]").filter({ hasText: "effacées" }).waitFor({ timeout: 4000 });
    const left = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("fce")));
    if (left.length) throw new Error(`clés restantes : ${left.join(",")}`);
    await page.screenshot({ path: "coverage/smoke-privacy.png", fullPage: true });
});
await step("captures d'écran", async () => {
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures&q=paris`);
    await ready();
    await expectVisible("[data-testid=company-card-900000001]");
    await page.screenshot({ path: "coverage/smoke-search.png", fullPage: false });
    await page.goto(`${BASE}?qa=1&qaScenario=fixtures&view=detail&siren=900000001`);
    await ready();
    await expectVisible("[data-testid=detail-finances-table]");
    await page.screenshot({ path: "coverage/smoke-detail.png", fullPage: true });
});

await browser.close();
server.kill();
const filtered = problems.filter(p => !/favicon/.test(p));
if (filtered.length) {
    console.error(`\n${filtered.length} problème(s) :\n- ${filtered.join("\n- ")}`);
    process.exit(1);
}
console.log("\nTest de fumée OK");
