<template>
  <div class="container">
    <div class="header">
      <h1>🎥 Electron Recorder with Real-time Transcription</h1>
      <p>Record system audio/video and microphone audio with live transcription</p>
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

      <!-- System Audio Chat Display -->
      <div class="chat-section">
        <div class="chat-header">
          <h3>📝 System Audio Chat</h3>
          <div class="diarization-toggle">
            <label class="toggle-label">
              <input 
                type="checkbox" 
                v-model="diarizationEnabled"
                :disabled="systemTranscribing"
                class="toggle-input"
                @change="onDiarizationToggle"
              >
              <span class="toggle-slider"></span>
              <span class="toggle-text">Speaker Diarization</span>
            </label>
            <div class="toggle-status">Status: {{ diarizationEnabled ? 'ON' : 'OFF' }}</div>
          </div>
        </div>
        
        <!-- Only show chat content when transcribing or has messages -->
        <div v-if="systemTranscribing || systemMessages.length > 0">
        <div class="transcription-status">
          <span v-if="systemTranscribing" class="status recording">
            🔴 Transcribing System Audio...
          </span>
          <span v-else-if="systemMessages.length > 0" class="status stopped">
            ⏹️ System Transcription Stopped
          </span>
        </div>
        
        <!-- Speaker Legend -->
        <div v-if="diarizationEnabled && systemSpeakers.size > 0" class="speaker-legend">
          <h4>🎤 Speakers Detected:</h4>
          <div class="speaker-list">
            <span 
              v-for="[speakerId, color] in systemSpeakers" 
              :key="speakerId"
              class="speaker-legend-item"
              :style="{ backgroundColor: color + '20', color: color, borderColor: color }"
            >
              Speaker {{ speakerId + 1 }}
            </span>
          </div>
        </div>
        
        <!-- System Messages Chat -->
        <div class="chat-container system-chat">
          <div class="chat-messages">
            <div 
              v-for="message in systemMessages" 
              :key="message.id"
              class="message system-message"
              :style="{ '--speaker-color': getSpeakerColor(message.speakerId) }"
            >
              <div v-if="diarizationEnabled" class="message-header">
                <span class="speaker-badge" :style="{ backgroundColor: getSpeakerColor(message.speakerId) }">
                  {{ message.speakerLabel }}
                </span>
                <span class="message-time">{{ formatMessageTime(message.timestamp) }}</span>
              </div>
              <div v-else class="message-header">
                <span class="speaker-badge system-badge">System Audio</span>
                <span class="message-time">{{ formatMessageTime(message.timestamp) }}</span>
              </div>
              <div class="message-content">{{ message.text }}</div>
            </div>
          </div>
        </div>
        
        </div>
        
        <div v-if="systemTranscriptionError" class="error-message">
          ❌ {{ systemTranscriptionError }}
        </div>
      </div>
    </div>

    <!-- Microphone Audio Recording Section -->
    <div class="recording-section">
      <h2>
        🎤 Microphone Audio Recording & Live Transcription
        <span v-if="micRecording" class="loading"></span>
      </h2>
      <p>Record audio from your microphone with real-time transcription</p>

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

      <!-- Microphone Chat Display -->
      <div v-if="isTranscribing || chatMessages.length > 0" class="chat-section">
        <h3>📝 Microphone Chat (5s bursts)</h3>
        <div class="transcription-status">
          <span v-if="isTranscribing" class="status recording">
            🔴 Transcribing Microphone...
          </span>
          <span v-else-if="chatMessages.length > 0" class="status stopped">
            ⏹️ Microphone Transcription Stopped
          </span>
        </div>
        
        <!-- Current Message Preview -->
        <div v-if="currentMicMessage" class="current-message-preview">
          <div class="preview-label">Current ({{ Math.ceil(micBurstInterval / 1000) }}s burst):</div>
          <div class="preview-text">{{ currentMicMessage }}</div>
        </div>
        
        <!-- Microphone Messages Chat -->
        <div class="chat-container mic-chat">
          <div class="chat-messages">
            <div 
              v-for="message in chatMessages" 
              :key="message.id"
              class="message mic-message"
            >
              <div class="message-header">
                <span class="speaker-badge mic-badge">You</span>
                <span class="message-time">{{ formatMessageTime(message.timestamp) }}</span>
              </div>
              <div class="message-content">{{ message.text }}</div>
            </div>
          </div>
        </div>
        
        <div v-if="transcriptionError" class="error-message">
          ❌ {{ transcriptionError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'

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

// System transcription state
const systemTranscribing = ref(false)
const systemTranscriptionText = ref('')
const systemFinalTranscriptionText = ref('')
const systemInterimTranscriptionText = ref('')
const systemTranscriptionError = ref('')
const systemWs = ref(null)
const systemAudioContext = ref(null)
const systemProcessor = ref(null)
const systemMicrophone = ref(null)
const systemSpeakers = ref(new Map()) // Track speakers and their colors
const systemMessages = ref([]) // Store system speaker messages
const diarizationEnabled = ref(true) // Toggle for speaker diarization

// Microphone recording state
const micRecording = ref(false)
const micRecordingTime = ref(0)
const micError = ref('')
const micSuccess = ref('')
const micMediaRecorder = ref(null)
const micChunks = ref([])
let micTimer = null

// Transcription state
const isTranscribing = ref(false)
const transcriptionText = ref('')
const finalTranscriptionText = ref('')
const interimTranscriptionText = ref('')
const transcriptionError = ref('')
const ws = ref(null)
const audioContext = ref(null)
const processor = ref(null)
const microphone = ref(null)

// Chat messages
const chatMessages = ref([])
const currentMicMessage = ref('')
const micBurstTimer = ref(null)
const micBurstInterval = 5000 // 5 seconds
const systemBurstTimer = ref(null)
const systemBurstInterval = 5000 // 5 seconds

// Speaker color generation
const getSpeakerColor = (speakerId) => {
  if (!systemSpeakers.value.has(speakerId)) {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c', 
      '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
      '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
    ]
    const colorIndex = systemSpeakers.value.size % colors.length
    systemSpeakers.value.set(speakerId, colors[colorIndex])
  }
  return systemSpeakers.value.get(speakerId)
}

// Message management functions
const addSystemMessage = (speakerId, speakerLabel, text, isFinal = true) => {
  if (diarizationEnabled.value) {
    // Individual speaker messages
    const message = {
      id: Date.now() + Math.random(),
      type: 'system',
      speakerId,
      speakerLabel,
      text: text.trim(),
      timestamp: new Date(),
      isFinal
    }
    systemMessages.value.push(message)
  } else {
    // Accumulate text for burst messages (similar to mic)
    if (!systemMessages.value.length || systemMessages.value[systemMessages.value.length - 1].isAccumulating) {
      // Create new message or add to existing accumulating message
      if (systemMessages.value.length && systemMessages.value[systemMessages.value.length - 1].isAccumulating) {
        systemMessages.value[systemMessages.value.length - 1].text += ' ' + text.trim()
        systemMessages.value[systemMessages.value.length - 1].timestamp = new Date()
      } else {
        const message = {
          id: Date.now() + Math.random(),
          type: 'system',
          speakerId: 0,
          speakerLabel: 'System Audio',
          text: text.trim(),
          timestamp: new Date(),
          isFinal: false,
          isAccumulating: true
        }
        systemMessages.value.push(message)
      }
    } else {
      // Create new accumulating message
      const message = {
        id: Date.now() + Math.random(),
        type: 'system',
        speakerId: 0,
        speakerLabel: 'System Audio',
        text: text.trim(),
        timestamp: new Date(),
        isFinal: false,
        isAccumulating: true
      }
      systemMessages.value.push(message)
    }
  }
}

const addMicMessage = (text, isFinal = true) => {
  const message = {
    id: Date.now() + Math.random(),
    type: 'microphone',
    text: text.trim(),
    timestamp: new Date(),
    isFinal
  }
  chatMessages.value.push(message)
}

const startMicBurstTimer = () => {
  if (micBurstTimer.value) {
    clearInterval(micBurstTimer.value)
  }
  
  micBurstTimer.value = setInterval(() => {
    if (currentMicMessage.value.trim()) {
      addMicMessage(currentMicMessage.value, true)
      currentMicMessage.value = ''
    }
  }, micBurstInterval)
}

const stopMicBurstTimer = () => {
  if (micBurstTimer.value) {
    clearInterval(micBurstTimer.value)
    micBurstTimer.value = null
  }
  
  // Add any remaining message
  if (currentMicMessage.value.trim()) {
    addMicMessage(currentMicMessage.value, true)
    currentMicMessage.value = ''
  }
}

const startSystemBurstTimer = () => {
  if (systemBurstTimer.value) {
    clearInterval(systemBurstTimer.value)
  }
  
  systemBurstTimer.value = setInterval(() => {
    // Finalize any accumulating system messages
    if (systemMessages.value.length && systemMessages.value[systemMessages.value.length - 1].isAccumulating) {
      systemMessages.value[systemMessages.value.length - 1].isAccumulating = false
      systemMessages.value[systemMessages.value.length - 1].isFinal = true
    }
  }, systemBurstInterval)
}

const stopSystemBurstTimer = () => {
  if (systemBurstTimer.value) {
    clearInterval(systemBurstTimer.value)
    systemBurstTimer.value = null
  }
  
  // Finalize any remaining accumulating message
  if (systemMessages.value.length && systemMessages.value[systemMessages.value.length - 1].isAccumulating) {
    systemMessages.value[systemMessages.value.length - 1].isAccumulating = false
    systemMessages.value[systemMessages.value.length - 1].isFinal = true
  }
}

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
  if (micBurstTimer.value) clearInterval(micBurstTimer.value)
  if (systemBurstTimer.value) clearInterval(systemBurstTimer.value)
  if (systemMediaRecorder.value) systemMediaRecorder.value.stop()
  if (micMediaRecorder.value) micMediaRecorder.value.stop()
  
  // Cleanup transcription
  stopTranscription()
  stopSystemTranscription()
  if (ws.value) ws.value.close()
  if (systemWs.value) systemWs.value.close()
  if (audioContext.value) audioContext.value.close()
  if (systemAudioContext.value) systemAudioContext.value.close()
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

    // Start real-time transcription for system audio
    await startSystemTranscription(stream)

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
  
  // Stop system transcription
  stopSystemTranscription()
}

