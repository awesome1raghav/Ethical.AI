/**
 * @fileOverview Manages partial and final transcripts for continuous streaming.
 */

import { VoiceEvent } from './types';

export class TranscriptManager {
  private currentFullTranscript: string = '';
  private lastPartial: string = '';

  public processChunk(text: string, isFinal: boolean): VoiceEvent {
    const timestamp = Date.now();
    
    if (isFinal) {
      this.currentFullTranscript += (this.currentFullTranscript ? ' ' : '') + text;
      this.lastPartial = '';
      return {
        type: 'TRANSCRIPT_FINAL',
        payload: {
          transcript: this.currentFullTranscript,
          timestamp,
          state: 'IDLE'
        }
      };
    } else {
      this.lastPartial = text;
      return {
        type: 'TRANSCRIPT_PARTIAL',
        payload: {
          partial: text,
          transcript: this.currentFullTranscript,
          timestamp,
          state: 'PROCESSING'
        }
      };
    }
  }

  public reset(): void {
    this.currentFullTranscript = '';
    this.lastPartial = '';
  }

  public getFinalTranscript(): string {
    return this.currentFullTranscript;
  }
}
