# French Companies Explorer — QA Training V2

Application statique moderne en HTML/CSS/JavaScript vanilla connectée à l'API publique Recherche d'Entreprises.

## Fonctionnalités V2

- recherche simple par nom, mot-clé, SIREN ou SIRET ;
- filtres avancés ;
- pagination ;
- tri des résultats ;
- statistiques sur les résultats visibles ;
- fiche détaillée ;
- affichage des établissements correspondants lorsqu'ils sont présents dans la réponse API ;
- favoris persistants ;
- recherches sauvegardées ;
- historique ;
- comparaison jusqu'à trois entreprises ;
- export JSON et CSV ;
- deep-linking via paramètres d'URL ;
- mode clair/sombre persistant ;
- états chargement / erreur / aucun résultat ;
- design responsive ;
- `data-testid` sur les principaux contrôles.

## Lancer localement

```bash
python -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déploiement

Le projet est entièrement statique et compatible GitHub Pages.

## API

L'application consomme l'API Recherche d'Entreprises :

`https://recherche-entreprises.api.gouv.fr/search`

## QA / Playwright

La V2 est adaptée à :
- tests E2E UI ;
- tests API ;
- tests de cohérence API ↔ UI ;
- tests localStorage ;
- tests de deep-linking ;
- tests de téléchargement ;
- tests de tri et pagination ;
- tests responsive et accessibilité.


## Identité visuelle

La V2 redesign utilise une palette bleue inspirée du cahier de style fourni, une typographie Poppins, un Hero plein écran et des animations décoratives légères, sans modifier le périmètre fonctionnel.
