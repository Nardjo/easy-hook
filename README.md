# Éditeur de Vidéo avec Hook

Une application web qui permet d'ajouter une image "hook" au début d'une vidéo en utilisant l'API WebCodecs.

## Fonctionnalités

- Ajout d'une image "hook" au début d'une vidéo pendant 1 seconde
- Traitement vidéo rapide et efficace grâce à l'API WebCodecs
- Interface utilisateur intuitive et réactive
- Métriques de performance détaillées
- Conseils d'optimisation personnalisés
- Support de divers formats d'image et de vidéo

## Prérequis

- Navigateur moderne supportant l'API WebCodecs (Chrome 94+, Edge 94+, Opera 80+)
- Node.js et npm/pnpm pour le développement

## Installation

1. Clonez ce dépôt ou téléchargez le code source
2. Naviguez vers le répertoire du projet
3. Installez les dépendances :

```bash
npm install
# ou
pnpm install
```

4. Lancez le serveur de développement :

```bash
npm run dev
# ou
pnpm dev
```

## Utilisation

1. Ouvrez l'application dans votre navigateur
2. Téléchargez une image pour le "hook"
3. Téléchargez une vidéo à traiter
4. Cliquez sur "Traiter la vidéo"
5. Téléchargez le résultat une fois le traitement terminé

## Fonctionnement

L'application :
1. Prend un fichier vidéo et un fichier image en entrée
2. Utilise l'API WebCodecs pour décoder la vidéo
3. Ajoute l'image comme première frame pendant 1 seconde
4. Encode le tout en une nouvelle vidéo MP4
5. Fournit un fichier téléchargeable

## Développement

Ce projet est structuré comme suit :

- `app/composables/useWebCodecsProcessor.ts` - Implémentation principale utilisant l'API WebCodecs
- `app/composables/useVideoProcessor.ts` - Wrapper simplifié pour l'utilisation dans les composants Vue
- `app/pages/index.vue` - Interface utilisateur principale

## Avantages de WebCodecs API

1. **Performance**: Traitement plus rapide que les solutions basées sur FFmpeg.wasm
2. **Mémoire**: Utilisation réduite de la mémoire
3. **Batterie**: Moins d'impact sur la batterie des appareils mobiles
4. **UX**: Interface plus réactive pendant le traitement
5. **Sécurité**: Pas besoin de CORS spécifiques comme avec FFmpeg.wasm

## Compatibilité

- Chrome 94+
- Edge 94+
- Opera 80+

Codé presque entièrement avec [Junie](https://www.jetbrains.com/fr-fr/junie/) 😁
