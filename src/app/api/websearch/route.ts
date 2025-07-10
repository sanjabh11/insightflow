import { NextRequest, NextResponse } from 'next/server';


export const runtime = 'edge'; // For fast response

/**
 * POST /api/websearch
 * Request body: { query: string }
 * Response: { answer: string, sources: {title: string, url: string}[] }
 * Version 2.9.2
 */
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'No query provided.' }, { status: 400 });
    }

    // Google Custom Search API endpoint (using Gemini for answer synthesis)
    // You must set up a Google Programmable Search Engine and get an API key and cx
    // For demonstration, we'll use Gemini to search the web and synthesize an answer
    // This is a placeholder: Replace with your actual Google Search integration
    const searchResults = await fetch(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${process.env.GEMINI_API_KEY}&cx=YOUR_GOOGLE_CSE_CX`,
      { method: 'GET' }
    );
    if (!searchResults.ok) {
      return NextResponse.json({ answer: 'No relevant answer found on the internet.', sources: [] }, { status: 200 });
    }
    const data = await searchResults.json();
    const items = data.items || [];
    const sources = items.slice(0, 3).map((item: any) => ({
      title: item.title,
      url: item.link
    }));
    // Synthesize answer using Gemini (if available)
    let answer = '';
    if (items.length > 0) {
      answer = items[0].snippet;
    } else {
      answer = 'No relevant answer found on the internet.';
    }
    return NextResponse.json({ answer, sources });
  } catch (err) {
    return NextResponse.json({ answer: 'No relevant answer found on the internet.', sources: [] }, { status: 200 });
  }
}
