# Prompt amélioré — French Companies Explorer V2

Construire une application web statique moderne nommée **French Companies Explorer — QA Training V2**, développée uniquement en **HTML5, CSS3 et JavaScript vanilla**, sans framework frontend et sans backend propriétaire.

L'application doit être **compatible GitHub Pages**, responsive, accessible, visuellement moderne, colorée et professionnelle. Elle doit consommer directement l'API publique **Recherche d'Entreprises** de l'Annuaire des Entreprises / data.gouv.fr.

## Objectifs fonctionnels

L'application doit proposer :

1. Une recherche simple par nom, mot-clé, SIREN ou SIRET.
2. Des filtres avancés : code postal, commune, état administratif et taille de page.
3. Une pagination des résultats.
4. Une fiche détaillée par entreprise.
5. Un tri côté interface sur les résultats affichés : nom, date de création, statut.
6. Des favoris persistés dans `localStorage`.
7. Des recherches sauvegardées avec nom personnalisé.
8. Un historique des recherches.
9. Une comparaison de jusqu'à trois entreprises.
10. Une vue des établissements retournés par l'API lorsqu'ils sont disponibles.
11. Un tableau de statistiques calculées sur les résultats de la page courante.
12. Un export JSON et CSV des résultats visibles.
13. Un système de deep-linking : la recherche et les filtres doivent pouvoir être restaurés depuis l'URL.
14. Un mode clair / sombre avec persistance locale.
15. Une gestion claire des états : chargement, erreur API, aucun résultat.
16. Des `data-testid` stables sur les principaux contrôles et composants pour l'automatisation Playwright.

## Contraintes QA

- Ne pas masquer les erreurs réseau.
- Afficher explicitement les états de chargement et d'erreur.
- Garder la logique métier lisible et testable.
- Éviter les dépendances externes inutiles.
- Préserver des sélecteurs accessibles (`role`, labels, texte) en plus des `data-testid`.
- Préparer le projet à des tests E2E, API et de cohérence API ↔ UI.

## Architecture

```text
index.html
styles.css
app.js
README.md
PROMPT_SPEC.md
```

## Design

Le design doit être moderne, coloré, attractif et responsive, avec :
- gradients modérés ;
- cartes ;
- badges de statut ;
- typographie claire ;
- contrastes suffisants ;
- états hover/focus ;
- mode sombre ;
- mise en page adaptée mobile/tablette/desktop.
