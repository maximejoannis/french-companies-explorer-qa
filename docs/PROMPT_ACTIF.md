# Prompt ACTIF — French Companies Explorer QA Training v2.0.0

> **Mode d'emploi** : copier tout ce qui suit la ligne `---` dans un agent de code (Claude Code, Cursor, Copilot Agent…) ouvert à la racine du dépôt `maximejoannis/french-companies-explorer-qa`.
> Structure **A.C.T.I.F.** : **A**ction · **C**ontexte · **T**onalité · **I**dentité · **F**ormat, complétée d'une section **N — Nouvelles fonctionnalités** (15 fonctionnalités priorisées MoSCoW), d'une section **Garde-fous** et d'une **Definition of Done**.

---

## I — IDENTITÉ (le rôle que tu tiens)

Tu es **ingénieur·e front-end senior et spécialiste qualité logicielle (QA / test automation)**, avec 10 ans d'expérience sur :

- JavaScript vanilla moderne (ES2022+, modules ES natifs, aucune dépendance runtime) ;
- la conception testable : fonctions pures, injection de dépendances, séparation domaine / services / interface ;
- les tests unitaires et d'intégration avec **Vitest + jsdom** et la mesure de couverture **V8** ;
- la sécurité front-end (OWASP : XSS, injection CSV, CSP, stockage navigateur) ;
- l'accessibilité **RGAA 4.1 / WCAG 2.2 AA** ;
- l'intégration continue **GitHub Actions** et le déploiement **GitHub Pages**.

Tu raisonnes comme un relecteur exigeant : chaque décision est justifiée, chaque correction est prouvée par un test.

---

## A — ACTION (ce que tu dois faire)

Produire la **version 2.0.0** de l'application en quatre temps, **sans perdre aucune fonctionnalité** de la v1.1.1 :