// Microphone recording functions
const startMicRecording = async () => {
  try {
    micError.value = ''
    micSuccess.value = ''
    transcriptionError.value = ''
    
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000 // Deepgram works best with 16kHz
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

    // Start burst-based transcription
    await startTranscription(stream)
    startMicBurstTimer()

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
  
  // Stop transcription and burst timer
  stopTranscription()
  stopMicBurstTimer()
}

// Utility function to format time
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format message timestamp
const formatMessageTime = (timestamp) => {
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Transcription functions
const startTranscription = async (stream) => {
  try {
    // Connect to WebSocket server
    ws.value = new WebSocket('ws://localhost:3000')
    
    ws.value.onopen = () => {
      console.log('WebSocket connected')
      isTranscribing.value = true
      transcriptionText.value = ''
      finalTranscriptionText.value = ''
      interimTranscriptionText.value = ''
      transcriptionError.value = ''
      currentMicMessage.value = ''
      chatMessages.value = [] // Clear previous messages
      
      // Send start transcription message
      ws.value.send(JSON.stringify({
        type: 'start_transcription'
      }))
      
      // Set up audio processing
      setupAudioProcessing(stream)
    }
    
    ws.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'transcription':
          if (data.transcript && data.transcript.trim()) {
            if (data.is_final) {
              // Add to current mic message for burst processing
              currentMicMessage.value += data.transcript + ' '
            } else {
              // Update interim results (not used in burst mode)
              interimTranscriptionText.value = data.transcript
            }
          }
          break
          
        case 'transcription_stopped':
          isTranscribing.value = false
          break
          
        case 'error':
          transcriptionError.value = data.message
          isTranscribing.value = false
          break
      }
    }
    
    ws.value.onclose = () => {
      console.log('WebSocket disconnected')
      isTranscribing.value = false
    }
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
      transcriptionError.value = 'Connection error occurred'
      isTranscribing.value = false
    }
    
  } catch (error) {
    console.error('Error starting transcription:', error)
    transcriptionError.value = 'Failed to start transcription'
  }
}

