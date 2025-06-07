<script setup lang="ts">
import {onMounted} from 'vue';

// Types
interface FileUpload {
  file: File | null
  preview: string | null
  originalSize?: number
  optimizedSize?: number
}

interface PerformanceData {
  duration: number
  inputSize: number
  outputSize: number
  compressionRatio: number
  processingSpeed: number
  tips: string[]
  showDetails: boolean
}

// Configuration
const CONFIG = {
  imageFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/heic'],
  videoFormats: ['video/mp4', 'video/avi', 'video/quicktime', 'video/mov'],
  progressSteps: {
    init: 5,
    compression: 10,
    imageProcessing: 30,
    filePreparation: 40,
    ffmpegProcessing: 60,
    downloading: 85,
    finalization: 95,
    complete: 100
  },
  // Paramètres FFmpeg
  ffmpeg: {
    videoWidth: 720,
    videoHeight: 1280,
    frameDuration: 0.033,
    preset: 'ultrafast',
    crf: '28'
  }
} as const

// Constantes pour le worker
const VIDEO_WIDTH = CONFIG.ffmpeg.videoWidth
const VIDEO_HEIGHT = CONFIG.ffmpeg.videoHeight
const FRAME_DURATION = CONFIG.ffmpeg.frameDuration
const FFMPEG_PRESET = CONFIG.ffmpeg.preset
const FFMPEG_CRF = CONFIG.ffmpeg.crf

// État principal
const isProcessing = ref(false)
const progress = ref(0)
const statusMessage = ref('')
const showStatus = ref(false)
const processingPhase = ref('')
const processingStartTime = ref(0)
const elapsedTime = ref(0)
const timeUpdateInterval = ref<number | null>(null)

// État des fichiers
const imageUpload = reactive<FileUpload>({file: null, preview: null})
const videoUpload = reactive<FileUpload>({file: null, preview: null})

// Métriques de performance
const performanceData = reactive<PerformanceData>({
  duration: 0,
  inputSize: 0,
  outputSize: 0,
  compressionRatio: 0,
  processingSpeed: 0,
  tips: [],
  showDetails: false
})

// Initialiser le processeur vidéo
const {
  loadFFmpeg,
  processVideo: processVideoWithFFmpeg,
  optimizeImage,
  optimizeVideo,
  isLoaded,
  isLoading,
  performanceMetrics,
  getOptimizationTips,
  MESSAGES
} = useVideoProcessor()

// Initialiser le worker FFmpeg (optionnel)
const {
  initWorker,
  processVideo: processVideoWithWorker,
  isInitialized: isWorkerInitialized,
  isProcessing: isWorkerProcessing,
  performanceMetrics: workerPerformanceMetrics,
  getOptimizationTips: getWorkerOptimizationTips,
  MESSAGES: WORKER_MESSAGES
} = useFFmpegWorker()

// Option pour utiliser le worker
const useWorker = ref(false)

// Vérifier si les workers sont supportés
const isWorkerSupported = ref(typeof Worker !== 'undefined')

