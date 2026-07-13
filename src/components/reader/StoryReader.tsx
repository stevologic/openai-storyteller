import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TouchEvent as RTouchEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RenderedStory } from '../../lib/types';
import { findLanguage } from '../../lib/catalog';
import { useStore } from '../../lib/store';
import { DemoScene } from '../../sample/scenes';
import { CinematicMedia } from './CinematicMedia';
import { useNarration } from './useNarration';
import { Ambient } from './ambient';
import {
  IconAuto,
  IconClose,
  IconDownload,
  IconFilm,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconVolume,
} from '../icons';
import { downloadStoryImages, saveStoryJson, storyHasImages } from '../../lib/exportStory';
import { downloadBlob, renderStoryToVideo, videoExportSupported } from '../../lib/exportVideo';
import { DonateButton } from '../Donate';
import './reader.css';

type Slide = { kind: 'cover' } | { kind: 'page'; index: number } | { kind: 'end' };

/** Split text into word tokens with their start offsets, for karaoke highlight. */
function tokenize(text: string): { word: string; start: number }[] {
  const out: { word: string; start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ word: m[0], start: m.index });
  return out;
}

export default function StoryReader({ story }: { story: RenderedStory }) {
  const setView = useStore((s) => s.setView);
  const ttsProvider = useStore((s) => s.settings.tts.provider);

  const slides: Slide[] = useMemo(
    () => [{ kind: 'cover' } as Slide, ...story.pages.map((_, index) => ({ kind: 'page', index }) as Slide), { kind: 'end' } as Slide],
    [story],
  );

  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [autoplay, setAutoplay] = useState(false);
  const [ambientOn, setAmbientOn] = useState(false);
  const [videoExport, setVideoExport] = useState<{ ratio: number; message: string } | null>(null);
  const ambient = useRef<Ambient>(new Ambient());
  const advanceTimer = useRef<number | undefined>(undefined);

  const slide = slides[pos];
  const page = slide.kind === 'page' ? story.pages[slide.index] : undefined;

  const go = useCallback(
    (delta: number) => {
      setPos((p) => {
        const next = Math.min(slides.length - 1, Math.max(0, p + delta));
        setDir(delta >= 0 ? 1 : -1);
        return next;
      });
    },
    [slides.length],
  );

  const close = useCallback(() => {
    ambient.current.stop();
    if (story.demo) setView('landing');
    else setView('studio');
  }, [setView, story.demo]);

  const onNarrationEnd = useCallback(() => {
    if (autoplay) {
      advanceTimer.current = window.setTimeout(() => go(1), 900);
    }
  }, [autoplay, go]);

  const narration = useNarration({
    text: page?.text ?? '',
    audioUrl: page?.audioUrl,
    ttsProvider,
    lang: findLanguage(story.language ?? '').bcp47,
    onEnd: onNarrationEnd,
  });

  const onExportVideo = useCallback(
    async (silent = false) => {
      narration.stop();
      ambient.current.stop();
      setAmbientOn(false);
      setAutoplay(false);
      setVideoExport({ ratio: 0, message: 'Preparing…' });
      try {
        const { blob, filename } = await renderStoryToVideo(
          story,
          (p) => setVideoExport({ ratio: p.ratio, message: p.message }),
          { preferMp4: true, audio: silent ? 'none' : 'narration' },
        );
        downloadBlob(blob, silent ? filename.replace(/(\.\w+)$/, '-silent$1') : filename);
        setVideoExport(null);
      } catch (err) {
        setVideoExport({ ratio: 1, message: err instanceof Error ? err.message : 'Video export failed.' });
        window.setTimeout(() => setVideoExport(null), 4500);
      }
    },
    [story, narration],
  );

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') close();
      else if (e.key === ' ') {
        e.preventDefault();
        if (page) narration.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close, narration, page]);

  // Autoplay driver: (re)start on each slide.
  useEffect(() => {
    window.clearTimeout(advanceTimer.current);
    narration.stop();
    if (!autoplay) return;
    if (slide.kind === 'page') {
      if (narration.available) {
        const t = window.setTimeout(() => narration.start(), 500);
        return () => window.clearTimeout(t);
      }
      advanceTimer.current = window.setTimeout(() => go(1), 6500);
    } else if (slide.kind === 'cover') {
      advanceTimer.current = window.setTimeout(() => go(1), 3800);
    }
    return () => window.clearTimeout(advanceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, autoplay]);

  // Clean up on unmount.
  useEffect(() => {
    const amb = ambient.current;
    return () => {
      amb.stop();
      window.clearTimeout(advanceTimer.current);
    };
  }, []);

  const toggleAmbient = () => setAmbientOn(ambient.current.toggle());

  // Touch swipe.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: RTouchEvent) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e: RTouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const pageNumberLabel =
    slide.kind === 'cover' ? 'Cover' : slide.kind === 'end' ? 'The End' : `${slide.index + 1} / ${story.pages.length}`;

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 80, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: d * -80, scale: 1.02 }),
  };

  return (
    <div className="reader" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div
          key={pos}
          className="reader-slide"
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {slide.kind === 'cover' && (
            <>
              <CinematicMedia story={story} cover />
              <div className="reader-cover">
                <span className="reader-age">Ages {story.ageRange}</span>
                <h1 className="reader-title">{story.title}</h1>
                {story.dedication && <p className="reader-dedication">{story.dedication}</p>}
                <button className="btn btn-sunlit btn-lg reader-begin" onClick={() => go(1)}>
                  <IconBookOpen /> Begin the story
                </button>
              </div>
            </>
          )}

          {slide.kind === 'page' && page && (
            <>
              <CinematicMedia story={story} page={page} />
              <div className="reader-textwrap">
                <div className="reader-textcard">
                  <p className="reader-header">{page.header}</p>
                  <p className="reader-prose">
                    <ProseWithHighlight text={page.text} charIndex={narration.charIndex} />
                  </p>
                </div>
              </div>
            </>
          )}

          {slide.kind === 'end' && (
            <>
              <div className="cinema-media">
                {story.demo ? (
                  <div className="cinema-layer cinema-scene kb-drift">
                    <DemoScene sceneId="end" />
                  </div>
                ) : story.coverImageUrl ? (
                  <img className="cinema-layer kb-drift" src={story.coverImageUrl} alt="" />
                ) : (
                  <div className="cinema-layer cinema-fallback" />
                )}
                <div className="cinema-vignette" />
              </div>
              <div className="reader-end">
                <h2>The End</h2>
                {story.moral && <p className="reader-moral">“{story.moral}”</p>}
                <div className="reader-end-actions">
                  <button className="btn btn-ghost" onClick={() => setPos(0)}>
                    Read again
                  </button>
                  {!story.demo && (
                    <button className="btn btn-ghost" onClick={() => saveStoryJson(story)}>
                      <IconDownload /> Save file
                    </button>
                  )}
                  {!story.demo && storyHasImages(story) && (
                    <button className="btn btn-ghost" onClick={() => downloadStoryImages(story)}>
                      <IconDownload /> Download pictures
                    </button>
                  )}
                  {story.storyVideoUrl ? (
                    <a className="btn btn-ghost" href={story.storyVideoUrl} download={story.storyVideoName}>
                      <IconFilm /> Download video
                    </a>
                  ) : videoExportSupported() ? (
                    <button className="btn btn-ghost" onClick={() => onExportVideo(false)}>
                      <IconFilm /> Export video
                    </button>
                  ) : null}
                  {videoExportSupported() && (
                    <button className="btn btn-ghost" onClick={() => onExportVideo(true)} title="No audio — ready for social media">
                      <IconFilm /> Silent video
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={close}>
                    {story.demo ? 'Create your own' : 'Modify this story'}
                  </button>
                </div>
                <div className="reader-end-tip">
                  <DonateButton label="Loved it? Tip the maker" className="donate-ghost" />
                </div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Top bar */}
      <div className="reader-topbar">
        <button className="reader-chip" onClick={close} aria-label="Close reader">
          <IconClose />
        </button>
        <div className="reader-toptools">
          {!story.demo && (
            <button className="reader-chip" onClick={() => saveStoryJson(story)} title="Save this story to a file">
              <IconDownload /> <span className="reader-chip-label">Save</span>
            </button>
          )}
          <button
            className={`reader-chip ${autoplay ? 'active' : ''}`}
            onClick={() => setAutoplay((a) => !a)}
            title="Cinematic autoplay"
          >
            <IconAuto /> <span className="reader-chip-label">Auto</span>
          </button>
          <button
            className={`reader-chip ${ambientOn ? 'active' : ''}`}
            onClick={toggleAmbient}
            title="Ambient sound"
          >
            {ambientOn ? <IconVolume /> : <IconMute />}
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="reader-bottombar">
        <button className="reader-nav" onClick={() => go(-1)} disabled={pos === 0} aria-label="Previous">
          <IconPrev />
        </button>

        <div className="reader-center">
          {slide.kind === 'page' && narration.available && (
            <button className="btn btn-primary btn-sm reader-narrate" onClick={narration.toggle}>
              {narration.playing ? <IconPause /> : <IconPlay />}
              {narration.playing ? 'Pause' : 'Read to me'}
            </button>
          )}
          <span className="reader-pagelabel">{pageNumberLabel}</span>
          <div className="reader-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`reader-dot ${i === pos ? 'on' : ''}`}
                onClick={() => {
                  setDir(i > pos ? 1 : -1);
                  setPos(i);
                }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          className="reader-nav"
          onClick={() => go(1)}
          disabled={pos === slides.length - 1}
          aria-label="Next"
        >
          <IconNext />
        </button>
      </div>

      <AnimatePresence>
        {videoExport && (
          <motion.div className="video-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="video-card">
              <div className="video-spinner" />
              <h2>Filming your storybook…</h2>
              <div className="video-bar">
                <motion.div className="video-fill" animate={{ width: `${Math.round(videoExport.ratio * 100)}%` }} transition={{ ease: 'easeOut' }} />
              </div>
              <p className="video-stage">{videoExport.message}</p>
              <p className="video-hint">Recording plays out in real time — sit back and watch. The video downloads when it’s done.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProseWithHighlight({ text, charIndex }: { text: string; charIndex: number }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  if (charIndex < 0) return <>{text}</>;
  // Find the active token (last token whose start <= charIndex).
  let active = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].start <= charIndex) active = i;
    else break;
  }
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={i === active ? 'word active' : 'word'}>
          {t.word}{' '}
        </span>
      ))}
    </>
  );
}

function IconBookOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
