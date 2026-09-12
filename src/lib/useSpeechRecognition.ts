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
  // Tracks "the user wants this on" independently of whatever the browser
  // engine itself decides to do. Chrome (and others) will silently fire
  // `onend` after a stretch of silence even with continuous=true — without
  // this flag that used to read as "user stopped it" and the mic would
  // just go dark. Now onend only turns isListening off when this is false,
  // i.e. stop() was actually called; otherwise it restarts automatically.
  const shouldListenRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  const runRecognition = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    // continuous=true asks the engine itself not to stop after one
    // utterance. It still isn't a hard guarantee across all browsers
    // (see shouldListenRef above), but it's the right baseline setting.
    recognition.continuous = true;
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
        onResultRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // 'no-speech' just means it didn't catch anything in this stretch —
        // not a real error, and onend (which follows) will restart it as
        // long as the user hasn't clicked stop. 'aborted' fires on our own
        // manual stop() calls, including the restart below, so it's not
        // something to surface either.
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        shouldListenRef.current = false;
        setIsListening(false);
        onErrorRef.current?.('Microphone access was denied. Enable it in your browser settings to use voice input.');
        return;
      }
      shouldListenRef.current = false;
      setIsListening(false);
      onErrorRef.current?.(`Voice input error: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // The engine stopped on its own (silence timeout, mobile Safari's
        // short max duration, etc.) but the user never clicked stop —
        // start a fresh recognition instance right away so it feels like
        // it never turned off.
        runRecognition();
        return;
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      onErrorRef.current?.('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    shouldListenRef.current = true;
    setIsListening(true);
    runRecognition();
  }, [runRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, start, stop };
}
