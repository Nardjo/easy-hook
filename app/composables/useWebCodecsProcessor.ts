import { ref, reactive } from 'vue';
// Import heic2any dynamically to avoid SSR issues
import MP4Box from 'mp4box';

// Extended HTMLVideoElement interface to support non-standard properties
interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: {length: number};
}

// Types
interface ProcessingOptions {
  width: number;
  height: number;
  frameDuration: number; // in seconds
  fps?: number;
}

interface PerformanceMetrics {
  processingDuration: number;
  inputSize: number;
  outputSize: number;
  compressionRatio: number;
  processingSpeed: number;
}

// Constants
const DEFAULT_OPTIONS: ProcessingOptions = {
  width: 720,
  height: 1280,
  frameDuration: 1, // 1 second for the hook image (changed from 0.033)
  fps: 30
};

// Status messages
const MESSAGES = {
  CHECKING_SUPPORT: 'Vérification de la compatibilité WebCodecs...',
  NOT_SUPPORTED: 'WebCodecs API n\'est pas supporté par votre navigateur.',
  DECODING_VIDEO: 'Décodage de la vidéo...',
  PROCESSING_FRAMES: 'Traitement des images...',
  ENCODING_VIDEO: 'Encodage de la vidéo...',
  PROCESSING_COMPLETE: 'Traitement terminé avec succès!',
  ERROR_PROCESSING: 'Erreur lors du traitement: ',
  PREPARING_AUDIO: 'Préparation de l\'audio...',
  MUXING_STREAMS: 'Combinaison des flux audio et vidéo...'
};

/**
 * Composable for video processing using WebCodecs API
 */
