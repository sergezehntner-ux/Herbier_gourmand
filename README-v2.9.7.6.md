# Herbier Gourmand v2.9.7.6 — Notifications restes

Correctif ciblé, basé sur v2.9.7.5.

## Modifications
- Les notifications « À vérifier — utilisation de restes » dans Courses s'affichent sur deux lignes et ne sont plus masquées par le badge « À vérifier » ni le bouton « Modifier ».
- Une notification correspond à une utilisation de restes active dans le Planning.
- Si une utilisation de restes est retirée du Planning, sa notification est retirée automatiquement de Courses.
- Si elle est déplacée, l'ancienne notification disparaît et la nouvelle est créée avec la nouvelle date / le nouveau repas.
- Plusieurs utilisations de restes différentes conservent chacune leur propre notification.

## À remplacer sur GitHub
- index.html
- app-v282.js
- version.json
- manifest.webmanifest
- sw.js
- service-worker.js

Aucun fichier de données n'est remplacé.
