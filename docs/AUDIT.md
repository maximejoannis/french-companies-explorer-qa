# Audit de la v1.1.1 (étape 0)

Méthode : lecture du code, puis **reproduction par exécution** des fonctions de la v1.1.1 dans jsdom (script de preuve conservé hors dépôt). Chaque anomalie confirmée a un test de non-régression dans la v2.0.0 (colonne « Test »).

Gravité : 🟥 bloquante · 🟧 majeure · 🟨 mineure.

| # | Anomalie | Verdict | Gravité | Preuve (v1.1.1) | Correction v2 | Test |
|---|---|---|---|---|---|---|
| 1 | Interpolations non échappées dans des attributs (`data-compare="${c.siren}"`, `data-open`, `data-del-saved`) → XSS stockée | ✅ Confirmée | 🟥 | Favori `siren: '1" onmouseover="alert(1)'` → l'attribut `onmouseover` est créé dans le DOM | Plus aucun `innerHTML` : DOM construit par `createDom().h` (nœuds texte) + schémas validés + ESLint `no-unsanitized` | `search.test.js` « régression #1 », « contenus hostiles » |
| 2 | Origine partagée `*.github.io` : stockage non fiable | ✅ Confirmée (conception) | 🟧 | Toutes les pages GitHub Pages du compte partagent `localStorage` | Clés préfixées/versionnées `fce:v2:*`, validation de schéma à chaque lecture | `schema.test.js` |
| 3 | `load()` sans validation de forme | ✅ Confirmée | 🟥 | `fce_favorites = "oops"` → `TypeError: S.favorites.map is not a function` à l'ouverture des favoris | `sanitizeList` + validateurs par type | `schema.test.js`, `search.test.js` « régression #3 » |
| 4 | Thème lu sans liste blanche | ✅ Confirmée | 🟨 | `fce_theme = '"><img>'` → `data-theme='"><img>'` | `sanitizePrefs` (system/light/dark) | `schema.test.js` « régression #4 » |
| 5 | Neutralisation CSV incomplète (tabulation / CR en tête) | ⚠️ Partielle | 🟧 | `"\r=1"` était neutralisé, mais `"\tcmd"` ne l'était pas | `neutralizeCsvFormula` couvre `= + - @ \t \r` | `csv-export.test.js` |
| 6 | Pas de CSP ; Google Fonts chargée deux fois (`<link>` + `@import`) | ✅ Confirmée | 🟧 | `index.html` l. 9-11, `styles.css` l. 1 | CSP `<meta>` stricte, police auto-hébergée (OFL) | `shell.test.js` « aucun style inline… » |
| 7 | Aucun timeout, erreurs non distinguées, pas de « Réessayer » | ✅ Confirmée | 🟧 | `throw new Error()` (l. 649), message unique | `createHttp` : timeout 8 s, erreurs typées, retry borné, bouton Réessayer | `http.test.js`, `search.test.js` « erreurs réseau » |
| 8 | Résolution de commune non annulable (réponses obsolètes) | ✅ Confirmée (lecture) | 🟧 | `resolveCityCode` sans `signal` ni contrôle d'identifiant | Même `AbortController` et même `requestId` que la recherche | `search.test.js` « réponse obsolète » |
| 9 | `openDetail` avale les erreurs et prend `results[0]` sans vérifier le SIREN | ✅ Confirmée | 🟧 | `catch {}` (l. 750) | `getBySiren` vérifie `siren` exact ; message d'erreur ; repli sur l'instantané | `services.test.js` « régression #9 » |
| 10 | `save()` sans `try/catch` | ✅ Confirmée | 🟧 | `QuotaExceededError` remontée non gérée | `createStorage.write` renvoie `false` + toast | `services.test.js`, `search.test.js` « stockage plein » |
| 11 | Index d'autocomplétion partagé entreprise/commune | ✅ Confirmée | 🟨 | Variable globale unique `activeSuggestion` | Composant `createAutocomplete` avec état par instance | `shell.test.js` « régression #11 » |
| 12 | Tri par date : « Non renseignée » en tête | ✅ Confirmée | 🟧 | Ordre obtenu `2,3,1` (sans date en premier) | `sortCompanies` : manquants toujours en fin, tri stable | `lists.test.js` « régression #12 » |
| 13 | Favori / comparaison impossibles depuis une fiche hors résultats | ✅ Confirmée (lecture) | 🟧 | `current(siren)` ne cherche que dans les résultats → `return` silencieux | Cache de session des entreprises consultées | `views.test.js` « régression #13 » |
| 14 | `navigator.clipboard.writeText` sans `try/catch` | ✅ Confirmée | 🟨 | Promesse rejetée non gérée (l. 771) | `copyText` avec repli, ne lève jamais | `services.test.js` « régression #14 » |
| 15 | Timers de toast non annulés | ✅ Confirmée | 🟨 | Un 2ᵉ toast disparaît avec le timer du 1er | `createToaster` annule le timer précédent | couvert par les tests d'intégration |
| 16 | Deep-linking partiel (`replaceState` seul, vue absente de l'URL) | ✅ Confirmée | 🟧 | Le bouton Précédent quitte l'application | Routeur `pushState` + `?view=` / `siren` / `sirens` | `shell.test.js` « pushState » |
| 17 | `prompt()` et `Date.now()` comme identifiant | ✅ Confirmée | 🟨 | l. 376 et 388 | `<dialog>` accessible + `crypto.randomUUID()` | `views.test.js` « dialogue accessible (#17) » |
| 18 | Instantanés sans version ni migration | ✅ Confirmée | 🟨 | Copies brutes de `norm()` | Format v2 versionné + migration automatique des clés v1 | `schema.test.js`, `shell.test.js` « migration v1.1.1 » |
| 19 | Accueil : « Compare **deux** entreprises » (limite = 3) | ✅ Confirmée | 🟨 | `index.html` l. 56 | Texte corrigé | — |
| 20 | Focus déplacé dès le chargement initial | ✅ Confirmée | 🟨 | `route("home")` au démarrage appelle `focus()` | Pas de focus au premier rendu | `search.test.js` (focus sur `body`) |
| 21 | Code mort notes/tags (`saveFavoriteMeta`, `favoriteMetaFor`, `normalizeTags`) | ✅ Confirmée | 🟨 | Une seule occurrence de chaque fonction (définition) ; ESLint `no-unused-vars` | Fonctionnalité livrée (N-4) | `views.test.js` « notes et tags » |
| 22 | **Nouvelle** — Codes commune corses (`2A004`) rejetés au rechargement d'URL | ✅ Confirmée | 🟧 | `/^\d{5}$/.test("2A004") === false` | Regex `^(\d{5}|2[AB]\d{3})$` | `criteria.test.js` |
| 23 | **Nouvelle** — Établissements fermés jamais filtrés | ✅ Confirmée | 🟧 | SIRENE : établissement `A`/`F` (fermé) ; la v1 filtrait sur `C` | `statusView(…, "establishment")` accepte `F` | `company.test.js`, `views.test.js` « (A/F, #23) » |
| 24 | **Nouvelle** — Navigation invisible sous 930 px (aucun menu) | ✅ Confirmée | 🟥 | `.nav { display: none }` sans alternative | Bouton « Menu » accessible (`aria-expanded`) | `shell.test.js` « menu mobile », test de fumée |
| 25 | **Nouvelle** — Statistiques tassées dans une seule colonne | ✅ Confirmée | 🟨 | `.stats-extended` placé dans la 1ʳᵉ cellule de la grille `.result-stats` | `grid-column: 1 / -1` | contrôle visuel (capture de fumée) |
| 26 | **Nouvelle** — Département : n'importe quel code à 3 chiffres accepté (`999`) | ✅ Confirmée | 🟨 | `/^(?:\d{2,3}|2A|2B)$/` | `^(\d{2}|97\d|2A|2B)$` | `criteria.test.js` |

## Anomalie trouvée lors de la revue RGPD de la 2.0.0 (corrigée en 2.1.0)

| # | Anomalie | Gravité | Correction | Test |
|---|---|---|---|---|
| 27 | Les clés v1 étaient conservées après migration : une donnée effacée dans la v2 restait stockée (droit à l'effacement non respecté) | 🟧 | Suppression des clés v1 après migration réussie, nettoyage des installations déjà migrées | `privacy.test.js`, `services.test.js` |

## Anomalies trouvées pendant le développement de la v2 (corrigées avant livraison)

- Le service worker rechargeait la page lors de sa **première** prise de contrôle (`clients.claim`), ce qui annulait la première navigation : rechargement désormais conditionné à l'acceptation explicite d'une mise à jour (`pwa.test.js`).
- L'analyse multi-pages mélangeait deux tailles de page (pages manquantes) : même `per_page` que la recherche affichée.

## Points restant à confirmer

- **Règle La Poste** (SIRET dont la somme des chiffres est un multiple de 5) : implémentée d'après la documentation INSEE connue, **à reconfirmer** auprès d'une source INSEE à jour.
- Champs de l'API non vérifiables depuis l'environnement de développement (réseau sortant bloqué) : forme exacte de `tva`, présence de `libelle_activite_principale`. Le code tolère leur absence ; à valider par un test de contrat contre l'API réelle.
