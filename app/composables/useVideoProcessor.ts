import { ref, reactive } from 'vue';
import useWebCodecsProcessor from './useWebCodecsProcessor';

// Status messages
const MESSAGES = {
  PROCESSING_VIDEO: 'Traitement de la vidéo...',
  PROCESSING_COMPLETE: 'Traitement terminé avec succès!',
  WEBCODECS_NOT_SUPPORTED: 'WebCodecs API n\'est pas supporté par votre navigateur.',
  WEBCODECS_PROCESSING: 'Traitement avec WebCodecs API...'
};

/**
 * Composable for video processing with WebCodecs API
 */
export default function useVideoProcessor() {
  // State
  const isLoaded = ref(true); // Always true since we only use WebCodecs now
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Get WebCodecs processor
  const {
    isSupported: isWebCodecsSupported,
    processVideo: processVideoWithWebCodecs,
    performanceMetrics: webCodecsMetrics,
    getOptimizationTips: getWebCodecsTips
  } = useWebCodecsProcessor();

  // Performance metrics (will be populated during processing)
  const performanceMetrics = reactive({
    processingDuration: 0,
    inputSize: 0,
    outputSize: 0,
    compressionRatio: 0,
    processingSpeed: 0
  });

  /**
   * Main process video function
   */
  const processVideo = async (
    videoFile: File,
    imageFile: File,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<Blob> => {
    const startTime = performance.now();

    const updateProgress = (progress: number, message: string) => {
      if (progressCallback) {
        progressCallback(progress, message);
      }
    };

    try {
      // Check if WebCodecs is supported
      if (!isWebCodecsSupported.value) {
        updateProgress(0, MESSAGES.WEBCODECS_NOT_SUPPORTED);
        throw new Error(MESSAGES.WEBCODECS_NOT_SUPPORTED);
      }

      updateProgress(5, MESSAGES.WEBCODECS_PROCESSING);

      const result = await processVideoWithWebCodecs(
        videoFile,
        imageFile,
        progressCallback,
        {
          width: 720,
          height: 1280,
          frameDuration: 1, // 1 second for the hook
          fps: 30
        }
      );

      // Copy performance metrics
      Object.assign(performanceMetrics, {
        processingDuration: webCodecsMetrics.processingDuration,
        inputSize: webCodecsMetrics.inputSize,
        outputSize: webCodecsMetrics.outputSize,
        compressionRatio: webCodecsMetrics.compressionRatio,
        processingSpeed: webCodecsMetrics.processingSpeed
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      throw err;
    }
  };

  /**
   * Get optimization tips based on performance metrics
   */
  const getOptimizationTips = (): string[] => {
    return getWebCodecsTips();
  };

  return {
    isLoaded,
    isLoading,
    error,
    performanceMetrics,
    processVideo,
    getOptimizationTips,
    MESSAGES
  };
}
