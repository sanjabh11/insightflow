'use server';

/**
 * @fileOverview Analyzes the content of an uploaded file and answers questions about it.
 * Can also trigger image generation if requested for DOCX/PDF files.
 *
 * - analyzeUploadedContent - A function that analyzes file content, answers questions, and flags for image generation.
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
  fileType: z.string().describe('The MIME type of the uploaded file (e.g., application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).'),
});
export type AnalyzeUploadedContentInput = z.infer<typeof AnalyzeUploadedContentInputSchema>;

const AnalyzeUploadedContentOutputSchema = z.object({
  answer: z.string().describe('The textual answer to the question about the file content.'),
  sources: z.array(z.string()).describe('The sources used to answer the question.'),
  requiresImageGeneration: z.boolean().describe('Whether an image should be generated based on the request and document type.'),
  imageGenerationPrompt: z.string().optional().describe('A concise prompt for generating an image, if requiresImageGeneration is true.'),
  generatedImageUri: z.string().optional().describe('The data URI of the generated image, to be populated by the calling application if image generation is performed.'),
});
export type AnalyzeUploadedContentOutput = z.infer<typeof AnalyzeUploadedContentOutputSchema>;

export async function analyzeUploadedContent(
  input: AnalyzeUploadedContentInput
): Promise<AnalyzeUploadedContentOutput> {
  // The flow will determine if image generation is needed and provide the prompt.
  // The actual image generation call will be made by the client if 'requiresImageGeneration' is true.
  // So, 'generatedImageUri' will initially be undefined from this flow.
  const result = await analyzeUploadedContentFlow(input);
  return {...result, generatedImageUri: undefined };
}

const analyzeUploadedContentPrompt = ai.definePrompt({
  name: 'analyzeUploadedContentPrompt',
  input: {schema: AnalyzeUploadedContentInputSchema},
  output: {schema: AnalyzeUploadedContentOutputSchema},
  prompt: `You are an AI assistant.
File Content: {{media url=fileDataUri}}
User Question: {{{question}}}
File Type: {{{fileType}}}

Instructions:
1. Answer the user's question based on the file content.
2. If the question asks for a visual representation, graph, chart, or image based on data in the document, AND the fileType is 'application/pdf' or 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', then:
   a. Your textual answer should describe what kind of visual would be appropriate or summarize the data to be visualized.
   b. Set the 'requiresImageGeneration' output field to true.
   c. Provide a concise 'imageGenerationPrompt' output field (e.g., "A bar chart showing sales per quarter based on the document's sales data.").
3. If the document is not a PDF or DOCX, or if the question does not ask for a visual representation from the document data, set 'requiresImageGeneration' to false and do not provide an 'imageGenerationPrompt'.
4. Cite sources if applicable (e.g., "Source: Uploaded Document").
5. Ensure your output is a valid JSON object matching the defined output schema.
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
    if (!output) {
      // Fallback in case the LLM fails to produce structured output
      return {
        answer: "Sorry, I couldn't process your request for the uploaded file.",
        sources: [],
        requiresImageGeneration: false,
      };
    }
    // Ensure sources are always an array, even if LLM forgets
    return {
        ...output,
        sources: output.sources || (input.fileDataUri ? ["Uploaded Document"] : [])
    };
  }
);
