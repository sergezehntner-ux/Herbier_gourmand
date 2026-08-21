# Herbier Gourmand v2.9.7.5 — Liens Courses ↔ Recettes

Correctif ciblé construit à partir de v2.9.7.4.

## Fonction finalisée
- Un article de Courses provenant du Planning conserve sa ou ses recettes sources.
- Toucher le nom de l’article ouvre directement la recette s’il n’y en a qu’une.
- S’il y a plusieurs recettes sources, une fenêtre permet de choisir laquelle consulter.
- Le bouton **Modifier** continue d’ouvrir l’édition normale de l’article.
- Les articles ajoutés manuellement, sans recette source, continuent à ouvrir leur édition normale.
- Le retour depuis la recette ramène à Courses.

## Installation
Remplacer sur GitHub :
- `index.html`
- `app-v282.js`
- `version.json`
- `manifest.webmanifest`
- `sw.js`
- `service-worker.js`

Les icônes peuvent rester inchangées. Aucun fichier de données n’est inclus.
