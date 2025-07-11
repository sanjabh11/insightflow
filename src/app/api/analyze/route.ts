import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { AnalyzeUploadedContentInputSchema, AnalyzeUploadedContentOutputSchema, AnalyzeUploadedContentInput, AnalyzeUploadedContentOutput } from '@/ai/flows/analyze-uploaded-content-schemas';

// Increase the timeout for this specific route
export const maxDuration = 300; // 5 minutes

// This is the core analysis logic, moved from the original flow file.
async function performAnalysis(
  input: AnalyzeUploadedContentInput
): Promise<AnalyzeUploadedContentOutput> {
  console.time('performAnalysis_total');

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
      const {output} = await analyzeUploadedContentPrompt(input);
      if (!output) {
        return {
          answer: "Sorry, I couldn't process your request for the uploaded file.",
          sources: [],
          requiresImageGeneration: false,
        };
      }
      return {
          ...output,
          sources: output.sources || (input.fileDataUri ? ["Uploaded Document"] : [])
      };
    }
  );

  try {
    const result = await analyzeUploadedContentFlow(input);
    console.timeEnd('performAnalysis_total');
    return { ...result, generatedImageUri: undefined };
  } catch (error) {
    console.error('Error during analysis:', error);
    console.timeEnd('performAnalysis_total');
    return {
      answer: "Sorry, the analysis failed. Please try again later.",
      sources: [],
      requiresImageGeneration: false,
      generatedImageUri: undefined,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate the input body against the Zod schema
    const validationResult = AnalyzeUploadedContentInputSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    // Gemini API max tokens: 1,048,575. Estimate 1 token ≈ 4 chars. Be conservative.
    // For binary/base64, 1 char ≈ 1 byte, but base64 inflates size by ~33%.
    // We'll limit to 2.5MB of base64 data (well below the API limit).
    const MAX_BASE64_LENGTH = 2.5 * 1024 * 1024; // 2.5MB
    const fileDataUri = validationResult.data.fileDataUri;
    if (typeof fileDataUri === 'string') {
      // Only count the base64 payload, not the prefix
      const base64Part = fileDataUri.split(',')[1] || '';
      if (base64Part.length > MAX_BASE64_LENGTH) {
        return NextResponse.json({
          error: 'File too large',
          details: `The uploaded file is too large for analysis. Please upload a file under 2.5MB (base64-encoded).`,
        }, { status: 413 });
      }
    }

    const result = await performAnalysis(validationResult.data);

    return NextResponse.json(result);

  } catch (error) {
    console.error('API Route Error:', error);
    // Check if error is a known type, otherwise provide a generic message
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to process request', details: errorMessage }, { status: 500 });
  }
}
