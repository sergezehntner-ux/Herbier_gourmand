# Herbier Gourmand v2.9.5.2 — Sauvegarde & transfert

## Fichiers à remplacer sur GitHub

- `index.html`
- `app-v282.js`
- `styles-v282.css`
- `version.json`
- `sw.js`
- `service-worker.js`

Aucun fichier de données (`recipes.json`, `producers.json`, etc.) ne doit être remplacé par ce paquet.

## Changements

- Interface **Sauvegarde et transfert** harmonisée avec *Ma Santé*.
- Dossier conseillé : **OneDrive → Apps → Herbier Gourmand → Sauvegardes**.
- Boutons : **Exporter une sauvegarde**, **Importer une sauvegarde**, **Importer historique Paprika**.
- Sauvegardes nommées `Herbier-Gourmand_YYYY-MM-DD_HH-MM.hgbak`.
- Sur Notebook : tentative d’ouverture de **Enregistrer sous…** via le sélecteur système.
- Sur Smartphone / navigateur non compatible : téléchargement classique dans **Téléchargements**.
- Import possible depuis OneDrive via le sélecteur de fichiers de l’appareil.
- Bandeau vert : **Dernière action : Export/Import <nom du fichier>** (mémorisée localement par appareil).
- Le contenu et le format fonctionnel `.hgbak` restent inchangés.
- Avant un import, un point de restauration local de sécurité est conservé.

## Test conseillé

1. Notebook → Exporter → choisir OneDrive/Apps/Herbier Gourmand/Sauvegardes.
2. Smartphone → Importer ce même fichier depuis OneDrive.
3. Smartphone → Exporter (le fichier arrive dans Téléchargements), puis le déplacer manuellement dans OneDrive.
4. Notebook → Importer le fichier depuis OneDrive.
5. Vérifier la ligne **Dernière action** sur chacun des deux appareils.
