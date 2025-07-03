// @ts-nocheck

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


// File paths and names (constants)
const TEMP_JPEG_FILENAME = "temp_hook.jpg";
const OUTPUT_FILE_PREFIX = "processed_";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Dossier où se trouvent les vidéos
const VIDEOS_DIR = path.join(__dirname, 'videos');

// Extensions vidéo supportées
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

// Video processing parameters (constants)
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1278;
const FRAME_DURATION = 0.033; // in seconds

// Command strings (constants)
const SIPS_COMMAND = 'sips -s format jpeg "{imagePath}" --out "{jpegPath}"';
const IMAGEMAGICK_CHECK_COMMAND = 'command -v convert';
const IMAGEMAGICK_CONVERT_COMMAND = 'convert "{imagePath}" "{jpegPath}"';
const FFMPEG_COMMAND = 'ffmpeg -i "{videoPath}" -i "{jpegPath}" ' +
  '-filter_complex "[1:v]scale={videoWidth}:{videoHeight}:force_original_aspect_ratio=decrease,' +
  'pad={videoWidth}:{videoHeight}:(ow-iw)/2:(oh-ih)/2,setdar=9/16,setpts=PTS-STARTPTS[overlay];' +
  '[0:v][overlay]overlay=0:0:enable=\'lt(t,{frameDuration})\'" ' +
  '-c:v libx264 -preset veryfast -profile:v high -level 4.2 -pix_fmt yuv420p -aspect 9:16 -c:a aac -b:a 128k -movflags +faststart "{outputVideo}"';

// Messages utiles pour l'utilisateur
const PROCESSING_VIDEO = "Traitement de la vidéo avec ffmpeg...";
const VIDEO_PROCESSED = "✅ Vidéo traitée avec succès: {outputPath}";
const VIDEO_NOT_FOUND = "Fichier vidéo introuvable à {videoPath}";
const IMAGE_NOT_FOUND = "Fichier image introuvable à {imagePath}";
const FFMPEG_FAILED = "Le traitement ffmpeg a échoué: {error}";
const OUTPUT_NOT_CREATED = "La vidéo traitée n'a pas été créée.";
const UNEXPECTED_ERROR = "Une erreur inattendue s'est produite: {error}";

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


      // Check if files exist
      if (!fs.existsSync(videoPath)) {
        return reject(new Error(VIDEO_NOT_FOUND.replace('{videoPath}', videoPath)));
      }

      if (!fs.existsSync(imagePath)) {
        return reject(new Error(IMAGE_NOT_FOUND.replace('{imagePath}', imagePath)));
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
          console.log('HEIC converti en JPEG en utilisant sips');
        } catch (error) {
          console.log('La conversion sips a échoué, essai d\'une méthode alternative avec ImageMagick...');

          // Check if ImageMagick is installed
          try {
            execSync(IMAGEMAGICK_CHECK_COMMAND, { stdio: 'pipe' });
            const convertCommand = IMAGEMAGICK_CONVERT_COMMAND
              .replace('{imagePath}', imagePath)
              .replace('{jpegPath}', jpegPath);
            execSync(convertCommand, { stdio: 'pipe' });
            console.log('HEIC converti en JPEG en utilisant ImageMagick');
          } catch (error) {
            return reject(new Error('Échec de la conversion HEIC en JPEG. Veuillez vous assurer que sips ou ImageMagick est installé.'));
          }
        }
      }

      // 2) Insert the image as the first frame
      console.log(PROCESSING_VIDEO);
      // Force la sortie en .mp4 pour compat Instagram
const outputBaseName = path.parse(videoPath).name;
let outputVideo = path.join(outputDir, `${OUTPUT_FILE_PREFIX}${outputBaseName}.mp4`);
let fileIndex = 1;
while (fs.existsSync(outputVideo)) {
  outputVideo = path.join(outputDir, `${OUTPUT_FILE_PREFIX}${outputBaseName}_${fileIndex}.mp4`);
  fileIndex++;
}

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
        return reject(new Error(FFMPEG_FAILED.replace('{error}', error.message)));
      }

      // 3) Clean up temporary files
      if (isHeic && fs.existsSync(jpegPath)) {
        fs.unlinkSync(jpegPath);
      }

      // Check if the output file was created successfully
      if (fs.existsSync(outputVideo)) {
        resolve(outputVideo);
      } else {
        reject(new Error(OUTPUT_NOT_CREATED));
      }

    } catch (error) {
      reject(new Error(UNEXPECTED_ERROR.replace('{error}', error.message)));
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

// Main execution (CLI)
async function main() {
    try {
      // CLI argument parsing
      const args = process.argv.slice(2);
      let videoPath = args[0];
      // Chemin du dossier Téléchargements (français ou anglais)
      const downloadsDir = fs.existsSync(path.join(process.env.HOME, 'Téléchargements'))
        ? path.join(process.env.HOME, 'Téléchargements')
        : path.join(process.env.HOME, 'Downloads');
      let imagePath = downloadsDir; // Toujours le dossier téléchargements

      // Sélection interactive de la vidéo si non précisée
      if (!videoPath) {
        if (!fs.existsSync(VIDEOS_DIR)) {
          console.error(`Le dossier ${VIDEOS_DIR} n'existe pas.`);
          process.exit(1);
        }
        const allFiles = fs.readdirSync(VIDEOS_DIR);
        const videoFiles = allFiles.filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()));
        if (videoFiles.length === 0) {
          console.error(`Aucune vidéo trouvée dans ${VIDEOS_DIR}.`);
          process.exit(1);
        }
        // Sélection interactive avec inquirer
        const inquirer = (await import('inquirer')).default;
        const { videoChoice } = await inquirer.prompt([
          {
            type: 'list',
            name: 'videoChoice',
            message: 'Sélectionnez la vidéo à traiter :',
            choices: videoFiles,
          },
        ]);
        videoPath = path.join(VIDEOS_DIR, videoChoice);
      }

      // Toujours prendre la plus récente du dossier téléchargements
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

      // Validation des chemins
      if (!videoPath || !imagePath) {
        console.error(MISSING_ARGUMENTS);
        console.log(USAGE_INFO);
        process.exit(1);
      }

      console.log('🎬 Démarrage du traitement vidéo...');
      console.log(`🎥 Fichier vidéo: ${videoPath}`);
      if (imageFromDirectory) {
        console.log(`🖼️ Fichier image (le plus récent du répertoire): ${imagePath}`);
      } else {
        console.log(`🖼️ Fichier image: ${imagePath}`);
      }
      console.log(`📁 Répertoire de sortie (même chemin que l'image): ${outputDir}`);

      try {
        // Process the video
        const outputPath = await processVideo(videoPath, imagePath, outputDir);
        console.log(VIDEO_PROCESSED.replace('{outputPath}', outputPath));
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(error.message || error);
      process.exit(1);
    }
}

main();
