import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// File paths and names (constants)
const TEMP_JPEG_FILENAME = "temp_hook.jpg";
const OUTPUT_FILE_PREFIX = "processed_";

// Video processing parameters (constants)
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const FRAME_DURATION = 0.033; // in seconds

// Command strings (constants)
const SIPS_COMMAND = 'sips -s format jpeg "{imagePath}" --out "{jpegPath}"';
const IMAGEMAGICK_CHECK_COMMAND = "command -v convert";
const IMAGEMAGICK_CONVERT_COMMAND = 'convert "{imagePath}" "{jpegPath}"';
const FFMPEG_COMMAND =
	'ffmpeg -i "{videoPath}" -i "{jpegPath}" ' +
	'-filter_complex "[1:v]scale={videoWidth}:{videoHeight}:force_original_aspect_ratio=decrease,' +
	"pad={videoWidth}:{videoHeight}:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS[overlay];" +
	"[0:v][overlay]overlay=0:0:enable='lt(t,{frameDuration})'\" " +
	'-c:a copy "{outputVideo}"';

// Error messages
const VIDEO_NOT_FOUND = "Fichier vidéo introuvable à {videoPath}";
const IMAGE_NOT_FOUND = "Fichier image introuvable à {imagePath}";
const HEIC_CONVERSION_FAILED =
	"Échec de la conversion HEIC en JPEG. Veuillez vous assurer que sips ou ImageMagick est installé.";
const FFMPEG_FAILED = "Le traitement ffmpeg a échoué: {error}";
const OUTPUT_NOT_CREATED = "Le fichier de sortie n'a pas été créé";
const UNEXPECTED_ERROR = "Une erreur inattendue s'est produite: {error}";
const SIPS_FAILED =
	"La conversion sips a échoué, essai d'une méthode alternative avec ImageMagick...";

/**
 * Process a video by adding an image as the first frame
 * @param {string} videoPath - Path to the video file
 * @param {string} imagePath - Path to the image file (HEIC or other format)
 * @param {string} outputDir - Directory to save the output
 * @returns {Promise<string>} - Path to the processed video
 */
export async function processVideo(videoPath, imagePath, outputDir) {
	return new Promise(async (resolve, reject) => {
		try {
			// Check if files exist
			if (!fs.existsSync(videoPath)) {
				return reject(
					new Error(VIDEO_NOT_FOUND.replace("{videoPath}", videoPath)),
				);
			}

			if (!fs.existsSync(imagePath)) {
				return reject(
					new Error(IMAGE_NOT_FOUND.replace("{imagePath}", imagePath)),
				);
			}

			// Create output directory if it doesn't exist
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			// 1) Convert image to JPEG if it's HEIC
			const isHeic = imagePath.toLowerCase().endsWith(".heic");
			let jpegPath = imagePath;

			if (isHeic) {
				jpegPath = path.join(outputDir, TEMP_JPEG_FILENAME);

				// Try using sips for conversion (macOS)
				try {
					const sipsCommand = SIPS_COMMAND.replace(
						"{imagePath}",
						imagePath,
					).replace("{jpegPath}", jpegPath);
					execSync(sipsCommand, { stdio: "pipe" });
					console.log("HEIC converted to JPEG using sips");
				} catch (error) {
					console.log(SIPS_FAILED);

					// Check if ImageMagick is installed
					try {
						execSync(IMAGEMAGICK_CHECK_COMMAND, { stdio: "pipe" });
						const convertCommand = IMAGEMAGICK_CONVERT_COMMAND.replace(
							"{imagePath}",
							imagePath,
						).replace("{jpegPath}", jpegPath);
						execSync(convertCommand, { stdio: "pipe" });
						console.log("HEIC converted to JPEG using ImageMagick");
					} catch (error) {
						return reject(new Error(HEIC_CONVERSION_FAILED));
					}
				}
			}

			// 2) Insert the image as the first frame
			console.log("Processing video with ffmpeg...");
			const outputVideo = path.join(
				outputDir,
				`${OUTPUT_FILE_PREFIX}${path.basename(videoPath)}`,
			);

			try {
				const ffmpegCommand = FFMPEG_COMMAND.replace("{videoPath}", videoPath)
					.replace("{jpegPath}", jpegPath)
					.replace(/{videoWidth}/g, VIDEO_WIDTH)
					.replace(/{videoHeight}/g, VIDEO_HEIGHT)
					.replace("{frameDuration}", FRAME_DURATION)
					.replace("{outputVideo}", outputVideo);
				execSync(ffmpegCommand, { stdio: "pipe" });
			} catch (error) {
				return reject(
					new Error(FFMPEG_FAILED.replace("{error}", error.message)),
				);
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
			reject(new Error(UNEXPECTED_ERROR.replace("{error}", error.message)));
		}
	});
}

/**
 * Creates a temporary directory for processing
 * @returns {string} Path to the temporary directory
 */
export function createTempDirectory() {
	const tempDir = path.join(process.cwd(), "tmp", `process-${Date.now()}`);
	fs.mkdirSync(tempDir, { recursive: true });
	return tempDir;
}

/**
 * Cleans up temporary files and directories
 * @param {string} dirPath - Path to the directory to clean up
 * @param {boolean} removeDir - Whether to remove the directory itself
 */
export function cleanupTempFiles(dirPath, removeDir = true) {
	if (fs.existsSync(dirPath)) {
		const files = fs.readdirSync(dirPath);

		for (const file of files) {
			const filePath = path.join(dirPath, file);
			if (fs.statSync(filePath).isDirectory()) {
				cleanupTempFiles(filePath, true);
			} else {
				fs.unlinkSync(filePath);
			}
		}

		if (removeDir) {
			fs.rmdirSync(dirPath);
		}
	}
}
