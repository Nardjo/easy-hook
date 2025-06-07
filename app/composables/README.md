# Video Processing with WebCodecs API

Ce dossier contient les composables pour le traitement vidéo utilisant l'API WebCodecs.

## Composables

### `useWebCodecsProcessor`

Implémentation principale utilisant l'API WebCodecs pour:
- Décoder une vidéo
- Ajouter une image "hook" au début pendant 1 seconde (30 frames à 30fps)
- Encoder le tout en MP4
- Gérer l'audio (si présent)

```typescript
const {
  isSupported,
  processVideo,
  performanceMetrics,
  getOptimizationTips
} = useWebCodecsProcessor();
```

### `useVideoProcessor`

Composable wrapper qui:
- Utilise WebCodecs API
- Fournit des métriques de performance
- Gère les erreurs

```typescript
const {
  isLoaded,
  isLoading,
  processVideo,
  performanceMetrics,
  getOptimizationTips
} = useVideoProcessor();
```

## Utilisation

```vue
<script setup>
import { ref } from 'vue';
import useVideoProcessor from '~/composables/useVideoProcessor';

// Initialiser le processeur vidéo
const {
  processVideo,
  performanceMetrics,
  getOptimizationTips
} = useVideoProcessor();

// État
const isProcessing = ref(false);
const progress = ref(0);
const statusMessage = ref('');

// Fonction de traitement
const handleProcessVideo = async (videoFile, imageFile) => {
  if (!videoFile || !imageFile) return;

  isProcessing.value = true;

  try {
    // Traiter la vidéo
    const blob = await processVideo(
      videoFile,
      imageFile,
      (value, message) => {
        progress.value = value;
        statusMessage.value = message;
      }
    );

    // Télécharger le résultat
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_video_${Date.now()}.mp4`;
    link.click();
    URL.revokeObjectURL(url);

    // Afficher les métriques
    console.log('Performance:', performanceMetrics);
    console.log('Tips:', getOptimizationTips());
  } catch (error) {
    console.error('Error processing video:', error);
    statusMessage.value = `Erreur: ${error.message}`;
  } finally {
    isProcessing.value = false;
  }
};
</script>
```

## Avantages de WebCodecs API

1. **Performance**: Traitement rapide et efficace
2. **Mémoire**: Utilisation optimisée de la mémoire
3. **Batterie**: Faible impact sur la batterie des appareils mobiles
4. **UX**: Interface réactive pendant le traitement
5. **Sécurité**: Utilisation des API web standards

## Limitations

1. **Support navigateur**: WebCodecs API n'est supporté que sur Chrome/Edge récents
2. **Codecs**: Support limité des codecs selon le navigateur
3. **Muxing**: Le muxing audio/vidéo est simplifié dans cette implémentation

## Compatibilité

- Chrome 94+
- Edge 94+
- Opera 80+
