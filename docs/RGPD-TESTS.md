# Plan de tests RGPD — terrain d'entraînement

Scénarios prêts à automatiser dans le dépôt Playwright. Colonne « Couvert » : test déjà présent dans ce dépôt (Vitest), à reproduire en E2E pour s'entraîner.

Préparation commune : `?qa=1&qaScenario=fixtures` (données fictives, aucun réseau), attendre `html[data-ready="true"]`.

## A. Information et transparence

| ID | Scénario | Étapes | Résultat attendu | Sélecteurs | Couvert |
|---|---|---|---|---|---|
| RGPD-01 | Accès à la page Confidentialité | Cliquer « Confidentialité » dans le pied de page ; puis `g` + `p` au clavier | Vue affichée, URL `?view=privacy`, titre d'onglet « Confidentialité · … » | `footer-privacy`, `#privacyView` | `privacy.test.js` |
| RGPD-02 | Destinataires des données | Ouvrir la page | 4 lignes : API Recherche, API Découpage, GitHub Pages, liens externes | `privacy-recipients` | `privacy.test.js` |
| RGPD-03 | Mentions légales et licence | Ouvrir la page, suivre le lien Licence | Hébergeur affiché ; `./LICENSE` servi | `privacy-legal`, `footer-license` | `privacy.test.js` |
| RGPD-04 | Aucun traceur | Charger l'accueil et inspecter les requêtes réseau et `document.cookie` | Aucune requête hors origine et hors API ; aucun cookie | — | test de fumée |

## B. Minimisation

| ID | Scénario | Étapes | Résultat attendu | Sélecteurs | Couvert |
|---|---|---|---|---|---|
| RGPD-05 | Dirigeants jamais stockés | Ouvrir la fiche `900000001`, l'ajouter aux favoris, lire `localStorage` | « TESTEUR » absent de toutes les clés `fce:*` | `#detailFav` | `views.test.js`, fumée |
| RGPD-06 | Entrepreneur individuel minimisé | Rechercher « cafe », ajouter `900000043` aux favoris | Clé `fce:v2:favorites` : `name` et `address` vides, `minimized: "ei"` ; carte « Entrepreneur individuel (SIREN …) » | `favorite-minimized` | `privacy.test.js` |
| RGPD-07 | Option désactivée puis réactivée | Décocher l'option, ajouter `900000043`, recocher | Nom enregistré puis effacé rétroactivement (favoris et comparaison) | `privacy-minimize` | `privacy.test.js` |
| RGPD-08 | Diffusion partielle | `?view=detail&siren=900000118`, ajouter aux favoris (option décochée) | Bandeau d'information ; `minimized: "partial"` quoi qu'il arrive | `detail-partial-diffusion` | `privacy.test.js` |
| RGPD-09 | Géolocalisation | Simuler une position (Playwright `geolocation`), « Utiliser ma position » | Coordonnées arrondies à 2 décimales dans l'URL ; rien dans `localStorage` | `nearby-use-location`, `nearby-point` | `shell.test.js` |
| RGPD-10 | Refus de géolocalisation | Refuser la permission | Message de repli, aucune erreur | `nearby-state` | `shell.test.js` |
| RGPD-11 | Export avec dirigeants | Configurer l'export, cocher « Dirigeants » | Avertissement visible avant téléchargement | `export-column-directors`, `#exportPersonalWarning` | `views.test.js` |

## C. Conservation limitée

| ID | Scénario | Étapes | Résultat attendu | Sélecteurs | Couvert |
|---|---|---|---|---|---|
| RGPD-12 | Purge au chargement | Injecter (`addInitScript`) un historique daté de 120 jours, charger | Entrée absente de l'historique et du stockage | `#historyList` | `privacy.test.js` |
| RGPD-13 | Réduction de la durée | Passer la durée de 90 à 30 jours | Entrées de plus de 30 jours supprimées immédiatement ; préférence enregistrée | `privacy-retention` | `privacy.test.js` |
| RGPD-14 | Sans limite | Choisir « Sans limite », recharger | Aucune purge | `privacy-retention` | `privacy.test.js` |
| RGPD-15 | Cache API | Mode hors ligne : consulter, attendre plus de 24 h (horloge Playwright `page.clock`) | Réponse expirée non servie et purgée à l'activation | — | `infra.test.js` (logique) |

## D. Droits des personnes

| ID | Scénario | Étapes | Résultat attendu | Sélecteurs | Couvert |
|---|---|---|---|---|---|
| RGPD-16 | Inventaire | Ajouter 1 favori et 1 comparaison, ouvrir la page | Compteurs 1 / 1, bouton « Effacer » désactivé pour les catégories vides | `privacy-inventory`, `privacy-count-*`, `privacy-erase-*` | `privacy.test.js` |
| RGPD-17 | Portabilité | « Exporter mes données » | Fichier `mes-donnees-fce-AAAA-MM-JJ.json`, schéma `fce-personal-data`, 6 catégories | `privacy-export` | `privacy.test.js` |
| RGPD-18 | Effacement par catégorie | Effacer « Favoris » | Favoris et notes vidés, comparaison intacte, toast de confirmation | `privacy-erase-favorites` | `privacy.test.js` |
| RGPD-19 | Effacement total — garde-fou | Ouvrir le dialogue sans cocher la case | « Tout effacer » désactivé ; Annuler ne supprime rien | `erase-dialog`, `erase-ack`, `erase-confirm`, `erase-cancel` | `privacy.test.js` |
| RGPD-20 | Effacement total | Cocher, confirmer | Aucune clé `fce*` (local et session), caches `fce-*` supprimés, clés d'autres applications conservées, préférences par défaut | `privacy-status` | `privacy.test.js`, fumée |
| RGPD-21 | Clés v1 après migration | Injecter des clés `fce_*`, charger | Données migrées puis clés v1 supprimées (anomalie #27) | `privacy-count-legacy` | `privacy.test.js`, `services.test.js` |

## E. Robustesse (Labo QA)

| ID | Scénario | Étapes | Résultat attendu | Sélecteurs | Couvert |
|---|---|---|---|---|---|
| RGPD-22 | Stockage bloqué | `?qa=1&qaStorage=blocked` puis ajouter un favori | Toast « Stockage du navigateur indisponible », l'application reste utilisable | `qa-lab-storage` | `shell.test.js` |
| RGPD-23 | Stockage plein | `?qa=1&qaStorage=quota` puis ajouter un favori | Toast « Stockage du navigateur plein », aucune exception | `qa-lab-storage` | `privacy.test.js` |
| RGPD-24 | Stockage corrompu | Injecter `fce:v2:favorites = "oops"` | Page Favoris vide, aucune erreur console | — | `search.test.js` |

## Idées d'exercices supplémentaires

- Vérifier les noms accessibles des boutons « Effacer » (`getByRole('button', { name: 'Effacer : Comparaison' })`).
- Tester l'effacement total en anglais (`?lang=en`) et vérifier le retour au français ensuite.
- Écrire un test de non-régression visuelle de la page Confidentialité en thème sombre et contraste renforcé.
