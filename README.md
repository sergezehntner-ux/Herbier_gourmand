# Herbier Gourmand v2.7.1 — Mission Terrain

## Mission de cette version
Redonner le contrôle à l'utilisateur et rendre visible la différence apportée par ses propres recettes Paprika.

## Nouveautés
- Planning assisté : une proposition initiale, puis choix libre repas par repas.
- Bouton **Changer la recette** ouvrant la banque de recettes, avec **Reprendre au planning**.
- Écran dédié pour lire une recette et impression séparée.
- La liste de courses est invalidée lorsqu'un changement la rend obsolète.
- Import expérimental avancé de `.paprikarecipes`, `.paprikarecipe`, JSON et HTML.
- Aperçu avant import, détection des doublons et remplacement facultatif.
- Formulaire recette avec séparateur `nom / quantité / unité`.

## Import Paprika
Dans Paprika, exporter les recettes au format Paprika, puis dans Herbier Gourmand ouvrir **Recettes > Importer Paprika**. Le traitement reste local dans le navigateur.

## Publication GitHub Pages
Remplacer les fichiers du dépôt par le contenu de ce dossier. Les numéros de version de `app.js`, `version.json` et `sw.js` correspondent à 2.7.1.


## v2.5.1 corrigée
Cette livraison doit remplacer les fichiers du dépôt après sauvegarde. Elle est basée directement sur le ZIP GitHub du 20 juillet 2026. Après déploiement, ouvrir l’application et forcer une actualisation si l’ancienne interface reste en cache.


## v2.5.1a — stabilisation
- Les articles cochés restent à leur place; suppression uniquement via confirmation.
- Présentation compacte, une ligne par ingrédient sous le rayon.
- Menus Magasin et Rayon fonctionnels, avec option « Autre… ».
- Associations ingrédient → magasin/rayon conservées et modifiables.
- Bouton Vider maintenu.
- Planning Matin, Midi et Soir.
- Fiche recette complète sur écran dédié et bouton Modifier conservé.
- Accueil rétabli en plein écran.
