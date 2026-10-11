// @ts-check
import { sanitizeCriteria } from "../../core/criteria.js";

/**
 * Historique et recherches sauvegardées.
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createHistoryView(ctx) {
    const { dom, store } = ctx;
    const { h, $, replace } = dom;

    /** @param {any} x */
    function summary(x) {
        const t = ctx.t;
        const parts = [
            x.postalCode,
            x.city,
            x.status ? t("history.status", { status: x.status }) : "",
            x.naf ? `NAF ${x.naf}` : "",
            x.section ? t("history.section", { section: x.section }) : "",
            x.labels?.length ? t("history.labels", { count: x.labels.length }) : ""
        ].filter(Boolean);
        return parts.join(" · ") || t("history.noFilter");
    }

    /** @param {string} iso */
    function when(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(ctx.locale(), { dateStyle: "short", timeStyle: "short" }).format(d);
    }

    /** @param {any} entry */
    function relaunch(entry) {
        ctx.router.go({ view: "search", criteria: sanitizeCriteria(entry), page: 1 }, { push: true, recordHistory: true });
    }

    function render() {
        const t = ctx.t;
        const { history, saved } = store.get();
        replace(
            $("#historyList"),
            ...(history.length
                ? history.map((x, i) =>
                      h(
                          "article",
                          { "data-testid": "history-item" },
                          h(
                              "div",
                              {},
                              h("p", {}, h("b", {}, x.query)),
                              h("small", { class: "muted" }, summary(x)),
                              x.at ? h("small", { class: "muted block" }, when(x.at)) : null
                          ),
                          h("button", { type: "button", class: "button secondary", "data-h": String(i), onclick: () => relaunch(x) }, t("history.relaunch"))
                      )
                  )
                : [h("div", { class: "state" }, t("history.empty"))])
        );
        replace(
            $("#savedSearchesList"),
            ...(saved.length
                ? saved.map((x, i) =>
                      h(
                          "article",
                          { "data-testid": "saved-search-item" },
                          h("div", {}, h("p", { class: "saved-name" }, x.name), h("small", { class: "muted" }, `${x.query} · ${summary(x)}`)),
                          h(
                              "div",
                              { class: "actions" },
                              h(
                                  "button",
                                  { type: "button", class: "button secondary", "data-saved": String(i), onclick: () => relaunch(x) },
                                  t("history.launch")
                              ),
                              h(
                                  "button",
                                  {
                                      type: "button",
                                      class: "button secondary",
                                      "data-del-saved": x.id,
                                      "aria-label": t("history.deleteSaved", { name: x.name }),
                                      onclick: () => {
                                          store.set({ saved: store.get().saved.filter(s => s.id !== x.id) });
                                          ctx.persist("saved");
                                          render();
                                      }
                                  },
                                  "×"
                              )
                          )
                      )
                  )
                : [h("div", { class: "state" }, t("history.noSaved"))])
        );
    }

    $("#clearHistoryBtn").addEventListener("click", () => {
        store.set({ history: [] });
        ctx.persist("history");
        render();
    });

    return { render };
}
