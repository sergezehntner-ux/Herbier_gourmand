# Herbier Gourmand v2.9.2 — Correctifs terrain

## Fichiers à remplacer sur GitHub

- `index.html`
- `app-v282.js`
- `version.json`
- `sw.js`
- `service-worker.js`

Ne remplacez pas `producers.json` : la base actuelle de 193 producteurs reste inchangée.

## Corrections intégrées

1. Retour contextuel : après avoir ouvert une recette, une plante ou un producteur depuis une fiche Fruits & Légumes, le bouton Retour ramène à la fiche d’origine et à sa position précédente.
2. Bouton « À préparer la veille » pour chaque recette planifiée. Un rappel apparaît dans le planning du jour précédent, y compris lorsqu’il se trouve dans la semaine précédente.
3. Toute modification d’une recette actualise immédiatement les recettes déjà présentes dans le planning.
4. Dans les fiches détaillées des restaurants et producteurs, le code postal précède la localité sur une seule ligne.
5. Filtres producteurs adaptés aux catégories multiples, produits, modes de vente et labels de la base v2.9.1.

## Après publication

Attendre la fin du déploiement GitHub Pages, puis fermer et rouvrir l’application. Si l’ancienne version reste affichée, actualiser la page deux fois ou supprimer le cache de la PWA avant de la rouvrir.
