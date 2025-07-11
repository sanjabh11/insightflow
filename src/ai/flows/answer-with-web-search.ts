'use server';

/**
 * @fileOverview Uses web search to answer questions if the information is not found in the uploaded file.
 *
 * - answerWithWebSearch - A function that answers questions using web search.
 * - AnswerWithWebSearchInput - The input type for the answerWithWebSearch function.
 * - AnswerWithWebSearchOutput - The return type for the answerWithWebSearch function.
 */

import {ai} from '@/ai/genkit';
import { z } from 'genkit';
import { AnswerWithWebSearchInputSchema, AnswerWithWebSearchOutputSchema, AnswerWithWebSearchInput, AnswerWithWebSearchOutput } from './answer-with-web-search-schemas';
// ...rest of the file stays the same, only async functions exported ...
export async function answerWithWebSearch(input: AnswerWithWebSearchInput): Promise<AnswerWithWebSearchOutput> {
  try {
    // Try Gemini 2.0 Flash first
    return await answerWithWebSearchFlow(input);
  } catch (flashError) {
    // Fallback to Gemini 1.5 Pro
    try {
      const { genkit } = await import('genkit');
      const { googleAI } = await import('@genkit-ai/googleai');
      const ai15 = genkit({
        plugins: [googleAI()],
        model: 'googleai/gemini-1.5-pro',
      });
      const AnswerWithWebSearchInputSchema15 = z.object({
        question: z.string().describe('The question to answer.'),
        fileContent: z.string().optional().describe('The content of the uploaded file.'),
      });
      const AnswerWithWebSearchOutputSchema15 = z.object({
        answer: z.string().describe('The answer to the question.'),
        sources: z.array(z.string()).describe('The sources used to answer the question.'),
      });
      const webSearch15 = ai15.defineTool({
        name: 'webSearch',
        description: 'Searches the web for an answer to the user\'s question.',
        inputSchema: z.object({
          query: z.string().describe('The search query.'),
        }),
        outputSchema: z.object({
          results: z.array(z.string()).describe('The search results.'),
        }),
      },
      async (input) => {
        return {
          results: [
            `Web search result for ${input.query} 1`,
            `Web search result for ${input.query} 2`,
          ],
        };
      });
      const answerWithWebSearchPrompt15 = ai15.definePrompt({
        name: 'answerWithWebSearchPrompt15',
        input: {schema: AnswerWithWebSearchInputSchema15},
        output: {schema: AnswerWithWebSearchOutputSchema15},
        tools: [webSearch15],
        prompt: `You are a helpful AI assistant. Use the available tools to best answer the user's question.\n\nQuestion: {{{question}}}\n\n{{#if fileContent}}\nHere is the content of the uploaded file:\n{{{fileContent}}}\nAnswer the question using information from the file if possible.  Cite the file as the source.  If the answer is not in the file, use the webSearch tool.\n{{else}}\nThe user has not uploaded a file.  Use the webSearch tool to answer the question.\n{{/if}}`,
      });
      const answerWithWebSearchFlow15 = ai15.defineFlow(
        {
          name: 'answerWithWebSearchFlow15',
          inputSchema: AnswerWithWebSearchInputSchema15,
          outputSchema: AnswerWithWebSearchOutputSchema15,
        },
        async input => {
          const {output} = await answerWithWebSearchPrompt15(input);
          return output!;
        }
      );
      return await answerWithWebSearchFlow15(input);
    } catch (proError) {
      return {
        answer: "Sorry, both Gemini 2.0 Flash and Gemini 1.5 Pro failed to process your request.",
        sources: [],
      };
    }
  }
}

if (!ai) {
  throw new Error("Genkit AI is not initialized. Check your configuration.");
}

const webSearch = ai.defineTool({
  name: 'webSearch',
  description: 'Searches the web for an answer to the user\'s question.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
  }),
  outputSchema: z.object({
    results: z.array(z.string()).describe('The search results.'),
  }),
},
async (input) => {
  // Replace with actual web search implementation.
  // This is just a placeholder for demonstration purposes.
  return {
    results: [
      `Web search result for ${input.query} 1`,
      `Web search result for ${input.query} 2`,
    ],
  };
});

const answerWithWebSearchPrompt = ai.definePrompt({
  name: 'answerWithWebSearchPrompt',
  input: {schema: AnswerWithWebSearchInputSchema},
  output: {schema: AnswerWithWebSearchOutputSchema},
  tools: [webSearch],
  prompt: `You are a helpful AI assistant. Use the available tools to best answer the user's question.

  Question: {{{question}}}

  {{#if fileContent}}
  Here is the content of the uploaded file:
  {{{fileContent}}}
  Answer the question using information from the file if possible.  Cite the file as the source.  If the answer is not in the file, use the webSearch tool.
  {{else}}
  The user has not uploaded a file.  Use the webSearch tool to answer the question.
  {{/if}}`,
});

const answerWithWebSearchFlow = ai.defineFlow(
  {
    name: 'answerWithWebSearchFlow',
    inputSchema: AnswerWithWebSearchInputSchema,
    outputSchema: AnswerWithWebSearchOutputSchema,
  },
  async input => {
    const {output} = await answerWithWebSearchPrompt(input);
    return output!;
  }
);
