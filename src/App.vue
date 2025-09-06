<template>
  <div class="unified-container">
    <!-- Header with Controls -->
    <div class="unified-header">
      <div class="header-content">
        <h1>🎥 Live Transcription Chat</h1>
        <div class="controls-section">
          <!-- Screen Source Selection -->
      <div class="source-selector">
        <select 
          v-model="selectedScreenSource"
              :disabled="isRecording"
              class="source-select"
        >
              <option value="">Choose screen/window...</option>
          <option 
            v-for="source in screenSources" 
            :key="source.id" 
            :value="source.id"
          >
                {{ source.name }}
          </option>
        </select>
      </div>

          <!-- Diarization Toggle -->
          <div class="diarization-toggle">
            <label class="toggle-label">
              <input 
                type="checkbox" 
                v-model="diarizationEnabled"
                :disabled="isRecording"
                class="toggle-input"
                @change="onDiarizationToggle"
              >
              <span class="toggle-slider"></span>
              <span class="toggle-text">Speaker Diarization</span>
            </label>
          </div>

          <!-- Main Control Buttons -->
          <div class="main-controls">
        <button 
              class="btn btn-primary btn-large"
              @click="startUnifiedRecording"
              :disabled="isRecording || !selectedScreenSource"
            >
              🎬 Start Transcription
        </button>
        
        <button 
              class="btn btn-danger btn-large"
              @click="stopUnifiedRecording"
              :disabled="!isRecording"
            >
              ⏹️ Stop Transcription
        </button>
        </div>
        
          <!-- Status and Timer -->
          <div class="status-section">
            <div v-if="isRecording" class="status recording">
              🔴 Live Transcription Active
        </div>
            <div v-if="isRecording" class="timer">
              {{ formatTime(recordingTime) }}
      </div>
      </div>
      </div>
      </div>
      </div>

    <!-- Unified Chat Interface -->
    <div class="unified-chat">
      <!-- Speaker Legend (when diarization enabled) -->
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
        
      <!-- Current Message Preview -->
      <div v-if="currentMicMessage" class="current-message-preview">
        <div class="preview-label">You are saying:</div>
        <div class="preview-text">{{ currentMicMessage }}</div>
    </div>

      <!-- Unified Chat Messages -->
      <div class="chat-container">
        <div class="chat-messages" ref="chatMessagesRef">
          <div 
            v-for="message in allMessages" 
            :key="message.id"
            class="message"
            :class="[message.type === 'microphone' ? 'mic-message' : 'system-message']"
            :style="message.type === 'system' && diarizationEnabled ? { '--speaker-color': getSpeakerColor(message.speakerId) } : {}"
          >
            <div class="message-header">
              <span 
                v-if="message.type === 'microphone'"
                class="speaker-badge mic-badge"
              >
                You
              </span>
              <span 
                v-else-if="diarizationEnabled"
                class="speaker-badge" 
                :style="{ backgroundColor: getSpeakerColor(message.speakerId) }"
              >
                {{ message.speakerLabel }}
              </span>
              <span 
                v-else
                class="speaker-badge system-badge"
              >
                System Audio
              </span>
              <span class="message-time">{{ formatMessageTime(message.timestamp) }}</span>
        </div>
            <div class="message-content">{{ message.text }}</div>
        </div>
      </div>
      </div>

      <!-- Error Messages -->
      <div v-if="systemTranscriptionError || transcriptionError" class="error-message">
        ❌ {{ systemTranscriptionError || transcriptionError }}
      </div>
      </div>

    <!-- Video Preview (when recording) -->
    <div v-if="systemPreview" class="video-preview">
      <video ref="systemVideoRef" autoplay muted></video>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'

// Unified recording state
const isRecording = ref(false)
const recordingTime = ref(0)
const systemPreview = ref(false)
const selectedScreenSource = ref('')
const screenSources = ref([])
const systemVideoRef = ref(null)
const systemMediaRecorder = ref(null)
const systemChunks = ref([])
const micMediaRecorder = ref(null)
const micChunks = ref([])
let recordingTimer = null

