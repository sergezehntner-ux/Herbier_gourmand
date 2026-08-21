# Herbier Gourmand v2.9.7.9.1 — Recherche flottante globale

Correctif de chargement de v2.9.7.9.

## À remplacer sur GitHub
- index.html
- app-v282.js
- version.json
- sw.js
- service-worker.js

## Changement
Ajoute un bouton flottant **🔍 Rechercher** dans Recettes, Sorties, Producteurs, Plantes & Épices et Fruits & Légumes lorsque la zone de recherche n’est plus visible.

La correction est isolée : elle n’intercepte ni ne remplace `switchView()` ou une autre fonction existante. Aucun fichier de données n’est modifié.
