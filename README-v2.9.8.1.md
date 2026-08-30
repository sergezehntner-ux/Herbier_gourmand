# Herbier Gourmand v2.9.8.1 — Photos Paprika

Ajoute un mode sûr à l’import Paprika : « Ajouter uniquement les photos aux recettes existantes ».

- correspondance prioritaire par UID Paprika, sinon titre normalisé exact ;
- ne modifie aucun autre champ des recettes ;
- n’écrase pas les photos déjà présentes ;
- signale recettes introuvables, ambiguës ou sans photo ;
- stocke les photos Paprika dans IndexedDB et elles sont ensuite incluses dans les sauvegardes .hgbak.
