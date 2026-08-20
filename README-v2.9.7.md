# Herbier Gourmand v2.9.7 — Mémoire & liens culinaires

Base : v2.9.6.6 stable.

## À remplacer sur GitHub
- index.html
- app-v282.js
- styles-v282.css
- version.json
- manifest.webmanifest
- sw.js
- service-worker.js
- icon-hg-2970-192.png
- icon-hg-2970-512.png

## Nouveautés
- Recettes : choix de compléments parmi les recettes existantes.
- Recettes : compléments libres, transférables dans Courses lorsqu'ils sont écrits sous la forme `nom / quantité / unité`.
- Recettes : champ « Que pourrais-je faire avec des restes ? ».
- Planning : bouton « Cuisiné » qui enregistre/retire la date de l'historique de la recette.
- Planning : proposition facultative d'un commentaire au moment de marquer une recette comme cuisinée.
- Planning : bouton Favori.
- Fiche recette : toutes les dates cuisinées, le statut Favori et les commentaires sont visibles.
- Courses : toucher un ingrédient transféré depuis le planning ouvre sa recette source ; si plusieurs recettes l'utilisent, un choix est proposé.
- Courses : un bouton « Modifier » distinct conserve l'accès à l'édition de l'article.

## Données
Aucun fichier JSON de données n'est inclus ni remplacé.
Les nouveaux champs sont stockés dans la recette locale existante et sont donc inclus automatiquement dans les sauvegardes `.hgbak`.

## Contrôles effectués
- syntaxe JavaScript (`node --check`)
- validité JSON du manifest et de version.json
- contrôle des identifiants HTML utilisés par les nouveaux composants
- cache PWA isolé `herbier-v2-9-7`
