import { NextResponse } from 'next/server';

// This API proxies OCR requests to the standalone Node.js OCR microservice at http://localhost:4001/ocr

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ocrRes = await fetch('http://localhost:4001/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await ocrRes.json();
    if (!ocrRes.ok) {
      return NextResponse.json({ error: data.error || 'OCR microservice error', details: data.details }, { status: ocrRes.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to proxy OCR request', details: error.message }, { status: 500 });
  }
}
