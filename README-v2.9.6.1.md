# Herbier Gourmand v2.9.6.1 — correctif listes & icône PWA

Remplacer sur GitHub :
- index.html
- app-v282.js
- styles-v282.css
- manifest.webmanifest
- version.json
- sw.js
- service-worker.js

Ajouter sur GitHub :
- icon-hg-2961-192.png
- icon-hg-2961-512.png

Les anciens fichiers icon-192.png / icon-512.png peuvent rester : ils ne sont plus utilisés par le manifest v2.9.6.1.

## Ce qui change
- Les listes déroulantes visibles utilisent désormais un composant Herbier Gourmand compact, sans lignes séparatrices.
- Les options textuelles sont triées alphabétiquement à l'ouverture. Les listes où l'ordre est logique (durées, portions, température, Matin/Midi/Soir) conservent volontairement leur ordre.
- L'icône PWA utilise de nouveaux noms de fichiers afin d'éviter que l'ancien pictogramme reste servi par le cache.

## Important pour l'icône déjà installée sur Smartphone
Android/Edge peut conserver l'icône d'une PWA déjà installée même après une mise à jour du manifest. Après publication de v2.9.6.1 :
1. ouvrir Herbier Gourmand et vérifier que v2.9.6.1 est affichée ;
2. supprimer une seule fois l'ancien raccourci/application Herbier Gourmand de l'écran d'accueil ;
3. rouvrir le site dans Edge et utiliser « Installer ».

Cette opération ne supprime pas les données stockées dans le navigateur tant que les données du site ne sont pas effacées. Une sauvegarde .hgbak reste néanmoins recommandée avant toute manipulation d'installation.
