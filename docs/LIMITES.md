# Limites connues et suites possibles

## Limites

1. **API réelle non testée depuis l'environnement de développement.** Le réseau sortant vers `recherche-entreprises.api.gouv.fr` était bloqué : le comportement a été vérifié avec des données fictives (mode Labo QA `fixtures`) qui reproduisent le contrat documenté dans l'OpenAPI. Deux points sont tolérés par le code mais à confirmer sur l'API réelle : la forme du champ `tva` et la présence de `libelle_activite_principale` (sinon seul le code NAF est affiché).
2. **Règle La Poste** (SIRET dont la somme des chiffres est un multiple de 5) : à reconfirmer auprès d'une source INSEE à jour. En cas d'erreur, l'impact est limité : la recherche reste autorisée avec un simple avertissement.
3. **Hors ligne** : le service worker est un module ES ; les navigateurs qui ne supportent pas les service workers « module » n'ont pas le mode hors ligne (l'application fonctionne normalement en ligne).
4. **Score Lighthouse** non mesuré (outil indisponible dans l'environnement). Accessibilité vérifiée par conception et par tests (noms accessibles, `aria-*`, focus, contrastes, raccourcis désactivables). À mesurer : `npx lighthouse https://maximejoannis.github.io/french-companies-explorer-qa/ --only-categories=accessibility`.
5. **Couverture** : `src/main.js` (câblage) est exclu comme prévu par le prompt ; `sw.js` est hors de `src/` et n'est pas mesuré, mais sa logique est dans `src/core/cache-strategy.js` (100 %).
6. **Établissements** : la fiche charge jusqu'à 100 établissements (`limite_matching_etablissements`) et les pagine côté client ; au-delà, seul le total est affiché.
7. **Outillage** : Vitest 5 a besoin de `vite` en dépendance « peer » ; il est installé automatiquement par npm (le contournement `legacy-peer-deps` de la 2.1.0 a été retiré).
8. **Licence** : MIT pour le code (choix par défaut, modifiable). L'avis complémentaire du fichier `LICENSE` et `PRIVACY.md` sont informatifs et ne constituent pas un conseil juridique.
9. **RGPD** : la conformité porte sur ce que fait l'application dans le navigateur. Les journaux de GitHub Pages et des API de l'État relèvent de ces opérateurs. Le statut de diffusion partielle est lu depuis l'API (`statut_diffusion`) ; son comportement exact sur l'API réelle (champs déjà masqués ou non) reste à vérifier.

## Suites possibles

- Test de contrat quotidien contre l'API réelle (schéma JSON des réponses) dans le dépôt Playwright, pour détecter les évolutions de l'API.
- Exécuter le test de fumée sur Firefox et WebKit en CI.
- Tests d'accessibilité automatisés (axe-core) dans le dépôt Playwright.
- Carte interactive des résultats à proximité (nécessiterait une bibliothèque cartographique : exclue ici pour rester sans dépendance d'exécution).
