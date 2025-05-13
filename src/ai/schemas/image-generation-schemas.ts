
/**
 * @fileOverview Zod schemas for image generation flow.
 *
 * - GenerateImageInputSchema - Zod schema for the input of the image generation flow.
 * - GenerateImageOutputSchema - Zod schema for the output of the image generation flow.
 */

import { z } from 'genkit';

export const GenerateImageInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The document's data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe("A concise prompt guiding the image generation, often related to visualizing data from the document."),
});

export const GenerateImageOutputSchema = z.object({
  imageDataUri: z.string().optional().describe("Data URI of the generated image (e.g., 'data:image/png;base64,...'). Undefined if generation failed."),
});
