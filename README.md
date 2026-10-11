# French Companies Explorer — QA Training v2.1.0

[![CI](https://github.com/maximejoannis/french-companies-explorer-qa/actions/workflows/ci.yml/badge.svg)](https://github.com/maximejoannis/french-companies-explorer-qa/actions/workflows/ci.yml)
![Couverture](https://img.shields.io/badge/couverture%20lignes-98%25-2ea44f)
![Tests](https://img.shields.io/badge/tests-406-2ea44f)
![Licence](https://img.shields.io/badge/licence-MIT-blue)
![RGPD](https://img.shields.io/badge/RGPD-aucun%20cookie%20%C2%B7%20aucun%20traceur-2ea44f)
![JavaScript](https://img.shields.io/badge/JavaScript-modules%20ES%20natifs-F7DF1E?logo=javascript&logoColor=000)
![API](https://img.shields.io/badge/API-data.gouv.fr-000091)

Application web de recherche d'entreprises françaises, conçue comme **terrain d'entraînement QA** : tests manuels, tests API, cohérence API ↔ UI et automatisation E2E avec Playwright (dépôt séparé).

🌐 https://maximejoannis.github.io/french-companies-explorer-qa/ · 🧪 Labo QA : ajoute `?qa=1`

> La v2 est une refonte complète de la v1.1.1 : architecture modulaire testable, 27 anomalies corrigées, garde-fous de sécurité, 16 nouvelles fonctionnalités dont la gestion RGPD, 406 tests et une CI bloquante. Détails : [CHANGELOG](./CHANGELOG.md) · [Audit](./docs/AUDIT.md) · [Migration](./MIGRATION.md) · [Traçabilité](./docs/TRACEABILITY.md) · [Confidentialité](./PRIVACY.md) · [Plan de tests RGPD](./docs/RGPD-TESTS.md).

---

## Fonctionnalités

| Domaine | Ce que permet l'application |
|---|---|
| Recherche | Nom, mot-clé, SIREN ou SIRET (clé de Luhn vérifiée), autocomplétion accessible, pagination, tri client, filtre local, vue cartes ou tableau |
| Filtres | Code postal, commune (résolue en code INSEE), NAF, section NAF, département, région, effectif, état, catégorie (PME/ETI/GE), forme juridique, labels (ESS, RGE, Bio, Qualiopi…), CA et résultat net min/max, dirigeant |
| Fiche | Identifiants, TVA intracommunautaire, siège, structure, labels, finances (tableau + graphique), dirigeants, établissements filtrables et paginés, impression/PDF |
| Favoris | Notes, tags, recherche, tri, import/export JSON validé, **veille** (détection des changements à l'actualisation) |
| Comparaison | Jusqu'à 3 entreprises, différences seules, réordonnancement, lien de partage |
| Proximité | Entreprises autour d'une commune ou de ta position (arrondie à ~1 km, jamais stockée), distance, lien OpenStreetMap |
| Analyse | Répartitions par statut, catégorie, effectif, département et secteur (SVG accessibles + tableaux) sur 1 à 4 pages |
| Export | CSV (protégé contre l'injection de formules) ou JSON ; page courante, toutes les pages (500 lignes max), comparaison ou favoris ; colonnes au choix |
| Confort | Thème système/clair/sombre, contraste renforcé, densité, animations réduites, taille du texte, raccourcis clavier désactivables, FR/EN, PWA installable et consultable hors ligne |
| Confidentialité | Inventaire des données locales, export JSON, effacement par catégorie ou total, durée de conservation de l'historique, minimisation des entrepreneurs individuels et des unités en diffusion partielle, mentions légales |
| Labo QA | `?qa=1` : latence, erreurs 400/404/429/500, timeout, JSON invalide, résultats vides, hors ligne, données fictives déterministes, stockage bloqué ou plein (`qaStorage`) |

## Démarrage

Aucune dépendance d'exécution : les outils npm servent uniquement au développement.

```bash
nvm use            # Node 22 (voir .nvmrc)
npm ci
npm start          # http://localhost:4173/
```

Ouvrir directement `index.html` en `file://` ne fonctionne pas (modules ES) : utiliser `npm start` ou tout serveur statique.

> `.npmrc` active `legacy-peer-deps` pour contourner une erreur de résolution de npm 10 sur les dépendances optionnelles de Vite 8 (utilisé par Vitest). Aucune dépendance n'est livrée au navigateur.

## Scripts

| Commande | Rôle |
|---|---|
| `npm test` | Tests unitaires et d'intégration (Vitest + jsdom) |
| `npm run coverage` | Tests + rapport de couverture V8 (`coverage/index.html`) — **seuils bloquants** |
| `npm run lint` | ESLint (dont `no-unsanitized` : interdit `innerHTML` dynamique, `prompt`, `eval`…) |
| `npm run typecheck` | Vérification des types JSDoc (`tsc --noEmit`, `checkJs`) |
| `npm run format` / `format:check` | Prettier |
| `npm run check` | Tout ce qui précède, comme la CI |
| `npm run smoke` | Test de fumée dans Chromium, en mode Labo QA « fixtures » (aucun appel réseau) |
| `npm run build:site` | Prépare `_site/` pour GitHub Pages |

## Qualité

| Indicateur | Seuil | Mesuré |
|---|---|---|
| Couverture des lignes | ≥ 80 % (≥ 90 % sur `src/core`) | **97,9 %** (src/core : 99,6 %) |
| Couverture des branches | ≥ 80 % (≥ 90 % sur `src/core`) | **91,0 %** (src/core : 98,0 %) |
| Couverture des fonctions | ≥ 80 % (≥ 90 % sur `src/core`) | **95,4 %** (src/core : 99,0 %) |
| Couverture des instructions | ≥ 80 % (≥ 90 % sur `src/core`) | **96,4 %** (src/core : 99,5 %) |
| Tests | — | 406 (19 fichiers) |
| Lint, types, format | 0 erreur | 0 |
| `npm audit --audit-level=high` | 0 | 0 vulnérabilité |

Les tests ne sont pas des tests de façade : un échantillon de mutations volontaires (neutralisation CSV désactivée, tri des valeurs manquantes inversé, clé de Luhn toujours vraie, rendu HTML au lieu de texte, validation CA supprimée) fait échouer entre 2 et 10 tests à chaque fois.

## Architecture

```text
index.html            Structure, CSP, tous les sélecteurs v1.1.1 conservés
styles.css            Styles (aucun style inline), thèmes, préférences, impression
sw.js                 Service worker (coquille mince)
manifest.webmanifest  PWA
src/
├── main.js           Seul module à effets de bord
├── app.js            init({ win, transport, storageBackend, now, timers… }) — tout est injectable
├── config.js         Limites documentées de l'API et constantes
├── core/             Domaine PUR (aucun DOM, réseau ni stockage — règle ESLint)
│   ├── query.js, luhn.js, criteria.js, url-state.js, company.js, finances.js, geo.js
│   ├── sort.js, stats.js, aggregate.js, compare.js, diff.js, history.js
│   ├── csv.js, export.js, schema.js, migration.js, favorites-io.js
│   └── i18n.js, rate-limiter.js, cache-strategy.js, shortcuts.js
├── services/         http.js (timeout, retry, erreurs typées), companies-api.js, geo-api.js, storage.js, clipboard.js, download.js
├── state/store.js    Store observable
├── ui/               dom.js (construction sans innerHTML), router.js, autocomplete.js, charts.js, render.js, export-dialog.js, preferences.js, views/*
├── locales/          fr.js, en.js (parité vérifiée par test)
└── qa-lab/           Mode Labo QA (chargé dynamiquement si ?qa=1) + données fictives
tests/
├── unit/             Domaine, services, Labo QA, PWA
└── integration/      Application complète montée dans jsdom (fenêtre isolée par test)
```

## Garde-fous

- **XSS** : aucun `innerHTML` ; DOM construit avec des nœuds texte ; URLs `href` limitées à `https:`, `#`, `./`, `blob:` ; ESLint `no-unsanitized` en CI.
- **CSP** stricte en `<meta>` (pas d'inline, `connect-src` limité aux deux API), `referrer` restreint, liens externes `noopener noreferrer`.
- **RGPD** : police auto-hébergée (plus de Google Fonts) ; dirigeants et position GPS jamais persistés ; colonne « Dirigeants » désactivée par défaut à l'export avec avertissement ; le service worker retire les dirigeants avant mise en cache.
- **Stockage non fiable** (origine `*.github.io` partagée) : clés `fce:v2:*` versionnées, validation de schéma à chaque lecture, écritures protégées (quota, navigation privée), plafonds (100 favoris, 12 historiques…).
- **Réseau** : timeout 8 s, erreurs typées et messages dédiés (400, 404, 429, 5xx, réseau, timeout, JSON invalide), 2 relances max avec backoff et `Retry-After`, limiteur partagé à 5 req/s (limite documentée : 7), réponses obsolètes ignorées, opérations en lot plafonnées et annulables.
- **Entrées** : listes blanches pour tous les paramètres d'URL, longueurs maximales, validation des formats avant tout appel.
- **CSV** : neutralisation des cellules commençant par `= + - @`, tabulation ou retour chariot.

## Confidentialité et RGPD

Même pour un projet personnel, la gestion des données personnelles est intégrée, parce qu'elle fait partie des scénarios de test les plus courants sur de vrais projets.

- **Aucune collecte** : ni compte, ni cookie, ni mesure d'audience. Les données restent dans le navigateur.
- **Page Confidentialité** (`?view=privacy`) : inventaire en temps réel, export JSON (portabilité), effacement par catégorie ou total (stockage v1/v2, session, caches), réglage de la durée de conservation (90 jours par défaut), minimisation.
- **Minimisation** : dirigeants et position jamais enregistrés ; entrepreneurs individuels et unités en diffusion partielle (`statut_diffusion = "P"`) enregistrés sans nom ni adresse.
- Documents : [PRIVACY.md](./PRIVACY.md) (politique et mentions légales) et [docs/RGPD-TESTS.md](./docs/RGPD-TESTS.md) (24 scénarios de test prêts à automatiser).

## Pour l'automatisation Playwright

- Attendre `html[data-ready="true"]` avant d'interagir.
- Utiliser `?qa=1&qaScenario=fixtures` pour des données déterministes, et les autres scénarios pour les cas d'erreur.
- Plus de 110 `data-testid` stables, jamais traduits ; les sélecteurs v1.1.1 sont conservés.
- Voir [MIGRATION.md](./MIGRATION.md) pour les changements visibles.

## Licence

Code sous licence [MIT](./LICENSE). Le fichier `LICENSE` contient aussi un avis (informatif) : la licence ne couvre pas les données des entreprises, qui contiennent des données personnelles et dont toute réutilisation doit respecter le RGPD. Police Poppins sous SIL OFL 1.1. Données du Labo QA entièrement fictives.

## Sources

- API Recherche d'Entreprises — [documentation](https://recherche-entreprises.api.gouv.fr/docs/) · [OpenAPI](https://recherche-entreprises.api.gouv.fr/openapi.json)
- API Découpage administratif — https://geo.api.gouv.fr/
- Police Poppins — SIL Open Font License 1.1 (`assets/fonts/OFL-LICENSE.txt`)
