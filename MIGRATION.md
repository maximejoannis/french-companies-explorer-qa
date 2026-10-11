# Migration

## 2.0.0 → 2.1.0

| Changement | Impact pour les tests | Action recommandée |
|---|---|---|
| Les clés `fce_*` (v1) sont supprimées après migration | Les tests qui relisaient les clés v1 après chargement échouent | Lire les clés `fce:v2:*` |
| Les favoris et la comparaison d'un **entrepreneur individuel** sont enregistrés sans nom ni adresse (option par défaut) | Le titre de carte devient « Entrepreneur individuel (SIREN …) » | Désactiver l'option (`privacy-minimize`) ou adapter l'assertion |
| L'historique de plus de **90 jours** est purgé au chargement | Les historiques injectés avec des dates anciennes disparaissent | Injecter des dates récentes ou régler `retentionDays: 0` dans `fce:v2:prefs` |
| `setupQaLab` renvoie `{ transport, storageBackend }` | Usage interne uniquement | — |
| Nouvelle vue `?view=privacy` et pied de page | Aucun sélecteur existant modifié | — |

# Migration 1.1.1 → 2.0.0

Ce document s'adresse en priorité au **dépôt d'automatisation Playwright** et à la personne qui administre le dépôt GitHub.

## Ce qui ne change pas (garanti par `tests/integration/shell.test.js`)

- Tous les `id` de la v1.1.1 sont présents (`queryInput`, `searchForm`, `resultsGrid`, `sortSelect`, `exportDialog`, `detailFav`, `copySiren`, `establishmentList`…).
- Les 8 `data-testid` historiques sont conservés (`search-form`, `query-input`, `search-button`, `sort-select`, `results-stats`, `active-filters`, `results-grid`, `company-card-<siren>`).
- Les attributs `data-*` utilisés comme sélecteurs : `data-route`, `data-query`, `data-fav`, `data-detail`, `data-compare`, `data-remove`, `data-open`, `data-h`, `data-saved`, `data-del-saved`, `data-rm`, `data-est-filter`, `data-remove-filter` (clés `cp`, `city`, `naf`, `department`, `region`, `workforce`, `status`, `size`, `sort`), `data-detail-fav`, `#resetActiveFilters`.
- Les URL v1 (`?q=…&cp=…&status=…&size=…&sort=…&page=…`) restent valides.
- Les textes français visibles (« 4 résultats », « Aucune entreprise ne correspond à cette recherche. », « Ajouté aux favoris. »…). **La langue par défaut reste le français**, même si le navigateur de test est en `en-US` (locale par défaut de Playwright). L'anglais ne s'active que par `?lang=en` ou par la préférence utilisateur.
- Les données locales v1 (`fce_favorites`, `fce_history`, `fce_saved`, `fce_compare`, `fce_favorite_meta`, `fce_theme`) sont **migrées automatiquement** au premier chargement ; les clés v1 sont conservées (retour arrière possible).

## Ce qui change

| Changement | Impact pour les tests | Action recommandée |
|---|---|---|
| Script chargé en `type="module"` depuis `src/main.js` (l'ancien `app.js` racine est supprimé) | Les tests qui attendaient `load` peuvent démarrer avant l'initialisation | Attendre `html[data-ready="true"]` avant d'interagir |
| Navigation par `pushState` et paramètre `?view=` (`favorites`, `compare`, `history`, `detail&siren=…`, `nearby`, `about`) | `page.goBack()` revient désormais à la vue précédente au lieu de quitter l'app | Mettre à jour les tests qui supposaient l'ancien comportement |
| Libellés de formulaire enveloppés dans un `<span>` (`<label><span>Code postal</span><input></label>`) | Aucun : le nom accessible est identique (`getByLabel('Code postal')`) | — |
| Nommage des recherches : `<dialog id="saveSearchDialog">` au lieu de `window.prompt()` | Les tests utilisant `page.on('dialog')` pour nommer une recherche échouent | Remplir `[data-testid=save-search-name]` puis cliquer `[data-testid=save-search-confirm]` |
| Statut d'établissement fermé reconnu (`F`) | Le filtre « Fermés » renvoie désormais des établissements | Mettre à jour les assertions qui attendaient une liste vide |
| Le tri par date place les dates manquantes en fin | Ordre des cartes différent pour « Création récente » | Mettre à jour les instantanés d'ordre |
| Libellé du compteur au singulier/pluriel (`1 résultat`, `4 résultats` au lieu de `4 résultat(s)`) | Assertions textuelles du compteur | Utiliser une regex `/\d+ résultats?/` |
| Titre de l'onglet par vue (`Favoris · French Companies Explorer`) | Assertions sur `document.title` | Mettre à jour |
| Toast « Lien copié. » (au lieu de « Lien de la recherche copié. ») | Assertion textuelle | Mettre à jour |
| Nouvelle CSP stricte | Les scripts injectés par les tests via `page.addScriptTag({ content })` sont bloqués | Utiliser `page.evaluate` ou `addInitScript` (non concernés par la CSP) |

## Nouveaux outils pour l'automatisation

- **Mode Labo QA** : `?qa=1&qaScenario=fixtures` sert des données fictives déterministes, sans réseau ; scénarios `400`, `404`, `429`, `500`, `timeout`, `invalid-json`, `empty`, `offline` ; `qaLatency=<ms>` pour tester les états de chargement.
- Plus de 110 `data-testid` (liste dans `docs/TRACEABILITY.md`).
- Signal `html[data-ready="true"]`.

## Déploiement GitHub Pages

Le workflow `.github/workflows/ci.yml` publie le site **uniquement si lint, types, tests, couverture et test de fumée passent**. Il faut basculer une fois la source de GitHub Pages : *Settings → Pages → Build and deployment → Source : GitHub Actions*. Le dossier publié (`_site/`) ne contient que les fichiers d'exécution (ni tests ni `node_modules`).
