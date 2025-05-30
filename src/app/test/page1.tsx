'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, Volume2 } from 'lucide-react';
import { MastraClient } from "@mastra/client-js";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AudioRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
}

const client = new MastraClient({
  // Required
  baseUrl: "http://localhost:4111",
 
  // Optional configurations for development
  retries: 3, // Number of retry attempts
  backoffMs: 300, // Initial retry backoff time
  maxBackoffMs: 5000, // Maximum retry backoff time
  headers: {
    // Custom headers for development
    "X-Development": "true",
  },
});

// Get a reference to your local agent
const agent = client.getAgent("weatherAgent");
 
// Generate responses
const response = await agent.generate({
  messages: [
    {
      role: "user",
      content: "Hello, I'm testing the local development setup!",
    },
  ],
});

console.log(response);

const AIVoiceTutor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioState, setAudioState] = useState<AudioRecorderState>({
    isRecording: false,
    isProcessing: false,
    mediaRecorder: null,
    audioChunks: []
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // API endpoints - adjust these to your server setup
  const WHISPER_API = 'http://localhost:8000/transcribe';
  const OLLAMA_API = 'http://localhost:11434/api/generate';
  const TTS_API = 'http://localhost:8001/synthesize';

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processAudio(audioBlob);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      
      setAudioState({
        isRecording: true,
        isProcessing: false,
        mediaRecorder,
        audioChunks
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (audioState.mediaRecorder && audioState.isRecording) {
      audioState.mediaRecorder.stop();
      setAudioState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: true
      }));
    }
  }, [audioState.mediaRecorder, audioState.isRecording]);

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Step 1: Transcribe audio with Whisper
      const transcript = await transcribeAudio(audioBlob);
      
      if (!transcript.trim()) {
        setError('No speech detected. Please try again.');
        setAudioState(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text: transcript,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Step 2: Generate AI response with Ollama
      const aiResponse = await generateAIResponse(transcript);

      // Add AI message
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      // Step 3: Convert AI response to speech with Coqui TTS
      await synthesizeSpeech(aiResponse);

    } catch (err) {
      setError('Failed to process audio. Please try again.');
      console.error('Processing error:', err);
    } finally {
      setAudioState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const response = await fetch(WHISPER_API, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Transcription failed');
    }

    const data = await response.json();
    return data.text || '';
  };

  const generateAIResponse = async (text: string): Promise<string> => {
    const prompt = `You are a helpful English tutor. The student said: "${text}". 
    Provide a supportive response that helps them practice English. Keep it conversational and encouraging.`;

    const response = await fetch(OLLAMA_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama2', // or your preferred model
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('AI response failed');
    }

    const data = await response.json();
    return data.response || 'I apologize, I could not generate a response.';
  };

  const synthesizeSpeech = async (text: string) => {
    try {
      const response = await fetch(TTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          speaker: 'default' // Adjust based on your TTS setup
        })
      });

      if (!response.ok) {
        throw new Error('Speech synthesis failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
        
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (err) {
      console.error('TTS error:', err);
      // Continue without audio if TTS fails
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            AI English Tutor
          </h1>
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Chat Messages */}
          <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto mb-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <Volume2 className="mx-auto mb-4 h-12 w-12" />
                <p>Click the microphone to start your conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 p-3 rounded-lg max-w-xs ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white ml-auto'
                      : 'bg-white text-gray-800 border'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center space-x-4">
            <button
              onClick={audioState.isRecording ? stopRecording : startRecording}
              disabled={audioState.isProcessing}
              className={`p-4 rounded-full transition-all duration-200 ${
                audioState.isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } ${
                audioState.isProcessing
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105'
              }`}
            >
              {audioState.isProcessing ? (
                <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
              ) : audioState.isRecording ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>

            {audioRef.current && (
              <button
                onClick={togglePlayback}
                className="p-3 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all duration-200 hover:scale-105"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
            )}
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              {audioState.isRecording
                ? 'Recording... Click to stop'
                : audioState.isProcessing
                ? 'Processing your speech...'
                : 'Click microphone to start speaking'}
            </p>
          </div>

          {/* Hidden audio element */}
          <audio ref={audioRef} className="hidden" />
        </div>

        {/* Setup Instructions */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Setup Instructions</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>1. Whisper API:</strong> Run on port 8000</p>
            <p><strong>2. Ollama:</strong> Install and run with `ollama serve` (port 11434)</p>
            <p><strong>3. Coqui TTS:</strong> Run TTS server on port 8001</p>
            <p><strong>4.</strong> Make sure all services allow CORS for your domain</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIVoiceTutor;