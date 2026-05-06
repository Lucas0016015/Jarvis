'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

/* ── useSpeech ────────────────────────────────────────────────────────────
   Web Speech API integration for voice input/output.
   Falls back gracefully if browser doesn't support it.
   ───────────────────────────────────────────────────────────────────── */

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export function useSpeech() {
  const { setActivityState, setMicActive } = useJarvisStore();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        setTranscript(final || interim);
        if (final) {
          finalTranscriptRef.current = final;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setActivityState('idle');
        if (event.error !== 'no-speech') {
          setMicActive(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setActivityState('idle');
        setMicActive(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setActivityState, setMicActive]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    finalTranscriptRef.current = '';
    setTranscript('');
    setIsListening(true);
    setActivityState('listening');
    setMicActive(true);

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setActivityState('error');
    }
  }, [isListening, setActivityState, setMicActive]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Failed to stop speech recognition:', err);
    }

    setIsListening(false);
    setActivityState('idle');
  }, [isListening, setActivityState]);

  const speak = useCallback((text: string, lang = 'es-ES') => {
    if (!('speechSynthesis' in window)) return false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isListening,
    transcript: transcript || finalTranscriptRef.current,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