const setupAudioProcessing = (stream) => {
  try {
    // Create audio context
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    })
    
    // Get microphone input
    microphone.value = audioContext.value.createMediaStreamSource(stream)
    
    // Create script processor for real-time audio processing
    processor.value = audioContext.value.createScriptProcessor(4096, 1, 1)
    
    processor.value.onaudioprocess = (event) => {
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }
        
        // Convert to base64 and send
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)))
        
        ws.value.send(JSON.stringify({
          type: 'audio_data',
          data: base64Data
        }))
      }
    }
    
    // Connect audio processing chain
    microphone.value.connect(processor.value)
    processor.value.connect(audioContext.value.destination)
    
  } catch (error) {
    console.error('Error setting up audio processing:', error)
    transcriptionError.value = 'Failed to set up audio processing'
  }
}

const stopTranscription = () => {
  if (ws.value) {
    ws.value.send(JSON.stringify({
      type: 'stop_transcription'
    }))
    ws.value.close()
    ws.value = null
  }
  
  if (processor.value) {
    processor.value.disconnect()
    processor.value = null
  }
  
  if (microphone.value) {
    microphone.value.disconnect()
    microphone.value = null
  }
  
  isTranscribing.value = false
}

// System transcription functions
const startSystemTranscription = async (stream) => {
  try {
    // Connect to WebSocket server for system audio
    systemWs.value = new WebSocket('ws://localhost:3000')
    
    systemWs.value.onopen = () => {
      console.log('System WebSocket connected')
      systemTranscribing.value = true
      systemTranscriptionText.value = ''
      systemFinalTranscriptionText.value = ''
      systemInterimTranscriptionText.value = ''
      systemTranscriptionError.value = ''
      systemSpeakers.value.clear() // Reset speakers for new session
      systemMessages.value = [] // Clear previous messages
      
      // Send start transcription message with diarization setting
      systemWs.value.send(JSON.stringify({
        type: 'start_transcription',
        diarization: diarizationEnabled.value
      }))
      
      // Set up audio processing for system audio
      setupSystemAudioProcessing(stream)
      
      // Start burst timer if diarization is disabled
      if (!diarizationEnabled.value) {
        startSystemBurstTimer()
      }
    }
    
    systemWs.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'transcription':
          if (data.transcript && data.transcript.trim()) {
            if (data.is_final) {
              // Add system message immediately for chat format
              addSystemMessage(
                data.speaker || 0, 
                data.speaker_label || 'Speaker 1', 
                data.transcript, 
                true
              )
            } else {
              // Update interim results (not used in chat mode)
              const speakerInfo = data.speaker_label ? `[${data.speaker_label}] ` : ''
              systemInterimTranscriptionText.value = speakerInfo + data.transcript
            }
          }
          break
          
        case 'transcription_stopped':
          systemTranscribing.value = false
          break
          
        case 'error':
          systemTranscriptionError.value = data.message
          systemTranscribing.value = false
          break
      }
    }
    
    systemWs.value.onclose = () => {
      console.log('System WebSocket disconnected')
      systemTranscribing.value = false
    }
    
    systemWs.value.onerror = (error) => {
      console.error('System WebSocket error:', error)
      systemTranscriptionError.value = 'Connection error occurred'
      systemTranscribing.value = false
    }
    
  } catch (error) {
    console.error('Error starting system transcription:', error)
    systemTranscriptionError.value = 'Failed to start system transcription'
  }
}

