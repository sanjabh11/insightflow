export const mockTextDetection = jest.fn();
export const mockDocumentTextDetection = jest.fn(); // Added for PDF OCR

export const ImageAnnotatorClient = jest.fn().mockImplementation(() => {
  return {
    textDetection: mockTextDetection,
    documentTextDetection: mockDocumentTextDetection, // Added for PDF OCR
  };
});
