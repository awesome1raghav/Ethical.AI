import {genkit} from 'genkit';
import {ollama} from 'genkitx-ollama';

/**
 * @fileOverview Central AI configuration for EthicalAI.
 * Powering Nexus, Sovereign, and Citadel layers.
 */
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const ollamaModel = process.env.MODEL_NAME || 'gemma4:12b';

export const ai = genkit({
  plugins: [
    ollama({
      models: [
        {
          name: ollamaModel,
        },
      ],
      serverAddress: ollamaBaseUrl,
    }),
  ],
  model: `ollama/${ollamaModel}`,
});