const setupSystemAudioProcessing = (stream) => {
  try {
    // Create audio context for system audio
    systemAudioContext.value = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    })
    
    // Get system audio input
    systemMicrophone.value = systemAudioContext.value.createMediaStreamSource(stream)
    
    // Create script processor for real-time audio processing
    systemProcessor.value = systemAudioContext.value.createScriptProcessor(4096, 1, 1)
    
    systemProcessor.value.onaudioprocess = (event) => {
      if (systemWs.value && systemWs.value.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }
        
        // Convert to base64 and send
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)))
        
        systemWs.value.send(JSON.stringify({
          type: 'audio_data',
          data: base64Data
        }))
      }
    }
    
    // Connect audio processing chain
    systemMicrophone.value.connect(systemProcessor.value)
    systemProcessor.value.connect(systemAudioContext.value.destination)
    
  } catch (error) {
    console.error('Error setting up system audio processing:', error)
    systemTranscriptionError.value = 'Failed to set up system audio processing'
  }
}

const stopSystemTranscription = () => {
  if (systemWs.value) {
    systemWs.value.send(JSON.stringify({
      type: 'stop_transcription'
    }))
    systemWs.value.close()
    systemWs.value = null
  }
  
  if (systemProcessor.value) {
    systemProcessor.value.disconnect()
    systemProcessor.value = null
  }
  
  if (systemMicrophone.value) {
    systemMicrophone.value.disconnect()
    systemMicrophone.value = null
  }
  
  // Stop burst timer
  stopSystemBurstTimer()
  
  systemTranscribing.value = false
}

