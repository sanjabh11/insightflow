// This file should be in src/ai/flows/__mocks__/jszip.ts

const mockJSZipLoadAsync = jest.fn();

// To allow tests to import and manipulate this mock directly:
export { mockJSZipLoadAsync };

// This is what will be imported when 'jszip' is imported in the code under test.
// The source code uses `import JSZip from 'jszip';` then `JSZip.loadAsync(...)`.
// This means the default export must be an object with a `loadAsync` method.
export default {
  loadAsync: mockJSZipLoadAsync,
};
