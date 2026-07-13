import { useCallback, useEffect, useRef, useState } from 'react';
import { browserNarration } from '../../lib/providers/tts';
import type { TtsProviderId } from '../../lib/types';

interface NarrationState {
  playing: boolean;
  /** Char index of the word currently being spoken (browser TTS only), else -1. */
  charIndex: number;
}

/** Drives narration for the *current* page — pre-rendered audio if present,
 *  otherwise live browser speech with word-boundary highlighting. */
export function useNarration(opts: {
  text: string;
  audioUrl?: string;
  ttsProvider: TtsProviderId;
  lang?: string;
  onEnd?: () => void;
}) {
  const { text, audioUrl, ttsProvider, lang, onEnd } = opts;
  const [state, setState] = useState<NarrationState>({ playing: false, charIndex: -1 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browser = useRef(browserNarration());
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const stop = useCallback(() => {
    browser.current.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState({ playing: false, charIndex: -1 });
  }, []);

  const start = useCallback(() => {
    if (audioUrl) {
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      el.src = audioUrl;
      el.onended = () => {
        setState({ playing: false, charIndex: -1 });
        onEndRef.current?.();
      };
      el.play().then(
        () => setState({ playing: true, charIndex: -1 }),
        () => setState({ playing: false, charIndex: -1 }),
      );
      return;
    }
    // Cloud narration is pre-rendered. If a clip is unavailable, stay silent
    // instead of switching that page to a different system/browser voice.
    if (ttsProvider !== 'browser') return;
    if (!browser.current.supported) return;
    setState({ playing: true, charIndex: 0 });
    browser.current.speak(text, {
      lang,
      onBoundary: (ci) => setState((s) => ({ ...s, charIndex: ci })),
      onEnd: () => {
        setState({ playing: false, charIndex: -1 });
        onEndRef.current?.();
      },
    });
  }, [audioUrl, text, ttsProvider, lang]);

  const toggle = useCallback(() => {
    if (state.playing) stop();
    else start();
  }, [state.playing, start, stop]);

  // Stop whenever the page text changes or component unmounts.
  useEffect(() => {
    return () => {
      browser.current.cancel();
      audioRef.current?.pause();
    };
  }, [text]);

  const available = Boolean(audioUrl) || (ttsProvider === 'browser' && browser.current.supported);

  return { ...state, start, stop, toggle, available };
}