// Charger FFmpeg au montage du composant
onMounted(async () => {
  try {
    showStatus.value = true
    statusMessage.value = MESSAGES.LOADING_FFMPEG

    // Charger FFmpeg principal
    await loadFFmpeg()

    // Initialiser le worker en arrière-plan si supporté
    if (isWorkerSupported.value) {
      console.log('Initialisation du worker FFmpeg en arrière-plan...')
      initWorker().catch(err => {
        console.warn('Impossible d\'initialiser le worker FFmpeg:', err)
        // Désactiver l'option worker si l'initialisation échoue
        useWorker.value = false
      })
    } else {
      console.log('Web Workers non supportés dans ce navigateur')
      useWorker.value = false
    }

    if (isLoaded.value) {
      statusMessage.value = MESSAGES.FFMPEG_LOADED
      setTimeout(() => {
        showStatus.value = false
      }, 2000)
    }
  } catch (error) {
    console.error('Error loading FFmpeg:', error)
    statusMessage.value = `${MESSAGES.ERROR_LOADING_FFMPEG}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
  }
})

// Composable pour gérer les uploads
const useFileUpload = (upload: FileUpload) => {
  const handleFile = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] || null

    if (file) {
      // Stocker la taille originale
      upload.originalSize = file.size
      upload.file = file
      upload.preview = URL.createObjectURL(file)

      // Afficher la taille du fichier
      console.log(`Fichier chargé: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`)
    } else {
      upload.file = null
      upload.preview = null
      upload.originalSize = undefined
      upload.optimizedSize = undefined
    }
  }

  return {handleFile}
}

// Handlers
const {handleFile: handleImageFile} = useFileUpload(imageUpload)
const {handleFile: handleVideoFile} = useFileUpload(videoUpload)

// Utilitaires
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

// Mise à jour du progrès avec phase
const updateProgress = (value: number, message: string) => {
  progress.value = value
  statusMessage.value = message
  processingPhase.value = message

  // Mettre à jour le temps écoulé
  if (processingStartTime.value > 0) {
    elapsedTime.value = (Date.now() - processingStartTime.value) / 1000
  }
}

const startTimeTracking = () => {
  processingStartTime.value = Date.now()

  // Mettre à jour le temps écoulé toutes les secondes
  if (timeUpdateInterval.value) {
    clearInterval(timeUpdateInterval.value)
  }

  timeUpdateInterval.value = window.setInterval(() => {
    if (processingStartTime.value > 0) {
      elapsedTime.value = (Date.now() - processingStartTime.value) / 1000
    }
  }, 1000)
}

const stopTimeTracking = () => {
  if (timeUpdateInterval.value) {
    clearInterval(timeUpdateInterval.value)
    timeUpdateInterval.value = null
  }
}

const downloadFile = (blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: `processed_video_${Date.now()}.mp4`,
    style: {display: 'none'}
  })

  document.body.appendChild(link)
  link.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(link)
}

const resetProcess = () => {
  setTimeout(() => {
    isProcessing.value = false
    progress.value = 0
    showStatus.value = false
    stopTimeTracking()
    // Ne pas réinitialiser les métriques de performance pour que l'utilisateur puisse les consulter
  }, 3000)
}

// Basculer l'affichage des détails de performance
const togglePerformanceDetails = () => {
  performanceData.showDetails = !performanceData.showDetails
}

// Traitement principal
const processVideo = async () => {
  if (!imageUpload.file || !videoUpload.file) return

  // Vérifier si FFmpeg est chargé (principal ou worker selon le choix)
  if (useWorker.value && !isWorkerInitialized.value) {
    statusMessage.value = 'Worker FFmpeg non initialisé'
    showStatus.value = true
    return
  } else if (!useWorker.value && !isLoaded.value) {
    statusMessage.value = MESSAGES.ERROR_LOADING_FFMPEG
    showStatus.value = true
    return
  }

  try {
    // Réinitialiser et démarrer le suivi
    isProcessing.value = true
    showStatus.value = true
    startTimeTracking()

    // Enregistrer les tailles originales pour les métriques
    performanceData.inputSize = (imageUpload.originalSize || 0) + (videoUpload.originalSize || 0)

    let blob: Blob;

    // Utiliser le worker ou le traitement principal selon le choix
    if (useWorker.value && isWorkerSupported.value) {
      console.log('Utilisation du worker FFmpeg pour le traitement')

      // Traiter la vidéo avec le worker FFmpeg
      blob = await processVideoWithWorker(
          videoUpload.file,
          imageUpload.file,
          {
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
            frameDuration: FRAME_DURATION,
            preset: FFMPEG_PRESET,
            crf: FFMPEG_CRF
          },
          updateProgress
      )

      // Copier les métriques du worker
      Object.assign(performanceData, {
        duration: workerPerformanceMetrics.processingDuration,
        inputSize: workerPerformanceMetrics.inputSize,
        outputSize: workerPerformanceMetrics.outputSize,
        compressionRatio: workerPerformanceMetrics.compressionRatio,
        processingSpeed: workerPerformanceMetrics.processingSpeed
      })

      // Générer des conseils d'optimisation
      performanceData.tips = getWorkerOptimizationTips()

    } else {
      console.log('Utilisation du traitement FFmpeg principal')

      // Traiter la vidéo avec FFmpeg.wasm optimisé
      blob = await processVideoWithFFmpeg(
          videoUpload.file,
          imageUpload.file,
          updateProgress
      )

      // Mettre à jour les métriques de performance
      performanceData.outputSize = blob.size
      performanceData.duration = elapsedTime.value
      performanceData.compressionRatio = performanceData.inputSize > 0
          ? performanceData.inputSize / blob.size
          : 0
      performanceData.processingSpeed = performanceData.duration > 0
          ? performanceData.inputSize / performanceData.duration
          : 0

      // Générer des conseils d'optimisation
      performanceData.tips = getOptimizationTips({
        inputSize: performanceData.inputSize,
        outputSize: performanceData.outputSize,
        processingDuration: performanceData.duration,
        compressionRatio: performanceData.compressionRatio,
        processingSpeed: performanceData.processingSpeed
      })
    }

    // Afficher automatiquement les détails de performance
    performanceData.showDetails = true

    // Télécharger le fichier traité
    downloadFile(blob)

    updateProgress(CONFIG.progressSteps.complete, 'Traitement terminé avec succès!')
    stopTimeTracking()
    resetProcess()

  } catch (error) {
    console.error('Error processing video:', error)
    statusMessage.value = `Une erreur est survenue: ${
        error instanceof Error ? error.message : 'Erreur inconnue'
    }`
    isProcessing.value = false
    stopTimeTracking()
  }
}

// Computed
const isFormValid = computed(() =>
    Boolean(imageUpload.file && videoUpload.file && isLoaded.value)
)
</script>

<template>
  <UContainer class="py-10">
    <UCard class="mb-8">
      <template #header>
        <UHeading class="text-center" level="1">
          Éditeur de Vidéo avec Hook
        </UHeading>
      </template>

      <UDivider class="my-4"/>

      <UGrid :ui="{ gap: 'gap-6' }" cols="1" lg="2">
        <!-- Section Image -->
        <div>
          <UFormField label="Image de superposition">
            <UInput
                type="file"
                :accept="CONFIG.imageFormats.join(',')"
                @change="handleImageFile"
                size="lg"
                placeholder="Sélectionnez une image"
            >
              <template #leading>
                <UIcon name="i-heroicons-photo" class="h-5 w-5"/>
              </template>
            </UInput>
          </UFormField>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Formats acceptés: JPG, PNG, GIF, HEIC
          </p>

          <div v-if="imageUpload.preview" class="mt-4 flex justify-center">
            <UImage
                :src="imageUpload.preview"
                class="max-h-48 rounded-md object-contain"
            />
          </div>
        </div>

        <!-- Section Vidéo -->
        <div>
          <UFormField label="Vidéo à traiter">
            <UInput
                type="file"
                :accept="CONFIG.videoFormats.join(',')"
                @change="handleVideoFile"
                size="lg"
                placeholder="Sélectionnez une vidéo"
            >
              <template #leading>
                <UIcon name="i-heroicons-film" class="h-5 w-5"/>
              </template>
            </UInput>
          </UFormField>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Formats acceptés: MP4, AVI, MOV
          </p>

          <div v-if="videoUpload.preview" class="mt-4 flex justify-center">
            <video
                :src="videoUpload.preview"
                controls
                class="max-h-48 w-full rounded-md object-contain"
            />
          </div>
        </div>
      </UGrid>

      <!-- Section Status et Progression -->
      <div class="mt-6">
        <UAlert
            v-if="showStatus"
            :type="isProcessing ? 'info' : 'success'"
            :title="statusMessage"
            class="mb-4"
        >
          <template v-if="isProcessing">
            <div class="text-sm mt-2">
              <p>Phase: <span class="font-medium">{{ processingPhase }}</span>
              </p>
              <p>Temps écoulé: <span
                  class="font-medium">{{ formatDuration(elapsedTime) }}</span>
              </p>
            </div>
          </template>
        </UAlert>

        <UProgress
            v-if="isProcessing"
            :value="progress"
            class="mb-4"
        />

        <!-- Métriques de Performance -->
        <UCard
            v-if="performanceData.duration > 0"
            class="mb-6 p-4"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Métriques de Performance</h3>
              <UButton
                  size="xs"
                  variant="ghost"
                  @click="togglePerformanceDetails"
                  :icon="performanceData.showDetails ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              >
                {{ performanceData.showDetails ? 'Masquer' : 'Afficher' }}
              </UButton>
            </div>
          </template>

          <template v-if="performanceData.showDetails">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Durée de
                  traitement</p>
                <p class="font-semibold">
                  {{ formatDuration(performanceData.duration) }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Ratio de
                  compression</p>
                <p class="font-semibold">
                  {{ performanceData.compressionRatio.toFixed(2) }}x</p>
              </div>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Taille
                  d'entrée</p>
                <p class="font-semibold">
                  {{ formatFileSize(performanceData.inputSize) }}</p>
              </div>
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Taille de
                  sortie</p>
                <p class="font-semibold">
                  {{ formatFileSize(performanceData.outputSize) }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">Vitesse de
                  traitement</p>
                <p class="font-semibold">
                  {{ formatFileSize(performanceData.processingSpeed) }}/s</p>
              </div>
            </div>

            <!-- Conseils d'optimisation -->
            <div v-if="performanceData.tips.length > 0" class="mt-4">
              <p class="font-medium mb-2">Conseils d'optimisation:</p>
              <ul class="list-disc pl-5 text-sm">
                <li v-for="(tip, index) in performanceData.tips" :key="index"
                    class="mb-1">
                  {{ tip }}
                </li>
              </ul>
            </div>
          </template>

          <div v-else>
            <p class="text-sm">
              Traitement terminé en <span class="font-medium">{{
                formatDuration(performanceData.duration)
              }}</span>
              avec un ratio de compression de <span class="font-medium">{{
                performanceData.compressionRatio.toFixed(2)
              }}x</span>
            </p>
          </div>

          <template #footer v-if="!performanceData.showDetails">
            <p class="text-sm">
              Traitement terminé en <span class="font-medium">{{
                formatDuration(performanceData.duration)
              }}</span>
              avec un ratio de compression de <span class="font-medium">{{
                performanceData.compressionRatio.toFixed(2)
              }}x</span>
            </p>
          </template>
        </UCard>
      </div>

      <!-- Options avancées -->
      <div class="mt-4 mb-2">
        <UFormGroup v-if="isWorkerSupported" label="Options de traitement"
                    class="mb-4">
          <UToggle
              v-model="useWorker"
              :disabled="isProcessing || !isWorkerInitialized"
              color="primary"
          >
            <template #default>
              Utiliser le traitement en arrière-plan
              <UBadge v-if="isWorkerInitialized" color="success" size="xs"
                      class="ml-2">Prêt
              </UBadge>
              <UBadge v-else color="warning" size="xs" class="ml-2">
                Initialisation...
              </UBadge>
            </template>
            <template #description>
              <span class="text-xs">
                Améliore la réactivité de l'interface pendant le traitement des vidéos volumineuses
              </span>
            </template>
          </UToggle>
        </UFormGroup>
      </div>

      <!-- Bouton d'Action -->
      <div class="mt-4 flex flex-col items-center">
        <UButton
            size="lg"
            variant="solid"
            color="primary"
            :loading="isProcessing"
            :disabled="!isFormValid || isProcessing"
            @click="processVideo"
            icon="i-heroicons-play"
            class="mb-2"
        >
          Traiter la vidéo
        </UButton>

        <p v-if="isProcessing" class="text-sm text-center text-gray-500 mt-2">
          Mode:
          {{ useWorker ? 'Traitement en arrière-plan' : 'Traitement standard' }}
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
