export const mockTextDetection = jest.fn();

export const ImageAnnotatorClient = jest.fn().mockImplementation(() => {
  return {
    textDetection: mockTextDetection,
  };
});
