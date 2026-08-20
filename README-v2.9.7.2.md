# Herbier Gourmand v2.9.7.2 — Utiliser des restes & liens Courses

À remplacer sur GitHub : index.html, app-v282.js, version.json, manifest.webmanifest, sw.js, service-worker.js.

Nouveautés :
- « Utiliser des restes » : une idée par ligne dans la recette.
- Depuis la fiche recette, planification d’un reste à une date ultérieure et à un repas.
- Si une recette est déjà planifiée : choix entre remplacement et complément.
- Le planning conserve la provenance (recette et date de cuisson).
- Possibilité de retirer une utilisation de restes planifiée.
- Le lien Courses → recette(s) source(s), introduit en v2.9.7, est conservé.
- Aucun fichier de données JSON n’est remplacé. Les nouvelles données sont stockées sous une clé hg-* et entrent donc dans le .hgbak.
