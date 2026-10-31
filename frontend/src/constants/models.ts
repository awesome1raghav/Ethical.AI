export interface AIModelOption {
  id: string;
  name: string;
  provider: 'Ollama';
  description: string;
  icon: string;
  badge?: string;
  maxContext: number;
}

// Single local model: Gemma 4 12B served by Ollama.
export const AVAILABLE_MODELS: AIModelOption[] = [
  { id: 'ollama:gemma4:12b', name: 'Gemma 4 12B', provider: 'Ollama', description: 'Google Gemma 4 open-weight model, running locally via Ollama', icon: '💎', badge: 'Local · Guarded', maxContext: 32768 },
];
