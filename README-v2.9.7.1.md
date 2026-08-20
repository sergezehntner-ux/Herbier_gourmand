# Herbier Gourmand v2.9.7.1 — Compléments & démarrage sécurisé

Cette version part de la v2.9.7 et ne touche pas aux fichiers JSON de données.

## Modifications

- Conserve et stabilise le **Choix de compléments** introduit en v2.9.7 : recettes liées + compléments libres.
- Ajoute un **démarrage sécurisé** : l’interface reste couverte par « Chargement de vos données… » jusqu’à la fin du chargement des recettes, planning, courses, sorties, producteurs, plantes, épices, fruits et légumes.
- Pendant ce chargement, aucune manipulation n’est possible.
- En cas d’échec réel, un message apparaît avec un bouton **Réessayer** ; aucune donnée n’est supprimée.
- Cache PWA et numéro de version mis à jour en v2.9.7.1.

## Fichiers à remplacer sur GitHub

- index.html
- app-v282.js
- version.json
- manifest.webmanifest
- sw.js
- service-worker.js

Les fichiers CSS, JSON de données et icônes restent inchangés.
