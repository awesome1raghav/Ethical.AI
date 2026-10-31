import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { BrowserSpeechProvider } from './speechProvider';

export function useVoiceInput(
  currentText: string,
  onChange: (text: string) => void,
  onPermissionDenied?: () => void,
  onUnsupported?: () => void
) {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  const [error, setError] = useState<string | null>(null);
  
  // Ref to hold the text right before we started listening.
  // This allows us to append the live transcript cleanly without creating feedback loops.
  const baseTextRef = useRef(currentText);

  // When we start listening, capture the current text.
  const handleStart = () => {
    if (!browserSupportsSpeechRecognition) {
      setError('Unsupported browser');
      if (onUnsupported) onUnsupported();
      return;
    }
    
    // Check permission logic
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        baseTextRef.current = currentText;
        resetTranscript();
        BrowserSpeechProvider.start();
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permission denied');
          if (onPermissionDenied) onPermissionDenied();
        } else {
          setError('Microphone unavailable');
        }
      });
  };

  const handleStop = () => {
    BrowserSpeechProvider.stop();
  };

  const toggleListening = () => {
    if (listening) {
      handleStop();
    } else {
      handleStart();
    }
  };

  // Sync transcript back up to the parent
  useEffect(() => {
    if (listening && transcript !== '') {
      const separator = baseTextRef.current.trim().length > 0 ? ' ' : '';
      onChange(baseTextRef.current + separator + transcript);
    }
  }, [transcript, listening, onChange]);

  return {
    listening,
    toggleListening,
    start: handleStart,
    stop: handleStop,
    isSupported: browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    error
  };
}
