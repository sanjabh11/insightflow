// TypeScript declaration for dynamic import of pdfjs-dist modules
// This file allows importing 'pdfjs-dist/build/pdf' and 'pdfjs-dist/legacy/build/pdf' without type errors.
declare module 'pdfjs-dist/build/pdf' {
  const pdfjsLib: any;
  export = pdfjsLib;
}
declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjsLib: any;
  export = pdfjsLib;
}
