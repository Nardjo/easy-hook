import { createError, defineEventHandler, readBody, getRequestHeaders, sendStream } from 'h3';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { processVideo, createTempDirectory, cleanupTempFiles } from '../../utils/videoProcessor';

export default defineEventHandler(async (event) => {
  try {
    // Create a temporary directory for processing
    const tempDir = createTempDirectory();
    let videoPath = '';
    let imagePath = '';

    // Parse the multipart form data
    const form = formidable({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
      filter: (part) => {
        // Accept only image and video files
        if (part.mimetype) {
          return part.mimetype.includes('image') || part.mimetype.includes('video');
        }
        return false;
      }
    });

    // Parse the form data
    const { fields, files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      form.parse(event.node.req, (err, fields, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ fields, files });
      });
    });

    // Check if both files were uploaded
    if (!files.video || !files.image) {
      cleanupTempFiles(tempDir);
      throw createError({
        statusCode: 400,
        statusMessage: 'Both video and image files are required'
      });
    }

    // Get file paths
    const videoFile = Array.isArray(files.video) ? files.video[0] : files.video;
    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;

    videoPath = videoFile.filepath;
    imagePath = imageFile.filepath;

    // Process the video
    const outputPath = await processVideo(videoPath, imagePath, tempDir);

    // Set response headers for file download
    event.node.res.setHeader('Content-Type', 'video/mp4');
    event.node.res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);

    // Stream the file to the client
    const fileStream = fs.createReadStream(outputPath);

    // Clean up temporary files after streaming is complete
    fileStream.on('close', () => {
      cleanupTempFiles(tempDir);
    });

    return sendStream(event, fileStream);
  } catch (error) {
    console.error('Error processing video:', error);

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'An unexpected error occurred during video processing'
    });
  }
});
