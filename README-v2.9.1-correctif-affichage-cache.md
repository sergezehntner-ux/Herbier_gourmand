# Herbier Gourmand v2.9.1 — correctif affichage et cache

Ce paquet ne remplace pas les 193 producteurs déjà installés. Il met à jour :

- le numéro visible dans l'en-tête ;
- la version interne utilisée dans les sauvegardes ;
- `version.json` et l'indicateur « À jour » ;
- le cache PWA afin de forcer le chargement de la nouvelle version.

## Fichiers à remplacer sur GitHub

Remplacer à la racine du dépôt :

- `index.html`
- `app-v282.js`
- `version.json`
- `sw.js`
- `service-worker.js`

Ne pas supprimer ni remplacer votre `producers.json` actuel s'il contient déjà les 193 producteurs.

## Après la mise à jour GitHub

1. Attendre une à deux minutes que GitHub Pages publie les changements.
2. Ouvrir Herbier Gourmand et actualiser la page.
3. Si l'ancien titre reste affiché, fermer complètement l'application, la rouvrir, puis actualiser une seconde fois.
4. En dernier recours, désinstaller puis réinstaller la PWA : les données locales doivent auparavant être sauvegardées dans un fichier `.hgbak`.

L'en-tête doit ensuite afficher : `v2.9.1 · Producteurs consolidés`.
