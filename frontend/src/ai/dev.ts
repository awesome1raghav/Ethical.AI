import { config } from 'dotenv';

config();

// Registers the Genkit flows used by the app with the Genkit developer UI.
import '@/ai/flows/natural-language-mission-intake';
import '@/ai/flows/research-agent-deep-research';