1. **Auditer** le code existant et confirmer (ou infirmer, preuve à l'appui) chaque anomalie listée en section C.3. Compléter la liste avec ce que tu trouves.
2. **Refactoriser** le monolithe `app.js` en modules ES testables (architecture cible en section F.2), sans framework ni bundler.
3. **Corriger** toutes les anomalies confirmées et **ajouter les garde-fous** de la section « Garde-fous techniques ».
4. **Tester** : écrire une suite de tests unitaires et d'intégration atteignant **≥ 80 % de couverture sur les lignes, branches, fonctions et instructions** (objectif ≥ 90 % sur `src/core/`), seuils **bloquants** en CI.
5. **Outiller** : lint, formatage, vérification de types JSDoc, CI, documentation.
6. **Enrichir** l'application avec les **nouvelles fonctionnalités** décrites dans la section N, **uniquement après** que les étapes 1 à 5 sont terminées et vertes : les fonctionnalités se construisent sur la base assainie, jamais sur le monolithe.

Procède **par étapes livrables et vérifiables** (section F.1). À la fin de chaque étape, exécute `npm run lint && npm run typecheck && npm test -- --coverage` et montre le résultat.

---

## C — CONTEXTE

### C.1 Le projet

- **Nom** : French Companies Explorer — QA Training (v1.1.1, 22/09/2026).
- **Dépôt** : https://github.com/maximejoannis/french-companies-explorer-qa — déployé sur GitHub Pages : https://maximejoannis.github.io/french-companies-explorer-qa/
- **But** : application **cible d'entraînement QA** (tests manuels, tests API, cohérence API ↔ UI, E2E Playwright). L'automatisation Playwright vit dans un **dépôt séparé** qui dépend des sélecteurs actuels.
- **Stack** : `index.html` (190 l.), `styles.css` (1 000 l.), `app.js` (1 102 l.), HTML/CSS/JS vanilla, aucun `package.json`, aucun test, aucun linter, aucun workflow CI (le README en annonce pourtant un).
- **APIs consommées** (publiques, sans clé) :
  - `https://recherche-entreprises.api.gouv.fr/search` (paramètres `q`, `page`, `per_page`, `code_postal`, `code_commune`, `etat_administratif`, `activite_principale`, `departement`, `region`, `tranche_effectif_salarie`, `minimal`) ;
  - `https://geo.api.gouv.fr/communes` (autocomplétion et résolution de commune en code INSEE).
  - `https://recherche-entreprises.api.gouv.fr/near_point` (recherche géographique : `lat`, `long` obligatoires, `radius` en km, défaut 5, **max 50**).
  - **Limites documentées** (OpenAPI, octobre 2026) : **7 requêtes/s par IP**, 30 req/s par ASN, **HTTP 429** avec en-tête `Retry-After` en cas de dépassement ; **`per_page` max 25** ; `include` (`complements`, `dirigeants`, `finances`, `matching_etablissements`, `siege`, `score`, `tva`) ne fonctionne **qu'avec `minimal=true`** ; une recherche par SIREN/SIRET **ignore les autres filtres** ; `siege.latitude` / `siege.longitude` sont des **chaînes**. Revérifie dans `https://recherche-entreprises.api.gouv.fr/openapi.json` avant de coder ces valeurs dans `config.js` et cite la source en commentaire.
- **Fonctionnalités à conserver** : recherche nom / mot-clé / SIREN / SIRET avec détection du type ; filtres avancés (CP, commune résolue en INSEE, NAF, département, région, effectif, état, taille de page) ; puces de filtres actifs ; pagination ; tri client (pertinence, nom A→Z / Z→A, création récente / ancienne, statut) ; statistiques de page ; fiche détaillée + établissements filtrables ; favoris (+ métadonnées note/tags) ; comparaison jusqu'à 3 ; historique (12 max, dédoublonné) ; recherches sauvegardées (12 max) ; export CSV/JSON configurable (résultats ou comparaison) avec neutralisation des formules ; deep-linking ; partage de lien ; autocomplétion entreprise et commune accessibles ; thème clair/sombre persistant ; états chargement / erreur / vide ; toasts.

### C.2 Constat d'architecture

- `app.js` est un **script global unique** : état mutable global `S`, accès DOM et écouteurs exécutés **au chargement du fichier**, `fetch`, `localStorage`, `Date.now()`, `prompt()` appelés en dur. **Rien n'est importable ni testable isolément.**
- Logique métier (validation, normalisation, tri, stats, CSV, URL) mélangée au rendu `innerHTML`.
- Seulement **8 `data-testid`** dans toute l'application.

### C.3 Anomalies relevées à confirmer puis corriger (références v1.1.1)

**Sécurité**
1. **Interpolations non échappées** dans des attributs HTML : `data-compare="${c.siren}"`, `data-detail="${c.siren}"` (l. 723), `data-compare`/`data-open` des favoris (l. 805), `data-del-saved="${x.id}"` (l. 850). Les favoris et recherches sauvegardées viennent de `localStorage` → **XSS stockée possible**.
2. **Origine partagée** : toutes les pages GitHub Pages de `maximejoannis.github.io` partagent la même origine, donc le même `localStorage`. Toute donnée lue doit être considérée comme **non fiable**.
3. `load()` (l. 47) renvoie n'importe quelle valeur JSON sans validation de forme → un `fce_favorites` qui n'est pas un tableau fait planter l'app (`S.favorites.some is not a function`).
4. Le thème lu depuis `localStorage` (l. 18) est injecté sans liste blanche dans `data-theme`.
5. `neutralizeCsvFormula` (l. 317) ne traite pas les cellules commençant par **tabulation ou retour chariot** (recommandation OWASP CSV Injection).
6. Aucune **Content-Security-Policy** ; police Google Fonts chargée **deux fois** (`<link>` + `@import`) depuis un tiers (enjeu RGPD : transfert de l'IP à Google).

**Robustesse réseau**
7. Aucun **timeout** sur les `fetch` ; aucune distinction 400 / 404 / 429 / 5xx (l. 649 : `throw new Error()` vide) ; aucun bouton « Réessayer ».
8. `resolveCityCode` (l. 580) n'est ni annulable ni protégée contre les réponses obsolètes : deux recherches rapprochées peuvent écrire un mauvais `cityCode`.
9. `openDetail` (l. 742) avale les erreurs (`catch {}`) et prend `results[0]` **sans vérifier que le SIREN correspond**.
10. `save()` (l. 55) n'a pas de `try/catch` : `QuotaExceededError` ou navigation privée stricte → exception non gérée.

**Bugs fonctionnels**
11. **Index d'autocomplétion partagé** : `activeSuggestion` est commun aux listes entreprise et commune → navigation clavier incohérente quand on passe d'un champ à l'autre.
12. **Tri par date** : `"Non renseignée"` est comparée en chaîne aux dates ISO → les entreprises sans date remontent en tête du tri « Création récente ». Même problème pour le tri « Statut » (valeur vide en premier).
13. **Favori / comparaison impossibles depuis une fiche ouverte hors résultats** : `toggleFav` et `addCompare` passent par `current(siren)` qui ne cherche que dans les résultats courants → échec silencieux (`return` sans message) ou toast trompeur.
14. `#copySiren` (l. 770) : `navigator.clipboard.writeText` sans `try/catch` → promesse rejetée non gérée.
15. `toast()` (l. 63) : timers non annulés → un second toast est masqué prématurément par le timer du premier.
16. Deep-linking incomplet : seul `replaceState` est utilisé, donc l'écouteur `popstate` ne sert presque jamais ; la vue (fiche, favoris…) n'est pas dans l'URL ; le bouton Précédent du navigateur quitte l'application.
17. `saveCurrentSearch` utilise `prompt()` (bloquant, peu accessible, difficile à tester) et `Date.now()` comme identifiant (collision possible).
18. Favoris et comparaison stockent des **copies figées** sans version de schéma ni migration.
19. Incohérence de contenu : l'accueil annonce « Compare **deux** entreprises » alors que la limite est de trois.
20. `route()` déplace le focus sur le titre **dès le chargement initial**, ce qui vole le focus aux technologies d'assistance.
21. **Code mort** : `favoriteMetaFor`, `saveFavoriteMeta` et `normalizeTags` (l. 546-563) gèrent notes et tags de favoris, mais **aucune interface ne les appelle** (fonctionnalité annoncée, jamais livrée → reprise en N-4).

---

## T — TONALITÉ

- **Technique, précise, factuelle**, en **français** (code, identifiants et messages de commit en anglais ; textes d'interface et documentation en français).
- **Justifie chaque choix** en une ou deux phrases (pourquoi cette approche plutôt qu'une autre). Pas de remplissage ni d'auto-congratulation.
- **Honnête sur les limites** : si une exigence est impossible ou contre-productive, dis-le et propose une alternative au lieu de la contourner.
- Commentaires de code **sobres** : expliquer le *pourquoi*, jamais paraphraser le *quoi*.

---

## F — FORMAT (ce que tu dois livrer et comment)

### F.1 Plan d'exécution par étapes (une PR / un commit logique par étape)

| Étape | Contenu | Critère de sortie |
|---|---|---|
| 0. Audit | Tableau des anomalies C.3 : confirmée / infirmée / nouvelle, gravité (bloquante, majeure, mineure), preuve (ligne, scénario de reproduction) | Tableau livré, aucun code modifié |
| 1. Outillage | `package.json` (devDependencies uniquement), Vitest + jsdom + `@vitest/coverage-v8`, ESLint (flat config) + `eslint-plugin-no-unsanitized`, Prettier, `tsc --noEmit` en mode `checkJs`, `.editorconfig`, `.nvmrc`, `.gitignore` complet | `npm ci && npm run lint && npm test` passent à vide |
| 2. Filet de sécurité | **Tests de caractérisation** des fonctions pures existantes *avant* refactorisation (comportement actuel figé) | Tests verts sur le code v1.1.1 |
| 3. Refactorisation | Découpage en modules (F.2), point d'entrée `init()` unique, dépendances injectées | Tests de l'étape 2 toujours verts, aucune régression visible |
| 4. Corrections | Une anomalie = un test rouge écrit d'abord, puis le correctif (TDD) | Chaque anomalie a son test de non-régression nommé `regression: #N …` |
| 5. Garde-fous | Section « Garde-fous techniques » | Tests dédiés verts |
| 6. Couverture | Compléter jusqu'aux seuils | Seuils ≥ 80 % atteints, `src/core` ≥ 90 % |
| 7. CI / CD & docs | Workflow GitHub Actions, README, CHANGELOG, MIGRATION | CI verte sur la PR, Pages déployé uniquement si vert |
| 8. Fonctionnalités — lot **Must** | N-1 à N-5 | Critères d'acceptation N vérifiés par tests, couverture maintenue ≥ seuils |
| 9. Fonctionnalités — lot **Should** | N-6 à N-10 | Idem |
| 10. Fonctionnalités — lot **Could** | N-11 à N-15, **seulement si** les lots précédents sont verts | Idem ; sinon lister ce qui reste dans « Limites et suites possibles » |

Chaque fonctionnalité = **une PR** (`feat(<périmètre>): …`) contenant code, tests, `data-testid`, mise à jour du README et une entrée CHANGELOG.

### F.2 Architecture cible

```text
french-companies-explorer-qa/
├── index.html                  # <script type="module" src="./src/main.js">, CSP en <meta>
├── styles.css                  # (option : découper en styles/ si justifié)
├── assets/fonts/               # Poppins auto-hébergée (woff2), plus de Google Fonts
├── assets/icons/               # N-11 : icônes PWA
├── manifest.webmanifest        # N-11
├── sw.js                       # N-11 : service worker à la racine (portée = toute l'app)
├── version.json                # N-15 : version, date et commit, généré en CI
├── locales/fr.json, en.json    # N-14
├── src/
│   ├── main.js                 # seul fichier avec effets de bord : appelle init()
│   ├── app.js                  # init({ document, window, storage, fetch, clock, ids })
│   ├── config.js               # URLs d'API, limites, clés de stockage, constantes
│   ├── core/                   # 100 % pur : ni DOM, ni fetch, ni storage, ni Date.now
│   │   ├── query.js            # detectQueryType
│   │   ├── validation.js       # validateAdvancedCriteria, listes blanches, longueurs max
│   │   ├── company.js          # normalizeCompany, statusView
│   │   ├── sort.js             # tri stable, valeurs manquantes toujours en fin
│   │   ├── stats.js            # computeStats
│   │   ├── csv.js              # csvEscape, neutralizeCsvFormula, toCsv
│   │   ├── url-state.js        # criteriaToParams / paramsToCriteria (+ vue)
│   │   ├── history.js          # addHistory, searchIdentity, dédoublonnage, plafond
│   │   ├── compare.js          # règles de comparaison (max 3, doublons)
│   │   ├── filename.js         # exportFileName (slug)
│   │   ├── luhn.js             # N-3 : clé de contrôle SIREN/SIRET
│   │   ├── finances.js         # N-1 : tri des exercices, variations, formatage €
│   │   ├── geo.js              # N-6 : distance haversine, arrondi des coordonnées
│   │   ├── aggregate.js        # N-7 : répartitions pour les graphiques
│   │   ├── diff.js             # N-4 / N-8 : différences entre deux instantanés
│   │   ├── favorites-io.js     # N-4 : import/export de favoris validé
│   │   └── i18n.js             # N-14 : résolution de clés, pluriels
│   ├── qa-lab/                 # N-5 : intercepteur HTTP + panneau, chargé à la demande
│   ├── services/
│   │   ├── http.js             # fetchJson : timeout, AbortSignal, erreurs typées, retry
│   │   ├── companies-api.js    # searchCompanies, getCompanyBySiren, suggest
│   │   ├── geo-api.js          # searchCities, resolveCityCode
│   │   ├── storage.js          # lecture validée par schéma, écriture protégée, migrations
│   │   └── clipboard.js        # copie avec repli
│   ├── state/
│   │   └── store.js            # état + abonnements, aucune variable globale
│   └── ui/
│       ├── dom.js              # h() / helpers qui créent des nœuds (textContent par défaut)
│       ├── router.js           # vues via URL (?view=detail&siren=…) + pushState
│       ├── toast.js
│       ├── autocomplete.js     # composant combobox réutilisable, état d'index **par instance**
│       ├── dialogs.js          # export + nommage de recherche (remplace prompt())
│       └── views/              # search, results, detail, favorites, compare, history
└── tests/
    ├── unit/                   # miroir de src/core et src/services
    ├── integration/            # vues montées dans jsdom avec fetch simulé
    ├── fixtures/               # réponses API réelles anonymisées (JSON)
    └── setup.js
```

Règles d'architecture :
- `src/core/**` ne doit **rien importer** de `services/`, `ui/` ou `state/` (vérifié par une règle ESLint `no-restricted-imports`).
- **Aucun bundler** : l'application doit fonctionner telle quelle sur GitHub Pages et en ouvrant un serveur statique local (`npx serve .`). Les outils npm sont **uniquement** des devDependencies.
- Types : `// @ts-check` + JSDoc (`@typedef Company`, `@typedef SearchCriteria`…) vérifiés par `tsc --noEmit` ; pas de migration TypeScript.

### F.3 Stratégie de test attendue

Configuration `vitest.config.js` :

```js
coverage: {
  provider: 'v8',
  include: ['src/**/*.js'],
  exclude: ['src/main.js'],
  reporter: ['text', 'html', 'lcov', 'json-summary'],
  thresholds: { lines: 80, branches: 80, functions: 80, statements: 80,
                'src/core/**': { lines: 90, branches: 90, functions: 90, statements: 90 } }
}
```

Couvrir au minimum :

| Module | Cas obligatoires |
|---|---|
| `query` | vide, espaces, 9 chiffres, 14 chiffres, 8/10/13/15 chiffres, SIREN avec espaces (`356 000 000`), texte, texte + chiffres |
| `validation` | CP simple et multiple, CP invalide, NAF `56.10A` / minuscules / `5610A`, départements `75`, `974`, `2A`, `2B`, `2C` (invalide), région, longueurs max |
| `company` | API complète, `siege` absent, champs manquants, `matching_etablissements` vs `etablissements`, statut minuscule |
| `sort` | chaque mode, **valeurs manquantes en fin dans les deux sens**, stabilité, accents (`É` vs `E`), non-mutation de l'entrée |
| `csv` | guillemets, `;`, retours ligne, `=`, `+`, `-`, `@`, tabulation, CR, espaces en tête, BOM, `null`/`undefined` |
| `url-state` | aller-retour `criteria → params → criteria` (test de propriété sur des entrées variées), paramètres inconnus ignorés, valeurs hors liste blanche rejetées, `page` négative / décimale / `NaN` |
| `history` | dédoublonnage insensible à la casse, plafond 12, ordre, entrée ancienne sans champs récents |
| `http` | succès, 400, 404, 429 (+ `Retry-After`), 500, JSON invalide, timeout, `AbortError` non affiché, retry borné |
| `storage` | JSON corrompu, mauvais type, entrées partiellement valides filtrées, migration v1 → v2, `QuotaExceededError`, `localStorage` indisponible |
| `autocomplete` | debounce (`vi.useFakeTimers`), réponse obsolète ignorée, flèches/Entrée/Échap, **index indépendant entre deux instances** (#11) |
| `luhn` | SIREN valides connus, clé erronée d'un chiffre, transposition de deux chiffres, SIRET valide, exception La Poste (si confirmée) |
| `finances` | aucun exercice, un exercice, exercices non triés, valeurs `null`, résultat négatif, variation depuis zéro |
| `geo` | distance nulle, Paris ↔ Marseille (tolérance), coordonnées en chaînes, coordonnées invalides, arrondi |
| `aggregate` / `diff` | jeu vide, valeurs manquantes regroupées sous « Non renseigné », aucun changement, changement de statut A → C |
| `favorites-io` | fichier valide, JSON invalide, mauvais schéma, doublons, dépassement du plafond, fusion vs remplacement |
| `qa-lab` | chaque scénario (latence, 400, 429 + `Retry-After`, 500, timeout, vide, hors ligne) produit l'état UI attendu ; inactif sans `?qa=1` |
| Intégration | recherche réussie → cartes + stats + pagination ; erreur → message + bouton Réessayer ; vide ; favori depuis une fiche hors résultats (#13) ; export désactivé pendant le chargement ; restauration depuis l'URL ; **payload XSS** (`<img src=x onerror=…>`) dans `nom_complet`, `siren` et `localStorage` → rendu en texte, aucun élément `img` créé |

Règles de test :
- **Simuler `fetch`** avec `vi.stubGlobal` / `vi.fn` et des fixtures ; **aucun appel réseau réel** en test unitaire.
- Horloge et identifiants injectés (`clock.now()`, `ids.next()`) → tests déterministes.
- Nommage : `describe('<module>')` / `it('<comportement attendu> quand <condition>')`.
- Assertions sur le **comportement observable**, pas sur les détails d'implémentation. Snapshots interdits sauf justification écrite.

### F.4 Livrables de la réponse finale

1. Le **tableau d'audit** (étape 0).
2. L'**arborescence** finale et le **contenu complet** de chaque fichier créé ou modifié (pas d'extraits « … reste inchangé »).
3. La **sortie** de `npm test -- --coverage` (tableau texte V8).
4. `.github/workflows/ci.yml` : déclenché sur `push` et `pull_request`, Node LTS, `npm ci`, lint, typecheck, tests + couverture, `npm audit --audit-level=high`, upload du rapport de couverture en artefact ; **job de déploiement Pages dépendant (`needs`) du job de test**.
5. `.github/dependabot.yml` (npm + github-actions, hebdomadaire).
6. `README.md` mis à jour (installation, scripts, architecture, tests, badges CI/couverture), `CHANGELOG.md` section **2.0.0** au format Keep a Changelog, `MIGRATION.md` listant tout changement visible par le dépôt Playwright.
7. Une **liste de commits** au format Conventional Commits (`refactor:`, `fix:`, `test:`, `ci:`, `docs:`, `chore:`).
8. Un **tableau de traçabilité** fonctionnalités N-x → fichiers → tests → `data-testid` ajoutés.
9. Un paragraphe **« Limites et suites possibles »**.

---

## N — NOUVELLES FONCTIONNALITÉS (complément de l'Action)

Priorisation **MoSCoW**. Pour chaque fonctionnalité : récit utilisateur, critères d'acceptation (à traduire en tests), `data-testid` à créer, garde-fous propres. Les noms de paramètres et champs d'API ci-dessous proviennent de l'OpenAPI officielle ; **revérifie-les** avant implémentation.

Règles communes à toutes les fonctionnalités :
- La logique va dans `src/core/` (pure, testée ≥ 90 %), l'appel réseau dans `src/services/`, l'affichage dans `src/ui/`.
- Chaque nouvel état d'interface (chargement, vide, erreur, partiel) est **explicite** et a son `data-testid`.
- Tout nouveau critère de recherche est **sérialisé dans l'URL**, restauré au chargement, validé par liste blanche.
- Aucune fonctionnalité ne doit casser un parcours existant ni renommer un sélecteur existant.

### 🟥 MUST — lot 8

#### N-1. Fiche entreprise enrichie
*En tant qu'utilisateur, je veux voir dirigeants, finances, labels et TVA d'une entreprise pour l'évaluer sans quitter l'application.*

- Section **Dirigeants** (`dirigeants`) : personnes physiques (nom, prénoms, qualité, **année/mois** de naissance tels que fournis) et personnes morales (dénomination, SIREN cliquable vers sa fiche, qualité).
- Section **Finances** (`finances`) : tableau par exercice (CA, résultat net, variation N/N-1 en %) + **mini-graphique SVG** fait main, accompagné du tableau comme alternative accessible.
- **Badges de labels** issus de `complements` (ESS, RGE, Bio, Qualiopi, SIAE, société à mission, association, entrepreneur individuel, service public, convention collective renseignée, Egapro…) avec infobulle explicative.
- **TVA intracommunautaire** (`tva`) avec bouton copier ; **nombre d'établissements ouverts / total** ; établissements **paginés** via `page_etablissements`.
- Critères : champs absents → mention neutre « Non renseigné », jamais `undefined` ni section vide ; une entreprise sans finances n'affiche pas de graphique.
- `data-testid` : `detail-directors`, `detail-finances-table`, `detail-finances-chart`, `detail-labels`, `detail-vat`, `establishments-pagination`.
- **Garde-fou RGPD** : les données de dirigeants (personnes physiques) sont **affichées mais jamais persistées** (exclues des instantanés de favoris, de la comparaison stockée, de l'historique et des exports par défaut).

#### N-2. Filtres avancés étendus
*Je veux affiner ma recherche par catégorie, forme juridique, secteur, labels, finances et dirigeant.*

- Nouveaux filtres : `categorie_entreprise` (PME/ETI/GE), `nature_juridique` (liste), `section_activite_principale` (A–U avec libellés), labels booléens `est_*` (cases à cocher groupées), `ca_min`/`ca_max`, `resultat_net_min`/`resultat_net_max`, `nom_personne`/`prenoms_personne`.
- Compteur de filtres actifs sur le bouton « Filtres avancés » ; chaque filtre a sa puce supprimable (réutiliser `activeFilters`).
- Critères : min > max → message de validation, pas d'appel API ; une recherche par SIREN/SIRET **affiche un avertissement** « les filtres sont ignorés pour une recherche par identifiant » (comportement documenté de l'API).
- `data-testid` : `filter-category`, `filter-legal-form`, `filter-section`, `filter-labels`, `filter-revenue-min`, `filter-revenue-max`, `filter-person`, `advanced-filters-count`.

#### N-3. Validation SIREN / SIRET par clé de Luhn
*Je veux savoir immédiatement si un identifiant saisi est plausible.*

- `detectQueryType` vérifie la **clé de Luhn** ; accepte les espaces (`356 000 000`) et les normalise.
- Nouvel état : `format valide mais clé incorrecte` (message distinct, recherche **quand même autorisée** avec avertissement, car l'API reste la source de vérité).
- Exception connue des SIRET de La Poste (SIREN 356000000 : somme des chiffres multiple de 5) — **à confirmer** auprès d'une source officielle INSEE avant implémentation.
- `data-testid` : `query-hint` (existant `#queryHint` conservé) avec attribut `data-state="valid|invalid-checksum|invalid-length|text"`.

#### N-4. Favoris complets : notes, tags, import/export, veille
*Je veux organiser mes favoris et savoir si une entreprise suivie a changé.*

- Interface pour **notes** (≤ 500 car.) et **tags** (≤ 8 × 30 car.) — réactive le code mort (#21).
- Filtre par tag, tri (nom, date d'ajout), recherche locale dans les favoris.
- **Export / import JSON** des favoris (fichier versionné `{ schema: "fce-favorites", version: 2, items: [...] }`) avec choix **fusionner / remplacer** et rapport « N importés, M ignorés (raison) ».
- **Veille** : bouton « Actualiser » (un favori ou tous, débit limité) qui compare l'instantané stocké aux données fraîches et signale les changements (statut A → C, nom, adresse du siège, effectif) via un badge « Modifié » et un détail des différences.
- `data-testid` : `favorite-note`, `favorite-tags`, `favorites-tag-filter`, `favorites-export`, `favorites-import`, `favorites-refresh`, `favorite-changed-badge`.
- **Garde-fous** : import = donnée non fiable → validation de schéma stricte, taille de fichier ≤ 1 Mo, plafond 100 favoris, aucun HTML interprété ; actualisation « tous » plafonnée et annulable.

#### N-5. Mode « Labo QA » (cœur de la vocation pédagogique)
*En tant qu'apprenant QA, je veux provoquer des situations difficiles à reproduire pour m'entraîner à les tester.*

- Activé **uniquement** par `?qa=1` ; panneau flottant et **bannière permanente** « Mode Labo QA actif ».
- Scénarios injectés au niveau de `services/http.js` : latence configurable, réponse 400 / 404 / 429 (+ `Retry-After`) / 500, timeout, JSON invalide, résultats vides, hors ligne, **mode fixtures** (réponses déterministes locales depuis `tests/fixtures`, idéal pour Playwright).
- Paramétrable par URL (`?qa=1&qaScenario=429&qaLatency=2000`) pour être piloté par les tests E2E.
- `data-testid` : `qa-lab-banner`, `qa-lab-panel`, `qa-lab-scenario`, `qa-lab-latency`.
- **Garde-fous** : module chargé **dynamiquement** (`import()`) seulement si `?qa=1` ; état conservé en `sessionStorage` uniquement ; aucun scénario ne s'applique sans bannière visible ; jamais d'appel réseau réel en mode fixtures.

### 🟧 SHOULD — lot 9

#### N-6. Recherche à proximité (`/near_point`)
- Point de départ : **géolocalisation du navigateur** (sur action explicite) **ou** une commune choisie (centre via `geo.api.gouv.fr`, `fields=centre`).
- Rayon 1–50 km (curseur + champ), filtre NAF/section, distance calculée (haversine) affichée et tri par distance.
- Lien « Voir sur OpenStreetMap » par résultat (lien externe, **pas de carte embarquée** pour rester sans dépendance et compatible CSP).
- `data-testid` : `nearby-form`, `nearby-radius`, `nearby-use-location`, `result-distance`.
- **Garde-fous vie privée** : position demandée seulement au clic, jamais stockée, **arrondie à 2 décimales** (~1 km) avant envoi et dans l'URL ; refus de permission → message clair et repli sur la commune.

#### N-7. Tableau de bord analytique des résultats
- Graphiques **SVG accessibles** (pas de bibliothèque) : répartition par statut, catégorie, tranche d'effectif, département, section NAF ; chaque graphique a son **tableau alternatif** et un titre/description ARIA.
- Option « Analyser jusqu'à N pages » (N ≤ 4, soit 100 entreprises) avec barre de progression, annulation et respect du débit.
- `data-testid` : `analytics-panel`, `analytics-chart-<axe>`, `analytics-table-<axe>`, `analytics-pages`, `analytics-cancel`.

#### N-8. Comparaison enrichie
- Partage de la comparaison par URL (`?view=compare&sirens=…,…`) avec rechargement des données.
- Interrupteur « Afficher uniquement les différences » ; lignes finances (dernier CA, résultat), labels, nombre d'établissements.
- Réordonner les entreprises (boutons accessibles, pas uniquement glisser-déposer).
- `data-testid` : `compare-share`, `compare-diff-only`, `compare-move-left`, `compare-move-right`.

#### N-9. Vue tableau et filtre local des résultats
- Bascule **cartes / tableau** (préférence mémorisée) ; tableau triable par en-tête (`aria-sort`).
- Champ « Filtrer dans ces résultats » (local, sans appel API, avec compteur annoncé en `aria-live`).
- `data-testid` : `view-toggle`, `results-table`, `local-filter`.

#### N-10. Export étendu
- Export **multi-pages** (plafond 500 lignes, progression, annulation, débit limité), **choix des colonnes**, export des **favoris avec notes/tags**.
- **Fiche imprimable / PDF** via feuille de style `@media print` (pas de bibliothèque PDF).
- Les colonnes dirigeants sont **désactivées par défaut** et précédées d'un avertissement RGPD si l'utilisateur les coche.
- `data-testid` : `export-columns`, `export-all-pages`, `export-progress`, `print-detail`.

### 🟨 COULD — lot 10

#### N-11. Application installable et hors ligne (PWA)
- `manifest.webmanifest`, icônes, `sw.js` à la racine : cache de l'**interface** (stratégie *cache first* versionnée) et des **dernières réponses API** (*network first* avec repli, durée de vie limitée).
- Bannière « Hors ligne — données du JJ/MM HH:MM » et invitation « Nouvelle version disponible — recharger ».
- Logique de stratégie de cache dans `src/core/cache-strategy.js` (testée) ; `sw.js` reste une coquille mince.
- `data-testid` : `offline-banner`, `update-available`.

#### N-12. Raccourcis clavier
- `/` focus recherche, `?` aide, `Échap` ferme, `g` puis `f`/`c`/`h` pour naviguer.
- **WCAG 2.1.4** : raccourcis à touche unique **désactivables** dans les préférences ; inactifs quand un champ a le focus.
- `data-testid` : `shortcuts-dialog`.

#### N-13. Préférences d'affichage
- Thème **système / clair / sombre**, contraste renforcé, densité compacte, réduction des animations, taille de texte. Panneau dédié, persistance validée.
- `data-testid` : `preferences-dialog`, `pref-theme`, `pref-contrast`, `pref-density`.

#### N-14. Internationalisation FR / EN
- Dictionnaires JSON dans `locales/`, module `i18n.js` (interpolation, pluriels via `Intl.PluralRules`), formats via `Intl.NumberFormat` / `Intl.DateTimeFormat`, attribut `lang` mis à jour, langue dans l'URL (`?lang=en`).
- Test automatisé qui **échoue si une clé manque** dans une des langues.
- `data-testid` : `lang-switch`. Les `data-testid` ne sont **jamais** traduits.

#### N-15. Page « À propos & nouveautés »
- Version, date et commit lus depuis `version.json` (généré par la CI), extrait du CHANGELOG, liens sources/licence, **état des API** (test léger à la demande, pas en boucle).
- `data-testid` : `about-version`, `about-api-status`.

### ⛔ WON'T (hors périmètre, ne pas implémenter)
Backend propriétaire, comptes utilisateurs, synchronisation cloud, notifications push, carte avec tuiles embarquées (Leaflet/MapLibre), toute dépendance runtime, scraping de sites tiers, collecte analytique. Si l'une te semble indispensable, **propose-la** dans « Limites et suites possibles » sans l'implémenter.

---

## GARDE-FOUS

### G.1 Garde-fous techniques à implémenter dans l'application

**Sécurité**
- Rendu : construire le DOM avec `document.createElement` + `textContent` (helper `h()`), ou un gabarit qui **échappe par défaut**. `innerHTML` interdit hors exceptions documentées, contrôlé par `eslint-plugin-no-unsanitized`.
- **CSP** via `<meta http-equiv="Content-Security-Policy">` (GitHub Pages ne permet pas d'en-têtes) : `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://recherche-entreprises.api.gouv.fr https://geo.api.gouv.fr; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'`. Conséquence : supprimer tous les styles et gestionnaires inline (dont `style="grid-column:1/-1"`).
- `<meta name="referrer" content="strict-origin-when-cross-origin">` ; liens externes en `rel="noopener noreferrer"`.
- **Police auto-hébergée** (suppression de Google Fonts).
- **Stockage** : clés préfixées et versionnées (`fce:v2:favorites`), lecture via **validateur de schéma** écrit à la main (pas de dépendance), entrées invalides ignorées individuellement, `try/catch` sur toutes les écritures avec toast « Stockage indisponible », plafonds de taille (favoris ≤ 100, historique 12, sauvegardes 12, tags ≤ 8 × 30 caractères, note ≤ 500 caractères). Migration automatique des clés v1 (`fce_*`).
- **Entrées** : longueur maximale de la requête (ex. 100 caractères), normalisation des SIREN/SIRET avec espaces, listes blanches pour `status`, `sort`, `size`, `workforce`, `theme`, `view`.
- **CSV** : neutraliser `= + - @ \t \r` en tête de cellule ; conserver BOM et `;`.
- Identifiants : `crypto.randomUUID()` (avec repli) à la place de `Date.now()`.

**Réseau**
- `fetchJson` unique : timeout (ex. 8 s via `AbortSignal.timeout` combiné au signal d'annulation), erreurs typées (`ValidationError`, `NotFoundError`, `RateLimitError`, `ServerError`, `NetworkError`, `TimeoutError`) et messages utilisateur distincts pour chacune.
- **Retry** limité à 2 tentatives, backoff exponentiel avec gigue, **uniquement** pour 429 / 5xx / réseau sur des GET ; respect de `Retry-After`.
- **Limiteur de débit** côté client (file d'attente partagée par *toutes* les requêtes vers `recherche-entreprises`) réglé avec marge sous la limite documentée de 7 req/s, par exemple **5 req/s** ; indispensable pour N-4 (veille), N-7 (analyse multi-pages), N-8 et N-10 (export multi-pages).
- Toute opération en lot (actualisation, analyse, export multi-pages) est **plafonnée, annulable, avec progression**, et s'arrête proprement sur 429 persistant.
- Protection contre les **réponses obsolètes** pour *toutes* les requêtes (recherche, résolution de commune, fiche, suggestions).
- Fiche par SIREN : vérifier `result.siren === siren` ; sinon état « Entreprise introuvable ».
- Pagination bornée par la limite réelle de l'API (bouton Suivant désactivé et message explicite au-delà).

**Accessibilité et UX**
- Index actif **par instance** d'autocomplétion ; `aria-activedescendant` cohérent.
- Remplacer `prompt()` par un `<dialog>` accessible (focus piégé, Échap, retour du focus).
- Pas de déplacement de focus au premier chargement ; annonce des changements de vue via une région `aria-live`.
- Bouton « Réessayer » sur l'état d'erreur ; boutons d'export désactivés tant qu'aucune donnée n'est exportable.
- File d'attente de toasts (un timer annulé à chaque nouveau message).
- Respect de `prefers-reduced-motion` et `prefers-color-scheme` (thème système par défaut si aucun choix stocké).

### G.2 Garde-fous de comportement pour toi (l'agent)

1. **Compatibilité Playwright** : ne supprime ni ne renomme **aucun `id`, `data-testid`, rôle ARIA ou nom accessible existant**. Tu peux en **ajouter** (convention `kebab-case`, ex. `data-testid="company-card"`, `favorite-toggle`, `compare-table`, `export-dialog`, `error-retry`). Toute exception doit figurer dans `MIGRATION.md`.
2. **Zéro dépendance runtime**. Toute devDependency ajoutée est justifiée en une ligne et sa version exacte est épinglée dans `package-lock.json`.
3. **Pas de triche sur la couverture** : interdit de baisser les seuils, d'élargir `exclude`, d'ajouter `/* v8 ignore */` ou `.skip`/`.only`, ou d'écrire des tests sans assertion. Si un code est intestable, refactorise-le.
4. **Ne pas tester les mocks** : un test doit échouer si le comportement réel régresse (vérifie-le en cassant volontairement une fonction sur un ou deux cas et indique-le).
5. **Ne pas inventer** de champ d'API, de paramètre ou de limite : vérifie dans la documentation officielle ou dans une fixture réelle ; sinon signale « à vérifier ».
6. **Pas de changement fonctionnel non demandé** : toute évolution de comportement visible est listée dans le CHANGELOG avec sa justification.
7. **Aucun secret, aucune télémétrie, aucun traceur** ajouté.
8. **Arrête-toi et demande** avant toute décision irréversible ou ambiguë (suppression d'une fonctionnalité, changement d'URL publique, modification du format d'export consommé par des tests externes).
9. Si une commande échoue, **ne masque pas l'erreur** : montre la sortie, explique la cause, corrige.

---

## DEFINITION OF DONE

- [ ] Les 21 anomalies de C.3 sont confirmées/infirmées ; chaque anomalie confirmée a un test de non-régression vert.
- [ ] `npm run lint`, `npm run typecheck`, `npm test -- --coverage` passent sans avertissement.
- [ ] Couverture ≥ 80 % (lignes, branches, fonctions, instructions) globale, ≥ 90 % sur `src/core/`.
- [ ] Le test « payload XSS » passe sur les résultats, les favoris, la comparaison, l'historique et les recherches sauvegardées.
- [ ] Aucune erreur dans la console ni violation CSP en ouvrant l'app via `npx serve .` et en parcourant toutes les vues.
- [ ] Tous les `id` / `data-testid` de la v1.1.1 sont toujours présents.
- [ ] Workflow CI vert ; le déploiement Pages ne part que si les tests passent.
- [ ] README, CHANGELOG 2.0.0 et MIGRATION à jour.
- [ ] Score Lighthouse Accessibilité ≥ 95 sur l'accueil et la recherche (indiquer le score obtenu).
- [ ] Lots **Must** (N-1 à N-5) livrés intégralement ; lots Should/Could livrés ou explicitement reportés avec justification.
- [ ] Chaque critère d'acceptation de la section N est couvert par au moins un test identifiable dans le tableau de traçabilité.
- [ ] Aucune donnée de personne physique (dirigeants, position GPS) n'est persistée dans le stockage du navigateur (test dédié).
- [ ] Le mode Labo QA est inactif et invisible sans `?qa=1` (test dédié).
- [ ] Aucune opération en lot ne dépasse le limiteur de débit (test avec horloge simulée).
