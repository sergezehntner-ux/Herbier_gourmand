# Herbier Gourmand v2.9.5 — Ergonomie terrain II

Fichiers à remplacer sur GitHub :
- index.html
- app-v282.js
- version.json
- sw.js
- service-worker.js

Aucun fichier de données (recipes.json, producers.json, restaurants.json, herbs-spices.json, fruits-vegetables.json) ne doit être remplacé.

## Modifications
- Recettes : recherche dédiée par Tag.
- Recettes : filtre « Sans ingrédient… » pour exclure temporairement un ingrédient.
- Planning : « Rôle » renommé « Service » (les données existantes restent compatibles).
- Planning : rafraîchissement immédiat après modification d'une recette conservé et vérifié.
- Courses : lignes compactées ; en regroupement par magasin, le rayon apparaît directement sur la ligne de l'article.
- Sorties : conservation renforcée de la position dans la liste après ouverture, modification puis retour.
- Cache PWA : version 2.9.5.

## Non inclus volontairement
- « Une idée surprise » intelligente : réservée à un chantier séparé.
- Végétarien / végane / recette rapide et choix de compléments : prévus pour l'étape suivante.

Après publication, fermer complètement Herbier Gourmand puis le rouvrir. Si l'ancienne version reste visible, faire une actualisation forcée ou relancer la PWA après quelques secondes.
