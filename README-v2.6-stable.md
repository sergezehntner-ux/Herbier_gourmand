# Herbier Gourmand v2.6 stable

## Version de référence
- Toutes les fonctions de la v2.5.1d sont conservées : affichage compact, retour à la position précédente et planning modifiable (ajout, remplacement, déplacement et retrait d’une recette).
- Rubrique **Envie d’une sortie ?** avec 160 restaurants, recherche croisée, fiches détaillées et édition complète.
- Restaurants inclus dans les sauvegardes `.hgbak`.
- Export/import complet entre appareils.
- Avant chaque import, création automatique d’un point de restauration local et téléchargement d’une sauvegarde `avant-import`.
- Affichage de la date de la dernière sauvegarde et du nombre de modifications effectuées depuis.
- Rappel de ranger les sauvegardes dans `OneDrive/Herbier Gourmand/Sauvegardes`.

## Installation
1. Créer une sauvegarde `.hgbak` de la version actuelle.
2. Remplacer les fichiers du dépôt GitHub par ceux de cette archive.
3. Attendre le déploiement GitHub Pages.
4. Actualiser l’application une fois.
5. Vérifier recettes, planning, courses, sorties et export/import.

## Limite connue
Une application web ne peut pas écrire silencieusement dans OneDrive sans connexion/API dédiée. Le fichier téléchargé doit donc encore être déplacé dans le dossier OneDrive choisi.
