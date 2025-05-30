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
import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const AnalyzeUploadedContentInputSchema = z.object({
  fileDataUri: z
    .string()
    .optional() 
    .describe(
      "The uploaded file's data, as a data URI. Optional if ocrText or processedFileText is provided."
    ),
  question: z.string().describe('The question to answer about the file content.'),
  fileType: z.string().describe('The MIME type of the uploaded file (e.g., application/pdf, image/png, application/zip).'),
});
export type AnalyzeUploadedContentInput = z.infer<typeof AnalyzeUploadedContentInputSchema>;

// Schema for the data that will be passed to the prompt
const PromptInputSchema = AnalyzeUploadedContentInputSchema.extend({
  ocrText: z.string().nullable().optional().describe('Extracted text from image OCR, if applicable.'),
  processedFileText: z.string().nullable().optional().describe('Text extracted from files like XLSX, ZIP listing, or manually decoded TXT/JSON.'),
});
type PromptInput = z.infer<typeof PromptInputSchema>;

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
  console.time('analyzeUploadedContent_total');
  // The flow will determine if image generation is needed and provide the prompt.
  // The actual image generation call will be made by the client if 'requiresImageGeneration' is true.
  // So, 'generatedImageUri' will initially be undefined from this flow.
  const result = await analyzeUploadedContentFlow(input);
  console.timeEnd('analyzeUploadedContent_total');
  return {...result, generatedImageUri: undefined };
}

const analyzeUploadedContentPrompt = ai.definePrompt({
  name: 'analyzeUploadedContentPrompt',
  input: {schema: PromptInputSchema }, // Use the extended schema
  output: {schema: AnalyzeUploadedContentOutputSchema},
  prompt: `You are an AI assistant.
{{if .ocrText}}
Extracted Text from Image:
{{{ .ocrText }}}
{{else if .processedFileText}}
Processed File Content:
{{{ .processedFileText }}}
{{else if .fileDataUri}}
File Content (e.g., PDF, DOCX, or other types not processed above): {{media url=.fileDataUri}}
{{else}}
No file content, OCR text, or processed text was provided for analysis.
{{end}}
User Question: {{{.question}}}
File Type: {{{.fileType}}}

Instructions:
1. Base your answer on the primary content provided (OCR Text, Processed File Content, or File Content in that order of preference).
2. If File Type is 'application/zip' and Processed File Content is available, your primary task is to list the contents of the ZIP file as presented in Processed File Content. You may also briefly answer the user's question if it's directly related to the file listing and requires no further interpretation of file contents.
3. If Processed File Content is from an XLSX file, use this extracted text to answer the user's question.
4. If Extracted Text from Image (ocrText) is available, use it to answer the question.
5. For PDF or DOCX files (where ocrText or processedFileText is not available), if the question asks for a visual representation (graph, chart, image), then:
   a. Your textual answer should describe what kind of visual would be appropriate or summarize the data to be visualized.
   b. Set 'requiresImageGeneration' output field to true.
   c. Provide 'imageGenerationPrompt' (e.g., "A bar chart showing sales per quarter...").
6. Otherwise (not PDF/DOCX, or question not about visuals, or it's an image/XLSX/ZIP where content is already processed), set 'requiresImageGeneration' to false.
7. Cite sources if applicable (e.g., "Source: Uploaded Document", "Source: OCR from Image", "Source: Processed XLSX/ZIP data").
8. Ensure your output is a valid JSON object matching the defined output schema.
`,
});

const analyzeUploadedContentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedContentFlow',
    inputSchema: AnalyzeUploadedContentInputSchema,
    outputSchema: AnalyzeUploadedContentOutputSchema,
  },
  async (input: AnalyzeUploadedContentInput) => {
    console.time('analyzeUploadedContentFlow_total');
    
    let ocrText: string | null = null;
    let processedFileText: string | null = null;
    
    // Initialize dataForPrompt with all potential fields, ensuring type compatibility.
    // fileDataUri will be explicitly managed based on processing outcomes.
    let dataForPrompt: PromptInput = { 
      ...input, 
      ocrText: null, 
      processedFileText: null,
      fileDataUri: input.fileDataUri // Start with original, might be cleared
    };

    if (input.fileDataUri) {
      const base64Data = input.fileDataUri.split(',')[1];
      if (!base64Data) {
        // Handle invalid data URI for all types that need it
        const invalidDataUriMsg = 'Invalid Data URI: Base64 content is missing.';
        if (input.fileType === 'image/png' || input.fileType === 'image/jpeg') {
          ocrText = invalidDataUriMsg;
        } else if (input.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || input.fileType === 'application/zip') {
          processedFileText = invalidDataUriMsg;
        }
        // Potentially return early or pass this error message to the prompt
        dataForPrompt.fileDataUri = undefined; // No valid URI to process
      } else {
        // Process based on file type
        if (input.fileType === 'image/png' || input.fileType === 'image/jpeg') {
          try {
            console.time('analyzeUploadedContentFlow_ocr');
            const visionClient = new ImageAnnotatorClient();
            const [result] = await visionClient.textDetection({ image: { content: base64Data } });
            const detections = result.textAnnotations;
            if (detections && detections.length > 0 && detections[0]?.description) {
              ocrText = detections[0].description;
              dataForPrompt.fileDataUri = undefined; // OCR successful, clear original URI for prompt
            } else {
              ocrText = "No text found in image by OCR.";
            }
            console.timeEnd('analyzeUploadedContentFlow_ocr');
          } catch (error: any) {
            console.error("OCR Error:", error);
            ocrText = `OCR processing failed: ${error.message || 'Unknown error'}`;
          }
        } else if (input.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          try {
            console.time('analyzeUploadedContentFlow_xlsx');
            const workbook = XLSX.read(Buffer.from(base64Data, 'base64'), { type: 'buffer' });
            let fullText = "";
            workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const txt = XLSX.utils.sheet_to_txt(sheet, { strip: true });
              if (txt.trim()) {
                 fullText += `Sheet "${sheetName}":\n${txt}\n\n`;
              }
            });
            processedFileText = fullText.trim() || "No text content found in XLSX file.";
            if (fullText.trim()) dataForPrompt.fileDataUri = undefined;
            console.timeEnd('analyzeUploadedContentFlow_xlsx');
          } catch (error: any) {
            console.error("XLSX Parsing Error:", error);
            processedFileText = `XLSX parsing failed: ${error.message || 'Unknown error'}`;
          }
        } else if (input.fileType === 'application/zip') {
          try {
            console.time('analyzeUploadedContentFlow_zip');
            const zip = await JSZip.loadAsync(Buffer.from(base64Data, 'base64'));
            let fileList = "Contents of ZIP file:\n";
            const files: string[] = [];
            zip.forEach((relativePath, zipEntry) => {
              files.push(`- ${zipEntry.name} ${zipEntry.dir ? '(directory)' : '(file)'}`);
            });
            processedFileText = fileList + files.join('\n');
            if (files.length > 0) dataForPrompt.fileDataUri = undefined;
            console.timeEnd('analyzeUploadedContentFlow_zip');
          } catch (error: any) {
            console.error("ZIP Parsing Error:", error);
            processedFileText = `ZIP parsing failed: ${error.message || 'Unknown error'}`;
          }
        } else if (input.fileType === 'text/plain' || input.fileType === 'application/json') {
          // Assuming {{media url=...}} handles these well. If not, decode here:
          // try {
          //   processedFileText = Buffer.from(base64Data, 'base64').toString('utf8');
          //   dataForPrompt.fileDataUri = undefined;
          // } catch (e) { processedFileText = "Failed to decode base64 text."; }
        }
      }
    } else if (!input.fileDataUri) {
        // If no fileDataUri was provided at all (e.g. question about general knowledge)
        // This case should be handled by the prompt's final 'else'
    }


    dataForPrompt.ocrText = ocrText;
    dataForPrompt.processedFileText = processedFileText;

    // Final check: if no specific content was extracted, ensure original URI is passed if available
    if (!dataForPrompt.ocrText && !dataForPrompt.processedFileText && input.fileDataUri) {
      dataForPrompt.fileDataUri = input.fileDataUri;
    }
    
    const {output} = await (async () => {
      console.time('analyzeUploadedContentPrompt_total');
      const result = await analyzeUploadedContentPrompt(dataForPrompt);
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
