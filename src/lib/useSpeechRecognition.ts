import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Wraps the browser's native SpeechRecognition API (Web Speech API).
 * No external package or API key needed — this is built into Chrome,
 * Edge, and Safari (with varying prefix support). Firefox does not
 * support it as of this writing.
 *
 * Usage:
 *   const { isListening, isSupported, start, stop } = useSpeechRecognition({
 *     onResult: (text) => setInput(prev => prev ? `${prev} ${text}` : text)
 *   });
 */

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
}

// Minimal shape of the Web Speech API we actually use — TypeScript's DOM
// lib doesn't ship types for this since it's non-standard/vendor-prefixed.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: {
    length: number;
    [index: number]: { isFinal: boolean; [index: number]: SpeechRecognitionResultLike };
  };
  resultIndex: number;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ onResult, onError }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isSupported = getSpeechRecognitionConstructor() !== null;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      onError?.('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        }
      }
      if (finalText.trim()) {
        onResult(finalText.trim());
      }
    };

    recognition.onerror = (event: { error: string }) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        // Not really an error from the user's perspective — just didn't
        // catch anything. Don't surface a scary error message for this.
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        onError?.('Microphone access was denied. Enable it in your browser settings to use voice input.');
        return;
      }
      onError?.(`Voice input error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [onResult, onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, start, stop };
}
