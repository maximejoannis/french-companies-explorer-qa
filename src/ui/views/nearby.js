// @ts-check
import { LIMITS, SECTIONS } from "../../config.js";
import { formatDistance, haversineKm, roundCoordinate } from "../../core/geo.js";
import { sortCompanies } from "../../core/sort.js";
import { nearbyDefaults, sanitizeNearby } from "../../core/url-state.js";
import { isAbortError } from "../../services/http.js";
import { createAutocomplete } from "../autocomplete.js";
import { setHidden } from "../dom.js";
import { companyCard, sectionLabel } from "../render.js";

/**
 * Recherche à proximité (N-6) via /near_point.
 * Vie privée : position demandée au clic seulement, arrondie à 2 décimales, jamais stockée.
 * @param {import("../app-context.js").AppContext} ctx
 */
export function createNearbyView(ctx) {
    const { dom } = ctx;
    const { h, $, replace } = dom;
    /** @type {import("../../core/url-state.js").NearbyQuery} */
    let query = nearbyDefaults();
    let page = 1;
    let totalPages = 0;
    /** @type {AbortController|null} */
    let controller = null;
    let requestId = 0;

    const placeInput = /** @type {HTMLInputElement} */ ($("#nearbyPlaceInput"));

    function fillSections() {
        const select = /** @type {HTMLSelectElement} */ ($("#nearbySection"));
        const value = select.value;
        replace(select, h("option", { value: "" }, ctx.t("filter.all")), ...SECTIONS.map(([code]) => h("option", { value: code }, sectionLabel(ctx, code))));
        select.value = value;
    }

    function renderPoint() {
        $("#nearbyPoint").textContent =
            query.lat !== null && query.lon !== null
                ? ctx.t("nearby.point", { place: query.place || ctx.t("nearby.myPosition"), lat: query.lat, lon: query.lon })
                : ctx.t("nearby.noPoint");
    }

    /** @param {string} message */
    function state(message) {
        const el = $("#nearbyState");
        el.textContent = message;
        setHidden(el, !message);
    }

    function readForm() {
        return sanitizeNearby({
            ...query,
            radius: /** @type {HTMLInputElement} */ ($("#nearbyRadius")).value,
            section: /** @type {HTMLSelectElement} */ ($("#nearbySection")).value,
            naf: /** @type {HTMLInputElement} */ ($("#nearbyNaf")).value
        });
    }

    /** @param {import("../../core/url-state.js").NearbyQuery} q */
    function writeForm(q) {
        query = q;
        placeInput.value = q.place;
        /** @type {HTMLInputElement} */ ($("#nearbyRadius")).value = String(q.radius);
        /** @type {HTMLSelectElement} */ ($("#nearbySection")).value = q.section;
        /** @type {HTMLInputElement} */ ($("#nearbyNaf")).value = q.naf;
        renderPoint();
    }

    async function run() {
        if (query.lat === null || query.lon === null) return state(ctx.t("nearby.needPoint"));
        controller?.abort();
        controller = new AbortController();
        const mine = controller;
        const id = ++requestId;
        state(ctx.t("search.loading"));
        replace($("#nearbyGrid"));
        setHidden($("#nearbyPagination"), true);
        try {
            const result = await ctx.api.nearPoint(
                { lat: query.lat, lon: query.lon, radius: query.radius, naf: query.naf, section: query.section },
                page,
                mine.signal
            );
            if (id !== requestId) return;
            ctx.cacheCompanies(result.companies);
            const origin = { lat: query.lat, lon: query.lon };
            const withDistance = result.companies.map(c => ({
                ...c,
                distanceKm: c.latitude !== null && c.longitude !== null ? haversineKm(origin, { lat: c.latitude, lon: c.longitude }) : null
            }));
            const sorted = sortCompanies(withDistance, "distance");
            totalPages = Math.max(1, result.totalPages);
            $("#nearbyCount").textContent = ctx.t("results.count", { count: result.total });
            state(sorted.length ? "" : ctx.t("nearby.empty"));
            replace(
                $("#nearbyGrid"),
                ...sorted.map(c =>
                    companyCard(ctx, c, {
                        isFavorite: ctx.actions.isFavorite(c.siren),
                        onDetail: s => ctx.actions.openDetail(s),
                        onFavorite: s => ctx.actions.toggleFavorite(s),
                        onCompare: s => ctx.actions.addCompare(s)
                    })
                )
            );
            $("#nearbyPageLabel").textContent = ctx.t("pagination.label", { page, max: totalPages });
            /** @type {HTMLButtonElement} */ ($("#nearbyPrev")).disabled = page <= 1;
            /** @type {HTMLButtonElement} */ ($("#nearbyNext")).disabled = page >= totalPages;
            setHidden($("#nearbyPagination"), totalPages <= 1);
            ctx.announce(ctx.t("results.count", { count: result.total }));
        } catch (error) {
            if (isAbortError(error) || id !== requestId) return;
            state(ctx.errorMessage(error));
        }
    }

    function locate() {
        const geo = ctx.win.navigator.geolocation;
        if (!geo) return state(ctx.t("nearby.geoUnsupported"));
        state(ctx.t("nearby.locating"));
        geo.getCurrentPosition(
            position => {
                const d = LIMITS.geolocationDecimals;
                query = { ...readForm(), lat: roundCoordinate(position.coords.latitude, d), lon: roundCoordinate(position.coords.longitude, d), place: "" };
                placeInput.value = "";
                renderPoint();
                state("");
                ctx.toast(ctx.t("nearby.located"));
            },
            error => state(ctx.t(error && error.code === 1 ? "nearby.geoDenied" : "nearby.geoFailed")),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
    }

    const autocomplete = createAutocomplete({
        input: placeInput,
        list: $("#nearbyPlaceSuggestions"),
        idPrefix: "nearby-option",
        minLength: 2,
        delay: LIMITS.cityAutocompleteDelayMs,
        timers: ctx.timers,
        h,
        load: (q, signal) => ctx.geo.searchCities(q, signal),
        renderOption: city => [h("b", {}, city.name), " ", h("small", {}, city.postalCodes.slice(0, 3).join(", "))],
        onSelect: city => {
            placeInput.value = city.name;
            if (city.lat === null || city.lon === null) return state(ctx.t("nearby.noCentre"));
            query = { ...readForm(), lat: roundCoordinate(city.lat, 4), lon: roundCoordinate(city.lon, 4), place: city.name };
            renderPoint();
        },
        messages: () => ({ loading: ctx.t("autocomplete.loading"), empty: ctx.t("autocomplete.noCity"), error: ctx.t("autocomplete.error") })
    });

    $("#nearbyForm").addEventListener("submit", event => {
        event.preventDefault();
        autocomplete.cancel();
        const rawNaf = /** @type {HTMLInputElement} */ ($("#nearbyNaf")).value.trim();
        if (rawNaf && !/^\d{2}\.\d{2}[A-Z]$/i.test(rawNaf)) return state(ctx.t("validation.naf"));
        query = readForm();
        page = 1;
        ctx.router.go({ view: "nearby", nearby: query }, { push: true });
    });
    $("#nearbyLocateBtn").addEventListener("click", locate);
    $("#nearbyPrev").addEventListener("click", () => {
        if (page > 1) {
            page -= 1;
            run();
        }
    });
    $("#nearbyNext").addEventListener("click", () => {
        if (page < totalPages) {
            page += 1;
            run();
        }
    });

    fillSections();
    renderPoint();

    return {
        /** @param {import("../../core/url-state.js").NearbyQuery} q */
        show(q) {
            writeForm(q);
            if (q.lat !== null && q.lon !== null) run();
            else state(ctx.t("nearby.intro"));
        },
        refreshLanguage() {
            fillSections();
            renderPoint();
        },
        formatDistance: (/** @type {number} */ km) => formatDistance(km, ctx.locale())
    };
}