// Unified transcription state
const systemTranscribing = ref(false)
const micTranscribing = ref(false)
const systemTranscriptionError = ref('')
const transcriptionError = ref('')
const systemWs = ref(null)
const micWs = ref(null)
const systemAudioContext = ref(null)
const micAudioContext = ref(null)
const systemProcessor = ref(null)
const micProcessor = ref(null)
const systemMicrophone = ref(null)
const micMicrophone = ref(null)
const systemSpeakers = ref(new Map()) // Track speakers and their colors
const diarizationEnabled = ref(true) // Toggle for speaker diarization

// Unified chat messages
const allMessages = ref([]) // Combined messages from both sources
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

// Unified message management functions
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
    allMessages.value.push(message)
  } else {
    // Accumulate text for burst messages (similar to mic)
    if (!allMessages.value.length || allMessages.value[allMessages.value.length - 1].isAccumulating) {
      // Create new message or add to existing accumulating message
      if (allMessages.value.length && allMessages.value[allMessages.value.length - 1].isAccumulating) {
        allMessages.value[allMessages.value.length - 1].text += ' ' + text.trim()
        allMessages.value[allMessages.value.length - 1].timestamp = new Date()
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
        allMessages.value.push(message)
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
      allMessages.value.push(message)
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
  allMessages.value.push(message)
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
    if (allMessages.value.length && allMessages.value[allMessages.value.length - 1].isAccumulating) {
      allMessages.value[allMessages.value.length - 1].isAccumulating = false
      allMessages.value[allMessages.value.length - 1].isFinal = true
    }
  }, systemBurstInterval)
}

const stopSystemBurstTimer = () => {
  if (systemBurstTimer.value) {
    clearInterval(systemBurstTimer.value)
    systemBurstTimer.value = null
  }
  
  // Finalize any remaining accumulating message
  if (allMessages.value.length && allMessages.value[allMessages.value.length - 1].isAccumulating) {
    allMessages.value[allMessages.value.length - 1].isAccumulating = false
    allMessages.value[allMessages.value.length - 1].isFinal = true
  }
}

// Unified recording functions
const startUnifiedRecording = async () => {
  try {
    console.log('Starting unified recording...')
    isRecording.value = true
    recordingTime.value = 0
    allMessages.value = []
    systemSpeakers.value.clear()
    
    // Start system recording
    await startSystemRecording()
    
    // Start microphone recording
    await startMicRecording()
    
    // Start unified timer
    recordingTimer = setInterval(() => {
      recordingTime.value++
    }, 1000)
    
  } catch (error) {
    console.error('Error starting unified recording:', error)
    isRecording.value = false
  }
}

const stopUnifiedRecording = () => {
  console.log('Stopping unified recording...')
  isRecording.value = false
  
  // Stop system recording
  stopSystemRecording()
  
  // Stop microphone recording
  stopMicRecording()
  
  // Stop timer
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
}

