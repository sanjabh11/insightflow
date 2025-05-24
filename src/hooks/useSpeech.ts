'use client';

import { useState, useEffect, useCallback } from 'react';

export type LanguageCode = 'en-US' | 'hi-IN';

export interface SpeechError {
  error: string;
  message?: string;
}

// Heuristic lists for voice categorization. These may need adjustment based on common browser voices.
const knownFemaleVoiceNames = [
  'samantha', 'karen', 'moira', 'google us english', 'microsoft zira', 'fiona', 'veena', 
  'google हिन्दी', 'lekha', 'female', 'woman', 'girl' 
];
const knownMaleVoiceNames = [
  'daniel', 'alex', 'tom', 'microsoft david', 'rishi', 'lee', 'oliver', 'male', 'man', 'boy'
];


export function useSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [allVoices, setAllVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en-US');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  const [recognitionInstance, setRecognitionInstance] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const instance = new SpeechRecognitionAPI();
        instance.continuous = false; // STT stops after first final result
        instance.interimResults = true;
        setRecognitionInstance(instance);
      }
      
      if (window.speechSynthesis && SpeechRecognitionAPI) {
        setSupported(true);
      } else {
        setSupported(false);
        setError({ error: 'Speech synthesis or recognition not supported by this browser.' });
      }
    }
  }, []);
  
  const processVoices = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      setAllVoices(voices);

      const currentLangVoices = voices.filter(voice => voice.lang.startsWith(selectedLanguage.split('-')[0]));
      
      let newSelectedVoiceURI: string | null = null;

      if (currentLangVoices.length > 0) {
        const defaultForLang = currentLangVoices.find(v => v.default);
        if (defaultForLang) {
          newSelectedVoiceURI = defaultForLang.voiceURI;
        } else {
          // Try specific voices if language is Hindi
          if (selectedLanguage === 'hi-IN') {
            const rishiVoice = currentLangVoices.find(v => v.name.toLowerCase().includes('rishi'));
            const googleHindiVoice = currentLangVoices.find(v => v.name.toLowerCase().includes('google हिन्दी'));
            if (rishiVoice) newSelectedVoiceURI = rishiVoice.voiceURI;
            else if (googleHindiVoice) newSelectedVoiceURI = googleHindiVoice.voiceURI;
          }
          if (!newSelectedVoiceURI) {
            newSelectedVoiceURI = currentLangVoices[0].voiceURI; // Fallback to first available for language
          }
        }
      } else if (voices.length > 0) { // Fallback to any voice if no specific language match
        const globalDefault = voices.find(v => v.default);
        newSelectedVoiceURI = globalDefault ? globalDefault.voiceURI : voices[0].voiceURI;
      }
      setSelectedVoiceURI(newSelectedVoiceURI);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    if (supported) {
      processVoices();
      window.speechSynthesis.onvoiceschanged = processVoices;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
        if (recognitionInstance) {
            recognitionInstance.abort(); // Ensure recognition is stopped on unmount
        }
      };
    }
  }, [supported, processVoices, recognitionInstance]);

  useEffect(() => {
    // Update selected voice when language changes
    if (supported) {
      processVoices();
    }
  }, [selectedLanguage, supported, processVoices]);

  // Speak with language selection and chunking for long texts
  const speak = useCallback((text: string, lang?: string) => {
    if (!supported || !text.trim() || !window.speechSynthesis) return;
    if (isSpeaking || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    // Chunk text if too long (browser limits)
    const maxChunkLength = 200;
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, maxChunkLength);
      // Try to split at sentence boundary
      const lastPunct = chunk.lastIndexOf('. ');
      if (lastPunct > 50) chunk = chunk.slice(0, lastPunct + 1);
      chunks.push(chunk.trim());
      remaining = remaining.slice(chunk.length).trim();
    }
    let currentChunk = 0;
    const speakChunk = () => {
      if (currentChunk >= chunks.length) {
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[currentChunk]);
      utterance.lang = lang || selectedLanguage;
      if (selectedVoiceURI) utterance.voice = allVoices.find(v => v.voiceURI === selectedVoiceURI) || null;
      if (lang && allVoices.length > 0) {
        const match = allVoices.find(v => v.lang === lang);
        if (match) utterance.voice = match;
      }
      utterance.onend = () => {
        currentChunk++;
        speakChunk();
      };
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        setError({ error: 'Speech synthesis error', message: event.error });
      };
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    };
    speakChunk();
  }, [supported, allVoices, selectedVoiceURI, selectedLanguage, isSpeaking]);

  const cancelSpeaking = useCallback(() => {
    if (supported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  const startListening = useCallback(() => {
    if (!supported || !recognitionInstance || isListening) return;

    setTranscript('');
    setError(null);
    recognitionInstance.lang = selectedLanguage;

    recognitionInstance.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
      if (finalTranscript) {
        // Recognition stops itself due to continuous = false
      }
    };

    recognitionInstance.onerror = (event) => {
      setError({ error: 'Speech recognition error', message: event.error });
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    recognitionInstance.start();
    setIsListening(true);
  }, [supported, recognitionInstance, isListening, selectedLanguage]);

  const stopListening = useCallback(() => {
    if (recognitionInstance && isListening) {
      recognitionInstance.stop();
      // onend will set isListening to false
    }
  }, [recognitionInstance, isListening]);

  const getCategorizedVoices = useCallback(() => {
    const langPrefix = selectedLanguage.split('-')[0];
    const filtered = allVoices.filter(voice => voice.lang.startsWith(langPrefix));
    
    return filtered.map(voice => {
      const nameLower = voice.name.toLowerCase();
      let gender: 'female' | 'male' | undefined = undefined;
      if (knownFemaleVoiceNames.some(femaleName => nameLower.includes(femaleName))) {
        gender = 'female';
      } else if (knownMaleVoiceNames.some(maleName => nameLower.includes(maleName))) {
        gender = 'male';
      }
      return { name: voice.name, voiceURI: voice.voiceURI, lang: voice.lang, gender };
    });
  }, [allVoices, selectedLanguage]);

  const updateSelectedLanguage = (lang: LanguageCode) => {
    setSelectedLanguage(lang);
  };

  const updateSelectedVoiceURI = (uri: string) => {
    setSelectedVoiceURI(uri);
  };

  return {
    isListening,
    isSpeaking,
    supported,
    voices: getCategorizedVoices(),
    selectedVoiceURI,
    setSelectedVoiceURI: updateSelectedVoiceURI,
    selectedLanguage,
    setSelectedLanguage: updateSelectedLanguage,
    transcript,
    error,
    speak,
    cancelSpeaking,
    startListening,
    stopListening,
  };
}