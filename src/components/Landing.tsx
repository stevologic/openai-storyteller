import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { SAMPLE_VIDEOS } from '../sample/sampleVideos';
import { SAMPLE_STORY } from '../sample/sampleStory';
import { DemoScene } from '../sample/scenes';
import { DonateCoins } from './Donate';
import { IconSpark, IconBook, IconFilm, IconVolume, IconKey, IconDownload, IconAuto } from './icons';
import './landing.css';

const PROVIDERS = ['OpenAI GPT', 'Claude', 'Gemini', 'Grok', 'gpt-image', 'Imagen', 'DALL·E', 'Veo', 'Sora'];

const FEATURES = [
  { icon: <IconKey />, title: 'Your choice of frontier AI', body: 'OpenAI GPT, Anthropic Claude, Google Gemini, or xAI Grok write the words; gpt-image, Imagen, or Grok paint the art. Mix and match in Settings.' },
  { icon: <IconBook />, title: 'A reader that feels alive', body: 'Full-bleed art with cinematic Ken Burns motion, elegant type, page-turn transitions and an ambient soundscape.' },
  { icon: <IconVolume />, title: 'Read aloud', body: 'Warm narration highlights each word as it’s spoken — add an OpenAI Speech voice to bake it right into the exported video.' },
  { icon: <IconFilm />, title: 'Consistent & video-ready', body: 'A locked “character bible” keeps your hero on-model every page; every book is filmed to a shareable MP4 — download it narrated, or as a silent version ready to post to social.' },
  { icon: <IconAuto />, title: 'In any language', body: 'Write the whole story in any of a dozen languages — from Spanish and French to Japanese, Hindi and Arabic.' },
  { icon: <IconDownload />, title: 'You own it', body: 'Everything runs in your browser and your API keys never leave your device. Export any book to a file, its images, or a shareable video.' },
];

const STEPS = [
  { n: '01', title: 'Describe the tale', body: 'A sentence is enough: the hero, the feeling, the gentle lesson.' },
  { n: '02', title: 'Tiny Book Buddies AI creates it', body: 'It writes the spreads, art-directs a consistent look, and paints every page.' },
  { n: '03', title: 'Read it like a movie', body: 'Turn pages, press play, dim the lights. Then export and keep it forever.' },
];

export default function Landing() {
  const setView = useStore((s) => s.setView);
  const setStory = useStore((s) => s.setStory);
  const setStoryBrief = useStore((s) => s.setStoryBrief);
  const createNew = () => {
    setStoryBrief(null);
    setView('studio');
  };
  // The bundled demo book: the full cinematic reader, zero keys, zero cost.
  const openDemo = () => {
    setStory(SAMPLE_STORY);
    setView('reader');
  };
  const scrollToSamples = () => document.getElementById('samples')?.scrollIntoView({ behavior: 'smooth' });
  const featured = SAMPLE_VIDEOS[0];

  return (
    <div className="landing">
      {/* HERO */}
      <section className="hero container">
        <div className="hero-copy">
          <motion.span
            className="chip hero-chip"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            ✦ Living storybooks, told by AI
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            Turn a bedtime idea into a <span className="grad">fully illustrated</span> book.
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            Tiny Book Buddies AI writes an original children’s story, illustrates every page in a style you
            choose — keeping your hero on-model from cover to end — and reads it aloud. Powered by your choice
            of OpenAI, Claude, Gemini, or Grok.
          </motion.p>
          <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <button className="btn btn-sunlit btn-lg" onClick={scrollToSamples}>
              <IconAuto /> Watch sample stories
            </button>
            <button className="btn btn-primary btn-lg" onClick={createNew}>
              <IconSpark /> Create your own
            </button>
          </motion.div>
          <p className="hero-note">
            Bring an API key from OpenAI, Anthropic, Google, or xAI — it stays in your browser, never sent to us.
            No key yet?{' '}
            <button type="button" className="linklike" onClick={openDemo}>
              Try the interactive demo
            </button>{' '}
            — free, right here.
          </p>
        </div>

        <motion.button
          className="hero-book"
          onClick={scrollToSamples}
          initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: -3 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 16 }}
          whileHover={{ rotate: 0, scale: 1.02 }}
          aria-label="Watch the sample stories"
        >
          <img className="hero-book-art" src={`https://i.ytimg.com/vi/${featured.id}/hqdefault.jpg`} alt={featured.title} />
          <span className="hero-book-play">▶ Watch</span>
        </motion.button>
      </section>

      {/* PROVIDER MARQUEE */}
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
            <span key={i} className="marquee-item">
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* SAMPLE STORIES — real books made with the app */}
      <section id="samples" className="container section">
        <div className="section-head">
          <span className="eyebrow">Sample stories</span>
          <h2>See what it makes.</h2>
          <p className="section-sub">Full storybooks written, illustrated, narrated, and filmed with Tiny Book Buddies AI.</p>
        </div>
        <div className="samples-grid">
          {SAMPLE_VIDEOS.map((v) => (
            <figure className="sample-card" key={v.id}>
              <div className="video-frame">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                  title={v.title}
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <figcaption>{v.title}</figcaption>
            </figure>
          ))}
        </div>
        {/* Interactive demo — the reader itself, running live with no key */}
        <button type="button" className="demo-card" onClick={openDemo} aria-label="Read Pip and the Lantern Moon — the interactive demo book">
          <span className="demo-card-art" aria-hidden>
            <DemoScene sceneId="cover" />
          </span>
          <span className="demo-card-copy">
            <span className="demo-card-eyebrow">✦ Interactive · no key needed</span>
            <span className="demo-card-title">Pip and the Lantern Moon</span>
            <span className="demo-card-sub">
              Open a real book in the cinematic reader — page turns, motion, and read-aloud, live in your
              browser.
            </span>
            <span className="btn btn-sunlit demo-card-btn">
              <IconBook /> Read it now
            </span>
          </span>
        </button>
        <div className="showcase-cta">
          <button className="btn btn-primary btn-lg" onClick={createNew}>
            <IconSpark /> Make one like this
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section className="container section">
        <div className="section-head">
          <span className="eyebrow">Why Tiny Book Buddies AI</span>
          <h2>A studio and a stage, in one page.</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className="feature card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: (i % 3) * 0.08 }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container section">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>Three steps to a book.</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NICHE */}
      <section className="container section">
        <div className="niche card">
          <div className="niche-copy">
            <span className="eyebrow">Built for little readers</span>
            <h2>Made for children’s picture books.</h2>
            <p>
              Every prompt, guardrail, and layout is tuned for warm, safe, age-appropriate stories a
              family will read a hundred times. Personalize the hero, choose the lesson, and keep a
              keepsake — or build a whole shelf.
            </p>
            <button className="btn btn-primary btn-lg" onClick={createNew}>
              <IconSpark /> Start your first book
            </button>
          </div>
          <button className="niche-book" onClick={scrollToSamples} aria-label="Watch the sample stories">
            <img src={`https://i.ytimg.com/vi/${SAMPLE_VIDEOS[1].id}/hqdefault.jpg`} alt={SAMPLE_VIDEOS[1].title} />
            <span className="niche-book-play">▶</span>
          </button>
        </div>
      </section>

      <footer className="landing-footer container">
        <div>
          <strong>Tiny Book Buddies AI</strong>
          <span> — living storybooks, told by AI.</span>
        </div>
        <div className="footer-links">
          <DonateCoins />
          <a href="https://github.com/stevologic/tiny-book-buddies-ai" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="footer-license">PolyForm Noncommercial 1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
