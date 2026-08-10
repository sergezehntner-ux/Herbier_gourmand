# Herbier Gourmand v2.9.4 — Ergonomie terrain

Fichiers à remplacer sur GitHub :
- `index.html`
- `app-v282.js`
- `version.json`
- `sw.js`
- `service-worker.js`

## Corrections intégrées
- Retour contextuel après une consultation croisée : Retour ramène à la fiche et à la position d’origine.
- Recettes : ouverture en cliquant directement sur la recette ; suppression du bouton « Voir la recette ».
- Planning : déplacement avec date + choix Matin/Midi/Soir.
- Planning : champ libre « Ajout / remarque » pour chaque repas.
- Planning : rafraîchissement immédiat après modification d’une recette.
- Courses : mémorisation des magasins utilisés même après vidage de la liste.
- Sorties : ajout du champ et filtre Région.
- Producteurs : saisie assistée du Lieu (on peut taper un lieu existant ou en créer un nouveau).
- Plantes & Épices : listes contrôlées pour Famille, Saison, Intensité et Formes.
- Fruits & Légumes : listes contrôlées pour Catégorie et Saison.
- Listes dynamiques triées alphabétiquement.
- Maintien de l’écran déjà actif pour Courses et consultation des recettes.

## Non inclus volontairement
Le moteur « Une idée surprise », la recherche « sans X », les compléments avancés et les indicateurs végétarien/végane/rapide restent hors de ce correctif pour ne pas fragiliser la version terrain.

Aucun fichier de données (`recipes.json`, `producers.json`, `restaurants.json`, etc.) n’est remplacé.
