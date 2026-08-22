# Herbier Gourmand v2.9.7.12 — Recettes épurées & Tags hybrides

Base : v2.9.7.11 validée.

## Modifications
- Le champ **Tags** est placé juste après **Catégorie** dans Ajouter/Modifier une recette.
- Tags devient un champ hybride : saisie libre + suggestions de tous les tags déjà présents dans la bibliothèque (avec les suggestions de base).
- Sur smartphone, les suggestions restent tactiles grâce au mécanisme introduit en v2.9.7.8.
- Suppression du bloc **Compléments et restes** du formulaire Recette.
- Les anciens champs recette liés aux compléments/restes sont conservés silencieusement pour ne pas perdre de données historiques, mais ne sont plus affichés ni utilisés dans la fiche Recette ou le transfert vers Courses. La logique réelle des restes demeure dans Planning.

## Fichiers à remplacer
- index.html
- app-v282.js
- version.json
- manifest.webmanifest
- sw.js
- service-worker.js

Aucun fichier de données n'est inclus.
