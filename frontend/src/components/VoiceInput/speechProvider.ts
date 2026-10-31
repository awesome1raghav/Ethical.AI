import SpeechRecognition from 'react-speech-recognition';

export interface SpeechProvider {
  start(): void;
  stop(): void;
  onTranscript(callback: (text: string) => void): void;
  isSupported(): boolean;
}

export const BrowserSpeechProvider: SpeechProvider = {
  start() {
    SpeechRecognition.startListening({ continuous: true, interimResults: true });
  },
  stop() {
    SpeechRecognition.stopListening();
  },
  onTranscript(callback: (text: string) => void) {
    // Note: react-speech-recognition exposes transcript primarily via its hook.
    // However, to respect this abstraction, the `useVoiceInput` hook will bridge the 
    // hook's transcript to this callback pattern if needed, or we can just use the hook 
    // natively in our useVoiceInput wrapper.
  },
  isSupported(): boolean {
    return SpeechRecognition.browserSupportsSpeechRecognition();
  }
};
