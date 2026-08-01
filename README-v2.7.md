# Herbier Gourmand v2.7

## Nouveautés
- Rubrique **Producteurs locaux** avec 36 adresses importées depuis le classeur fourni.
- Recettes et restaurants triés alphabétiquement (tri français, accents compris).
- Tag automatique `Import du JJ.MM.AAAA` pour chaque nouvelle importation de recettes.
- Mode lecture seule via `?readonly=1`, avec chargement automatique de `herbier-latest.hgbak`.
- Indicateur de modifications non sauvegardées.
- Avertissement du navigateur en cas de fermeture avec travail non sauvegardé.
- Sauvegarde directe sur GitHub via l’API, avec mise à jour de `herbier-latest.hgbak` et création d’une archive datée.
- Le jeton GitHub est conservé uniquement dans la session du navigateur et n’est pas inclus dans les sauvegardes.

## Mise en route GitHub
1. Ouvrir **Configurer** dans la page d’accueil.
2. Indiquer le propriétaire, le dépôt, la branche et un jeton finement limité au dépôt.
3. Cliquer **Sauvegarder sur GitHub**.
4. Partager l’adresse de l’application avec `?readonly=1` à la fin.

## Sécurité
Avant l’installation, conserver le ZIP précédent et un export `.hgbak`.
