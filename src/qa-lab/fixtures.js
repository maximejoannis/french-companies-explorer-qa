// @ts-check
/**
 * Jeu de données FICTIF et déterministe pour le mode Labo QA (« fixtures ») et les tests.
 * Les SIREN respectent la clé de Luhn mais n'appartiennent à aucune entreprise réelle (plage 9000000xx).
 * Les dirigeants sont des personnes imaginaires.
 */
import { haversineKm } from "../core/geo.js";

/** @param {string} siren @param {string} siret @param {Record<string, any>} rest @returns {any} */
function company(siren, siret, rest) {
    const { city, cp, dep, lat, lon, address, ...others } = rest;
    return {
        siren,
        nom_complet: others.nom_complet,
        statut_diffusion: others.statut_diffusion || "O",
        siege: {
            siret,
            adresse: address,
            code_postal: cp,
            libelle_commune: city,
            departement: dep,
            latitude: lat === null ? null : String(lat),
            longitude: lon === null ? null : String(lon),
            est_siege: true,
            etat_administratif: others.etat_administratif
        },
        matching_etablissements: [
            { siret, adresse: address, libelle_commune: city, code_postal: cp, etat_administratif: others.etat_administratif, est_siege: true },
            ...(others.extraEtablissements || [])
        ],
        ...others
    };
}

