#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// File paths and names (constants)
const TEMP_JPEG_FILENAME = "temp_hook.jpg";
const OUTPUT_FILE_PREFIX = "processed_";

// Video processing parameters (constants)
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const FRAME_DURATION = 0.033; // in seconds

// Command strings (constants)
const SIPS_COMMAND = 'sips -s format jpeg "{imagePath}" --out "{jpegPath}"';
const IMAGEMAGICK_CHECK_COMMAND = 'command -v convert';
const IMAGEMAGICK_CONVERT_COMMAND = 'convert "{imagePath}" "{jpegPath}"';
const FFMPEG_COMMAND = 'ffmpeg -i "{videoPath}" -i "{jpegPath}" ' +
  '-filter_complex "[1:v]scale={videoWidth}:{videoHeight}:force_original_aspect_ratio=decrease,' +
  'pad={videoWidth}:{videoHeight}:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[overlay];' +
  '[0:v][overlay]overlay=0:0:enable=\'lt(t,{frameDuration})\'" ' +
  '-c:a copy "{outputVideo}"';

// Messages in French
const MESSAGES = {
  // Success messages
  HEIC_CONVERTED_SIPS: "HEIC converti en JPEG en utilisant sips",
  HEIC_CONVERTED_IMAGEMAGICK: "HEIC converti en JPEG en utilisant ImageMagick",
  PROCESSING_VIDEO: "Traitement de la vidéo avec ffmpeg...",
  VIDEO_PROCESSED: "✅ Vidéo traitée avec succès: {outputPath}",

  // Error messages
  VIDEO_NOT_FOUND: "Fichier vidéo introuvable à {videoPath}",
  IMAGE_NOT_FOUND: "Fichier image introuvable à {imagePath}",
  HEIC_CONVERSION_FAILED: "Échec de la conversion HEIC en JPEG. Veuillez vous assurer que sips ou ImageMagick est installé.",
  FFMPEG_FAILED: "Le traitement ffmpeg a échoué: {error}",
  OUTPUT_NOT_CREATED: "Le fichier de sortie n'a pas été créé",
  UNEXPECTED_ERROR: "Une erreur inattendue s'est produite: {error}",
  MISSING_ARGUMENTS: "Erreur: Arguments requis manquants",
  SIPS_FAILED: "La conversion sips a échoué, essai d'une méthode alternative avec ImageMagick...",

  // CLI messages
  STARTING_PROCESSING: "🎬 Démarrage du traitement vidéo...",
  VIDEO_FILE_INFO: "🎥 Fichier vidéo: {videoPath}",
  IMAGE_FILE_INFO: "🖼️ Fichier image: {imagePath}",
  IMAGE_FROM_DIR_INFO: "🖼️ Fichier image (le plus récent du répertoire): {imagePath}",
  OUTPUT_DIR_INFO: "📁 Répertoire de sortie (même chemin que l'image): {outputDir}"
};

// CLI usage information in French
const USAGE_INFO = `
Utilisation: process_video.js [fichier-video] [fichier-image]

Arguments (optionnels):
  fichier-video      Chemin vers le fichier vidéo (par défaut: valeur de config.js)
  fichier-image      Chemin vers le fichier image ou répertoire (par défaut: valeur de config.js)
                     Si un répertoire est spécifié, le fichier image le plus récent sera utilisé
                     (formats supportés: jpg, jpeg, png, heic, gif, bmp, tiff, webp)

Exemples:
  process_video.js                     # Utilise les chemins définis dans config.js
  process_video.js video.mp4           # Utilise le chemin vidéo spécifié et le chemin image de config.js
  process_video.js video.mp4 image.jpg # Utilise les chemins spécifiés
  process_video.js video.mp4 ~/Images  # Utilise le fichier image le plus récent du répertoire ~/Images
`;

/**
 * Process a video by adding an image as the first frame
 * @param {string} videoPath - Path to the video file
 * @param {string} imagePath - Path to the image file (HEIC or other format)
 * @param {string} outputDir - Directory to save the output (derived from image path)
 * @returns {Promise<string>} - Path to the processed video
 */
async function processVideo(videoPath, imagePath, outputDir) {
  return new Promise(async (resolve, reject) => {
    try {
      // Set the configurable paths
      config.videoPath = videoPath;
      config.imagePath = imagePath;

      // Check if files exist
      if (!fs.existsSync(videoPath)) {
        return reject(new Error(MESSAGES.VIDEO_NOT_FOUND.replace('{videoPath}', videoPath)));
      }

      if (!fs.existsSync(imagePath)) {
        return reject(new Error(MESSAGES.IMAGE_NOT_FOUND.replace('{imagePath}', imagePath)));
      }

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 1) Convert image to JPEG if it's HEIC
      const isHeic = imagePath.toLowerCase().endsWith('.heic');
      let jpegPath = imagePath;

      if (isHeic) {
        jpegPath = path.join(outputDir, TEMP_JPEG_FILENAME);

        // Try using sips for conversion (macOS)
        try {
          const sipsCommand = SIPS_COMMAND
            .replace('{imagePath}', imagePath)
            .replace('{jpegPath}', jpegPath);
          execSync(sipsCommand, { stdio: 'pipe' });
          console.log(MESSAGES.HEIC_CONVERTED_SIPS);
        } catch (error) {
          console.log(MESSAGES.SIPS_FAILED);

          // Check if ImageMagick is installed
          try {
            execSync(IMAGEMAGICK_CHECK_COMMAND, { stdio: 'pipe' });
            const convertCommand = IMAGEMAGICK_CONVERT_COMMAND
              .replace('{imagePath}', imagePath)
              .replace('{jpegPath}', jpegPath);
            execSync(convertCommand, { stdio: 'pipe' });
            console.log(MESSAGES.HEIC_CONVERTED_IMAGEMAGICK);
          } catch (error) {
            return reject(new Error(MESSAGES.HEIC_CONVERSION_FAILED));
          }
        }
      }

      // 2) Insert the image as the first frame
      console.log(MESSAGES.PROCESSING_VIDEO);
      const outputVideo = path.join(outputDir, `${OUTPUT_FILE_PREFIX}${path.basename(videoPath)}`);

      try {
        const ffmpegCommand = FFMPEG_COMMAND
          .replace('{videoPath}', videoPath)
          .replace('{jpegPath}', jpegPath)
          .replace(/{videoWidth}/g, VIDEO_WIDTH)
          .replace(/{videoHeight}/g, VIDEO_HEIGHT)
          .replace('{frameDuration}', FRAME_DURATION)
          .replace('{outputVideo}', outputVideo);
        execSync(ffmpegCommand, { stdio: 'pipe' });
      } catch (error) {
        return reject(new Error(MESSAGES.FFMPEG_FAILED.replace('{error}', error.message)));
      }

      // 3) Clean up temporary files
      if (isHeic && fs.existsSync(jpegPath)) {
        fs.unlinkSync(jpegPath);
      }

      // Check if the output file was created successfully
      if (fs.existsSync(outputVideo)) {
        resolve(outputVideo);
      } else {
        reject(new Error(MESSAGES.OUTPUT_NOT_CREATED));
      }

    } catch (error) {
      reject(new Error(MESSAGES.UNEXPECTED_ERROR.replace('{error}', error.message)));
    }
  });
}

// Print usage information
function printUsage() {
  console.log(USAGE_INFO);
}

/**
 * Find the most recent image file in a directory
 * @param {string} directoryPath - Path to the directory
 * @returns {string|null} - Path to the most recent image file, or null if no image files found
 */
function findMostRecentFile(directoryPath) {
  try {
    // Check if the path exists and is a directory
    const stats = fs.statSync(directoryPath);
    if (!stats.isDirectory()) {
      return null;
    }

    // Define valid image file extensions
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.gif', '.bmp', '.tiff', '.webp'];

    // Get all image files in the directory
    const files = fs.readdirSync(directoryPath)
      .filter(file => {
        const filePath = path.join(directoryPath, file);
        const isFile = fs.statSync(filePath).isFile();
        const extension = path.extname(file).toLowerCase();
        return isFile && validImageExtensions.includes(extension);
      })
      .map(file => {
        const filePath = path.join(directoryPath, file);
        return {
          path: filePath,
          mtime: fs.statSync(filePath).mtime
        };
      });

    // Sort files by modification time (most recent first)
    files.sort((a, b) => b.mtime - a.mtime);

    // Return the most recent image file, or null if no image files found
    return files.length > 0 ? files[0].path : null;
  } catch (error) {
    console.error(`Erreur lors de la recherche du fichier le plus récent: ${error.message}`);
    return null;
  }
}

// Main function
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);

  // Check if help is requested
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Replace $HOME with the actual home directory in config paths
  if (config.videoPath.includes('$HOME')) {
    config.videoPath = config.videoPath.replace('$HOME', process.env.HOME);
  }
  if (config.imagePath.includes('$HOME')) {
    config.imagePath = config.imagePath.replace('$HOME', process.env.HOME);
  }

  // Use default paths from config.js if no arguments are provided
  let videoPath = args.length > 0 ? args[0] : config.videoPath;
  let imagePath = args.length > 1 ? args[1] : config.imagePath;

  // Check if imagePath is a directory, and if so, find the most recent image file
  let imageFromDirectory = false;
  if (fs.existsSync(imagePath) && fs.statSync(imagePath).isDirectory()) {
    const mostRecentFile = findMostRecentFile(imagePath);
    if (mostRecentFile) {
      console.log(`Utilisation du fichier le plus récent dans le répertoire: ${path.basename(mostRecentFile)}`);
      imagePath = mostRecentFile;
      imageFromDirectory = true;
    } else {
      console.error(`Aucun fichier image trouvé dans le répertoire: ${imagePath}`);
      process.exit(1);
    }
  }

  const outputDir = path.dirname(imagePath);

  // Check if the paths are valid
  if (!videoPath || !imagePath) {
    console.error(MESSAGES.MISSING_ARGUMENTS);
    printUsage();
    process.exit(1);
  }

  console.log(MESSAGES.STARTING_PROCESSING);
  console.log(MESSAGES.VIDEO_FILE_INFO.replace('{videoPath}', videoPath));
  if (imageFromDirectory) {
    console.log(MESSAGES.IMAGE_FROM_DIR_INFO.replace('{imagePath}', imagePath));
  } else {
    console.log(MESSAGES.IMAGE_FILE_INFO.replace('{imagePath}', imagePath));
  }
  console.log(MESSAGES.OUTPUT_DIR_INFO.replace('{outputDir}', outputDir));

  try {
    // Process the video
    const outputPath = await processVideo(videoPath, imagePath, outputDir);
    console.log(MESSAGES.VIDEO_PROCESSED.replace('{outputPath}', outputPath));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
