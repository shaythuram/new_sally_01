const express = require('express');
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Deepgram configuration
const DEEPGRAM_API_KEY = 'ae2854b203e26ead1ddb518d5f29a209b9eceedc';
const deepgram = createClient(DEEPGRAM_API_KEY);

// Store active connections
const connections = new Map();
let connectionCounter = 0;

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  let deepgramConnection = null;
  let connectionId = `conn_${++connectionCounter}_${Date.now()}`;
  
  // Store connection
  connections.set(connectionId, {
    ws,
    deepgramConnection,
    isTranscribing: false
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'start_transcription':
          await handleStartTranscription(connectionId, message);
          break;
          
        case 'audio_data':
          handleAudioData(connectionId, message.data);
          break;
          
        case 'stop_transcription':
          handleStopTranscription(connectionId);
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket connection ${connectionId} closed`);
    handleStopTranscription(connectionId);
    connections.delete(connectionId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    handleStopTranscription(connectionId);
    connections.delete(connectionId);
  });
});

async function handleStartTranscription(connectionId, message) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  try {
    console.log(`Starting transcription for connection ${connectionId}`);
    
    // Create Deepgram connection
    const deepgramConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    // Handle Deepgram responses
    deepgramConnection.on('Results', (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript && transcript.trim()) {
        console.log(`Transcription for ${connectionId}: ${transcript} (final: ${data.is_final})`);
        connection.ws.send(JSON.stringify({
          type: 'transcription',
          transcript: transcript,
          is_final: data.is_final || false,
          confidence: data.channel?.alternatives?.[0]?.confidence || 0
        }));
      }
    });

    deepgramConnection.on('Error', (error) => {
      console.error('Deepgram error:', error);
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Transcription error occurred'
      }));
    });

    deepgramConnection.on('Close', () => {
      console.log(`Deepgram connection closed for ${connectionId}`);
      connection.ws.send(JSON.stringify({
        type: 'transcription_stopped'
      }));
    });

    // Update connection
    connection.deepgramConnection = deepgramConnection;
    connection.isTranscribing = true;

    // Send confirmation
    connection.ws.send(JSON.stringify({
      type: 'transcription_started',
      message: `Transcription started successfully for ${connectionId}`
    }));

  } catch (error) {
    console.error('Error starting transcription:', error);
    connection.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to start transcription'
    }));
  }
}

function handleAudioData(connectionId, audioData) {
  const connection = connections.get(connectionId);
  if (!connection || !connection.deepgramConnection || !connection.isTranscribing) {
    return;
  }

  try {
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Send audio data to Deepgram
    connection.deepgramConnection.send(audioBuffer);
  } catch (error) {
    console.error('Error sending audio data:', error);
  }
}

function handleStopTranscription(connectionId) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  console.log(`Stopping transcription for connection ${connectionId}`);

  if (connection.deepgramConnection) {
    connection.deepgramConnection.finish();
    connection.deepgramConnection = null;
  }
  
  connection.isTranscribing = false;
  
  connection.ws.send(JSON.stringify({
    type: 'transcription_stopped',
    message: `Transcription stopped for ${connectionId}`
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: connections.size,
    timestamp: new Date().toISOString()
  });
});

// Serve Vue app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  
  // Close all WebSocket connections
  connections.forEach((connection) => {
    if (connection.deepgramConnection) {
      connection.deepgramConnection.finish();
    }
    connection.ws.close();
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
