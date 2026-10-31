/**
 * @fileOverview The core processor that orchestrates STT events and logic.
 */

import { TranscriptManager } from './transcript-manager';
import { ConfidenceTracker } from './confidence-tracker';
import { LanguageDetector } from './language-detector';
import { VoiceEvent, EngineStatus } from './types';

export class SpeechProcessor {
  private transcriptManager = new TranscriptManager();
  private confidenceTracker = new ConfidenceTracker();
  private languageDetector = new LanguageDetector();
  private state: 'IDLE' | 'RECORDING' | 'PROCESSING' = 'IDLE';
  private startTime: number = 0;

  public startSession(): VoiceEvent {
    this.state = 'RECORDING';
    this.startTime = Date.now();
    this.transcriptManager.reset();
    this.confidenceTracker.reset();

    return {
      type: 'VOICE_STARTED',
      payload: {
        timestamp: this.startTime,
        state: this.state,
        language: this.languageDetector.getLanguage()
      }
    };
  }

  public processAudioChunk(data: { text: string; confidence: number; isFinal: boolean }): VoiceEvent {
    this.confidenceTracker.addScore(data.confidence);
    const event = this.transcriptManager.processChunk(data.text, data.isFinal);
    
    // Add enrichment metadata
    event.payload.confidence = this.confidenceTracker.getAverageConfidence();
    event.payload.language = this.languageDetector.getLanguage();
    event.payload.latency = Date.now() - this.startTime;

    return event;
  }

  public stopSession(): VoiceEvent {
    this.state = 'IDLE';
    return {
      type: 'VOICE_STOPPED',
      payload: {
        transcript: this.transcriptManager.getFinalTranscript(),
        timestamp: Date.now(),
        state: this.state
      }
    };
  }

  public getStatus(): EngineStatus {
    return {
      state: this.state,
      detectedLanguage: this.languageDetector.getLanguage(),
      averageConfidence: this.confidenceTracker.getAverageConfidence(),
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }
}
