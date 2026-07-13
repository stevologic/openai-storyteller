import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { SAMPLE_STORY } from '../sample/sampleStory';
import { DemoScene } from '../sample/scenes';
import { SHOWCASE, showcaseSrc } from '../showcase/manifest';
import { IconSpark, IconBook, IconFilm, IconVolume, IconKey, IconDownload, IconAuto } from './icons';
import './landing.css';

const PROVIDERS = ['OpenAI GPT', 'Claude', 'Gemini', 'gpt-image', 'Imagen', 'DALL·E', 'Veo', 'Sora'];

const FEATURES = [
  { icon: <IconSpark />, title: 'Works with zero setup', body: 'By default it runs entirely on your device — Chrome Built-in AI or Transformers.js for the words, procedural art for the pictures. No key, no sign-up, no cost.' },
  { icon: <IconKey />, title: 'Then plug in the best', body: 'Add OpenAI, Anthropic, or Google keys to upgrade to GPT / Claude / Gemini words and gpt-image / Imagen / DALL·E art. Mix and match in the UI.' },
  { icon: <IconBook />, title: 'A reader that feels alive', body: 'Full-bleed art with cinematic Ken Burns motion, elegant type, page-turn transitions and an ambient soundscape.' },
  { icon: <IconVolume />, title: 'Read aloud', body: 'Warm narration that highlights each word as it’s spoken — free in-browser, or studio-grade with an AI voice.' },
  { icon: <IconFilm />, title: 'Consistent & video-ready', body: 'A locked “character bible” keeps your hero on-model every page; animate spreads with Veo or Sora when you want real motion.' },
  { icon: <IconDownload />, title: 'You own it', body: 'Everything runs in your browser. Export any book to a file, its images, or a shareable video. No account, no middleman, no data leaving your device.' },
];

const STEPS = [
  { n: '01', title: 'Describe the tale', body: 'A sentence is enough: the hero, the feeling, the gentle lesson.' },
  { n: '02', title: 'Storyteller AI creates it', body: 'It writes the spreads, art-directs a consistent look, and paints every page.' },
  { n: '03', title: 'Read it like a movie', body: 'Turn pages, press play, dim the lights. Then export and keep it forever.' },
];

export default function Landing() {
  const setView = useStore((s) => s.setView);
  const setStory = useStore((s) => s.setStory);

  const openSample = () => {
    setStory({ ...SAMPLE_STORY, createdAt: Date.now() });
    setView('reader');
  };

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
            Storyteller AI writes an original children’s story, illustrates every page in a style you choose —
            keeping your hero on-model from cover to end — and reads it aloud, using the frontier AI models you
            already have keys for.
          </motion.p>
          <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <button className="btn btn-sunlit btn-lg" onClick={openSample}>
              <IconAuto /> Read the sample story
            </button>
            <button className="btn btn-primary btn-lg" onClick={() => setView('studio')}>
              <IconSpark /> Create your own
            </button>
          </motion.div>
          <p className="hero-note">Runs on-device by default — no sign-up, no API key, no cost. Bring keys for the best quality.</p>
        </div>

        <motion.button
          className="hero-book"
          onClick={openSample}
          initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: -3 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 16 }}
          whileHover={{ rotate: 0, scale: 1.02 }}
          aria-label="Open the sample story"
        >
          <div className="hero-book-art">
            <DemoScene sceneId="cover" />
          </div>
          <div className="hero-book-plate">
            <span className="hero-book-age">Ages {SAMPLE_STORY.ageRange}</span>
            <span className="hero-book-title">{SAMPLE_STORY.title}</span>
          </div>
          <span className="hero-book-play">▶ Play the demo</span>
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

      {/* SHOWCASE — real generated books (renders only when assets exist) */}
      {SHOWCASE.length > 0 && (
        <section className="container section showcase">
          <div className="section-head">
            <span className="eyebrow">Real output</span>
            <h2>Made with Storyteller AI.</h2>
            <p className="section-sub">
              Actual pages, generated by the models above — the hero stays on-model, spread after spread.
            </p>
          </div>
          {SHOWCASE.map((book) => (
            <div className="showcase-book" key={book.title}>
              <div className="showcase-book-head">
                <h3>{book.title}</h3>
                <span className="chip">
                  Ages {book.ageRange} · {book.style}
                </span>
              </div>
              <div className="showcase-grid">
                {book.pages.map((p) => (
                  <figure className="showcase-card" key={p.file}>
                    <img src={showcaseSrc(p.file)} alt={p.header} loading="lazy" />
                    <figcaption>
                      <span className="showcase-h">{p.header}</span>
                      <span className="showcase-c">{p.caption}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
          <div className="showcase-cta">
            <button className="btn btn-primary btn-lg" onClick={() => setView('studio')}>
              <IconSpark /> Make one like this
            </button>
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section className="container section">
        <div className="section-head">
          <span className="eyebrow">Why Storyteller AI</span>
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
              family will read a hundred times. Personalize the hero, choose the lesson, and print a
              keepsake — or build a whole shelf.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => setView('studio')}>
              <IconSpark /> Start your first book
            </button>
          </div>
          <button className="niche-book" onClick={openSample} aria-label="Open the sample story">
            <DemoScene sceneId="p5" />
          </button>
        </div>
      </section>

      <footer className="landing-footer container">
        <div>
          <strong>Storyteller AI</strong>
          <span> — living storybooks, told by AI.</span>
        </div>
        <div className="footer-links">
          <a href="https://github.com/stevologic/storyteller-ai" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="footer-license">PolyForm Noncommercial 1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
