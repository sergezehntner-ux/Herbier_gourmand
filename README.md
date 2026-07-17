# Herbier Gourmand — v2.3 Mise à jour automatique

## Nouveautés
- Vérification automatique de `version.json` à chaque ouverture
- Téléchargement forcé de la dernière version si le numéro change
- Suppression automatique des anciens caches lors d’une mise à jour
- Service worker activé immédiatement avec suppression des caches obsolètes
- Bouton **Actualiser** pour forcer manuellement une mise à jour
- Conservation du fonctionnement hors connexion

## Important
Le cache n’est pas supprimé à chaque ouverture normale. Il est supprimé uniquement lorsqu’une nouvelle version est détectée ou lorsque le bouton **Actualiser** est utilisé. Cela permet de rester rapide et de fonctionner hors connexion.

## Publication sur GitHub Pages
1. Décompresser le ZIP.
2. Remplacer tous les fichiers du dépôt par ceux-ci.
3. Vérifier que `version.json` est bien à la racine, à côté de `index.html`.
4. Attendre la fin du déploiement GitHub Pages.
5. Ouvrir l’application. Elle affichera **À jour · v2.3.0**.

## Pour les futures versions
À chaque nouvelle publication, modifier dans les fichiers :
- la valeur `version` de `version.json`;
- la constante `APP_VERSION` dans `app.js`;
- le nom du cache dans `sw.js`.

Ces trois numéros doivent correspondre.