export const FIXTURE_COMPANIES = Object.freeze([
    company("900000001", "90000000100009", {
        nom_complet: "BOULANGERIE DES TESTS",
        sigle: "BDT",
        activite_principale: "10.71C",
        section_activite_principale: "C",
        categorie_entreprise: "PME",
        nature_juridique: "5499",
        etat_administratif: "A",
        date_creation: "2012-03-14",
        tranche_effectif_salarie: "11",
        nombre_etablissements: 3,
        nombre_etablissements_ouverts: 2,
        city: "PARIS",
        cp: "75015",
        dep: "75",
        lat: 48.8412,
        lon: 2.3003,
        address: "12 RUE DU CAS NOMINAL 75015 PARIS",
        dirigeants: [
            { type_dirigeant: "personne physique", nom: "TESTEUR", prenoms: "Alice", qualite: "Gérant", date_de_naissance: "1980-05" },
            { type_dirigeant: "personne morale", denomination: "HOLDING ASSERTION", siren: "900000019", qualite: "Associé" }
        ],
        finances: { 2021: { ca: 820000, resultat_net: 41000 }, 2022: { ca: 905000, resultat_net: 52000 }, 2023: { ca: 880000, resultat_net: -12000 } },
        complements: { est_ess: false, est_bio: true, est_rge: false, convention_collective_renseignee: true },
        extraEtablissements: [
            { siret: "90000000100017", adresse: "3 AVENUE DU REGRESSION 75011 PARIS", libelle_commune: "PARIS", code_postal: "75011", etat_administratif: "A" },
            {
                siret: "90000000100025",
                adresse: "8 IMPASSE DU BUG 92100 BOULOGNE",
                libelle_commune: "BOULOGNE-BILLANCOURT",
                code_postal: "92100",
                etat_administratif: "F"
            }
        ]
    }),
    company("900000019", "90000001900001", {
        nom_complet: "HOLDING ASSERTION",
        activite_principale: "64.20Z",
        section_activite_principale: "K",
        categorie_entreprise: "ETI",
        nature_juridique: "5710",
        etat_administratif: "A",
        date_creation: "1998-11-02",
        tranche_effectif_salarie: "22",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "LYON",
        cp: "69002",
        dep: "69",
        lat: 45.7578,
        lon: 4.832,
        address: "1 PLACE DE LA COUVERTURE 69002 LYON",
        dirigeants: [{ type_dirigeant: "personne physique", nom: "MOCK", prenoms: "Bruno Charles", qualite: "Président", annee_de_naissance: "1971" }],
        finances: { 2022: { ca: 12500000, resultat_net: 1300000 }, 2023: { ca: 13900000, resultat_net: 1450000 } },
        complements: { est_societe_mission: true }
    }),
    company("900000027", "90000002700004", {
        nom_complet: "ATELIER PLAYWRIGHT",
        activite_principale: "62.01Z",
        section_activite_principale: "J",
        categorie_entreprise: "PME",
        nature_juridique: "5720",
        etat_administratif: "A",
        date_creation: "2019-06-30",
        tranche_effectif_salarie: "02",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "STRASBOURG",
        cp: "67000",
        dep: "67",
        lat: 48.5734,
        lon: 7.7521,
        address: "5 QUAI DES SELECTEURS 67000 STRASBOURG",
        dirigeants: [],
        finances: {},
        complements: { est_qualiopi: true, est_organisme_formation: true }
    }),
    company("900000035", "90000003500007", {
        nom_complet: "ANCIENNE FABRIQUE DE BUGS",
        activite_principale: "25.62B",
        section_activite_principale: "C",
        categorie_entreprise: "PME",
        nature_juridique: "5499",
        etat_administratif: "C",
        date_creation: "1975-01-20",
        tranche_effectif_salarie: "NN",
        nombre_etablissements: 2,
        nombre_etablissements_ouverts: 0,
        city: "MARSEILLE",
        cp: "13002",
        dep: "13",
        lat: 43.3049,
        lon: 5.3657,
        address: "40 BOULEVARD DE LA REGRESSION 13002 MARSEILLE",
        dirigeants: [{ type_dirigeant: "personne physique", nom: "STUB", prenoms: "Denise", qualite: "Liquidateur", date_de_naissance: "1955-02" }],
        finances: { 2019: { ca: 150000, resultat_net: -80000 } },
        complements: {}
    }),
    company("900000043", "90000004300001", {
        nom_complet: "CAFÉ DES ASSERTIONS",
        activite_principale: "56.30Z",
        section_activite_principale: "I",
        categorie_entreprise: "PME",
        nature_juridique: "1000",
        etat_administratif: "A",
        date_creation: "",
        tranche_effectif_salarie: "01",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "PARIS",
        cp: "75011",
        dep: "75",
        lat: 48.8589,
        lon: 2.3795,
        address: "77 RUE DU TIMEOUT 75011 PARIS",
        dirigeants: [],
        finances: null,
        complements: { est_entrepreneur_individuel: true }
    }),
    company("900000050", "90000005000006", {
        nom_complet: "RESTAURANT LE FLAKY",
        activite_principale: "56.10A",
        section_activite_principale: "I",
        categorie_entreprise: "PME",
        nature_juridique: "5499",
        etat_administratif: "A",
        date_creation: "2008-09-09",
        tranche_effectif_salarie: "03",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "PARIS",
        cp: "75012",
        dep: "75",
        lat: 48.8443,
        lon: 2.3743,
        address: "9 COUR DES RETRIES 75012 PARIS",
        dirigeants: [],
        finances: { 2023: { ca: 640000, resultat_net: 23000 } },
        complements: { est_ess: true }
    }),
    company("900000068", "90000006800008", {
        nom_complet: "COOPÉRATIVE CI VERTE",
        activite_principale: "01.13Z",
        section_activite_principale: "A",
        categorie_entreprise: "PME",
        nature_juridique: "5499",
        etat_administratif: "A",
        date_creation: "2001-04-01",
        tranche_effectif_salarie: "12",
        nombre_etablissements: 4,
        nombre_etablissements_ouverts: 4,
        city: "AJACCIO",
        cp: "20000",
        dep: "2A",
        lat: 41.9192,
        lon: 8.7386,
        address: "2 ROUTE DU PIPELINE 20000 AJACCIO",
        dirigeants: [],
        finances: { 2022: { ca: 2100000, resultat_net: 90000 } },
        complements: { est_ess: true, est_bio: true, est_siae: true }
    }),
    company("900000076", "90000007600001", {
        nom_complet: "Société <img src=x onerror=alert(1)> & Cie",
        activite_principale: "70.22Z",
        section_activite_principale: "M",
        categorie_entreprise: "",
        nature_juridique: "5710",
        etat_administratif: "A",
        date_creation: "2021-02-28",
        tranche_effectif_salarie: "",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "LILLE",
        cp: "59000",
        dep: "59",
        lat: 50.6292,
        lon: 3.0573,
        address: "\"><script>alert(2)</script> RUE DE L'ECHAPPEMENT 59000 LILLE",
        dirigeants: [],
        finances: {},
        complements: {}
    }),
    company("900000084", "90000008400005", {
        nom_complet: "=CMD|' /C calc'!A0 CONSEIL",
        activite_principale: "69.20Z",
        section_activite_principale: "M",
        categorie_entreprise: "PME",
        nature_juridique: "5499",
        etat_administratif: "A",
        date_creation: "2015-07-07",
        tranche_effectif_salarie: "00",
        nombre_etablissements: 1,
        nombre_etablissements_ouverts: 1,
        city: "NANTES",
        cp: "44000",
        dep: "44",
        lat: 47.2184,
        lon: -1.5536,
        address: "1 RUE DU TABLEUR 44000 NANTES",
        dirigeants: [],
        finances: {},
        complements: {}
    }),
    company("900000092", "90000009200008", {
        nom_complet: "ÉCOLE DES TESTEURS",
        activite_principale: "85.59A",
        section_activite_principale: "P",
        categorie_entreprise: "PME",
        nature_juridique: "9220",
        etat_administratif: "A",
        date_creation: "2010-10-10",
        tranche_effectif_salarie: "11",
        nombre_etablissements: 2,
        nombre_etablissements_ouverts: 2,
        city: "PARIS",
        cp: "75005",
        dep: "75",
        lat: 48.8462,
        lon: 2.3464,
        address: "10 RUE DES CAS LIMITES 75005 PARIS",
        dirigeants: [],
        finances: {},
        complements: { est_association: true, est_qualiopi: true }
    }),
    company("900000100", "90000010000009", {
        nom_complet: "TRANSPORTS ASYNC",
        activite_principale: "49.41A",
        section_activite_principale: "H",
        categorie_entreprise: "GE",
        nature_juridique: "5599",
        etat_administratif: "A",
        date_creation: "1988-12-12",
        tranche_effectif_salarie: "42",
        nombre_etablissements: 40,
        nombre_etablissements_ouverts: 38,
        city: "LYON",
        cp: "69007",
        dep: "69",
        lat: 45.7489,
        lon: 4.8433,
        address: "300 AVENUE DES PROMESSES 69007 LYON",
        dirigeants: [],
        finances: { 2023: { ca: 450000000, resultat_net: 12000000 } },
        complements: { est_rge: true }
    }),
    company("900000118", "90000011800001", {
        nom_complet: "INDÉPENDANT SANS SIÈGE GÉOLOCALISÉ",
        statut_diffusion: "P",
        activite_principale: "",
        section_activite_principale: "",
        categorie_entreprise: "",
        nature_juridique: "1000",
        etat_administratif: "",
        date_creation: "",
        tranche_effectif_salarie: "",
        nombre_etablissements: null,
        nombre_etablissements_ouverts: null,
        city: "",
        cp: "",
        dep: "",
        lat: null,
        lon: null,
        address: "",
        dirigeants: [],
        finances: {},
        complements: null
    })
]);

