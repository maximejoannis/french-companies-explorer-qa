# French Companies Explorer — QA Training

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-2ea44f?logo=github&logoColor=white)](https://maximejoannis.github.io/french-companies-explorer-qa/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=000)
![API](https://img.shields.io/badge/API-data.gouv.fr-000091)
![Responsive](https://img.shields.io/badge/Responsive-Design-2563EB)

Application web de recherche d'entreprises françaises conçue comme support
d'entraînement aux **tests manuels**, aux **tests API** et à
l'**automatisation E2E avec Playwright**.

🌐 **Application en ligne :**  
https://maximejoannis.github.io/french-companies-explorer-qa/

---

## Présentation

**French Companies Explorer** est une application web développée en
HTML, CSS et JavaScript vanilla.

Elle exploite l'API publique **Recherche d'Entreprises** afin de permettre
la recherche et la consultation d'informations relatives aux entreprises
françaises.

Le projet a également été conçu comme une application cible pour pratiquer
différentes activités QA :

- tests fonctionnels manuels ;
- conception de cas de test ;
- tests End-to-End ;
- tests API ;
- tests de cohérence API ↔ UI ;
- automatisation avec Playwright ;
- intégration continue avec GitHub Actions.

L'automatisation Playwright sera maintenue dans un repository séparé afin
de conserver une séparation claire entre l'application testée et le projet
d'automatisation.

---

## Fonctionnalités

### Recherche

- Recherche par nom d'entreprise
- Recherche par mot-clé
- Recherche par SIREN / SIRET
- Filtres avancés
- Filtrage par commune
- Filtrage par code postal
- Filtrage par état administratif
- Pagination des résultats
- Choix du nombre de résultats par page

### Consultation

- Affichage des entreprises sous forme de cartes
- Consultation d'une fiche détaillée
- Informations administratives
- SIREN
- SIRET du siège
- Activité principale
- Statut administratif
- Date de création
- Localisation
- Catégorie d'entreprise
- Effectif lorsqu'il est disponible
- Affichage des établissements disponibles dans les données retournées

### Tri et analyse

Les résultats peuvent être triés notamment par :

- pertinence ;
- nom ;
- date de création ;
- statut.

L'application fournit également des statistiques sur les résultats
actuellement affichés.

### Favoris

Une entreprise peut être ajoutée aux favoris.

Les favoris sont conservés dans le navigateur grâce à `localStorage`.

Il est possible de :

- ajouter une entreprise ;
- retirer une entreprise ;
- consulter ses favoris ;
- supprimer l'ensemble des favoris ;
- retrouver les favoris après actualisation de la page.

### Comparaison

L'application permet de comparer jusqu'à **trois entreprises**.

Les informations principales sont présentées dans un tableau comparatif :

- SIREN ;
- statut ;
- activité ;
- ville ;
- code postal ;
- date de création ;
- catégorie ;
- effectif.

### Historique

Les recherches effectuées sont enregistrées localement.

Une recherche précédente peut être relancée directement depuis
l'historique.

### Recherches sauvegardées

Une recherche et ses critères peuvent être sauvegardés afin d'être
réutilisés ultérieurement.

### Export

Les résultats visibles peuvent être exportés aux formats :

- JSON
- CSV

### Deep linking

Les paramètres de recherche peuvent être conservés dans l'URL afin de
restaurer une recherche directement depuis un lien.

### Interface

- Responsive Design
- Desktop / tablette / mobile
- Mode clair
- Mode sombre
- Persistance du thème
- États de chargement
- Gestion des erreurs API
- Gestion des recherches sans résultat

---

## Architecture

Le projet reste volontairement simple et ne nécessite aucun framework.

```text
french-companies-explorer-qa/
│
├── index.html
├── styles.css
├── app.js
├── README.md
├── PROMPT_SPEC.md
└── .gitignore
