# Electron Vue Recorder

A desktop application built with Electron and Vue.js that allows you to record system audio/video and microphone audio separately.

## Features

- 🖥️ **System Audio/Video Recording**: Capture your screen, windows, and system audio as a video file
- 🎤 **Microphone Audio Recording**: Record audio from your microphone as an audio file
- 🎬 **Separate Controls**: Two independent recording buttons for different audio types
- 💾 **File Management**: Automatically save recordings with timestamps
- 🎨 **Modern UI**: Beautiful, responsive interface built with Vue 3 and TailwindCSS

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

To run the application in development mode:

```bash
npm run dev
```

This will:
- Start the Vue.js development server
- Launch Electron with hot reload
- Open the application window

## Building for Production

To build the application for production:

```bash
npm run build:electron
```

This will create a distributable package in the `dist-electron` folder.

## Usage

### System Audio/Video Recording

1. Select a screen or window source from the dropdown
2. Click "Start Recording" to begin capturing
3. Click "Stop Recording" to finish and save the video file

### Microphone Audio Recording

1. Click "Start Recording" to begin capturing microphone audio
2. Click "Stop Recording" to finish and save the audio file

## Technical Details

- **Frontend**: Vue 3 with Composition API
- **Backend**: Electron with Node.js
- **Recording**: MediaRecorder API with WebM format
- **Desktop Capture**: Electron's desktopCapturer API
- **File Handling**: Electron's dialog API for file saving

## File Structure

```
├── main.js              # Electron main process
├── preload.js           # Preload script for secure IPC
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
├── src/
│   ├── App.vue          # Main Vue component
│   ├── main.js          # Vue app entry point
│   └── style.css        # Global styles
└── index.html           # HTML template
```

## Permissions

The application requires the following permissions:
- Screen recording access
- Microphone access
- File system access (for saving recordings)

## Supported Formats

- **Video**: WebM with VP9 video codec and Opus audio codec
- **Audio**: WebM with Opus audio codec

## Troubleshooting

### Recording Issues

- Ensure you have granted screen recording and microphone permissions
- Check that your system supports the required codecs
- Try restarting the application if recording fails

### Build Issues

- Make sure all dependencies are installed
- Check that Node.js version is compatible
- Clear node_modules and reinstall if needed

## License

MIT License - feel free to use this project for your own applications.