export const FIXTURE_COMMUNES = Object.freeze([
    { nom: "Paris", code: "75056", codesPostaux: ["75001", "75005", "75011", "75012", "75015"], centre: { type: "Point", coordinates: [2.347, 48.8589] } },
    { nom: "Lyon", code: "69123", codesPostaux: ["69002", "69007"], centre: { type: "Point", coordinates: [4.8351, 45.758] } },
    { nom: "Strasbourg", code: "67482", codesPostaux: ["67000"], centre: { type: "Point", coordinates: [7.7521, 48.5734] } },
    { nom: "Ajaccio", code: "2A004", codesPostaux: ["20000"], centre: { type: "Point", coordinates: [8.7386, 41.9192] } },
    { nom: "Marseille", code: "13055", codesPostaux: ["13002"], centre: { type: "Point", coordinates: [5.3698, 43.2965] } },
    { nom: "Lille", code: "59350", codesPostaux: ["59000"], centre: { type: "Point", coordinates: [3.0573, 50.6292] } },
    { nom: "Nantes", code: "44109", codesPostaux: ["44000"], centre: { type: "Point", coordinates: [-1.5536, 47.2184] } }
]);

/** @param {string} s */
const fold = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CITY_CODE_TO_CP = Object.fromEntries(FIXTURE_COMMUNES.map(c => [c.code, c.codesPostaux]));

/**
 * @param {any} c
 * @param {URLSearchParams} p
 */
