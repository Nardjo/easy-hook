# Processeur Vidéo – Version Simplifiée

Une application en ligne de commande pour ajouter une image comme première frame à des vidéos verticales, en ajoutant automatiquement la dernière image téléchargée comme première frame.

## Fonctionnalités principales

- Sélection interactive de la vidéo à traiter dans le dossier `/videos`
- L’image utilisée est toujours la plus récente du dossier Téléchargements (`~/Téléchargements` ou `~/Downloads`)
- Conversion automatique HEIC → JPEG si besoin (macOS)
- Génération de vidéo au format `.mp4` (H.264/AAC), compatible Instagram (Reels, Stories, DM)

## Prérequis

- Node.js >= 14
- ffmpeg (installé et accessible dans le PATH)
- sips (macOS, pour la conversion HEIC) ou ImageMagick (optionnel)

## Installation

1. Clone le dépôt et installe les dépendances :

```bash
git clone <repo>
cd easy-hook
npm install
```

2. Crée un dossier `videos` à la racine du projet (il est ignoré par git) et ajoute-y les vidéos que tu veux traiter.

## Utilisation

```bash
pnpm start
# ou
node process_video.js
```

- Un menu interactif te permet de choisir la vidéo à traiter dans `/videos`.
- L’image superposée est automatiquement la plus récente de ton dossier Téléchargements.
- La vidéo générée apparaît dans le même dossier que l’image, sans jamais écraser les anciennes versions.

## Exemples

- Lancer le script :

```bash
pnpm start
```

- La vidéo traitée sera nommée automatiquement (`processed_DM.mp4`, `processed_DM_1.mp4`, etc.)

## Développement

- Toute la logique est dans `process_video.js`.
- Pour modifier le format de sortie (vertical, carré…), change simplement les constantes `VIDEO_WIDTH` et `VIDEO_HEIGHT` dans le script.
