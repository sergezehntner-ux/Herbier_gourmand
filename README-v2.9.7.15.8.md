# Herbier Gourmand v2.9.7.15.8 — Retour Planning & Courses

Correctifs terrain ciblés :

- Après un transfert Planning → Courses, le simple retour au Planning ne demande plus une sauvegarde `.hgbak`.
- Un bouton **← Retour au planning** apparaît dans Courses après un transfert.
- Le retour restaure la semaine et la position de départ dans le Planning.
- Si Courses est réellement modifié ensuite, la protection de sortie reste active.
- Le regroupement des ingrédients est renforcé : apostrophes typographiques, espaces et ponctuation ne créent plus de doublons artificiels (ex. `huile d’olive` / `huile d'olive`).
- Les doublons existants de même ingrédient + même unité sont consolidés au chargement.

Aucun fichier de données n’est remplacé.
