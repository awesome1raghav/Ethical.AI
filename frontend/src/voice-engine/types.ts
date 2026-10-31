/**
 * @fileOverview Type definitions and events for the Voice Engine.
 */

export type VoiceEventType = 
  | 'VOICE_STARTED'
  | 'TRANSCRIPT_PARTIAL'
  | 'TRANSCRIPT_UPDATED'
  | 'TRANSCRIPT_FINAL'
  | 'VOICE_STOPPED'
  | 'ERROR';

export interface VoiceEvent {
  type: VoiceEventType;
  payload: {
    transcript?: string;
    partial?: string;
    confidence?: number;
    language?: string;
    latency?: number;
    error?: string;
    timestamp: number;
    state?: 'IDLE' | 'RECORDING' | 'PROCESSING';
  };
}

export interface EngineStatus {
  state: 'IDLE' | 'RECORDING' | 'PROCESSING';
  detectedLanguage: string;
  averageConfidence: number;
  uptime: number;
}
