# Herbier Gourmand v2.9.6.3 — Correctif listes Courses

Ce correctif restaure de manière forcée les sélecteurs natifs **Magasin**, **Rayon** et **Magasin / marché** de la rubrique Courses.

Il corrige aussi le service worker : la v2.9.6.2 gardait encore le nom de cache v2.9.6.1 et référençait des icônes non livrées, ce qui pouvait empêcher l'activation propre de la mise à jour.

## Fichiers à remplacer sur GitHub
- index.html
- app-v282.js
- styles-v282.css
- manifest.webmanifest
- version.json
- sw.js
- service-worker.js
- icon-hg-2963-192.png
- icon-hg-2963-512.png

Aucun fichier de données (`recipes.json`, `producers.json`, etc.) n'est remplacé.

Après publication, fermer complètement Herbier Gourmand puis le rouvrir. Une actualisation forcée peut être nécessaire une seule fois pour que le nouveau service worker prenne la main.
