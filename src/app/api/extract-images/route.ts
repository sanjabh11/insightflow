import { NextResponse } from 'next/server';
import JSZip from 'jszip';

async function extractImagesFromDOCX(data: Buffer): Promise<string[]> {
  const images: string[] = [];
  const zip = await JSZip.loadAsync(data);
  const media = zip.folder('word/media');
  if (media) {
    const files = Object.keys(media.files);
    for (const fname of files) {
      const file = media.files[fname];
      const blob = await file.async('base64');
      // Guess MIME type from extension
      let mime = 'image/png';
      if (fname.endsWith('.jpg') || fname.endsWith('.jpeg')) mime = 'image/jpeg';
      else if (fname.endsWith('.gif')) mime = 'image/gif';
      else if (fname.endsWith('.bmp')) mime = 'image/bmp';
      images.push(`data:${mime};base64,${blob}`);
    }
  }
  return images;
}

export async function POST(req: Request) {
  try {
    const { file, fileType } = await req.json();
    if (!file || !fileType) {
      return NextResponse.json({ error: 'No file or fileType provided' }, { status: 400 });
    }
    // Base64 to Buffer
    const base64 = file.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    let images: string[] = [];
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      images = await extractImagesFromDOCX(buffer);
    } else {
      return NextResponse.json({ error: 'Unsupported fileType' }, { status: 400 });
    }
    return NextResponse.json({ images });
  } catch (error) {
    console.error('Extract Images Error:', error);
    return NextResponse.json({ error: 'Failed to extract images' }, { status: 500 });
  }
}
