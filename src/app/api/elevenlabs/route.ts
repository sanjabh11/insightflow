// ElevenLabs API removed

const ELEVENLAB_API_KEY = process.env.Elevenlab_api_key;
const BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * POST /api/elevenlabs
 * Request body: { text: string, voice?: string, model?: string, language?: string }
 * Response: Audio stream (audio/mpeg)
 * Version 3.0.0 (modular, rollback-ready)
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'Rachel', model = 'eleven_multilingual_v3', language = 'en' } = await req.json();
    if (!text) {
      return new NextResponse('No text provided', { status: 400 });
    }
    if (!ELEVENLAB_API_KEY) {
      return new NextResponse('No ElevenLabs API key set', { status: 500 });
    }

    // ElevenLabs v3 API endpoint
    const url = `${BASE_URL}/${voice}/stream`;
    const body = JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      },
      output_format: 'mp3',
      xi_api_key: ELEVENLAB_API_KEY,
      language
    });
    const elevenRes = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLAB_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body
    });
    if (!elevenRes.ok) {
      return new NextResponse('Failed to get audio from ElevenLabs', { status: 502 });
    }
    // Stream audio directly to the client
    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="speech.mp3"'
      }
    });
  } catch (err) {
    return new NextResponse('Error processing TTS request', { status: 500 });
  }
}
