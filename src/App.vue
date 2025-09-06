<template>
  <div class="container">
    <div class="header">
      <h1>🎥 Electron Recorder</h1>
      <p>Record system audio/video and microphone audio separately</p>
    </div>

    <!-- System Audio/Video Recording Section -->
    <div class="recording-section">
      <h2>
        🖥️ System Audio & Video Recording
        <span v-if="systemRecording" class="loading"></span>
      </h2>
      <p>Capture your screen, windows, and system audio as a video file</p>
      
      <div class="source-selector">
        <label for="screen-source">Select Screen/Window:</label>
        <select 
          id="screen-source" 
          v-model="selectedScreenSource"
          :disabled="systemRecording"
        >
          <option value="">Choose a source...</option>
          <option 
            v-for="source in screenSources" 
            :key="source.id" 
            :value="source.id"
          >
            {{ source.name }} ({{ source.id }})
          </option>
        </select>
      </div>

      <div class="controls">
        <button 
          class="btn btn-primary"
          @click="startSystemRecording"
          :disabled="systemRecording || !selectedScreenSource"
        >
          🎬 Start Recording
        </button>
        
        <button 
          class="btn btn-danger"
          @click="stopSystemRecording"
          :disabled="!systemRecording"
        >
          ⏹️ Stop Recording
        </button>
        
        <div v-if="systemRecording" class="status recording">
          🔴 Recording System Audio/Video
        </div>
        
        <div v-if="!systemRecording && systemRecordingTime > 0" class="status stopped">
          ✅ Recording Stopped
        </div>
      </div>

      <div v-if="systemRecording" class="timer">
        {{ formatTime(systemRecordingTime) }}
      </div>

      <div v-if="systemPreview" class="recording-preview">
        <video ref="systemVideoRef" autoplay muted></video>
      </div>

      <div v-if="systemError" class="error-message">
        ❌ {{ systemError }}
      </div>

      <div v-if="systemSuccess" class="success-message">
        ✅ {{ systemSuccess }}
      </div>
    </div>

    <!-- Microphone Audio Recording Section -->
    <div class="recording-section">
      <h2>
        🎤 Microphone Audio Recording
        <span v-if="micRecording" class="loading"></span>
      </h2>
      <p>Record audio from your microphone as an audio file</p>

      <div class="controls">
        <button 
          class="btn btn-primary"
          @click="startMicRecording"
          :disabled="micRecording"
        >
          🎙️ Start Recording
        </button>
        
        <button 
          class="btn btn-danger"
          @click="stopMicRecording"
          :disabled="!micRecording"
        >
          ⏹️ Stop Recording
        </button>
        
        <div v-if="micRecording" class="status recording">
          🔴 Recording Microphone
        </div>
        
        <div v-if="!micRecording && micRecordingTime > 0" class="status stopped">
          ✅ Recording Stopped
        </div>
      </div>

      <div v-if="micRecording" class="timer">
        {{ formatTime(micRecordingTime) }}
      </div>

      <div v-if="micError" class="error-message">
        ❌ {{ micError }}
      </div>

      <div v-if="micSuccess" class="success-message">
        ✅ {{ micSuccess }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// System recording state
const systemRecording = ref(false)
const systemRecordingTime = ref(0)
const systemPreview = ref(false)
const systemError = ref('')
const systemSuccess = ref('')
const selectedScreenSource = ref('')
const screenSources = ref([])
const systemVideoRef = ref(null)
const systemMediaRecorder = ref(null)
const systemChunks = ref([])
let systemTimer = null

// Microphone recording state
const micRecording = ref(false)
const micRecordingTime = ref(0)
const micError = ref('')
const micSuccess = ref('')
const micMediaRecorder = ref(null)
const micChunks = ref([])
let micTimer = null

// Load screen sources on mount
onMounted(async () => {
  try {
    const sources = await window.electronAPI.getDesktopSources()
    screenSources.value = sources
  } catch (error) {
    console.error('Error loading screen sources:', error)
    systemError.value = 'Failed to load screen sources'
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (systemTimer) clearInterval(systemTimer)
  if (micTimer) clearInterval(micTimer)
  if (systemMediaRecorder.value) systemMediaRecorder.value.stop()
  if (micMediaRecorder.value) micMediaRecorder.value.stop()
})

// System recording functions
const startSystemRecording = async () => {
  try {
    systemError.value = ''
    systemSuccess.value = ''
    
    const source = screenSources.value.find(s => s.id === selectedScreenSource.value)
    if (!source) {
      throw new Error('No source selected')
    }

    // Get user media with the selected screen source
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    })

    // Set up video preview
    if (systemVideoRef.value) {
      systemVideoRef.value.srcObject = stream
      systemPreview.value = true
    }

    // Set up media recorder
    systemMediaRecorder.value = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    })

    systemChunks.value = []

    systemMediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        systemChunks.value.push(event.data)
      }
    }

    systemMediaRecorder.value.onstop = async () => {
      const blob = new Blob(systemChunks.value, { type: 'video/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      
      try {
        const result = await window.electronAPI.saveFile({
          data: Array.from(new Uint8Array(arrayBuffer)),
          filename: `system-recording-${Date.now()}.webm`,
          type: 'video'
        })
        
        if (result.success) {
          systemSuccess.value = `Video saved to: ${result.path}`
        }
      } catch (error) {
        systemError.value = 'Failed to save video file'
      }
    }

    systemMediaRecorder.value.start()
    systemRecording.value = true
    systemRecordingTime.value = 0
    
    // Start timer
    systemTimer = setInterval(() => {
      systemRecordingTime.value++
    }, 1000)

  } catch (error) {
    console.error('Error starting system recording:', error)
    systemError.value = `Failed to start recording: ${error.message}`
  }
}

