/**
 * @fileOverview Configuration settings for the Voice-to-Text Engine.
 */

export const VOICE_ENGINE_CONFIG = {
  supportedLanguages: [
    { code: 'en-US', name: 'English' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'te-IN', name: 'Telugu' }
  ],
  defaultLanguage: 'en-US',
  minConfidenceThreshold: 0.7,
  sampleRate: 16000,
  latencyTargetMs: 1000,
  enableAutoLanguageDetection: true
};
