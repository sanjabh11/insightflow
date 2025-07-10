import { z } from 'genkit';

export const AnalyzeUploadedContentInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The uploaded file's data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  question: z.string().describe('The question to answer about the file content.'),
  fileType: z.string().describe('The MIME type of the uploaded file (e.g., application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).'),
});
export type AnalyzeUploadedContentInput = z.infer<typeof AnalyzeUploadedContentInputSchema>;

export const AnalyzeUploadedContentOutputSchema = z.object({
  answer: z.string().describe('The textual answer to the question about the file content.'),
  sources: z.array(z.string()).describe('The sources used to answer the question.'),
  requiresImageGeneration: z.boolean().describe('Whether an image should be generated based on the request and document type.'),
  imageGenerationPrompt: z.string().optional().describe('A concise prompt for generating an image, if requiresImageGeneration is true.'),
  generatedImageUri: z.string().optional().describe('The data URI of the generated image, to be populated by the calling application if image generation is performed.'),
});
export type AnalyzeUploadedContentOutput = z.infer<typeof AnalyzeUploadedContentOutputSchema>;
