'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LanguageCode, useSpeech as useSpeechType } from '@/hooks/useSpeech'; // Import useSpeechType for ReturnType
import { Volume2, Languages } from 'lucide-react';

interface AudioControlsCardProps {
  speechControl: ReturnType<typeof useSpeechType>;
}

export function AudioControlsCard({ speechControl }: AudioControlsCardProps) {
  const {
    supported,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    selectedLanguage,
    setSelectedLanguage,
    error
  } = speechControl; // Use the passed prop

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-muted-foreground" />
            Audio Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Speech synthesis and recognition are not supported by your browser.
          </p>
          {error && <p className="text-destructive mt-2 text-sm">{error.error} {error.message}</p>}
        </CardContent>
      </Card>
    );
  }

  const femaleVoices = voices.filter(v => v.gender === 'female');
  const maleVoices = voices.filter(v => v.gender === 'male');
  const otherVoices = voices.filter(v => v.gender === undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-6 h-6 text-primary" />
          Audio Controls
        </CardTitle>
        <CardDescription>Select language and voice for audio responses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language-select" className="flex items-center gap-1">
            <Languages className="w-4 h-4" /> Language
          </Label>
          <Select
            value={selectedLanguage}
            onValueChange={(value) => setSelectedLanguage(value as LanguageCode)}
          >
            <SelectTrigger id="language-select" aria-label="Select language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="hi-IN">Hindi (India)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-select" className="flex items-center gap-1">
            <Volume2 className="w-4 h-4" /> Voice
          </Label>
          <Select
            value={selectedVoiceURI || ''}
            onValueChange={(value) => value && setSelectedVoiceURI(value)}
            disabled={voices.length === 0}
          >
            <SelectTrigger id="voice-select" aria-label="Select voice">
              <SelectValue placeholder={voices.length > 0 ? "Select voice" : "No voices for language"} />
            </SelectTrigger>
            <SelectContent>
              {voices.length === 0 && <SelectItem value="" disabled>No voices available</SelectItem>}

              {femaleVoices.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Lady Voices</SelectLabel>
                  {femaleVoices.map((voice) => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}

              {maleVoices.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Manly Voices</SelectLabel>
                  {maleVoices.map((voice) => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}

              {otherVoices.length > 0 && (
                 <SelectGroup>
                  <SelectLabel>Other Voices</SelectLabel>
                  {otherVoices.map((voice) => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {(femaleVoices.length === 0 && maleVoices.length === 0 && otherVoices.length === 0 && voices.length > 0) && (
                 <SelectGroup>
                    <SelectLabel>Available Voices</SelectLabel>
                    {voices.map((voice) => (
                        <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                        </SelectItem>
                    ))}
                 </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-destructive text-sm">{error.error}{error.message ? `: ${error.message}`: ''}</p>}
      </CardContent>
    </Card>
  );
}
