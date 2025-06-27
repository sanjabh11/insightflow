// ElevenLabs client removed
// Version 3.0.0

const DEFAULT_VOICE = 'Rachel';
const DEFAULT_MODEL = 'eleven_multilingual_v3';

export async function getElevenLabsAudio({ text, voice = DEFAULT_VOICE, model = DEFAULT_MODEL, language = 'en' }: { text: string, voice?: string, model?: string, language?: string }) {
  const res = await fetch('/api/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, model, language })
  });
  if (!res.ok) throw new Error('Failed to generate audio');
  return await res.blob(); // Returns MP3 blob
}
