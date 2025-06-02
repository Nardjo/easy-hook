# Video Processor

A command-line application that allows you to process videos by adding an image as the first frame.

## Features

- Support for HEIC image format (automatically converts to JPEG)
- Customizable output directory
- Simple command-line interface

## Requirements

- Node.js and npm
- ffmpeg (for video processing)
- On macOS: sips or ImageMagick (for HEIC conversion)

## Installation

1. Clone this repository or download the source code
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Make the script globally available (optional):

```bash
npm link
```

## Usage

Run the application with the required arguments:

```bash
video-processor <video-file> <image-file> <output-directory>
```

For example:

```bash
video-processor video.mp4 image.jpg ~/Videos/output
```

Or if you didn't install it globally:

```bash
npm start -- video.mp4 image.jpg ~/Videos/output
```

### Arguments

- `video-file`: Path to the video file
- `image-file`: Path to the image file (HEIC, JPEG, PNG)
- `output-directory`: Directory to save the processed video

### Help

To see usage information:

```bash
video-processor --help
```

## How It Works

The application:
1. Takes a video file and an image file as input
2. Converts HEIC images to JPEG if necessary
3. Adds the image as the first frame of the video
4. Saves the processed video to the specified output directory

The application uses:
- ffmpeg for video processing
- sips or ImageMagick for HEIC conversion (on macOS)

## Development

This project is structured as follows:

- `process_video.js` - Command-line interface
- `video-processor.js` - Video processing logic
- `config.js` - Configuration variables and messages
- `package.json` - Project configuration

To modify the application:
1. Make your changes to the source code
2. Test with `npm start -- <arguments>`

To customize the application behavior:
1. Edit the variables in `config.js` to change parameters like video dimensions or output file names
2. No recompilation is needed - changes take effect immediately

## File Structure Explained

If you're wondering which file to use:

- **process_video.js**: This is the main file you should run directly. It's the command-line interface that accepts your input arguments (video file, image file, output directory) and displays the results. You run this file using the commands shown in the Usage section above.

- **video-processor.js**: This is a module file that contains the core video processing logic. You don't run this file directly - it's imported and used by process_video.js. If you're a developer looking to understand or modify how the video processing works, this is the file to examine.

- **config.js**: This file contains all the configurable parameters and messages used by the application. You don't run this file directly, but you can edit it to customize the application's behavior without changing the core logic. For example, you can change the video dimensions, output file naming, or error messages.

The relationship between these files:
1. When you run `npm start` or `video-processor` command, process_video.js is executed
2. process_video.js imports configuration from config.js and parses your command-line arguments
3. process_video.js calls the processVideo function from video-processor.js
4. video-processor.js imports configuration from config.js and does the actual work of processing the video
5. video-processor.js returns the result to process_video.js
6. process_video.js displays the result to you

## License

MIT
