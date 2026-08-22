# Herbier Gourmand v2.9.7.13 — Sortie sécurisée Planning & Courses

À remplacer sur GitHub :
- index.html
- app-v282.js
- version.json
- manifest.webmanifest
- sw.js
- service-worker.js

## Nouveauté
Lorsque des modifications ont été faites pendant une session dans Planning ou Courses et qu’aucune sauvegarde `.hgbak` n’a encore été exportée, quitter vers une autre rubrique affiche trois choix :
- **Sauvegarder et sortir** : lance l’export `.hgbak`, puis quitte si l’export réussit.
- **Sortir sans sauvegarder** : quitte sans export ; les données restent enregistrées localement sur l’appareil et l’indicateur global « Modifications non sauvegardées » reste actif.
- **Continuer** : reste dans la rubrique.

Le comportement de protection du navigateur lors d’un rafraîchissement reste inchangé.

Aucun fichier de données n’est remplacé.
