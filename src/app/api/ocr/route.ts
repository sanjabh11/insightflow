import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Process image with Tesseract.js
    const result = await Tesseract.recognize(
      image,
      'eng', // Language
      { logger: (m: any) => console.log(m) } // Optional logger
    );

    return NextResponse.json({ text: result.data.text });
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}
