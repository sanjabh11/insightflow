'use server';
/**
 * @fileOverview Generates an image based on a document and a prompt, typically for creating graphs or visualizations from DOCX/PDF content.
 *
 * - generateImage - A function that takes document data and a prompt to generate an image.
 * - GenerateImageInput - The input type for the generateImage function.
 * - GenerateImageOutput - The return type for the generateImage function.
 */

import {ai} from '@/ai/genkit';
import type { z } from 'genkit';
import { GenerateImageInputSchema, GenerateImageOutputSchema } from '@/ai/schemas/image-generation-schemas';

export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;
export type GenerateImageOutput = z.infer<typeof GenerateImageOutputSchema>;

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

if (!ai) {
  throw new Error("Genkit AI is not initialized. Check your GEMINI_API_KEY and configuration.");
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async (input) => {
    if (!input.documentDataUri || !input.prompt) {
      console.warn('Image generation skipped: Missing documentDataUri or prompt.');
      return { imageDataUri: undefined };
    }

    try {
      if (!ai) {
        throw new Error("Genkit AI is not initialized. Check your configuration.");
      }
      const { media } = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', // This model supports image generation.
        prompt: [
          { media: { url: input.documentDataUri } },
          { 
            text: `Analyze the provided document. Based on its content and the following request, generate an image: "${input.prompt}". 
            If the request implies creating a data visualization (e.g., 'bar chart of sales', 'line graph of trends', 'pie chart of distribution'), 
            then generate a simple, clear chart or graph that accurately represents the relevant data found in the document.
            If the request is for a more general image related to the document's content, generate that instead.`
          }
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'], // Crucial for enabling image output.
          // Optional: Configure safety settings if defaults are too restrictive or lenient.
          // safetySettings: [
          //   { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          // ],
        },
      });

      if (media && media.url) {
        return { imageDataUri: media.url };
      } else {
        console.warn('Image generation result did not contain media URL.');
        return { imageDataUri: undefined };
      }
    } catch (error) {
      console.error('Error during image generation flow:', error);
      // Consider how to communicate this error back if needed, e.g., by returning an error message in the output.
      return { imageDataUri: undefined };
    }
  }
);
