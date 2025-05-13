'use server';

/**
 * @fileOverview Analyzes the content of an uploaded file and answers questions about it.
 *
 * - analyzeUploadedContent - A function that analyzes the content of an uploaded file and answers questions about it.
 * - AnalyzeUploadedContentInput - The input type for the analyzeUploadedContent function.
 * - AnalyzeUploadedContentOutput - The return type for the analyzeUploadedContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedContentInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The uploaded file's data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  question: z.string().describe('The question to answer about the file content.'),
});
export type AnalyzeUploadedContentInput = z.infer<typeof AnalyzeUploadedContentInputSchema>;

const AnalyzeUploadedContentOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the file content.'),
  sources: z.array(z.string()).describe('The sources used to answer the question.'),
});
export type AnalyzeUploadedContentOutput = z.infer<typeof AnalyzeUploadedContentOutputSchema>;

export async function analyzeUploadedContent(
  input: AnalyzeUploadedContentInput
): Promise<AnalyzeUploadedContentOutput> {
  return analyzeUploadedContentFlow(input);
}

const analyzeUploadedContentPrompt = ai.definePrompt({
  name: 'analyzeUploadedContentPrompt',
  input: {schema: AnalyzeUploadedContentInputSchema},
  output: {schema: AnalyzeUploadedContentOutputSchema},
  prompt: `You are an AI assistant that analyzes the content of uploaded files and answers questions about them.

  Here is the user's question: {{{question}}}

  Here is the content of the uploaded file:
  {{media url=fileDataUri}}
  `,
});

const analyzeUploadedContentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedContentFlow',
    inputSchema: AnalyzeUploadedContentInputSchema,
    outputSchema: AnalyzeUploadedContentOutputSchema,
  },
  async input => {
    const {output} = await analyzeUploadedContentPrompt(input);
    return output!;
  }
);