const stopSystemRecording = () => {
  if (systemMediaRecorder.value && systemRecording.value) {
    systemMediaRecorder.value.stop()
    systemRecording.value = false
    systemPreview.value = false
    
    if (systemTimer) {
      clearInterval(systemTimer)
      systemTimer = null
    }

    // Stop all tracks
    if (systemVideoRef.value && systemVideoRef.value.srcObject) {
      const tracks = systemVideoRef.value.srcObject.getTracks()
      tracks.forEach(track => track.stop())
    }
  }
}

// Microphone recording functions
const startMicRecording = async () => {
  try {
    micError.value = ''
    micSuccess.value = ''
    
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    })

    // Set up media recorder
    micMediaRecorder.value = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    })

    micChunks.value = []

    micMediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        micChunks.value.push(event.data)
      }
    }

    micMediaRecorder.value.onstop = async () => {
      const blob = new Blob(micChunks.value, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      
      try {
        const result = await window.electronAPI.saveFile({
          data: Array.from(new Uint8Array(arrayBuffer)),
          filename: `microphone-recording-${Date.now()}.webm`,
          type: 'audio'
        })
        
        if (result.success) {
          micSuccess.value = `Audio saved to: ${result.path}`
        }
      } catch (error) {
        micError.value = 'Failed to save audio file'
      }
    }

    micMediaRecorder.value.start()
    micRecording.value = true
    micRecordingTime.value = 0
    
    // Start timer
    micTimer = setInterval(() => {
      micRecordingTime.value++
    }, 1000)

  } catch (error) {
    console.error('Error starting microphone recording:', error)
    micError.value = `Failed to start recording: ${error.message}`
  }
}

const stopMicRecording = () => {
  if (micMediaRecorder.value && micRecording.value) {
    micMediaRecorder.value.stop()
    micRecording.value = false
    
    if (micTimer) {
      clearInterval(micTimer)
      micTimer = null
    }

    // Stop all tracks
    if (micMediaRecorder.value.stream) {
      const tracks = micMediaRecorder.value.stream.getTracks()
      tracks.forEach(track => track.stop())
    }
  }
}

// Utility function to format time
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>
