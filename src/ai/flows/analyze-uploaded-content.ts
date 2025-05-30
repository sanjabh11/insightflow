'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import pdfParse from 'pdf-parse'; 

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

const PromptInputSchema = AnalyzeUploadedContentInputSchema.extend({
  ocrText: z.string().nullable().optional().describe('Extracted text from image OCR, if applicable.'),
  processedFileText: z.string().nullable().optional().describe('Text extracted from files like PDF, XLSX, ZIP listing, or manually decoded TXT/JSON.'),
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
  const result = await analyzeUploadedContentFlow(input);
  console.timeEnd('analyzeUploadedContent_total');
  return {...result, generatedImageUri: undefined };
}

const analyzeUploadedContentPrompt = ai.definePrompt({
  name: 'analyzeUploadedContentPrompt',
  input: {schema: PromptInputSchema }, 
  output: {schema: AnalyzeUploadedContentOutputSchema},
  prompt: `You are an AI assistant. You will be provided with content extracted or derived from an uploaded file.
Your primary task is to answer the user's question based on the most relevant piece of content provided.
Prioritize these sources in the order they are presented if multiple seem available:
1. Extracted Text from Image (ocrText)
2. Processed File Content (processedFileText from PDF, XLSX, ZIP)
3. File Content via media link (fileDataUri for DOCX or fallbacks)

Content Presentation:
{{if .ocrText}}
Extracted Text from Image:
{{{ .ocrText }}}
{{else if .processedFileText}}
Processed File Content:
{{{ .processedFileText }}}
{{else if .fileDataUri}}
File Content (e.g., DOCX or other types not processed above): {{media url=.fileDataUri}}
{{else}}
No file content, OCR text, or processed text was provided for analysis. Please answer the question based on general knowledge if possible, or state that you cannot answer without file content.
{{end}}

User Question: {{{.question}}}
File Type: {{{.fileType}}}

Specific Instructions:

1.  Answering Based on Content:
    -   If "Extracted Text from Image" (ocrText) is provided, use this text as the primary basis for answering the user's question.
    -   If "Processed File Content" (processedFileText) is provided:
        -   If the original File Type was 'application/zip', this content is a list of files. Your answer should primarily consist of this list. Avoid answering questions about the *internal content* of the files within the ZIP archive in this interaction unless the question is solely about the file names/types themselves.
        -   If the original File Type was 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' (XLSX) or 'application/pdf', this content is extracted text from the document. Use this text as the primary basis for answering.
    -   If "File Content" is provided via a media link (e.g., for DOCX files, or as a fallback if server-side extraction failed for other types), use the content accessible through that link to answer the question.
    -   If no content is available, state that you cannot answer the question without the file content, unless it's a general knowledge question you can answer without context.

2.  Image Generation Requests:
    -   If the user's question specifically asks for a visual representation (like a chart, graph, or image based on data described in the document), AND the original \`fileType\` is 'application/pdf' or 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', AND the primary content available to you for answering the question is from the \`{{media url=.fileDataUri}}\` (i.e., \`ocrText\` or \`processedFileText\` containing extracted document text is NOT available or not sufficient for the visualization request), then you may consider generating an image:
        a. Your textual answer should describe the visual or summarize data for visualization.
        b. Set 'requiresImageGeneration' output field to true.
        c. Provide a concise 'imageGenerationPrompt'.
    -   Do NOT set \`requiresImageGeneration\` to true if you have \`ocrText\` or \`processedFileText\` that directly answers the user's question about the content, even if the original file was a PDF/DOCX, unless the question is specifically about visualizing the original document's structure or content that was not captured in the extracted text.
    -   For all other file types or if the question does not ask for a visual representation from document data, set 'requiresImageGeneration' to false and do not provide an 'imageGenerationPrompt'.

3.  Guidance for setting the 'sources' output field:
    -   If using 'Extracted Text from Image': Set \`sources: ["Text extracted from uploaded image via OCR"]\`.
    -   If using 'Processed File Content' from a PDF: Set \`sources: ["Text extracted from uploaded PDF"]\`.
    -   If using 'Processed File Content' from an XLSX: Set \`sources: ["Data extracted from uploaded XLSX file"]\`.
    -   If 'Processed File Content' is a ZIP listing: Set \`sources: ["Uploaded ZIP archive (contents listed)"]\`.
    -   If answering based on content from \`{{media url=.fileDataUri}}\` (e.g., a DOCX file or a fallback for other types): Set \`sources: ["Uploaded Document ({{{fileType}}})"]\`.
    -   If no specific file content was used (e.g., general knowledge answer): Set \`sources: []\`.

4.  Output Format:
    -   Ensure your output is a valid JSON object matching the defined output schema (fields: answer, sources, requiresImageGeneration, imageGenerationPrompt).
    -   Be concise and directly answer the user's question based on the provided context.
`,
});

const PDF_TEXT_EXTRACTION_THRESHOLD = 100; 

const analyzeUploadedContentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedContentFlow',
    inputSchema: AnalyzeUploadedContentInputSchema,
    outputSchema: AnalyzeUploadedContentOutputSchema,
  },
  async (input: AnalyzeUploadedContentInput) => {
    console.log(`[AI_FLOW_DEBUG] Start: Question="${input.question}", FileType="${input.fileType}", DataURI_Present=${!!input.fileDataUri}, DataURI_Prefix=${input.fileDataUri?.substring(0,40)}`);
    console.time('analyzeUploadedContentFlow_total');
    
    let ocrText: string | null = null;
    let processedFileText: string | null = null;
    let dataIsValid = true;
    let validationMessage = "Data URI appears valid.";
    
    let dataForPrompt: PromptInput = { 
      ...input, 
      ocrText: null, 
      processedFileText: null,
      fileDataUri: input.fileDataUri 
    };

    if (input.fileDataUri) {
      const base64Data = input.fileDataUri.split(',')[1];
      if (!base64Data) {
        const invalidDataUriMsg = 'Invalid Data URI: Base64 content is missing.';
        validationMessage = invalidDataUriMsg;
        dataIsValid = false;
        if (input.fileType === 'image/png' || input.fileType === 'image/jpeg') {
          ocrText = invalidDataUriMsg;
        } else if (['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'text/plain', 'application/json'].includes(input.fileType)) {
          processedFileText = invalidDataUriMsg;
        }
        dataForPrompt.fileDataUri = undefined; 
      }
      console.log(`[AI_FLOW_DEBUG] Data URI Validation: Valid=${dataIsValid}, Message="${validationMessage}"`);

      if (dataIsValid && base64Data) {
        if (input.fileType === 'image/png' || input.fileType === 'image/jpeg') {
          console.log(`[AI_FLOW_DEBUG] Attempting Image OCR for ${input.fileType}`);
          try {
            console.time('analyzeUploadedContentFlow_ocr');
            const visionClient = new ImageAnnotatorClient();
            const [result] = await visionClient.textDetection({ image: { content: base64Data } });
            const detections = result.textAnnotations;
            if (detections && detections.length > 0 && detections[0]?.description) {
              ocrText = detections[0].description;
              console.log(`[AI_FLOW_DEBUG] Image OCR Success: Text found (length=${ocrText.length}): "${ocrText.substring(0, 100)}..."`);
              dataForPrompt.fileDataUri = undefined; 
            } else {
              ocrText = "No text found in image by OCR.";
              console.log(`[AI_FLOW_DEBUG] Image OCR: No text found.`);
            }
            console.timeEnd('analyzeUploadedContentFlow_ocr');
          } catch (error: any) {
            console.error("OCR Error:", error);
            ocrText = `OCR processing failed: ${error.message || 'Unknown error'}`;
            console.log(`[AI_FLOW_DEBUG] Image OCR Error: ${error.message || 'Unknown error'}`);
          }
          console.log(`[AI_FLOW_DEBUG] ocrText final value: "${ocrText?.substring(0,100)}..."`);
        } else if (input.fileType === 'application/pdf') {
          console.log(`[AI_FLOW_DEBUG] PDF Processing Attempted for ${input.fileType}`);
          let attemptOcrForPdf = false;
          try {
            console.time('analyzeUploadedContentFlow_pdf_parse');
            const pdfDataBuffer = Buffer.from(base64Data, 'base64');
            const pdfParsedData = await pdfParse(pdfDataBuffer);
            const directText = pdfParsedData.text;
            console.timeEnd('analyzeUploadedContentFlow_pdf_parse');

            if (directText && directText.trim().length >= PDF_TEXT_EXTRACTION_THRESHOLD) {
              processedFileText = directText.trim();
              console.log(`[AI_FLOW_DEBUG] PDF Direct Parse Success: Text extracted (length=${processedFileText.length}): "${processedFileText.substring(0,100)}..."`);
              dataForPrompt.fileDataUri = undefined;
            } else {
              console.log(`[AI_FLOW_DEBUG] PDF Direct Parse: Insufficient text (length=${directText?.trim().length || 0}), attempting OCR.`);
              attemptOcrForPdf = true;
              // Retain short direct text in case OCR also fails or finds nothing
              processedFileText = directText?.trim() || null; 
            }
          } catch (parseError: any) {
            console.error("PDF Direct Parse Error:", parseError);
            processedFileText = `PDF direct parsing failed: ${parseError.message || 'Unknown error'}.`;
            console.log(`[AI_FLOW_DEBUG] PDF Parse/OCR Error (direct parse): ${parseError.message || 'Unknown error'}`);
            attemptOcrForPdf = true; // Attempt OCR if direct parse fails
          }

          if (attemptOcrForPdf) {
            console.log(`[AI_FLOW_DEBUG] Attempting PDF OCR.`);
            console.time('analyzeUploadedContentFlow_pdf_ocr');
            try {
              const visionClient = new ImageAnnotatorClient();
              const request = {
                image: { content: base64Data }, // For PDFs, content is passed this way
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              };
              const [result] = await visionClient.documentTextDetection(request as any); // Cast if type mismatch
              const fullTextAnnotation = result.fullTextAnnotation;
              if (fullTextAnnotation && fullTextAnnotation.text && fullTextAnnotation.text.trim()) {
                processedFileText = fullTextAnnotation.text.trim(); // OCR result takes precedence
                console.log(`[AI_FLOW_DEBUG] PDF OCR Success: Text extracted (length=${processedFileText.length}): "${processedFileText.substring(0,100)}..."`);
                dataForPrompt.fileDataUri = undefined;
              } else {
                // If OCR finds no new text, and direct parse was also insufficient/failed
                if (!processedFileText || processedFileText.startsWith("PDF direct parsing failed:")) {
                   processedFileText = "No text found in PDF by OCR (after attempting direct parse and OCR).";
                } // else, retain the short text from pdf-parse
                console.log(`[AI_FLOW_DEBUG] PDF OCR: No significant text found. Retained: "${processedFileText?.substring(0,100)}..."`);
              }
            } catch (ocrError: any) {
              console.error("PDF OCR Error:", ocrError);
              const ocrErrorMessage = `PDF OCR processing failed: ${ocrError.message || 'Unknown error'}`;
              // If direct parse also failed, append OCR error. Otherwise, prioritize direct parse error or short text.
              if (!processedFileText || processedFileText.startsWith("PDF direct parsing failed:")) {
                processedFileText = ocrErrorMessage;
              } else {
                processedFileText += ` (OCR also attempted and failed: ${ocrError.message || 'Unknown error'})`;
              }
              console.log(`[AI_FLOW_DEBUG] PDF OCR Error: ${ocrError.message || 'Unknown error'}`);
            }
            console.timeEnd('analyzeUploadedContentFlow_pdf_ocr');
          }
          console.log(`[AI_FLOW_DEBUG] processedFileText final value (PDF): "${processedFileText?.substring(0,100)}..."`);
        } else if (input.fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          // ... (XLSX LOGIC - REMAINS THE SAME)
          console.log(`[AI_FLOW_DEBUG] Attempting XLSX Parse for ${input.fileType}`);
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
            if (fullText.trim()) {
                dataForPrompt.fileDataUri = undefined;
                console.log(`[AI_FLOW_DEBUG] XLSX Parse Success: Text extracted (length=${processedFileText.length}): "${processedFileText.substring(0,100)}..."`);
            } else {
                console.log(`[AI_FLOW_DEBUG] XLSX Parse: No text content found.`);
            }
            console.timeEnd('analyzeUploadedContentFlow_xlsx');
          } catch (error: any) {
            console.error("XLSX Parsing Error:", error);
            processedFileText = `XLSX parsing failed: ${error.message || 'Unknown error'}`;
            console.log(`[AI_FLOW_DEBUG] XLSX Parse Error: ${error.message || 'Unknown error'}`);
          }
          console.log(`[AI_FLOW_DEBUG] processedFileText final value (XLSX): "${processedFileText?.substring(0,100)}..."`);
        } else if (input.fileType === 'application/zip') {
          // ... (ZIP LOGIC - REMAINS THE SAME)
          console.log(`[AI_FLOW_DEBUG] Attempting ZIP Process for ${input.fileType}`);
          try {
            console.time('analyzeUploadedContentFlow_zip');
            const zip = await JSZip.loadAsync(Buffer.from(base64Data, 'base64'));
            let fileListPrefix = "Contents of ZIP file:\n";
            const files: string[] = [];
            zip.forEach((relativePath, zipEntry) => {
              const name = zipEntry.name || "";
              files.push(`- ${name} ${zipEntry.dir ? '(directory)' : '(file)'}`);
            });
            
            const meaningfulFileEntries = files.filter(f => {
              const match = f.match(/^- (.*?) \((file|directory)\)$/);
              const entryName = match ? match[1] : f.replace(/^- (file|directory)$/, '').trim();
              return entryName.trim() !== ""; 
            });

            if (meaningfulFileEntries.length === 0) { 
              processedFileText = "ZIP file is empty or contains no listable files.";
              console.log(`[AI_FLOW_DEBUG] ZIP Process: Empty ZIP or no files found.`);
            } else {
              processedFileText = fileListPrefix + meaningfulFileEntries.join('\n');
              dataForPrompt.fileDataUri = undefined; 
              console.log(`[AI_FLOW_DEBUG] ZIP Process Success: Content list (length=${processedFileText.length}): "${processedFileText.substring(0,100)}..."`);
            }
            console.timeEnd('analyzeUploadedContentFlow_zip');
          } catch (error: any) {
            console.error("ZIP Parsing Error:", error);
            processedFileText = `ZIP parsing failed: ${error.message || 'Unknown error'}`;
            console.log(`[AI_FLOW_DEBUG] ZIP Process Error: ${error.message || 'Unknown error'}`);
          }
          console.log(`[AI_FLOW_DEBUG] processedFileText final value (ZIP): "${processedFileText?.substring(0,100)}..."`);
        } else if (input.fileType === 'text/plain' || input.fileType === 'application/json') {
          console.log(`[AI_FLOW_DEBUG] Handling ${input.fileType} (passthrough to media helper or manual decode if needed).`);
        }
      }
    } else { 
        console.log(`[AI_FLOW_DEBUG] No fileDataUri provided. Proceeding without file processing.`);
        validationMessage = "No fileDataUri provided.";
        console.log(`[AI_FLOW_DEBUG] Data URI Validation: Valid=N/A, Message="${validationMessage}"`);
    }

    dataForPrompt.ocrText = ocrText;
    dataForPrompt.processedFileText = processedFileText;

    // Consolidate clearing of fileDataUri: if any text was successfully extracted, clear it.
    if (ocrText && !ocrText.startsWith("OCR processing failed:") && !ocrText.startsWith("Invalid Data URI") && ocrText !== "No text found in image by OCR.") {
        // OCR succeeded with text
    } else if (processedFileText && !processedFileText.startsWith("PDF direct parsing failed:") && !processedFileText.startsWith("PDF OCR processing failed:") && !processedFileText.startsWith("XLSX parsing failed:") && !processedFileText.startsWith("ZIP parsing failed:") && !processedFileText.startsWith("Invalid Data URI") && processedFileText !== "No text content found in XLSX file." && processedFileText !== "ZIP file is empty or contains no listable files." && processedFileText !== "No text found in PDF by OCR.") {
        // File processing succeeded with text
    } else if (dataIsValid && input.fileDataUri) { // If no specific text was extracted, but data was valid
        dataForPrompt.fileDataUri = input.fileDataUri; // Restore it for media helper
    } else { // No data URI or invalid from start
        dataForPrompt.fileDataUri = undefined;
    }
    
    console.log(`[AI_FLOW_DEBUG] Data for Prompt: ocrText_present=${!!dataForPrompt.ocrText}, processedFileText_present=${!!dataForPrompt.processedFileText}, fileDataUri_present=${!!dataForPrompt.fileDataUri}, fileType=${dataForPrompt.fileType}, question="${dataForPrompt.question}"`);

    const {output} = await (async () => {
      console.time('analyzeUploadedContentPrompt_total');
      const result = await analyzeUploadedContentPrompt(dataForPrompt);
      console.timeEnd('analyzeUploadedContentPrompt_total');
      return result;
    })();
    
    console.log(`[AI_FLOW_DEBUG] Output from Prompt: Answer snippet="${output?.answer?.substring(0,100)}..."`);
    console.timeEnd('analyzeUploadedContentFlow_total');

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
