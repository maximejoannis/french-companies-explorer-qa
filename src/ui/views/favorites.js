// @ts-check
import { LIMITS } from "../../config.js";
import { diffSnapshots } from "../../core/diff.js";
import { mergeFavorites, parseFavoritesFile, serializeFavorites } from "../../core/favorites-io.js";
import { normalizeTags, sanitizeFavorite } from "../../core/schema.js";
import { isAbortError } from "../../services/http.js";
import { setHidden } from "../dom.js";
import { displayName, favoriteButton, statusBadge, valueOrMissing } from "../render.js";

/**
 * Favoris complets (N-4) : notes, tags, filtre, tri, import/export JSON, veille des changements.
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createFavoritesView(ctx) {
    const { dom, store } = ctx;
    const { h, $, replace } = dom;
    /** @type {AbortController|null} */
    let refreshController = null;

    /** @param {string} siren */
    const metaFor = siren => store.get().favoriteMeta[siren] || { note: "", tags: [] };

    function fillTagFilter() {
        const select = /** @type {HTMLSelectElement} */ ($("#favoritesTagFilter"));
        const value = select.value;
        const tags = [...new Set(Object.values(store.get().favoriteMeta).flatMap(m => m.tags))].sort((a, b) => a.localeCompare(b, "fr"));
        replace(select, h("option", { value: "" }, ctx.t("favorites.allTags")), ...tags.map(tag => h("option", { value: tag }, tag)));
        select.value = tags.includes(value) ? value : "";
    }

    function visible() {
        const q = /** @type {HTMLInputElement} */ ($("#favoritesSearch")).value.trim().toLocaleLowerCase(ctx.locale());
        const tag = /** @type {HTMLSelectElement} */ ($("#favoritesTagFilter")).value;
        const sort = /** @type {HTMLSelectElement} */ ($("#favoritesSort")).value;
        const list = store.get().favorites.filter(f => {
            const meta = metaFor(f.siren);
            if (tag && !meta.tags.includes(tag)) return false;
            return !q || `${displayName(ctx, f)} ${f.siren} ${f.city} ${meta.note} ${meta.tags.join(" ")}`.toLocaleLowerCase(ctx.locale()).includes(q);
        });
        if (sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));
        if (sort === "changed") return [...list].sort((a, b) => Number(b.changes.length > 0) - Number(a.changes.length > 0));
        return [...list].sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
    }

    /**
     * @param {string} siren
     * @param {string} note
     * @param {string} tags
     */
    function saveMeta(siren, note, tags) {
        const meta = { ...store.get().favoriteMeta };
        const clean = { note: note.slice(0, LIMITS.noteMax), tags: normalizeTags(tags) };
        if (clean.note || clean.tags.length) meta[siren] = clean;
        else delete meta[siren];
        store.set({ favoriteMeta: meta });
        ctx.persist("favoriteMeta");
        ctx.toast(ctx.t("favorites.metaSaved"));
        render();
    }

    /** @param {string} siren */
    function acknowledge(siren) {
        store.set({ favorites: store.get().favorites.map(f => (f.siren === siren ? { ...f, changes: [] } : f)) });
        ctx.persist("favorites");
        render();
    }

    /** @param {any} f */
    function card(f) {
        const t = ctx.t;
        const meta = metaFor(f.siren);
        const noteId = `note-${f.siren}`;
        const tagsId = `tags-${f.siren}`;
        const remove = favoriteButton(ctx, f, true, "data-remove");
        remove.addEventListener("click", () => ctx.actions.toggleFavorite(f.siren));
        const changes = f.changes.length
            ? h(
                  "div",
                  { class: "changes", "data-testid": "favorite-changes" },
                  h("span", { class: "status changed", "data-testid": "favorite-changed-badge" }, t("favorites.changed")),
                  h(
                      "ul",
                      { class: "plain-list small" },
                      ...f.changes.map((/** @type {any} */ c) =>
                          h("li", {}, `${t(`field.${c.field}`)} : `, h("del", {}, c.before || "∅"), " → ", h("ins", {}, c.after || "∅"))
                      )
                  ),
                  h("button", { type: "button", class: "link-button", "data-testid": "favorite-ack", onclick: () => acknowledge(f.siren) }, t("favorites.ack"))
              )
            : null;
        const noteInput = h("textarea", { id: noteId, maxlength: String(LIMITS.noteMax), "data-testid": "favorite-note", value: meta.note });
        const tagsInput = h("input", { id: tagsId, maxlength: "300", "data-testid": "favorite-tags", value: meta.tags.join(", ") });
        return h(
            "article",
            { class: "company", "data-testid": `favorite-card-${f.siren}` },
            h(
                "div",
                { class: "company-top" },
                h(
                    "div",
                    {},
                    statusBadge(ctx, f.status),
                    h("h3", {}, displayName(ctx, f)),
                    f.minimized ? h("p", { class: "muted small", "data-testid": "favorite-minimized" }, t(`privacy.minimizedNote.${f.minimized}`)) : null,
                    h("p", { class: "muted" }, `SIREN ${f.siren}`)
                ),
                remove
            ),
            changes,
            h(
                "div",
                { class: "company-meta" },
                h("div", { class: "meta-line" }, valueOrMissing(ctx, f.activityLabel || f.activity)),
                h("div", { class: "meta-line" }, valueOrMissing(ctx, f.city || f.address)),
                f.refreshedAt ? h("div", { class: "meta-line small" }, t("favorites.refreshedAt", { date: f.refreshedAt.slice(0, 10) })) : null
            ),
            meta.tags.length ? h("div", { class: "favorite-tags" }, ...meta.tags.map(tag => h("span", { class: "personal-tag" }, tag))) : null,
            h(
                "details",
                { class: "favorite-notes" },
                h("summary", {}, t("favorites.notes")),
                h("label", { for: noteId }, t("favorites.note")),
                noteInput,
                h("label", { for: tagsId }, t("favorites.tagsHelp")),
                tagsInput,
                h(
                    "button",
                    {
                        type: "button",
                        class: "button secondary",
                        "data-testid": "favorite-save-meta",
                        onclick: () =>
                            saveMeta(f.siren, /** @type {HTMLTextAreaElement} */ (noteInput).value, /** @type {HTMLInputElement} */ (tagsInput).value)
                    },
                    t("favorites.saveMeta")
                )
            ),
            h(
                "div",
                { class: "company-footer" },
                h(
                    "button",
                    { type: "button", class: "button secondary", "data-compare": f.siren, onclick: () => ctx.actions.addCompare(f.siren) },
                    t("action.compare")
                ),
                h(
                    "button",
                    {
                        type: "button",
                        class: "button secondary",
                        "data-refresh": f.siren,
                        "data-testid": "favorite-refresh",
                        onclick: () => refresh([f.siren])
                    },
                    t("favorites.refresh")
                ),
                h("button", { type: "button", class: "button", "data-open": f.siren, onclick: () => ctx.actions.openDetail(f.siren) }, t("action.detail"))
            )
        );
    }

    function render() {
        fillTagFilter();
        const root = $("#favoritesGrid");
        if (!store.get().favorites.length) return replace(root, h("div", { class: "state" }, ctx.t("favorites.empty")));
        const list = visible();
        if (!list.length) return replace(root, h("div", { class: "state" }, ctx.t("favorites.noMatch")));
        replace(root, ...list.map(card));
    }

    /**
     * Veille : recharge les favoris (débit limité, annulable) et enregistre les différences.
     * @param {string[]} sirens
     */
    async function refresh(sirens) {
        refreshController?.abort();
        refreshController = new AbortController();
        const mine = refreshController;
        const progress = /** @type {HTMLProgressElement} */ ($("#favoritesProgress"));
        progress.max = sirens.length;
        progress.value = 0;
        setHidden(progress, sirens.length < 2);
        setHidden($("#favoritesRefreshCancelBtn"), sirens.length < 2);
        let updated = 0;
        let changed = 0;
        let missing = 0;
        try {
            for (const siren of sirens) {
                const company = await ctx.api.getBySiren(siren, mine.signal);
                progress.value += 1;
                $("#favoritesStatus").textContent = ctx.t("favorites.progress", { done: progress.value, total: sirens.length });
                if (!company) {
                    missing += 1;
                    continue;
                }
                ctx.cacheCompanies([company]);
                const fresh = ctx.storedSnapshot(company);
                store.set({
                    favorites: store.get().favorites.map(f => {
                        if (f.siren !== siren) return f;
                        const diff = diffSnapshots(f, fresh);
                        if (diff.length) changed += 1;
                        return sanitizeFavorite({ ...fresh, addedAt: f.addedAt, refreshedAt: ctx.clock.iso(), changes: diff.length ? diff : f.changes }) || f;
                    })
                });
                updated += 1;
            }
            $("#favoritesStatus").textContent = ctx.t("favorites.refreshDone", { updated, changed, missing });
        } catch (error) {
            $("#favoritesStatus").textContent = isAbortError(error) ? ctx.t("favorites.refreshCancelled", { updated }) : ctx.errorMessage(error);
        } finally {
            ctx.persist("favorites");
            setHidden(progress, true);
            setHidden($("#favoritesRefreshCancelBtn"), true);
            render();
        }
    }

    function exportFavorites() {
        const s = store.get();
        if (!s.favorites.length) return ctx.toast(ctx.t("favorites.empty"));
        ctx.download(
            `favoris-fce-${ctx.clock.iso().slice(0, 10)}.json`,
            "application/json;charset=utf-8",
            serializeFavorites(s.favorites, s.favoriteMeta, ctx.clock.iso())
        );
        ctx.toast(ctx.t("favorites.exported", { count: s.favorites.length }));
    }

    /**
     * Lecture texte compatible (File.text() absent de certains environnements).
     * @param {File} file
     * @returns {Promise<string>}
     */
    function readText(file) {
        if (typeof file.text === "function") return file.text();
        return new Promise((resolve, reject) => {
            const reader = new ctx.win.FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /** @param {File} file */
    async function importFile(file) {
        if (file.size > LIMITS.importMaxBytes) {
            $("#favoritesStatus").textContent = ctx.t("import.tooLarge");
            return ctx.toast(ctx.t("import.tooLarge"));
        }
        const text = await readText(file);
        const parsed = parseFavoritesFile(text, file.size);
        if (parsed.errorKey) {
            $("#favoritesStatus").textContent = ctx.t(parsed.errorKey);
            return ctx.toast(ctx.t(parsed.errorKey));
        }
        const mode = /** @type {"merge"|"replace"} */ (/** @type {HTMLSelectElement} */ ($("#favoritesImportMode")).value === "replace" ? "replace" : "merge");
        const s = store.get();
        const { list, added, skipped } = mergeFavorites(s.favorites, parsed.items, mode, LIMITS.favoritesMax);
        const kept = new Set(list.map(f => f.siren));
        const baseMeta = mode === "replace" ? {} : { ...s.favoriteMeta };
        const meta = Object.fromEntries(Object.entries({ ...baseMeta, ...parsed.meta }).filter(([siren]) => kept.has(siren)));
        store.set({ favorites: list, favoriteMeta: meta });
        ctx.persist("favorites");
        ctx.persist("favoriteMeta");
        const message = ctx.t("favorites.imported", { added, skipped: skipped + parsed.rejected });
        $("#favoritesStatus").textContent = message;
        ctx.toast(message);
        render();
    }

    $("#favoritesSearch").addEventListener("input", render);
    $("#favoritesTagFilter").addEventListener("change", render);
    $("#favoritesSort").addEventListener("change", render);
    $("#favoritesRefreshBtn").addEventListener("click", () => {
        const all = store.get().favorites.map(f => f.siren);
        if (!all.length) return ctx.toast(ctx.t("favorites.empty"));
        refresh(all);
    });
    $("#favoritesRefreshCancelBtn").addEventListener("click", () => refreshController?.abort());
    $("#favoritesExportBtn").addEventListener("click", exportFavorites);
    $("#favoritesImportInput").addEventListener("change", event => {
        const inputEl = /** @type {HTMLInputElement} */ (event.target);
        const file = inputEl.files?.[0];
        if (file)
            importFile(file).finally(() => {
                inputEl.value = "";
            });
    });
    $("#clearFavoritesBtn").addEventListener("click", () => {
        store.set({ favorites: [], favoriteMeta: {} });
        ctx.persist("favorites");
        ctx.persist("favoriteMeta");
        render();
        ctx.toast(ctx.t("favorites.cleared"));
    });

    return { render, refresh, importFile, metaFor };
}