// Computed properties for chat interface
const hasSystemMessages = computed(() => systemMessages.value.length > 0)
const hasMicMessages = computed(() => chatMessages.value.length > 0)

// Auto-scroll chat containers
const scrollToBottom = (containerClass) => {
  nextTick(() => {
    const container = document.querySelector(`.${containerClass} .chat-messages`)
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

// Watch for new messages and auto-scroll
watch(systemMessages, () => {
  scrollToBottom('system-chat')
}, { deep: true })

watch(chatMessages, () => {
  scrollToBottom('mic-chat')
}, { deep: true })

// Handle diarization toggle change
const onDiarizationToggle = () => {
  console.log('Diarization toggle clicked, new value:', diarizationEnabled.value)
}

// Watch for diarization toggle changes
watch(diarizationEnabled, (newValue) => {
  console.log('Diarization toggle changed to:', newValue)
  
  // If currently transcribing, restart with new setting
  if (systemTranscribing.value && systemWs.value) {
    console.log('Restarting system transcription with new diarization setting')
    
    // Send new diarization setting to server
    systemWs.value.send(JSON.stringify({
      type: 'update_diarization',
      diarization: newValue
    }))
    
    // Clear current messages and restart burst timer if needed
    if (!newValue) {
      // Diarization disabled - start burst timer
      startSystemBurstTimer()
    } else {
      // Diarization enabled - stop burst timer
      stopSystemBurstTimer()
    }
  }
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.header p {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.recording-section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  border: 1px solid #e1e5e9;
}

.recording-section h2 {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.recording-section p {
  color: #7f8c8d;
  margin-bottom: 25px;
  font-size: 1rem;
  line-height: 1.5;
}

.source-selector {
  margin-bottom: 25px;
}

.source-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #34495e;
}

.source-selector select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.3s ease;
}

.source-selector select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.controls {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-danger {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
}

.status {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
}

.status.recording {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.status.stopped {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.timer {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  text-align: center;
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #e9ecef;
}

.recording-preview {
  margin-top: 20px;
  text-align: center;
}

.recording-preview video {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.error-message, .success-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 15px;
  font-weight: 600;
}

.error-message {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.success-message {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.loading {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Chat Styles */
.chat-section {
  margin-top: 30px;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.chat-section h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.transcription-status {
  margin-bottom: 20px;
}

.chat-container {
  background: white;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 15px;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 18px;
  position: relative;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.system-message {
  background: #f1f3f4;
  border: 1px solid #e0e0e0;
  align-self: flex-start;
  margin-right: auto;
}

.mic-message {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  align-self: flex-end;
  margin-left: auto;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.speaker-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.system-message .speaker-badge {
  background: var(--speaker-color, #667eea);
  color: white;
}

.mic-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.7;
  color: #666;
}

.mic-message .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.4;
  word-wrap: break-word;
}

.current-message-preview {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 15px;
}

.preview-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 4px;
}

.preview-text {
  font-size: 0.9rem;
  color: #424242;
  font-style: italic;
}

/* Chat Header Styles */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.chat-header h3 {
  margin: 0;
}

/* Toggle Styles */
.diarization-toggle {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 50px;
  height: 24px;
  background: #ccc;
  border-radius: 12px;
  margin-right: 10px;
  transition: background 0.3s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background: #667eea;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(26px);
}

.toggle-input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
}

.toggle-status {
  font-size: 0.8rem;
  color: #666;
  margin-left: 10px;
  font-weight: 500;
}

/* System Badge Styles */
.system-badge {
  background: #6c757d !important;
  color: white !important;
}

.speaker-label {
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.speaker-label:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Speaker Legend Styles */
.speaker-legend {
  margin-bottom: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.speaker-legend h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
}

.speaker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.speaker-legend-item {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
  border: 1px solid;
  transition: all 0.2s ease;
}

.speaker-legend-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 15px;
  }
  
  .header h1 {
    font-size: 2rem;
  }
  
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .btn {
    justify-content: center;
  }
  
  .recording-section {
    padding: 20px;
  }
}
</style>