// Load screen sources on mount
onMounted(async () => {
  try {
    const sources = await window.electronAPI.getDesktopSources()
    screenSources.value = sources
  } catch (error) {
    console.error('Error loading screen sources:', error)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (recordingTimer) clearInterval(recordingTimer)
  if (micBurstTimer.value) clearInterval(micBurstTimer.value)
  if (systemBurstTimer.value) clearInterval(systemBurstTimer.value)
  if (systemMediaRecorder.value) systemMediaRecorder.value.stop()
  if (micMediaRecorder.value) micMediaRecorder.value.stop()
  
  // Cleanup transcription
  stopMicTranscription()
  stopSystemTranscription()
  if (micWs.value) micWs.value.close()
  if (systemWs.value) systemWs.value.close()
  if (micAudioContext.value) micAudioContext.value.close()
  if (systemAudioContext.value) systemAudioContext.value.close()
})

// System recording functions
const startSystemRecording = async () => {
  try {
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

    systemMediaRecorder.value.start()

    // Start real-time transcription for system audio
    await startSystemTranscription(stream)

  } catch (error) {
    console.error('Error starting system recording:', error)
    systemTranscriptionError.value = `Failed to start system recording: ${error.message}`
  }
}

const stopSystemRecording = () => {
  if (systemMediaRecorder.value) {
    systemMediaRecorder.value.stop()
    systemPreview.value = false

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

    micMediaRecorder.value.start()

    // Start burst-based transcription
    await startMicTranscription(stream)
    startMicBurstTimer()

  } catch (error) {
    console.error('Error starting microphone recording:', error)
    transcriptionError.value = `Failed to start microphone recording: ${error.message}`
  }
}

const stopMicRecording = () => {
  if (micMediaRecorder.value) {
    micMediaRecorder.value.stop()

    // Stop all tracks
    if (micMediaRecorder.value.stream) {
      const tracks = micMediaRecorder.value.stream.getTracks()
      tracks.forEach(track => track.stop())
    }
  }
  
  // Stop transcription and burst timer
  stopMicTranscription()
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

// Microphone transcription functions
const startMicTranscription = async (stream) => {
  try {
    // Connect to WebSocket server
    micWs.value = new WebSocket('ws://localhost:3000')
    
    micWs.value.onopen = () => {
      console.log('Microphone WebSocket connected')
      micTranscribing.value = true
      transcriptionError.value = ''
      currentMicMessage.value = ''
      
      // Send start transcription message
      micWs.value.send(JSON.stringify({
        type: 'start_transcription'
      }))
      
      // Set up audio processing
      setupMicAudioProcessing(stream)
    }
    
    micWs.value.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'transcription':
          if (data.transcript && data.transcript.trim()) {
            if (data.is_final) {
              // Add to current mic message for burst processing
              currentMicMessage.value += data.transcript + ' '
            }
          }
          break
          
        case 'transcription_stopped':
          micTranscribing.value = false
          break
          
        case 'error':
          transcriptionError.value = data.message
          micTranscribing.value = false
          break
      }
    }
    
    micWs.value.onclose = () => {
      console.log('Microphone WebSocket disconnected')
      micTranscribing.value = false
    }
    
    micWs.value.onerror = (error) => {
      console.error('Microphone WebSocket error:', error)
      transcriptionError.value = 'Connection error occurred'
      micTranscribing.value = false
    }
    
  } catch (error) {
    console.error('Error starting transcription:', error)
    transcriptionError.value = 'Failed to start transcription'
  }
}

const setupMicAudioProcessing = (stream) => {
  try {
    // Create audio context
    micAudioContext.value = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    })
    
    // Get microphone input
    micMicrophone.value = micAudioContext.value.createMediaStreamSource(stream)
    
    // Create script processor for real-time audio processing
    micProcessor.value = micAudioContext.value.createScriptProcessor(4096, 1, 1)
    
    micProcessor.value.onaudioprocess = (event) => {
      if (micWs.value && micWs.value.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }
        
        // Convert to base64 and send
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)))
        
        micWs.value.send(JSON.stringify({
          type: 'audio_data',
          data: base64Data
        }))
      }
    }
    
    // Connect audio processing chain
    micMicrophone.value.connect(micProcessor.value)
    micProcessor.value.connect(micAudioContext.value.destination)
    
  } catch (error) {
    console.error('Error setting up microphone audio processing:', error)
    transcriptionError.value = 'Failed to set up microphone audio processing'
  }
}

const stopMicTranscription = () => {
  if (micWs.value) {
    micWs.value.send(JSON.stringify({
      type: 'stop_transcription'
    }))
    micWs.value.close()
    micWs.value = null
  }
  
  if (micProcessor.value) {
    micProcessor.value.disconnect()
    micProcessor.value = null
  }
  
  if (micMicrophone.value) {
    micMicrophone.value.disconnect()
    micMicrophone.value = null
  }
  
  micTranscribing.value = false
}

// System transcription functions
const startSystemTranscription = async (stream) => {
  try {
    // Connect to WebSocket server for system audio
    systemWs.value = new WebSocket('ws://localhost:3000')
    
    systemWs.value.onopen = () => {
      console.log('System WebSocket connected')
      systemTranscribing.value = true
      systemTranscriptionError.value = ''
      systemSpeakers.value.clear() // Reset speakers for new session
      
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
watch(allMessages, () => {
  scrollToBottom('unified-chat')
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
.unified-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f8f9fa;
}

/* Unified Header */
.unified-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.header-content h1 {
  margin: 0 0 20px 0;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.controls-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  justify-content: center;
}

.source-selector {
  flex: 1;
  min-width: 200px;
}

.source-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  backdrop-filter: blur(10px);
}

.source-select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.source-select option {
  background: #2c3e50;
  color: white;
}

.main-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.btn-large {
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 10px;
  min-width: 180px;
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

/* Unified Chat */
.unified-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.chat-container {
  flex: 1;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Video Preview */
.video-preview {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 300px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
