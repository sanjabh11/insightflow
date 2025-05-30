import { analyzeUploadedContent, AnalyzeUploadedContentInput, AnalyzeUploadedContentOutput } from '../analyze-uploaded-content';

// Import mocks from the __mocks__ directory
import { mockTextDetection } from '../__mocks__/@google-cloud/vision';
import { mockXLSXRead, mockSheetToTxt } from '../__mocks__/xlsx';
import { mockJSZipLoadAsync } from '../__mocks__/jszip'; 


// Mock the Genkit internals
const mockInternalPromptFunction = jest.fn();
jest.mock('@/ai/genkit', () => {
  return {
    ai: {
      definePrompt: jest.fn().mockImplementation((promptConfig) => {
        return async (input: any) => {
          mockInternalPromptFunction(input); 
          return { 
            output: {
              answer: 'Mocked LLM answer', 
              sources: [], 
              requiresImageGeneration: false,
              imageGenerationPrompt: undefined,
            } as AnalyzeUploadedContentOutput 
          };
        };
      }),
      defineFlow: jest.fn().mockImplementation((flowConfig, flowFn) => {
        return flowFn; 
      }),
    },
  };
});


describe('analyzeUploadedContent Flow Logic', () => {
  beforeEach(() => {
    mockTextDetection.mockReset(); // Use mockReset for more thorough cleaning
    mockInternalPromptFunction.mockReset(); // Use mockReset
    mockXLSXRead.mockReset(); // Use mockReset
    mockSheetToTxt.mockReset(); // Use mockReset
    mockJSZipLoadAsync.mockReset(); // Use mockReset
  });

  const pngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const xlsxDataUri = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,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';
  const emptyZipDataUri = 'data:application/zip;base64,UEsFBgAAAAABAAEAPwAAAAAAAQAAAAA=';
  const zipDataUri = 'data:application/zip;base64,UEsDBBQAAAAAADCgVlYAAAAAAAAAAAAAAAAKAAAAdGVzdC50eHRVS0cAAkcIaGVsbG9QSwECHgMUAAAAAAAwgFZVAAAAAAAAAAAAAAAACgAYAAAAAAAAAAAApIEAAAAAdGVzdC50eHRVS0cAAkcIaGVsbG9QSwUGAAAAAAEAAQBVAAAALwAAAAAA';
  const txtDataUri = 'data:text/plain;base64,SGVsbG8gV29ybGQh';
  const pdfDataUri = 'data:application/pdf;base64,JVBERi0xLjQKJdead6K9CjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbMCAwIDU5NSA4NDJdCi9SZXNvdXJjZXMgPDwvRm9udCA8PC9GMSA8PC9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYT4+Pj4+Ci9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCA0ND4+CnN0cmVhbQpCVCAvRjEgMTIgVGYgNzIgNzkyIFRkIChIZWxsbyBQREYpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAIG4gCjAwMDAwMDAxNTIgMDAwMDAIG4gCjAwMDAwMDAzMTggMDAwMDAIG4gCnRyYWlsZXIKPDwvU2l6ZSA1Ci9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM2NQolJUVPRgo=';
  const malformedDataUri = 'data:image/png;base64'; 
  const invalidBase64DataUri = 'data:image/png;base64,thisIsNotValidBase64!';

  describe('Image OCR Processing', () => {
    it('should call prompt with ocrText for successful OCR (PNG)', async () => {
      const ocrResultText = 'Extracted OCR text from PNG';
      mockTextDetection.mockResolvedValueOnce([{ textAnnotations: [{ description: ocrResultText }] }]);
      await analyzeUploadedContent({ fileDataUri: pngDataUri, question: 'Test question', fileType: 'image/png' });
      expect(mockTextDetection).toHaveBeenCalledTimes(1);
      expect(mockInternalPromptFunction).toHaveBeenCalledTimes(1);
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: ocrResultText,
        fileDataUri: undefined, 
        question: 'Test question',
        fileType: 'image/png',
      }));
    });

    it('should handle OCR when no text is found', async () => {
      mockTextDetection.mockResolvedValueOnce([{ textAnnotations: [] }]); 
      await analyzeUploadedContent({ fileDataUri: pngDataUri, question: 'Test question', fileType: 'image/png' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: 'No text found in image by OCR.',
        fileDataUri: pngDataUri, 
      }));
    });

    it('should handle OCR failure', async () => {
      mockTextDetection.mockRejectedValueOnce(new Error('OCR API Error'));
      await analyzeUploadedContent({ fileDataUri: pngDataUri, question: 'Test question', fileType: 'image/png' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: 'OCR processing failed: OCR API Error',
        fileDataUri: pngDataUri, 
      }));
    });
  });


  describe('XLSX Parsing', () => {
    it('should call prompt with processedFileText for successful XLSX parsing', async () => {
      mockXLSXRead.mockReturnValueOnce({ SheetNames: ['Sheet1'], Sheets: { 'Sheet1': {} } }); 
      mockSheetToTxt.mockReturnValueOnce('CellA1\tCellB1');

      await analyzeUploadedContent({ fileDataUri: xlsxDataUri, question: 'Test question', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      expect(mockXLSXRead).toHaveBeenCalledTimes(1);
      expect(mockSheetToTxt).toHaveBeenCalledTimes(1);
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'Sheet "Sheet1":\nCellA1\tCellB1', 
        fileDataUri: undefined,
      }));
    });

    it('should handle XLSX parsing error when read throws', async () => {
      mockXLSXRead.mockImplementationOnce(() => { throw new Error('XLSX Read Error'); });
      
      await analyzeUploadedContent({ fileDataUri: xlsxDataUri, question: 'Test question', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'XLSX parsing failed: XLSX Read Error',
        fileDataUri: xlsxDataUri, 
      }));
    });
    
    it('should handle case where XLSX sheet_to_txt returns empty string (no text content)', async () => {
      mockXLSXRead.mockReturnValueOnce({ SheetNames: ['Sheet1'], Sheets: { 'Sheet1': {} } });
      mockSheetToTxt.mockReturnValueOnce(''); 
      
      await analyzeUploadedContent({ fileDataUri: xlsxDataUri, question: 'Test question', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'No text content found in XLSX file.',
        fileDataUri: xlsxDataUri, 
      }));
    });
  });

  describe('ZIP File Listing', () => {
    it('should call prompt with processedFileText for successful ZIP listing', async () => {
      const mockZipFiles = {
        'test.txt': { name: 'test.txt', dir: false },
        'folder/': { name: 'folder/', dir: true },
      };
      const localForEachMockSuccess = jest.fn((callback) => { 
        Object.keys(mockZipFiles).forEach(path => {
          callback(path, mockZipFiles[path as keyof typeof mockZipFiles]);
        });
      });
      mockJSZipLoadAsync.mockResolvedValueOnce({
        files: mockZipFiles,
        forEach: localForEachMockSuccess,
      });

      await analyzeUploadedContent({ fileDataUri: zipDataUri, question: 'Test question', fileType: 'application/zip' });
      
      expect(mockJSZipLoadAsync).toHaveBeenCalledTimes(1);
      expect(localForEachMockSuccess).toHaveBeenCalledTimes(1); 
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'Contents of ZIP file:\n- test.txt (file)\n- folder/ (directory)',
        fileDataUri: undefined,
      }));
    });
    
    it('should handle empty ZIP file listing', async () => {
      const localForEachMockEmpty = jest.fn(); 
      mockJSZipLoadAsync.mockResolvedValueOnce({
        files: {}, 
        forEach: localForEachMockEmpty,
      });
      
      await analyzeUploadedContent({ fileDataUri: emptyZipDataUri, question: 'What is in this?', fileType: 'application/zip' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'ZIP file is empty or contains no listable files.',
        fileDataUri: emptyZipDataUri, 
      }));
       expect(localForEachMockEmpty).toHaveBeenCalledTimes(1); 
    });

    it('should handle ZIP parsing failure', async () => {
      mockJSZipLoadAsync.mockRejectedValueOnce(new Error('JSZip Corrupted'));
      await analyzeUploadedContent({ fileDataUri: zipDataUri, question: 'Test question', fileType: 'application/zip' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'ZIP parsing failed: JSZip Corrupted',
        fileDataUri: zipDataUri,
      }));
    });
  });

  describe('Passthrough File Types (TXT, PDF)', () => {
    it('should call prompt with fileDataUri for TXT files', async () => {
      await analyzeUploadedContent({ fileDataUri: txtDataUri, question: 'Test question', fileType: 'text/plain' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        fileDataUri: txtDataUri, ocrText: null, processedFileText: null, fileType: 'text/plain',
      }));
    });
    it('should call prompt with fileDataUri for PDF files (non-OCR path)', async () => {
      await analyzeUploadedContent({ fileDataUri: pdfDataUri, question: 'Test question', fileType: 'application/pdf' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        fileDataUri: pdfDataUri, ocrText: null, processedFileText: null, fileType: 'application/pdf',
      }));
    });
  });

  describe('Invalid Data URI Handling', () => {
    it('should handle malformed data URI (missing base64 content) for image', async () => {
      await analyzeUploadedContent({ fileDataUri: malformedDataUri, question: 'Test', fileType: 'image/png' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: 'Invalid Data URI: Base64 content is missing.', fileDataUri: undefined,
      }));
    });
    it('should handle malformed data URI for XLSX', async () => {
      await analyzeUploadedContent({ fileDataUri: malformedDataUri, question: 'Test', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        processedFileText: 'Invalid Data URI: Base64 content is missing.', fileDataUri: undefined,
      }));
    });
    it('should handle malformed data URI for ZIP', async () => {
        await analyzeUploadedContent({ fileDataUri: malformedDataUri, question: 'Test', fileType: 'application/zip' });
        expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
          processedFileText: 'Invalid Data URI: Base64 content is missing.', fileDataUri: undefined,
        }));
      });
    it('should pass invalid base64 to Vision API and reflect its error for images', async () => {
      mockTextDetection.mockRejectedValueOnce(new Error('Invalid image buffer from Vision API'));
      await analyzeUploadedContent({ fileDataUri: invalidBase64DataUri, question: 'Test', fileType: 'image/png' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: 'OCR processing failed: Invalid image buffer from Vision API', fileDataUri: invalidBase64DataUri,
      }));
    });
  });
  
  describe('Content Priority and No File URI', () => {
    it('should prioritize OCR text for images', async () => {
      const ocrResultText = 'Prioritized OCR Text';
      mockTextDetection.mockResolvedValueOnce([{ textAnnotations: [{ description: ocrResultText }] }]);
      await analyzeUploadedContent({ fileDataUri: pngDataUri, question: 'Test priority', fileType: 'image/png' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: ocrResultText, processedFileText: null, fileDataUri: undefined,
      }));
    });

    it('should prioritize processedFileText for XLSX if not an image', async () => {
      mockXLSXRead.mockReturnValueOnce({ SheetNames: ['Sheet1'], Sheets: { 'Sheet1': {} } });
      mockSheetToTxt.mockReturnValueOnce('CellA1\tCellB1'); 
      await analyzeUploadedContent({ fileDataUri: xlsxDataUri, question: 'Test XLSX priority', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: null, 
        processedFileText: 'Sheet "Sheet1":\nCellA1\tCellB1', 
        fileDataUri: undefined,
      }));
    });

    it('should use fileDataUri via media helper for PDF if no other processing applies', async () => {
      await analyzeUploadedContent({ fileDataUri: pdfDataUri, question: 'Test PDF passthrough', fileType: 'application/pdf' });
      expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
        ocrText: null, processedFileText: null, fileDataUri: pdfDataUri,
      }));
    });

    it('should handle calls with no fileDataUri (e.g., general question)', async () => {
        await analyzeUploadedContent({ question: 'General knowledge question', fileType: '' }); 
        expect(mockInternalPromptFunction).toHaveBeenCalledWith(expect.objectContaining({
          question: 'General knowledge question', fileDataUri: undefined, ocrText: null, processedFileText: null,
        }));
      });
  });
});
