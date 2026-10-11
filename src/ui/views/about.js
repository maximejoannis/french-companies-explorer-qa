// @ts-check
import { API, APP_VERSION } from "../../config.js";

/**
 * Page « À propos & nouveautés » (N-15).
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createAboutView(ctx) {
    const { dom } = ctx;
    const { h, $, replace } = dom;
    /** @type {{ version: string, date: string, commit: string }|null} */
    let info = null;

    async function loadVersion() {
        try {
            const response = await ctx.fetchStatic("./version.json");
            const data = response.ok ? await response.json() : null;
            info = {
                version: typeof data?.version === "string" ? data.version.slice(0, 20) : APP_VERSION,
                date: typeof data?.date === "string" ? data.date.slice(0, 25) : "",
                commit: typeof data?.commit === "string" && /^[0-9a-f]{7,40}$/.test(data.commit) ? data.commit.slice(0, 12) : ""
            };
        } catch {
            info = { version: APP_VERSION, date: "", commit: "" };
        }
        renderVersion();
    }

    function renderVersion() {
        const t = ctx.t;
        const v = info || { version: APP_VERSION, date: "", commit: "" };
        replace(
            $("#aboutVersion"),
            h("div", {}, h("dt", {}, t("about.versionLabel")), h("dd", {}, v.version)),
            h("div", {}, h("dt", {}, t("about.buildDate")), h("dd", {}, v.date || "—")),
            h("div", {}, h("dt", {}, t("about.commit")), h("dd", {}, v.commit || "—"))
        );
    }

    function renderNews() {
        replace($("#aboutNews"), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => h("li", {}, ctx.t(`about.news${i}`))));
    }

    async function checkApis() {
        const t = ctx.t;
        const root = $("#aboutApiStatus");
        replace(root, h("p", { class: "muted" }, t("about.checking")));
        /** @type {[string, string][]} */
        const targets = [
            ["Recherche d’Entreprises", `${API.search}?q=la%20poste&per_page=1&minimal=true`],
            ["Découpage administratif", `${API.communes}?nom=Paris&fields=code&limit=1`]
        ];
        const rows = [];
        for (const [name, url] of targets) {
            const start = ctx.clock.now();
            try {
                await ctx.http.getJson(url, { retries: 0 });
                rows.push(
                    h(
                        "li",
                        { "data-api-ok": "true" },
                        h("span", { class: "status active" }, t("about.ok")),
                        ` ${name} — ${Math.round(ctx.clock.now() - start)} ms`
                    )
                );
            } catch (error) {
                rows.push(h("li", { "data-api-ok": "false" }, h("span", { class: "status closed" }, t("about.ko")), ` ${name} — ${ctx.errorMessage(error)}`));
            }
        }
        replace(root, h("ul", { class: "plain-list" }, ...rows));
    }

    $("#aboutApiCheckBtn").addEventListener("click", checkApis);

    return {
        show() {
            renderNews();
            if (info) renderVersion();
            else loadVersion();
        },
        refreshLanguage() {
            renderNews();
            renderVersion();
        },
        checkApis
    };
}
