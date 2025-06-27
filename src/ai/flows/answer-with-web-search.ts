'use server';

/**
 * @fileOverview Uses web search to answer questions if the information is not found in the uploaded file.
 *
 * - answerWithWebSearch - A function that answers questions using web search.
 * - AnswerWithWebSearchInput - The input type for the answerWithWebSearch function.
 * - AnswerWithWebSearchOutput - The return type for the answerWithWebSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerWithWebSearchInputSchema = z.object({
  question: z.string().describe('The question to answer.'),
  fileContent: z.string().optional().describe('The content of the uploaded file.'),
});
export type AnswerWithWebSearchInput = z.infer<typeof AnswerWithWebSearchInputSchema>;

const AnswerWithWebSearchOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
  sources: z.array(z.string()).describe('The sources used to answer the question.'),
});
export type AnswerWithWebSearchOutput = z.infer<typeof AnswerWithWebSearchOutputSchema>;

export async function answerWithWebSearch(input: AnswerWithWebSearchInput): Promise<AnswerWithWebSearchOutput> {
  return answerWithWebSearchFlow(input);
}

if (!ai) {
  throw new Error("Genkit AI is not initialized. Check your GEMINI_API_KEY and configuration.");
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
