# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [2.1.0] — 2026-10-11

### Ajouté
- **Page Confidentialité** (`?view=privacy`, pied de page, raccourci `g` puis `p`) : résumé, destinataires des données, droits, mentions légales.
- **Mes données** : inventaire en temps réel du stockage local par catégorie, **export JSON** (portabilité), **effacement par catégorie** et **effacement total** confirmé (localStorage v1/v2, sessionStorage, caches du service worker), sans toucher aux autres applications de la même origine.
- **Durée de conservation** de l'historique réglable (30, 90 — par défaut —, 365 jours ou sans limite), purge automatique au chargement.
- **Minimisation** : nom, adresse, code postal, SIRET et coordonnées des entrepreneurs individuels non enregistrés (option active par défaut, appliquée rétroactivement) ; unités en **diffusion partielle** Sirene (`statut_diffusion = "P"`) jamais enregistrées avec leur nom, bandeau d'information sur la fiche.
- Purge des réponses API de plus de 24 h dans le cache hors ligne.
- Labo QA : stockage simulé `qaStorage=blocked|quota`.
- `LICENSE` (MIT + avis sur les données et le RGPD), `PRIVACY.md`, plan de tests `docs/RGPD-TESTS.md` (24 scénarios), pied de page.

### Corrigé
- #27 — Les clés v1 (`fce_*`) étaient conservées après la migration : un favori supprimé en v2 subsistait en v1. Elles sont désormais supprimées après une migration réussie (et nettoyées sur les installations déjà migrées).

## [2.0.0] — 2026-10-11

### Ajouté
- **Fiche enrichie** : dirigeants, finances (tableau + graphique), labels, TVA intracommunautaire, nombre d'établissements ouverts, établissements paginés, impression/PDF.
- **Filtres étendus** : catégorie, forme juridique, section NAF, labels (`est_*`), CA et résultat net min/max, nom et prénoms de dirigeant ; compteur de filtres actifs ; avertissement « filtres ignorés » pour les recherches par identifiant.
- **Validation SIREN/SIRET** par clé de Luhn (exception La Poste), saisie avec espaces acceptée.
- **Favoris** : notes, tags, recherche, tri, import/export JSON validé (fusion ou remplacement), veille des changements.
- **Mode Labo QA** (`?qa=1`) : latence, erreurs HTTP, timeout, JSON invalide, vide, hors ligne, données fictives déterministes.
- **Recherche à proximité** (`/near_point`) par commune ou géolocalisation arrondie.
- **Analyse** graphique multi-pages (SVG accessibles + tableaux de données).
- **Comparaison** partageable par URL, « différences seules », réordonnancement accessible.
- **Vue tableau** triable et filtre local des résultats.
- **Export** multi-pages (500 lignes max), choix des colonnes, export des favoris.
- **PWA** installable, consultable hors ligne, invitation à recharger lors d'une mise à jour.
- **Raccourcis clavier** désactivables, **préférences d'affichage**, **interface FR/EN**, page **À propos**.
- Menu de navigation pour mobile et tablette.
- Outillage : Vitest + jsdom, couverture V8 avec seuils bloquants, ESLint (`no-unsanitized`), vérification de types JSDoc, Prettier, CI GitHub Actions (lint, types, tests, audit, test de fumée Chromium, déploiement Pages conditionné), Dependabot.

### Modifié
- Refonte complète : `app.js` monolithique remplacé par des modules ES (`src/core` pur, `src/services`, `src/ui`), point d'entrée `init()` aux dépendances injectables.
- URL comme source de vérité (`?view=`, `siren`, `sirens`, proximité), navigation `pushState`.
- Stockage `fce:v2:*` versionné et validé ; migration automatique des données v1.1.1.
- Police Poppins auto-hébergée ; Content-Security-Policy stricte.
- Compteur de résultats au singulier/pluriel ; titres d'onglet par vue.

### Corrigé
- 21 anomalies de l'audit initial et 5 nouvelles (#22 à #26) : XSS par attributs, stockage corrompu, thème non validé, injection CSV, absence de timeout, réponses obsolètes, fiche par SIREN non vérifiée, quota de stockage, autocomplétion, tri des dates, favoris hors résultats, presse-papiers, toasts, deep-linking, `prompt()`, focus initial, codes commune corses, établissements fermés (`F`), navigation mobile, grille des statistiques, codes département. Détail : `docs/AUDIT.md`.

### Sécurité
- Aucun `innerHTML` dynamique (règle de lint bloquante), URLs `href` en liste blanche, CSP, `referrer` restreint, données personnelles jamais persistées.

## 1.1.1 — 2026-09-22

- correction de la régression visuelle du Hero : suppression du contour de focus parasite et adaptation responsive du titre ;
- correction des 14 anomalies QA documentées ;
- filtres NAF, département, région, effectif et commune résolue en code INSEE ;
- autocomplétion accessible et résistante aux réponses obsolètes ;
- partage d’une recherche par URL canonique ;
- comparaison jusqu’à trois entreprises avec valeurs inconnues neutres ;
- export CSV/JSON configurable, protégé pendant le chargement ;
- amélioration des noms accessibles, du focus, des annonces et des animations réduites.
