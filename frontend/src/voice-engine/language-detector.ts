/**
 * @fileOverview Handles language detection and validation for supported locales.
 */

import { VOICE_ENGINE_CONFIG } from './config';

export class LanguageDetector {
  private currentLanguage: string = VOICE_ENGINE_CONFIG.defaultLanguage;

  public detect(input: string): string {
    // In a real implementation, this would use a language detection model.
    // For the engine logic, we validate against supported locales.
    return this.currentLanguage;
  }

  public setLanguage(code: string): void {
    const supported = VOICE_ENGINE_CONFIG.supportedLanguages.some(l => l.code === code);
    if (supported) {
      this.currentLanguage = code;
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }
}
