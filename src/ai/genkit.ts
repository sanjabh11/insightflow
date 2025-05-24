import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

function logError(message: string) {
  if (typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error('[Genkit Init Error]', message);
  }
}

let ai: ReturnType<typeof genkit> | null = null;

try {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
    logError('GEMINI_API_KEY is missing! Please set it in your environment variables.');
    throw new Error('GEMINI_API_KEY is missing!');
  }
  ai = genkit({
    plugins: [googleAI()],
    model: 'googleai/gemini-2.0-flash',
  });
} catch (err) {
  logError(`Failed to initialize Genkit/GoogleAI: ${err instanceof Error ? err.message : String(err)}`);
  ai = null;
}

export { ai };
