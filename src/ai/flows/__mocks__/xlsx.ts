export const mockXLSXRead = jest.fn();
export const mockSheetToTxt = jest.fn();

export const read = mockXLSXRead;
export const utils = {
  sheet_to_txt: mockSheetToTxt,
};

// You might need to export other functions if the SUT uses them,
// otherwise jest.requireActual can be used carefully if the real module
// doesn't have side effects. For this case, we only need `read` and `utils.sheet_to_txt`.