export default function useWebCodecsProcessor() {
  // State
  const isSupported = ref(false);
  const isProcessing = ref(false);
  const error = ref<string | null>(null);
  const performanceMetrics = reactive<PerformanceMetrics>({
    processingDuration: 0,
    inputSize: 0,
    outputSize: 0,
    compressionRatio: 0,
    processingSpeed: 0
  });

  // Check if WebCodecs is supported
  const checkSupport = () => {
    isSupported.value = typeof window !== 'undefined' &&
      'VideoEncoder' in window &&
      'VideoDecoder' in window &&
      'EncodedVideoChunk' in window;
    return isSupported.value;
  };

  /**
   * Detect if a file is in HEIC/HEIF format
   * @param file - The file to check
   * @returns boolean indicating if the file is HEIC/HEIF
   */
  const isHeicFormat = (file: File): boolean => {
    return file.name.toLowerCase().endsWith('.heic') || 
           file.name.toLowerCase().endsWith('.heif') || 
           file.type.toLowerCase().includes('heic') || 
           file.type.toLowerCase().includes('heif');
  };

  /**
   * Convert HEIC/HEIF image to JPEG
   * @param file - The HEIC/HEIF file to convert
   * @returns Promise with the converted JPEG File
   */
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    const errors: string[] = [];

    // Start conversion timer
    const startTime = performance.now();
    console.log(`Conversion HEIC → JPEG: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    // Method 1: Try libheif-js (more robust)
    try {
      console.log('Méthode 1: Tentative de conversion avec libheif-js...');

      // Dynamically import libheif-js to avoid SSR issues
      const libheif = await import('libheif-js');

      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Decode the HEIC image
      console.log('Décodage de l\'image HEIC avec libheif-js...');
      const decoder = new libheif.HeifDecoder();
      const data = new Uint8Array(arrayBuffer);
      const decodedImages = decoder.decode(data);

      if (!decodedImages || decodedImages.length === 0) {
        throw new Error('Aucune image trouvée dans le fichier HEIC');
      }

      // Get the primary image
      const image = decodedImages[0];
      console.log(`Image décodée: ${image.get_width()}x${image.get_height()}`);

      // Create a canvas to render the image
      const canvas = document.createElement('canvas');
      canvas.width = image.get_width();
      canvas.height = image.get_height();
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Impossible de créer le contexte canvas');
      }

      // Créer un ImageData vide
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      // Utiliser image.display pour remplir l'ImageData
      await new Promise<void>((resolve, reject) => {
        image.display(imageData, (displayData: any) => {
          if (!displayData) {
            reject(new Error('Erreur lors de l\'affichage de l\'image HEIC'));
            return;
          }
          resolve();
        });
      });

      // Mettre l'image sur le canvas
      ctx.putImageData(imageData, 0, 0);

      // Convert canvas to JPEG Blob
      console.log('Conversion du canvas en JPEG...');
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Échec de la conversion canvas en Blob'));
          },
          'image/jpeg',
          0.9
        );
      });

      // Create a new filename by replacing the extension
      const newFilename = file.name.replace(/\.(heic|heif)$/i, '.jpg');

      // Create a new File object from the converted Blob
      const jpegFile = new File([jpegBlob], newFilename, { type: 'image/jpeg' });

      // Calculate conversion time and log details
      const endTime = performance.now();
      const conversionTime = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`✅ Conversion réussie avec libheif-js: ${file.name} → ${newFilename}`);
      console.log(`Taille: ${(file.size / 1024).toFixed(2)} KB → ${(jpegFile.size / 1024).toFixed(2)} KB`);
      console.log(`Ratio: ${(jpegFile.size / file.size * 100).toFixed(1)}%, Durée: ${conversionTime}s`);

      return jpegFile;
    } catch (libheifError) {
      // Format and store the libheif-js error
      let libheifErrorMessage = 'Erreur inconnue avec libheif-js';
      if (libheifError instanceof Error) {
        libheifErrorMessage = libheifError.message;
      } else if (typeof libheifError === 'string') {
        libheifErrorMessage = libheifError;
      } else if (libheifError && typeof libheifError === 'object') {
        try {
          libheifErrorMessage = JSON.stringify(libheifError);
        } catch (e) {
          libheifErrorMessage = 'Erreur non sérialisable avec libheif-js';
        }
      }

      console.error(`❌ Échec de la conversion avec libheif-js: ${libheifErrorMessage}`);
      errors.push(`Méthode libheif-js: ${libheifErrorMessage}`);

      // Method 2: Try heic2any (fallback)
      try {
        console.log('Méthode 2: Tentative de conversion avec heic2any...');

        // Dynamically import heic2any to avoid SSR issues
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;

        // Convert HEIC to JPEG Blob with 90% quality
        const jpegBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        }) as Blob;

        // Create a new filename by replacing the extension
        const newFilename = file.name.replace(/\.(heic|heif)$/i, '.jpg');

        // Create a new File object from the converted Blob
        const jpegFile = new File([jpegBlob], newFilename, { type: 'image/jpeg' });

        // Calculate conversion time and log details
        const endTime = performance.now();
        const conversionTime = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`✅ Conversion réussie avec heic2any: ${file.name} → ${newFilename}`);
        console.log(`Taille: ${(file.size / 1024).toFixed(2)} KB → ${(jpegFile.size / 1024).toFixed(2)} KB`);
        console.log(`Ratio: ${(jpegFile.size / file.size * 100).toFixed(1)}%, Durée: ${conversionTime}s`);

        return jpegFile;
      } catch (heic2anyError) {
        // Format and store the heic2any error
        let heic2anyErrorMessage = 'Erreur inconnue avec heic2any';
        if (heic2anyError instanceof Error) {
          heic2anyErrorMessage = heic2anyError.message;
        } else if (typeof heic2anyError === 'string') {
          heic2anyErrorMessage = heic2anyError;
        } else if (heic2anyError && typeof heic2anyError === 'object') {
          try {
            heic2anyErrorMessage = JSON.stringify(heic2anyError);
          } catch (e) {
            heic2anyErrorMessage = 'Erreur non sérialisable avec heic2any';
          }
        }

        console.error(`❌ Échec de la conversion avec heic2any: ${heic2anyErrorMessage}`);
        errors.push(`Méthode heic2any: ${heic2anyErrorMessage}`);

        // All methods failed, throw a comprehensive error
        const errorMessage = `Impossible de convertir l'image HEIC. Toutes les méthodes ont échoué:\n${errors.join('\n')}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
  };

  /**
   * Load an image file and return an ImageBitmap
   * @param file - The image file
   * @returns Promise with the ImageBitmap
   */
  const loadImage = async (file: File): Promise<ImageBitmap> => {
    try {
      console.log(`Chargement de l'image: ${file.name} (${file.type})`);

      // Check if the file is in HEIC/HEIF format
      if (isHeicFormat(file)) {
        console.log(`Format HEIC/HEIF détecté, conversion automatique en cours...`);

        try {
          // First attempt: Convert HEIC to JPEG using heic2any
          const jpegFile = await convertHeicToJpeg(file);

          // Load the converted JPEG file
          const imageBitmap = await createImageBitmap(jpegFile);
          console.log(`Image HEIC convertie et chargée avec succès: ${imageBitmap.width}x${imageBitmap.height}`);
          return imageBitmap;
        } catch (conversionError) {
          console.error('Échec de la conversion HEIC avec heic2any, tentative de chargement direct...', conversionError);

          // Format the conversion error for logging
          let errorMessage = 'Erreur inconnue';
          if (conversionError instanceof Error) {
            errorMessage = conversionError.message;
          } else if (typeof conversionError === 'string') {
            errorMessage = conversionError;
          } else if (conversionError && typeof conversionError === 'object') {
            try {
              errorMessage = JSON.stringify(conversionError);
            } catch (e) {
              errorMessage = 'Erreur non sérialisable';
            }
          }

          // Second attempt: Try to use native browser support for HEIC
          try {
            console.log('Tentative de chargement direct de l\'image HEIC avec le support natif du navigateur...');
            console.log(`Détails du fichier: nom=${file.name}, type=${file.type}, taille=${(file.size / 1024).toFixed(2)} KB`);
            const imageBitmap = await createImageBitmap(file);
            console.log(`Image HEIC chargée directement avec succès: ${imageBitmap.width}x${imageBitmap.height}`);
            return imageBitmap;
          } catch (nativeError) {
            console.error('Échec du chargement direct de l\'image HEIC:', nativeError);
            // Format the native error for better debugging
            let nativeErrorMessage = 'Erreur inconnue';
            if (nativeError instanceof Error) {
              nativeErrorMessage = nativeError.message;
            } else if (typeof nativeError === 'string') {
              nativeErrorMessage = nativeError;
            } else if (nativeError && typeof nativeError === 'object') {
              try {
                nativeErrorMessage = JSON.stringify(nativeError);
              } catch (e) {
                nativeErrorMessage = 'Erreur non sérialisable';
              }
            }
            console.log(`Détail de l'erreur native: ${nativeErrorMessage}`);

            // Third attempt: Try to use a data URL approach
            try {
              console.log('Tentative de chargement via Data URL...');
              return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                  try {
                    console.log('Fichier lu en Data URL, création de l\'élément Image...');
                    const img = new Image();
                    img.onload = async () => {
                      console.log(`Image chargée via Data URL: ${img.width}x${img.height}`);
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) {
                        const ctxError = new Error('Impossible de créer le contexte canvas');
                        console.error('Erreur de contexte canvas:', ctxError);
                        reject(ctxError);
                        return;
                      }
                      console.log('Dessin de l\'image sur le canvas...');
                      ctx.drawImage(img, 0, 0);
                      try {
                        console.log('Création de l\'ImageBitmap à partir du canvas...');
                        const bitmap = await createImageBitmap(canvas);
                        console.log(`Image HEIC chargée via Data URL avec succès: ${bitmap.width}x${bitmap.height}`);
                        resolve(bitmap);
                      } catch (bitmapError) {
                        console.error('Échec de création de l\'ImageBitmap:', bitmapError);
                        // Format the bitmap error for better debugging
                        let bitmapErrorMessage = 'Erreur inconnue';
                        if (bitmapError instanceof Error) {
                          bitmapErrorMessage = bitmapError.message;
                        } else if (typeof bitmapError === 'string') {
                          bitmapErrorMessage = bitmapError;
                        } else if (bitmapError && typeof bitmapError === 'object') {
                          try {
                            bitmapErrorMessage = JSON.stringify(bitmapError);
                          } catch (e) {
                            bitmapErrorMessage = 'Erreur non sérialisable';
                          }
                        }
                        console.log(`Détail de l'erreur de bitmap: ${bitmapErrorMessage}`);
                        reject(bitmapError);
                      }
                    };
                    img.onerror = (imgLoadError) => {
                      console.error('Échec du chargement de l\'image via Data URL:', imgLoadError);
                      reject(new Error('Échec du chargement de l\'image via Data URL'));
                    };
                    console.log('Définition de la source de l\'image...');
                    img.src = e.target?.result as string;
                  } catch (imgError) {
                    console.error('Erreur lors de la création de l\'image:', imgError);
                    reject(imgError);
                  }
                };
                reader.onerror = (readerError) => {
                  console.error('Échec de la lecture du fichier:', readerError);
                  reject(new Error('Échec de la lecture du fichier'));
                };
                console.log('Lecture du fichier en Data URL...');
                reader.readAsDataURL(file);
              });
            } catch (dataUrlError) {
              console.error('Échec du chargement via Data URL:', dataUrlError);
              // Format the data URL error for better debugging
              let dataUrlErrorMessage = 'Erreur inconnue';
              if (dataUrlError instanceof Error) {
                dataUrlErrorMessage = dataUrlError.message;
              } else if (typeof dataUrlError === 'string') {
                dataUrlErrorMessage = dataUrlError;
              } else if (dataUrlError && typeof dataUrlError === 'object') {
                try {
                  dataUrlErrorMessage = JSON.stringify(dataUrlError);
                } catch (e) {
                  dataUrlErrorMessage = 'Erreur non sérialisable';
                }
              }
              console.log(`Détail de l'erreur Data URL: ${dataUrlErrorMessage}`);
              // All attempts failed, throw a comprehensive error with details about all attempts
              throw new Error(`Impossible de traiter l'image HEIC. Toutes les méthodes ont échoué:
1. Conversion avec heic2any: ${errorMessage}
2. Support natif du navigateur: ${nativeErrorMessage}
3. Méthode Data URL: ${dataUrlErrorMessage}
Veuillez essayer avec une image au format JPG ou PNG, ou convertir votre image HEIC avant de l'importer.`);
            }
          }
        }
      } else {
        // For non-HEIC images, use createImageBitmap directly
        const imageBitmap = await createImageBitmap(file);
        console.log(`Image chargée avec succès: ${imageBitmap.width}x${imageBitmap.height}`);
        return imageBitmap;
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'image:', error);

      // Provide more informative error messages
      if (isHeicFormat(file)) {
        // This error is thrown when all HEIC handling attempts fail
        // The detailed error message is already formatted in the try-catch blocks above
        throw error;
      } else {
        throw new Error(`Impossible de charger l'image ${file.name}. Vérifiez que le format est supporté.`);
      }
    }
  };

  /**
   * Create a canvas with the image
   * @param imageFile - The image file
   * @param width - Canvas width
   * @param height - Canvas height
   * @returns Promise with the canvas element
   */
  const createImageCanvas = async (imageFile: File, width: number, height: number): Promise<HTMLCanvasElement> => {
    try {
      // Load the image using the new loadImage function
      const img = await loadImage(imageFile);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Fill with black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      // Calculate dimensions to maintain aspect ratio
      const scale = Math.min(width / img.width, height / img.height);
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;

      // Draw the image centered and scaled
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      return canvas;
    } catch (error) {
      throw error; // Re-throw the error with the detailed message from loadImage
    }
  };

  /**
   * Extract audio from video file
   * @param videoFile - The video file
   * @returns Promise with audio data or null if no audio
   */
  const extractAudio = async (videoFile: File): Promise<AudioData | null> => {
    return new Promise((resolve) => {
      // Create a video element to extract audio
      const video = document.createElement('video') as ExtendedHTMLVideoElement;
      video.muted = true;
      video.preload = 'metadata';

      // Set up event listeners
      video.onloadedmetadata = async () => {
        try {
          // Check if video has audio tracks
          if (video.mozHasAudio || Boolean(video.webkitAudioDecodedByteCount) ||
              Boolean(video.audioTracks && video.audioTracks.length > 0)) {

            // Create audio context and source
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(video);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);

            // Start playing to get audio data
            await video.play();

            // Create MediaRecorder to capture audio
            const recorder = new MediaRecorder(destination.stream);
            const chunks: BlobEvent[] = [];

            recorder.ondataavailable = (e) => chunks.push(e as BlobEvent);

            recorder.onstop = () => {
              URL.revokeObjectURL(video.src);
              video.remove();

              // If we have audio data, return it
              if (chunks.length > 0) {
                const audioBlob = new Blob(chunks.map(chunk => chunk.data), { type: 'audio/webm' });
                // In a real implementation, we would convert this to AudioData
                // For now, we'll just return a placeholder
                resolve(null); // Replace with actual AudioData when implemented
              } else {
                resolve(null);
              }
            };

            // Record for a short duration to capture audio
            recorder.start();
            setTimeout(() => {
              recorder.stop();
              video.pause();
            }, 1000);
          } else {
            // No audio tracks
            URL.revokeObjectURL(video.src);
            video.remove();
            resolve(null);
          }
        } catch (err) {
          console.error('Error extracting audio:', err);
          URL.revokeObjectURL(video.src);
          video.remove();
          resolve(null);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
        resolve(null);
      };

      video.src = URL.createObjectURL(videoFile);
    });
  };

  // Fonction utilitaire pour extraire le SPS/PPS (description) d'un MP4
  async function extractAvcDescriptionFromMp4(file: File): Promise<ArrayBuffer | undefined> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = function (e) {
        let arrayBuffer = e.target?.result;
        if (!arrayBuffer) {
          reject(new Error('Impossible de lire le fichier MP4'));
          return;
        }
        let pureArrayBuffer: ArrayBuffer;
        // Si c'est déjà un ArrayBuffer natif
        if (Object.prototype.toString.call(arrayBuffer) === '[object ArrayBuffer]') {
          pureArrayBuffer = arrayBuffer as ArrayBuffer;
        } else if (typeof globalThis.SharedArrayBuffer !== 'undefined' && Object.prototype.toString.call(arrayBuffer) === '[object SharedArrayBuffer]') {
          // Copie dans un ArrayBuffer classique
          pureArrayBuffer = new Uint8Array(arrayBuffer as ArrayBufferLike).slice().buffer;
        } else if (arrayBuffer && typeof (arrayBuffer as any).buffer === 'object' && Object.prototype.toString.call((arrayBuffer as any).buffer) === '[object ArrayBuffer]') {
          // Cas DataView ou TypedArray
          pureArrayBuffer = (arrayBuffer as any).buffer;
        } else {
          reject(new Error('Le buffer n\'est pas un ArrayBuffer valide'));
          return;
        }
        // Log diagnostic
        console.log('[mp4box] Type de fichier:', file.type, 'Nom:', file.name);
        console.log('[mp4box] Taille du fichier:', file.size, 'Taille du buffer:', pureArrayBuffer.byteLength);
        if (file.name.toLowerCase().endsWith('.mov')) {
          console.warn('[mp4box] Attention: les fichiers MOV Apple peuvent être mal supportés.');
        }
        if (pureArrayBuffer.byteLength !== file.size) {
          console.error('[mp4box] Erreur: la taille du buffer ne correspond pas à la taille du fichier.');
        }
        const mp4boxFile = MP4Box.createFile();
        mp4boxFile.onError = (e: any) => reject(e);
        mp4boxFile.onReady = (info: any) => {
          console.log('[mp4box] Tracks:', info.tracks.map((t: any) => t.codec));
          const videoTrack = info.tracks.find((t: any) => t.codec.startsWith('avc1'));
          if (!videoTrack || !videoTrack.avcC) {
            reject(new Error('Impossible de trouver la description AVC (SPS/PPS) dans le MP4.'));
            return;
          }
          resolve(videoTrack.avcC.buffer);
        };
        // mp4box.js attend un ArrayBuffer avec une propriété fileStart
        (pureArrayBuffer as any).fileStart = 0;
        mp4boxFile.appendBuffer(pureArrayBuffer);
        mp4boxFile.flush();
      };
      fileReader.onerror = () => reject(new Error('Erreur de lecture du fichier MP4'));
      fileReader.readAsArrayBuffer(file);
    });
  }

  // Conversion MOV → MP4 avec ffmpeg.wasm
  async function convertMovToMp4(file: File): Promise<File> {
    if (typeof window === 'undefined') {
      throw new Error('La conversion MOV → MP4 doit être effectuée côté client (navigateur).');
    }
    const ffmpegModule = await import('@ffmpeg/ffmpeg');
    const createFFmpeg = ffmpegModule.default?.createFFmpeg || (ffmpegModule as any).createFFmpeg;
    const fetchFile = ffmpegModule.default?.fetchFile || (ffmpegModule as any).fetchFile;
    if (typeof createFFmpeg !== 'function' || typeof fetchFile !== 'function') {
      throw new Error('Impossible de charger ffmpeg.wasm : createFFmpeg ou fetchFile est introuvable dans le module. Vérifie la version et la compatibilité du package.');
    }
    const ffmpeg = createFFmpeg({ log: true, corePath: '/ffmpeg/ffmpeg-core.js' });
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }
    const inputName = 'input.mov';
    const outputName = 'output.mp4';
    ffmpeg.FS('writeFile', inputName, await fetchFile(file));
    await ffmpeg.run('-i', inputName, '-c:v', 'libx264', '-tag:v', 'avc1', '-c:a', 'aac', outputName);
    const data = ffmpeg.FS('readFile', outputName);
    // Correction : s'assurer que le buffer est bien un ArrayBuffer
    const buffer = data.buffer instanceof ArrayBuffer ? data.buffer : new Uint8Array(data).buffer;
    const mp4File = new File([buffer], file.name.replace(/\.mov$/i, '.mp4'), { type: 'video/mp4' });
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);
    return mp4File;
  }

  /**
   * Process video using WebCodecs API
   * @param videoFile - The video file
   * @param imageFile - The image file for the hook
   * @param progressCallback - Callback for progress updates
   * @param options - Processing options
   * @returns Promise with the processed video as a Blob
   */
  const processVideo = async (
    videoFile: File,
    imageFile: File,
    progressCallback?: (progress: number, message: string) => void,
    options: Partial<ProcessingOptions> = {}
  ): Promise<Blob> => {
    // Start processing
    isProcessing.value = true;
    error.value = null;
    const startTime = performance.now();

    // Update progress
    const updateProgress = (progress: number, message: string) => {
      if (progressCallback) {
        progressCallback(progress, message);
      }
    };

    try {
      // Check WebCodecs support
      updateProgress(5, MESSAGES.CHECKING_SUPPORT);
      if (!checkSupport()) {
        throw new Error(MESSAGES.NOT_SUPPORTED);
      }

      // Merge options with defaults
      const processingOptions: ProcessingOptions = {
        ...DEFAULT_OPTIONS,
        ...options
      };

      const { width, height, frameDuration, fps = 30 } = processingOptions;

      // Calculate how many frames to show the hook image
      const hookFrameCount = Math.round(frameDuration * fps);

      // Conversion MOV → MP4 si besoin
      let videoToProcess = videoFile;
      if (videoFile.name.toLowerCase().endsWith('.mov')) {
        updateProgress(3, 'Conversion MOV → MP4 en cours...');
        videoToProcess = await convertMovToMp4(videoFile);
        updateProgress(5, 'Conversion MOV → MP4 terminée.');
      }

      // Store performance metrics
      performanceMetrics.inputSize = videoToProcess.size + imageFile.size;

      // Create a canvas with the hook image
      updateProgress(10, 'Préparation de l\'image hook...');
      const imageCanvas = await createImageCanvas(imageFile, width, height);

      // Prepare for video decoding and encoding
      updateProgress(15, MESSAGES.DECODING_VIDEO);

      // Create video decoder
      const videoDecoder = new VideoDecoder({
        output: async (videoFrame) => {
          // Store the decoded frame
          decodedFrames.push(videoFrame);
        },
        error: (e) => {
          console.error('Decoder error:', e);
          error.value = `Erreur de décodage: ${e.message}`;
        }
      });

      // Create video encoder
      const encodedChunks: EncodedVideoChunk[] = [];
      const videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => {
          encodedChunks.push(chunk);
        },
        error: (e) => {
          console.error('Encoder error:', e);
          error.value = `Erreur d'encodage: ${e.message}`;
        }
      });

      // Configure encoder
      const encoderConfig = {
        codec: 'avc1.4d401f', // H.264 level 3.1 (1280x720 max)
        width,
        height,
        bitrate: 5_000_000, // 5 Mbps
        framerate: fps
      };

      await videoEncoder.configure(encoderConfig);

      // Get video info
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';

      await new Promise<void>((resolve, reject) => {
        videoElement.onloadedmetadata = () => resolve();
        videoElement.onerror = () => reject(new Error('Failed to load video metadata'));
        videoElement.src = URL.createObjectURL(videoToProcess);
      });

      const videoDuration = videoElement.duration;
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      // EXTRACTION SPS/PPS (description)
      const avcDescription = await extractAvcDescriptionFromMp4(videoToProcess).catch(() => undefined);

      // Configure decoder based on video properties
      const decoderConfig: VideoDecoderConfig = {
        codec: 'avc1.4d401f', // H.264 level 3.1 (1280x720 max)
        codedWidth: videoWidth,
        codedHeight: videoHeight,
        ...(avcDescription ? { description: avcDescription } : {})
      };

      await videoDecoder.configure(decoderConfig);

      // Read the video file
      const videoData = await videoToProcess.arrayBuffer();

      // Create a demuxer (simplified for this example)
      // In a real implementation, we would use a proper demuxer like MP4Box.js
      // For now, we'll just feed the whole file to the decoder
      const decodedFrames: VideoFrame[] = [];

      // Feed data to the decoder
      videoDecoder.decode(new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        duration: undefined,
        data: videoData
      }));

      // Wait for decoding to complete
      // In a real implementation, we would handle this more gracefully
      await new Promise<void>((resolve) => {
        const checkDecoding = () => {
          if (videoDecoder.state === 'closed') {
            resolve();
          } else {
            setTimeout(checkDecoding, 100);
          }
        };
        setTimeout(checkDecoding, 100);
      });

      // Process frames
      updateProgress(40, MESSAGES.PROCESSING_FRAMES);

      // First, add the hook image frames
      for (let i = 0; i < hookFrameCount; i++) {
        const hookFrame = new VideoFrame(imageCanvas, {
          timestamp: i * (1000000 / fps), // timestamp in microseconds
          duration: 1000000 / fps
        });

        await videoEncoder.encode(hookFrame, { keyFrame: i === 0 });
        hookFrame.close();
      }

      // Then add the original video frames
      for (const frame of decodedFrames) {
        // Adjust timestamp to account for the hook frames
        const adjustedTimestamp = frame.timestamp + (hookFrameCount * (1000000 / fps));

        // Create a new frame with the adjusted timestamp
        // Using a bitmap to create a new frame from the existing one to avoid type issues
        const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(frame, 0, 0);
          // Create an ImageBitmap from the canvas, which is a valid input for VideoFrame
          const bitmap = await createImageBitmap(canvas);

          // Préparer les options VideoFrame avec gestion des valeurs null
          const frameOptions: VideoFrameInit = {
            timestamp: adjustedTimestamp
          };

          // Ajouter duration seulement si elle existe et n'est pas null
          if (frame.duration !== null && frame.duration !== undefined) {
            frameOptions.duration = frame.duration;
          }

          const newFrame = new VideoFrame(bitmap, frameOptions);

          await videoEncoder.encode(newFrame);
          newFrame.close();
          bitmap.close(); // Clean up the bitmap
        } else {
          // Fallback if canvas context is not available
          console.warn('Could not get canvas context, skipping frame');
        }

        frame.close();
      }

      // Finish encoding
      updateProgress(70, MESSAGES.ENCODING_VIDEO);
      await videoEncoder.flush();

      // Extract audio if present
      updateProgress(80, MESSAGES.PREPARING_AUDIO);
      const audioData = await extractAudio(videoToProcess);

      // Mux video and audio
      updateProgress(90, MESSAGES.MUXING_STREAMS);

      // Create a blob from the encoded chunks
      // This is a simplified version, in reality we would need to properly mux the video and audio
      const videoBlob = new Blob(
        encodedChunks.map(chunk => {
          const buffer = new ArrayBuffer(chunk.byteLength);
          const view = new Uint8Array(buffer);
          chunk.copyTo(view);
          return buffer;
        }),
        { type: 'video/mp4' }
      );

      // Update performance metrics
      const endTime = performance.now();
      performanceMetrics.processingDuration = (endTime - startTime) / 1000; // in seconds
      performanceMetrics.outputSize = videoBlob.size;
      performanceMetrics.compressionRatio = performanceMetrics.inputSize / performanceMetrics.outputSize;
      performanceMetrics.processingSpeed = performanceMetrics.inputSize / performanceMetrics.processingDuration;

      // Clean up
      videoDecoder.close();
      videoEncoder.close();

      // Complete
      updateProgress(100, MESSAGES.PROCESSING_COMPLETE);
      isProcessing.value = false;

      return videoBlob;
    } catch (err) {
      isProcessing.value = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      updateProgress(0, MESSAGES.ERROR_PROCESSING + errorMessage);
      throw err;
    }
  };

  /**
   * Get optimization tips based on performance metrics
   */
  const getOptimizationTips = (): string[] => {
    const tips: string[] = [];

    if (performanceMetrics.processingDuration > 10) {
      tips.push('Le traitement a pris plus de 10 secondes. Essayez de réduire la résolution de la vidéo.');
    }

    if (performanceMetrics.compressionRatio < 1) {
      tips.push('La vidéo de sortie est plus grande que les fichiers d\'entrée. Essayez d\'ajuster les paramètres d\'encodage.');
    }

    if (performanceMetrics.processingSpeed < 1000000) { // Less than 1MB/s
      tips.push('Vitesse de traitement lente. Vérifiez les performances de votre appareil.');
    }

    if (!isSupported.value) {
      tips.push('WebCodecs n\'est pas supporté par votre navigateur. Utilisez Chrome ou Edge pour de meilleures performances.');
    }

    return tips;
  };

  // Initialize
  if (typeof window !== 'undefined') {
    checkSupport();
  }

  return {
    isSupported,
    isProcessing,
    error,
    performanceMetrics,
    processVideo,
    getOptimizationTips,
    MESSAGES,
    // Export the new functions for potential external use
    loadImage,
    convertHeicToJpeg,
    isHeicFormat
  };
}
