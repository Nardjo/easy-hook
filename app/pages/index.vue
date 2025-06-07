<script setup lang="ts">
import {onMounted} from 'vue';

// Types
interface FileUpload {
  file: File | null
  preview: string | null
  originalSize?: number
  optimizedSize?: number
  error?: string | null
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
    processing: 60,
    downloading: 85,
    finalization: 95,
    complete: 100
  },
  // Paramètres WebCodecs
  video: {
    width: 720,
    height: 1280,
    frameDuration: 1, // 1 second for the hook
    fps: 30
  }
} as const

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
  isLoaded,
  isLoading,
  processVideo: processVideoWithWebCodecs,
  performanceMetrics,
  getOptimizationTips,
  MESSAGES
} = useVideoProcessor()

// Vérifier la compatibilité WebCodecs au montage du composant
onMounted(() => {
  try {
    showStatus.value = true
    statusMessage.value = 'Vérification de la compatibilité WebCodecs...'

    if (isLoaded.value) {
      statusMessage.value = 'WebCodecs API prêt'
      setTimeout(() => {
        showStatus.value = false
      }, 2000)
    }
  } catch (error) {
    console.error('Error checking WebCodecs support:', error)
    statusMessage.value = `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
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

  // Vérifier si WebCodecs est supporté
  if (!isLoaded.value) {
    statusMessage.value = MESSAGES.WEBCODECS_NOT_SUPPORTED
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

    // Traiter la vidéo avec WebCodecs
    console.log('Utilisation de WebCodecs API pour le traitement')
    const blob = await processVideoWithWebCodecs(
        videoUpload.file,
        imageUpload.file,
        updateProgress
    )

    // Mettre à jour les métriques de performance
    Object.assign(performanceData, {
      duration: performanceMetrics.processingDuration,
      inputSize: performanceMetrics.inputSize,
      outputSize: performanceMetrics.outputSize,
      compressionRatio: performanceMetrics.compressionRatio,
      processingSpeed: performanceMetrics.processingSpeed
    })

    // Générer des conseils d'optimisation
    performanceData.tips = getOptimizationTips()

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
                controls controlsList="nofullscreen" playsinline
                webkit-playsinline
                class="rounded w-full h-full object-cover shadow-lg ring"
            />
          </div>
        </div>
      </UGrid>

      <!-- Section Status et Progression -->
      <div class=" mt-6
            ">
        <UAlert
            v-if="showStatus"
            :type="isProcessing ? 'info' : 'success'"
            :title="statusMessage"
            class="mb-4"
        >
          <template v-if="isProcessing">
            <div class="text-sm mt-2">
              <p>Phase: <span class="font-medium">{{
                  processingPhase
                }}</span>
              </p>
              <p>Temps écoulé: <span
                  class="font-medium">{{
                  formatDuration(elapsedTime)
                }}</span>
              </p>
            </div>
          </template>
        </UAlert>

        <UProgress
            v-if="isProcessing"
            :value="progress"
            class="mb-4"
        />
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
      </div>
    </UCard>
  </UContainer>
</template>
