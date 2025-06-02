# Processeur Vidéo

Une application en ligne de commande qui permet de traiter des vidéos en ajoutant une image comme première image.

## Fonctionnalités

- Support du format d'image HEIC (conversion automatique en JPEG)
- Détection automatique du répertoire de sortie (même chemin que l'image)
- Utilisation de chemins par défaut configurables
- Possibilité d'utiliser un répertoire d'images (sélection automatique de l'image la plus récente)
- Support de la variable $HOME dans les chemins
- Interface en ligne de commande simple

## Prérequis

- Node.js et npm
- ffmpeg (pour le traitement vidéo)
- Sur macOS : sips ou ImageMagick (pour la conversion HEIC)

## Installation

1. Clonez ce dépôt ou téléchargez le code source
2. Naviguez vers le répertoire du projet
3. Installez les dépendances :

```bash
npm install
```

4. Rendez le script disponible globalement (optionnel) :

```bash
npm link
```

## Utilisation

Exécutez l'application avec les arguments (optionnels) :

```bash
process_video.js [fichier-video] [fichier-image]
```

Par exemple :

```bash
process_video.js video.mp4 image.jpg
```

Ou si vous ne l'avez pas installé globalement :

```bash
npm start -- video.mp4 image.jpg
```

### Arguments

- `fichier-video` : Chemin vers le fichier vidéo (optionnel, utilise la valeur de config.js par défaut)
- `fichier-image` : Chemin vers le fichier image ou répertoire (optionnel, utilise la valeur de config.js par défaut)
  - Si un répertoire est spécifié, le fichier image le plus récent sera utilisé
  - Formats supportés : jpg, jpeg, png, heic, gif, bmp, tiff, webp

### Exemples d'utilisation

```bash
process_video.js                     # Utilise les chemins définis dans config.js
process_video.js video.mp4           # Utilise le chemin vidéo spécifié et le chemin image de config.js
process_video.js video.mp4 image.jpg # Utilise les chemins spécifiés
process_video.js video.mp4 ~/Images  # Utilise le fichier image le plus récent du répertoire ~/Images
```

### Aide

Pour voir les informations d'utilisation :

```bash
process_video.js --help
```

## Fonctionnement

L'application :
1. Prend un fichier vidéo et un fichier image en entrée
2. Convertit les images HEIC en JPEG si nécessaire
3. Ajoute l'image comme première image de la vidéo
4. Enregistre la vidéo traitée dans le même répertoire que l'image

L'application utilise :
- ffmpeg pour le traitement vidéo
- sips ou ImageMagick pour la conversion HEIC (sur macOS)

## Développement

Ce projet est structuré comme suit :

- `process_video.js` - Interface en ligne de commande et logique de traitement vidéo
- `config.js` - Variables de configuration pour les chemins de fichiers

Pour modifier l'application :
1. Effectuez vos modifications dans le code source
2. Testez avec `npm start -- [arguments]`

Pour personnaliser le comportement de l'application :
1. Modifiez les variables dans `config.js` pour changer les chemins par défaut
2. Aucune recompilation n'est nécessaire - les changements prennent effet immédiatement

## Structure des fichiers expliquée

- **process_video.js** : C'est le fichier principal que vous devez exécuter directement. Il s'agit de l'interface en ligne de commande qui accepte vos arguments d'entrée (fichier vidéo, fichier image) et affiche les résultats. Il contient également toute la logique de traitement vidéo.

- **config.js** : Ce fichier contient les chemins configurables utilisés par l'application. Vous n'exécutez pas ce fichier directement, mais vous pouvez le modifier pour personnaliser les chemins par défaut de l'application sans changer la logique principale.

Variables configurables dans config.js :
- `videoPath` : Chemin par défaut vers le fichier vidéo (utilisé si aucun argument n'est fourni)
- `imagePath` : Chemin par défaut vers le fichier image (utilisé si aucun argument n'est fourni)

Ces chemins peuvent contenir la variable `$HOME` qui sera remplacée par le répertoire personnel de l'utilisateur.

Codé presque entièrement avec [Junie](https://www.jetbrains.com/fr-fr/junie/) 😁
