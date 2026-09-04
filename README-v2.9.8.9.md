# Herbier Gourmand v2.9.8.9 — Catégories partielles

- Le filtre Catégorie de Recettes fonctionne désormais par correspondance partielle.
- Exemple : filtrer « Salade » affiche « Salade » et « Salade - Plat principal ».
- Planning → Proposer une semaine accepte toute catégorie contenant « Plat principal ».
- Exemples admissibles : « Plat principal », « Salade - Plat principal », « Soupe - Plat principal ».
- « Salade » ou « Soupe » seules ne sont pas considérées comme plats principaux.
- La règle de saison calendaire reste inchangée.
- Les comparaisons sont normalisées (casse et accents neutralisés).
