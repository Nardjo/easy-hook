<script setup lang="ts">
// State for file uploads
const imageFile = ref<File | null>(null)
const videoFile = ref<File | null>(null)
const isProcessing = ref(false)
const progress = ref(0)
const statusMessage = ref('')
const showStatus = ref(false)

// Accepted file formats
const imageFormats = ['image/jpeg', 'image/png', 'image/gif', 'HEIC']
const videoFormats = ['video/mp4', 'video/avi', 'video/quicktime']

// Image preview URL
const imagePreview = ref<string | null>(null)
const videoPreview = ref<string | null>(null)

// Handle image upload
const onImageSelected = (file: File | null) => {
  if (file) {
    imagePreview.value = URL.createObjectURL(file)
  } else {
    imagePreview.value = null
  }
}

// Handle video upload
const onVideoSelected = (file: File | null) => {
  if (file) {
    videoPreview.value = URL.createObjectURL(file)
  } else {
    videoPreview.value = null
  }
}

// Process video function
const processVideo = async () => {
  if (!imageFile.value || !videoFile.value) return

  // Progress interval reference for cleanup
  let progressInterval: NodeJS.Timeout | null = null

  try {
    isProcessing.value = true
    showStatus.value = true
    statusMessage.value = 'Préparation des fichiers...'
    progress.value = 10

    // Create FormData
    const formData = new FormData()
    formData.append('video', videoFile.value)
    formData.append('image', imageFile.value)

    // Update progress
    progress.value = 20
    statusMessage.value = 'Envoi des fichiers au serveur...'

    // Since fetch doesn't support progress tracking natively, we'll simulate progress
    progressInterval = setInterval(() => {
      if (progress.value < 50) {
        progress.value += 1
      }
    }, 200)

    // Send files to API using fetch
    const response = await fetch('/api/process-video', {
      method: 'POST',
      body: formData
    })

    // Clear the progress interval
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }

    // Handle errors
    if (!response.ok) {
      let errorMessage = 'Erreur lors du traitement de la vidéo'
      try {
        const errorData = await response.json()
        errorMessage = errorData.statusMessage || errorMessage
      } catch (e) {
        errorMessage = `Erreur ${response.status}: ${response.statusText}`
      }
      throw new Error(errorMessage)
    }

    // Update progress
    progress.value = 80
    statusMessage.value = 'Téléchargement de la vidéo traitée...'

    // Get the blob from the response
    const blob = await response.blob()

    // Create a download link
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `processed_video_${Date.now()}.mp4`
    document.body.appendChild(a)

    // Trigger download
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    // Success message
    progress.value = 100
    statusMessage.value = 'Traitement terminé avec succès!'

    // Reset after 3 seconds
    setTimeout(() => {
      isProcessing.value = false
      progress.value = 0
    }, 3000)

  } catch (error) {
    // Handle error
    console.error('Error processing video:', error)
    statusMessage.value = `Une erreur est survenue: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
    isProcessing.value = false

    // Clear the progress interval if it exists
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
  }
}

// Computed property to check if form is valid
const isFormValid = computed(() => {
  return imageFile.value !== null && videoFile.value !== null
})
</script>

<template>
  <UContainer class="py-10">
    <UCard class="mb-8">
      <template #header>
        <UHeading class="text-center" level="1">Éditeur de Vidéo avec Hook</UHeading>
      </template>

      <UDivider class="my-4" />

      <UGrid :ui="{ gap: 'gap-6' }" cols="1" lg="2">
        <!-- Image Upload Section -->
        <div>
          <UFormField label="Image de superposition">
            <UInput
              type="file"
              v-model="imageFile"
              @update:model-value="onImageSelected"
              size="lg"
              placeholder="Sélectionnez une image"
            >
              <template #leading>
                <UIcon name="i-heroicons-photo" class="h-5 w-5" />
              </template>
            </UInput>
          </UFormField>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Formats acceptés: JPG, PNG, GIF</p>

          <div v-if="imagePreview" class="mt-4 flex justify-center">
            <UImage :src="imagePreview" class="max-h-48 rounded-md object-contain" />
          </div>
        </div>

        <!-- Video Upload Section -->
        <div>
          <UFormField label="Vidéo à traiter">
            <UInput
              type="file"
              :accept="videoFormats.join(',')"
              v-model="videoFile"
              @update:model-value="onVideoSelected"
              size="lg"
              placeholder="Sélectionnez une vidéo"
            >
              <template #leading>
                <UIcon name="i-heroicons-film" class="h-5 w-5" />
              </template>
            </UInput>
          </UFormField>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Formats acceptés: MP4, AVI, MOV</p>

          <div v-if="videoPreview" class="mt-4 flex justify-center">
            <video 
              :src="videoPreview" 
              controls 
              class="max-h-48 w-full rounded-md object-contain"
            ></video>
          </div>
        </div>
      </UGrid>

      <!-- Status and Progress Section -->
      <div class="mt-6">
        <UAlert 
          v-if="showStatus" 
          :type="isProcessing ? 'info' : 'success'" 
          :title="statusMessage"
          class="mb-4"
        />

        <UProgress 
          v-if="isProcessing" 
          :value="progress" 
          class="mb-4"
        />
      </div>

      <!-- Action Button -->
      <div class="mt-6 flex justify-center">
        <UButton
          size="lg"
          variant="solid"
          color="primary"
          :loading="isProcessing"
          :disabled="!isFormValid || isProcessing"
          @click="processVideo"
          icon="i-heroicons-play"
        >
          Traiter la vidéo
        </UButton>
      </div>
    </UCard>
  </UContainer>
</template>
