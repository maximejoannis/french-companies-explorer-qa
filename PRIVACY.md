# Politique de confidentialité — French Companies Explorer

*Dernière mise à jour : 11 octobre 2026 · version 2.1.0*

French Companies Explorer est un **projet personnel, non commercial**, d'entraînement à l'assurance qualité (tests manuels et automatisés). Cette page décrit les données traitées et la façon de les maîtriser. Elle est aussi disponible dans l'application : page **Confidentialité** (`?view=privacy`).

## 1. En bref

- Aucun compte, aucun cookie, aucun outil de mesure d'audience ni traceur publicitaire.
- Ce que tu enregistres (favoris, historique, préférences) reste **dans ton navigateur**. L'éditeur n'y a jamais accès : il n'existe aucun serveur applicatif.
- Tes recherches sont envoyées aux API publiques de l'État pour obtenir les résultats.
- Tu peux **exporter** ou **effacer** tes données à tout moment.

## 2. Éditeur, hébergeur, contact

| | |
|---|---|
| Éditeur | Maxime Joannis — projet personnel |
| Contact | [Tickets GitHub du projet](https://github.com/maximejoannis/french-companies-explorer-qa/issues) |
| Hébergeur | GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (GitHub Pages) |

## 3. Données enregistrées dans ton navigateur

| Catégorie | Contenu | Durée de conservation | Effacement |
|---|---|---|---|
| Favoris | Instantané de l'entreprise (sans dirigeants), date d'ajout, changements détectés | Jusqu'à suppression | Bouton ♥, « Tout supprimer », page Confidentialité |
| Notes et tags | Texte saisi par toi (500 caractères max, 8 tags max) | Jusqu'à suppression | Page Favoris ou Confidentialité |
| Comparaison | Jusqu'à 3 instantanés | Jusqu'à suppression | Page Comparer ou Confidentialité |
| Historique | Critères de recherche et date | **90 jours par défaut** (30, 90, 365 jours ou sans limite) — purge automatique | Page Historique ou Confidentialité |
| Recherches sauvegardées | Nom donné et critères | Jusqu'à suppression | Page Historique ou Confidentialité |
| Préférences | Thème, langue, contraste, densité, durée de conservation… | Jusqu'à suppression | Page Confidentialité |
| Cache hors ligne | Interface et dernières réponses de l'API **sans les dirigeants** | Réponses API : 24 h, purgées automatiquement | « Effacer toutes mes données » |
| Labo QA (`?qa=1`) | Scénario de test choisi | Durée de l'onglet (sessionStorage) | Fermeture de l'onglet ou effacement total |

Ces stockages servent uniquement à des fonctions demandées par l'utilisateur ou à la personnalisation de l'interface : ils relèvent des cas dispensés de consentement par la CNIL. Aucun bandeau de consentement n'est donc affiché.

**Jamais enregistrés** : les dirigeants (personnes physiques), ta position GPS, le nom et l'adresse des entrepreneurs individuels (option activée par défaut) et des entreprises en diffusion partielle.

## 4. Données transmises à des tiers

| Destinataire | Données | Quand |
|---|---|---|
| API Recherche d'Entreprises (DINUM) | Termes et filtres de recherche, coordonnées arrondies à ~1 km (recherche à proximité), adresse IP | À chaque recherche |
| API Découpage administratif (DINUM) | Nom de commune saisi, adresse IP | Autocomplétion des communes |
| GitHub Pages | Adresse IP, navigateur (journaux techniques de l'hébergeur) | Au chargement du site |
| OpenStreetMap, Annuaire des Entreprises | Adresse IP, page consultée | Uniquement si tu cliques sur un lien externe |

La police d'écriture est hébergée sur le site : aucune requête n'est envoyée à Google Fonts.

La géolocalisation n'est demandée **qu'au clic** sur « Utiliser ma position ». Elle est arrondie à 2 décimales (~1 km) avant tout envoi et apparaît dans l'URL de la recherche (historique du navigateur, liens partagés). Elle n'est jamais enregistrée par l'application.

## 5. Données des entreprises affichées

Les informations affichées proviennent de registres publics (base Sirene de l'INSEE, Registre national des entreprises de l'INPI) via l'API Recherche d'Entreprises. Elles peuvent contenir des données personnelles (entrepreneurs individuels, dirigeants).

- Une personne peut demander à l'INSEE la **diffusion partielle** de ses données. L'API signale ce statut (`statut_diffusion = "P"`) : l'application l'indique sur la fiche et n'enregistre jamais le nom ni l'adresse de ces unités.
- Pour corriger une donnée d'entreprise, il faut s'adresser à la source (INSEE, greffe ou INPI). L'application n'en est qu'un lecteur.

## 6. Tes droits

- **Accès et portabilité** : « Exporter mes données (JSON) » sur la page Confidentialité (schéma `fce-personal-data`).
- **Effacement** : par catégorie ou en totalité (stockage local v1 et v2, sessionStorage et cache hors ligne), immédiatement, après une confirmation explicite.
- **Réclamation** : tu peux saisir la [CNIL](https://www.cnil.fr).

## 7. Sécurité

Content-Security-Policy stricte (aucun script tiers), aucun `innerHTML` dynamique, validation de toutes les données relues depuis le stockage, liens externes sans transmission du référent. Détails : `README.md`, section « Garde-fous ».