function matchesFilters(c, p) {
    const s = c.siege;
    if (p.get("etat_administratif") && c.etat_administratif !== p.get("etat_administratif")) return false;
    if (p.get("code_postal") && !String(p.get("code_postal")).split(",").includes(s.code_postal)) return false;
    if (p.get("code_commune") && !(CITY_CODE_TO_CP[String(p.get("code_commune"))] || []).includes(s.code_postal)) return false;
    if (p.get("departement") && s.departement !== p.get("departement")) return false;
    if (p.get("categorie_entreprise") && c.categorie_entreprise !== p.get("categorie_entreprise")) return false;
    if (p.get("section_activite_principale") && c.section_activite_principale !== p.get("section_activite_principale")) return false;
    if (p.get("activite_principale") && c.activite_principale !== p.get("activite_principale")) return false;
    if (p.get("nature_juridique") && c.nature_juridique !== p.get("nature_juridique")) return false;
    if (p.get("tranche_effectif_salarie") && c.tranche_effectif_salarie !== p.get("tranche_effectif_salarie")) return false;
    for (const [key, value] of p) if (/^est_/.test(key) && value === "true" && !(c.complements && c.complements[key] === true)) return false;
    const lastCa = c.finances
        ? Object.values(c.finances)
              .map((/** @type {any} */ f) => f.ca)
              .pop()
        : undefined;
    if (p.get("ca_min") && !(typeof lastCa === "number" && lastCa >= Number(p.get("ca_min")))) return false;
    if (p.get("ca_max") && !(typeof lastCa === "number" && lastCa <= Number(p.get("ca_max")))) return false;
    if (p.get("nom_personne")) {
        const wanted = fold(String(p.get("nom_personne")));
        if (!(c.dirigeants || []).some((/** @type {any} */ d) => fold(d.nom || d.denomination || "").includes(wanted))) return false;
    }
    return true;
}

/**
 * @param {any} c
 * @param {URLSearchParams} p
 */
function shape(c, p) {
    const copy = structuredClone(c);
    const limit = Number(p.get("limite_matching_etablissements") || 10);
    copy.matching_etablissements = copy.matching_etablissements.slice(0, limit);
    if (p.get("minimal") === "true") {
        const include = (p.get("include") || "").split(",");
        for (const field of ["dirigeants", "finances", "complements", "matching_etablissements", "siege"]) if (!include.includes(field)) delete copy[field];
    }
    return copy;
}

/**
 * @param {any[]} list
 * @param {URLSearchParams} p
 */
function paginate(list, p) {
    const perPage = Math.min(25, Number(p.get("per_page") || 10));
    const page = Math.max(1, Number(p.get("page") || 1));
    return {
        results: list.slice((page - 1) * perPage, page * perPage).map(c => shape(c, p)),
        total_results: list.length,
        page,
        per_page: perPage,
        total_pages: Math.ceil(list.length / perPage)
    };
}

/**
 * Répond à une URL d'API comme le ferait le service réel (sous-ensemble suffisant pour la démo et les tests).
 * @param {string} url
 * @returns {{ status: number, body: unknown }}
 */
export function respondWithFixtures(url) {
    const u = new URL(url);
    const p = u.searchParams;
    if (u.hostname === "geo.api.gouv.fr") {
        const nom = fold(p.get("nom") || "");
        return { status: 200, body: FIXTURE_COMMUNES.filter(c => fold(c.nom).startsWith(nom)) };
    }
    if (u.pathname.endsWith("/near_point")) {
        const lat = Number(p.get("lat"));
        const lon = Number(p.get("long"));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { status: 400, body: { erreur: "lat et long sont obligatoires" } };
        const radius = Math.min(50, Number(p.get("radius") || 5));
        const list = FIXTURE_COMPANIES.filter(c => {
            const la = Number(c.siege.latitude);
            const lo = Number(c.siege.longitude);
            return c.siege.latitude !== null && haversineKm({ lat, lon }, { lat: la, lon: lo }) <= radius && matchesFilters(c, p);
        });
        return { status: 200, body: paginate(list, p) };
    }
    const q = (p.get("q") || "").trim();
    if (!q) return { status: 400, body: { erreur: "Veuillez indiquer au moins un terme de recherche" } };
    let list;
    if (/^\d{9}$/.test(q)) list = FIXTURE_COMPANIES.filter(c => c.siren === q);
    else if (/^\d{14}$/.test(q)) list = FIXTURE_COMPANIES.filter(c => c.matching_etablissements.some((/** @type {any} */ e) => e.siret === q));
    else {
        const terms = fold(q).split(/\s+/).filter(Boolean);
        const everything = terms.length === 1 && terms[0] === "*";
        list = FIXTURE_COMPANIES.filter(c => everything || terms.every(t => fold(`${c.nom_complet} ${c.sigle || ""} ${c.siege.libelle_commune}`).includes(t)));
        list = list.filter(c => matchesFilters(c, p));
    }
    return { status: 200, body: paginate(list, p) };
}
