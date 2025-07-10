'use server';

import { ai } from '@/ai/genkit';
import { AnalyzeUploadedContentInputSchema, AnalyzeUploadedContentOutputSchema, AnalyzeUploadedContentInput, AnalyzeUploadedContentOutput } from './analyze-uploaded-content-schemas';
// ...rest of the file stays the same, only async functions exported ...

export async function analyzeUploadedContent(
  input: AnalyzeUploadedContentInput
): Promise<AnalyzeUploadedContentOutput> {
  console.time('analyzeUploadedContent_total');
  try {
    // Try Gemini 2.0 Flash first
    const result = await analyzeUploadedContentFlow(input);
    console.timeEnd('analyzeUploadedContent_total');
    return { ...result, generatedImageUri: undefined };
  } catch (flashError) {
    // Fallback to Gemini 1.5 Pro
    try {
      // Dynamically create a 1.5-pro flow
      const { ai: flashAI } = await import('@/ai/genkit');
      const { genkit } = await import('genkit');
      const { googleAI } = await import('@genkit-ai/googleai');
      const { z } = await import('genkit');
      const ai15 = genkit({
        plugins: [googleAI()],
        model: 'googleai/gemini-1.5-pro',
      });
      const inputSchema = z.object({
        fileDataUri: z
          .string()
          .describe(
            "The uploaded file's data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
          ),
        question: z.string().describe('The question to answer about the file content.'),
        fileType: z.string().describe('The MIME type of the uploaded file (e.g., application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).'),
      });
      const outputSchema = z.object({
        answer: z.string().describe('The textual answer to the question about the file content.'),
        sources: z.array(z.string()).describe('The sources used to answer the question.'),
        requiresImageGeneration: z.boolean().describe('Whether an image should be generated based on the request and document type.'),
        imageGenerationPrompt: z.string().optional().describe('A concise prompt for generating an image, if requiresImageGeneration is true.'),
        generatedImageUri: z.string().optional().describe('The data URI of the generated image, to be populated by the calling application if image generation is performed.'),
      });
      const analyzeUploadedContentPrompt15 = ai15.definePrompt({
        name: 'analyzeUploadedContentPrompt15',
        input: {schema: inputSchema},
        output: {schema: outputSchema},
        prompt: `You are an AI assistant.\nFile Content: {{media url=fileDataUri}}\nUser Question: {{{question}}}\nFile Type: {{{fileType}}}\n\nInstructions:\n1. Answer the user's question based on the file content.\n2. If the question asks for a visual representation, graph, chart, or image based on data in the document, AND the fileType is 'application/pdf' or 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', then:\n   a. Your textual answer should describe what kind of visual would be appropriate or summarize the data to be visualized.\n   b. Set the 'requiresImageGeneration' output field to true.\n   c. Provide a concise 'imageGenerationPrompt' output field (e.g., "A bar chart showing sales per quarter based on the document's sales data.").\n3. If the document is not a PDF or DOCX, or if the question does not ask for a visual representation from the document data, set 'requiresImageGeneration' to false and do not provide an 'imageGenerationPrompt'.\n4. Cite sources if applicable (e.g., "Source: Uploaded Document").\n5. Ensure your output is a valid JSON object matching the defined output schema.`,
      });
      const analyzeUploadedContentFlow15 = ai15.defineFlow(
        {
          name: 'analyzeUploadedContentFlow15',
          inputSchema: inputSchema,
          outputSchema: outputSchema,
        },
        async input => {
          const {output} = await analyzeUploadedContentPrompt15(input);
          return output!;
        }
      );
      const result15 = await analyzeUploadedContentFlow15(input);
      console.timeEnd('analyzeUploadedContent_total');
      return { ...result15, generatedImageUri: undefined };
    } catch (proError) {
      console.timeEnd('analyzeUploadedContent_total');
      return {
        answer: "Sorry, both Gemini 2.0 Flash and Gemini 1.5 Pro failed to process your request.",
        sources: [],
        requiresImageGeneration: false,
        generatedImageUri: undefined,
      };
    }
  }
}

if (!ai) {
  throw new Error("Genkit AI is not initialized. Check your configuration.");
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
    console.time('analyzeUploadedContentFlow_total');
    const {output} = await (async () => {
      console.time('analyzeUploadedContentPrompt_total');
      const result = await analyzeUploadedContentPrompt(input);
      console.timeEnd('analyzeUploadedContentPrompt_total');
      return result;
    })();
    console.timeEnd('analyzeUploadedContentFlow_total');
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
