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
  IconImage,
  IconMute,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconVolume,
} from '../icons';
import { downloadStoryImages, saveStoryJson, storyHasImages } from '../../lib/exportStory';
import { downloadBlob, renderStoryToVideo, videoExportSupported } from '../../lib/exportVideo';
import { youtubePackageText } from '../../lib/youtube';
import { generateImage } from '../../lib/providers/image';
import { composeCoverPrompt, composeIllustrationPrompt } from '../../lib/prompts';
import { DonateButton } from '../Donate';
import './reader.css';

type Slide = { kind: 'cover' } | { kind: 'page'; index: number } | { kind: 'end' };

function revokeObjectUrl(url?: string): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

/** A changed slide makes any previously rendered whole-book video stale. */
function withoutStoryVideo(story: RenderedStory): Omit<RenderedStory, 'storyVideoUrl' | 'storyVideoName'> {
  revokeObjectUrl(story.storyVideoUrl);
  const { storyVideoUrl: _storyVideoUrl, storyVideoName: _storyVideoName, ...withoutVideo } = story;
  return withoutVideo;
}

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
  const setStory = useStore((s) => s.setStory);
  const settings = useStore((s) => s.settings);
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [slideRegen, setSlideRegen] = useState<{ message: string; error?: boolean } | null>(null);
  const [fileSave, setFileSave] = useState<{ message: string; error?: boolean } | null>(null);
  const [copied, setCopied] = useState('');
  const ambient = useRef<Ambient>(new Ambient());
  const advanceTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

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
        const { blob, filename, youtubeMetadata } = await renderStoryToVideo(
          story,
          (p) => setVideoExport({ ratio: p.ratio, message: p.message }),
          { preferMp4: true, audio: silent ? 'none' : 'narration' },
        );
        if (!silent) {
          revokeObjectUrl(story.storyVideoUrl);
          setStory({
            ...story,
            storyVideoUrl: URL.createObjectURL(blob),
            storyVideoName: filename,
            youtubeMetadata,
          });
        } else {
          setStory({ ...story, youtubeMetadata });
        }
        downloadBlob(blob, silent ? filename.replace(/(\.\w+)$/, '-silent$1') : filename);
        setVideoExport(null);
      } catch (err) {
        setVideoExport({ ratio: 1, message: err instanceof Error ? err.message : 'Video export failed.' });
        window.setTimeout(() => setVideoExport(null), 4500);
      }
    },
    [story, narration, setStory],
  );

  const saveStoryFile = useCallback(async () => {
    if (fileSave) return;
    setFileSave({ message: 'Packing the generated narration and video into your story file...' });
    try {
      await saveStoryJson(story);
      setFileSave(null);
    } catch (error) {
      setFileSave({
        message: error instanceof Error ? error.message : 'Could not save this story file.',
        error: true,
      });
    }
  }, [fileSave, story]);

  const regenerateSlide = useCallback(async () => {
    if (story.demo || slide.kind === 'end') return;
    if (settings.image.provider === 'none') {
      setSlideRegen({ message: 'Select an illustration provider in Settings before regenerating a slide.', error: true });
      return;
    }
    narration.stop();
    setAutoplay(false);
    setSlideRegen({ message: slide.kind === 'cover' ? 'Repainting the cover…' : `Repainting page ${slide.index + 1}…` });
    try {
      const prompt =
        slide.kind === 'cover'
          ? composeCoverPrompt(story.title, story.artStyle, story.characterBible)
          : composeIllustrationPrompt(story.artStyle, story.characterBible, story.pages[slide.index].illustration);
      const imageUrl = await generateImage(settings, prompt, story.artStyle);
      if (!imageUrl) throw new Error('The illustration provider returned no image.');

      const updatedStory = withoutStoryVideo(story);
      if (slide.kind === 'cover') {
        setStory({ ...updatedStory, coverImageUrl: imageUrl, coverSceneId: undefined });
      } else {
        const pages = updatedStory.pages.map((item, index) => {
          if (index !== slide.index) return item;
          revokeObjectUrl(item.videoUrl);
          return { ...item, imageUrl, videoUrl: undefined, sceneId: undefined };
        });
        setStory({ ...updatedStory, pages });
      }
      setSlideRegen(null);
    } catch (error) {
      setSlideRegen({ message: error instanceof Error ? error.message : 'Could not regenerate this slide.', error: true });
    }
  }, [narration, setStory, settings, slide, story]);

  const copyYouTube = useCallback(async (label: string, value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      window.clearTimeout(copyTimer.current);
      setCopied(label);
      copyTimer.current = window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('Copy failed');
    }
  }, []);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (publishOpen) {
        if (e.key === 'Escape') setPublishOpen(false);
        return;
      }
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
  }, [go, close, narration, page, publishOpen]);

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
      window.clearTimeout(copyTimer.current);
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
                {story.generationWarnings?.map((warning) => (
                  <p key={warning} className="reader-generation-warning" role="status">
                    {warning}
                  </p>
                ))}
                <div className="reader-end-actions">
                  <button className="btn btn-ghost" onClick={() => setPos(0)}>
                    Read again
                  </button>
                  {!story.demo && (
                    <button className="btn btn-ghost" onClick={saveStoryFile} disabled={Boolean(fileSave)}>
                      <IconDownload /> {fileSave ? 'Saving...' : 'Save file'}
                    </button>
                  )}
                  {!story.demo && storyHasImages(story) && (
                    <button className="btn btn-ghost" onClick={() => downloadStoryImages(story)}>
                      <IconDownload /> Download pictures
                    </button>
                  )}
                  {story.storyVideoUrl && (
                    <a className="btn btn-ghost" href={story.storyVideoUrl} download={story.storyVideoName}>
                      <IconFilm /> Download video
                    </a>
                  )}
                  {videoExportSupported() && (
                    <button className="btn btn-ghost" onClick={() => onExportVideo(false)}>
                      <IconFilm /> {story.storyVideoUrl ? 'Re-generate video' : 'Export video'}
                    </button>
                  )}
                  {videoExportSupported() && (
                    <button className="btn btn-ghost" onClick={() => onExportVideo(true)} title="No audio — ready for social media">
                      <IconFilm /> Silent video
                    </button>
                  )}
                  {story.youtubeMetadata && (
                    <button className="btn btn-sunlit" onClick={() => setPublishOpen(true)}>
                      Ready to publish
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
          {!story.demo && slide.kind !== 'end' && (
            <button
              className="reader-chip"
              onClick={regenerateSlide}
              disabled={Boolean(slideRegen) || Boolean(videoExport)}
              title="Regenerate this slide's artwork"
            >
              <IconImage /> <span className="reader-chip-label">Regenerate slide</span>
            </button>
          )}
          {!story.demo && (
            <button className="reader-chip" onClick={saveStoryFile} disabled={Boolean(fileSave)} title="Save this story to a file">
              <IconDownload /> <span className="reader-chip-label">{fileSave ? 'Saving...' : 'Save'}</span>
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

      <AnimatePresence>
        {slideRegen && (
          <motion.div className="video-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="video-card">
              {!slideRegen.error && <div className="video-spinner" />}
              <h2>{slideRegen.error ? 'Slide regeneration stopped' : 'Regenerating slide…'}</h2>
              <p className="video-hint">{slideRegen.message}</p>
              {slideRegen.error && (
                <button className="btn btn-primary slide-regen-close" onClick={() => setSlideRegen(null)}>
                  Close
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fileSave && (
          <motion.div className="video-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="video-card">
              {!fileSave.error && <div className="video-spinner" />}
              <h2>{fileSave.error ? 'Saving stopped' : 'Saving your story file...'}</h2>
              <p className="video-hint">{fileSave.message}</p>
              {fileSave.error && (
                <button className="btn btn-primary slide-regen-close" onClick={() => setFileSave(null)}>
                  Close
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {publishOpen && story.youtubeMetadata && (
          <motion.div
            className="publish-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPublishOpen(false)}
          >
            <motion.section
              className="reader-youtube publish-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="publish-modal-title"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="reader-youtube-head">
                <div>
                  <span className="eyebrow">Ready to publish</span>
                  <h3 id="publish-modal-title">YouTube package</h3>
                </div>
                <div className="publish-modal-actions">
                  <button
                    type="button"
                    className="btn btn-sunlit btn-sm"
                    onClick={() => copyYouTube('all', youtubePackageText(story.youtubeMetadata!))}
                  >
                    {copied === 'all' ? 'Copied!' : 'Copy everything'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm icon-btn"
                    onClick={() => setPublishOpen(false)}
                    aria-label="Close publishing details"
                  >
                    <IconClose />
                  </button>
                </div>
              </div>
              <YouTubeField label="Title" value={story.youtubeMetadata.title} copied={copied === 'title'} onCopy={() => copyYouTube('title', story.youtubeMetadata!.title)} />
              <YouTubeField label="Description" value={story.youtubeMetadata.description} copied={copied === 'description'} onCopy={() => copyYouTube('description', story.youtubeMetadata!.description)} />
              <YouTubeField label="Slide timestamps" value={story.youtubeMetadata.timestamps} copied={copied === 'timestamps'} onCopy={() => copyYouTube('timestamps', story.youtubeMetadata!.timestamps)} pre />
              <YouTubeField label="Hashtags" value={story.youtubeMetadata.hashtags} copied={copied === 'hashtags'} onCopy={() => copyYouTube('hashtags', story.youtubeMetadata!.hashtags)} />
              {copied === 'Copy failed' && <p className="reader-copy-error">Copy failed. Select the text and copy it manually.</p>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function YouTubeField({
  label,
  value,
  copied,
  onCopy,
  pre = false,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  pre?: boolean;
}) {
  return (
    <div className="reader-youtube-field">
      <div className="reader-youtube-label">
        <span>{label}</span>
        <button type="button" onClick={onCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {pre ? <pre>{value}</pre> : <p>{value}</p>}
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
