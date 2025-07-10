import { z } from 'genkit';

export const AnswerWithWebSearchInputSchema = z.object({
  question: z.string().describe('The question to answer.'),
  fileContent: z.string().optional().describe('The content of the uploaded file.'),
});
export type AnswerWithWebSearchInput = z.infer<typeof AnswerWithWebSearchInputSchema>;

export const AnswerWithWebSearchOutputSchema = z.object({
  answer: z.string().describe('The answer to the question.'),
  sources: z.array(z.string()).describe('The sources used to answer the question.'),
});
export type AnswerWithWebSearchOutput = z.infer<typeof AnswerWithWebSearchOutputSchema>;
