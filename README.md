<div align="center">

# ✦ Storyteller AI

### Living storybooks, told by AI.

Turn a single bedtime idea into a **fully illustrated, narrated children's picture book** —
using whichever frontier AI models you already have keys for.

**[▶ Live demo & sample story →](https://stevologic.github.io/storyteller-ai/)**

<br/>

<!-- HERO IMAGE — export a cover from the app ("Download pictures"), drop it at
     docs/showcase/hero.png, then replace this comment with:
     <img src="docs/showcase/hero.png" width="88%" alt="A storybook made with Storyteller AI" /> -->

_“The world is full of busy, friendly trucks, and each one makes our big, exciting home feel safe and wonderful.”_

<sub>— the closing line of a storybook made in a single click</sub>

</div>

---

Storyteller AI is a complete rewrite of the original _openai-storyteller_. The old Flask + DALL·E 2
app is gone; in its place is a fast, single-page web app that:

- **writes** an original, age-appropriate story — **on-device by default** (Chrome Built-in AI or
  Transformers.js), or with GPT / Claude / Gemini when you add a key,
- **illustrates** every page — free procedural art on-device, or gpt-image / Imagen / DALL·E — keeping
  the hero visually consistent across pages via a locked "character bible,"
- **reads it aloud** with word-by-word highlighting (free in-browser voices, or an AI voice),
- **presents it** in an immersive, cinematic reader with full-bleed art, Ken Burns motion,
  page-turn transitions, and an ambient soundscape, and
- **films it** — every book is also rendered to a shareable MP4 while it generates.

**It works with zero setup** — no key, no sign-up, no cost — because the default models run entirely on
your own computer. Add API keys anytime to upgrade the words and art. Everything runs **in your
browser**; keys are stored locally and sent directly to each provider — never to a Storyteller AI
server (there isn't one).

## 📖 A book it made — _Billy's Broccoli Path_

A real storybook Storyteller AI generated end-to-end from a one-line idea about a picky eater who
gets a little lost — original prose, a **Pixar-style hero kept consistent on every page**, and warm
narration. A few spreads:

<!-- ILLUSTRATION GALLERY — drop the exported page PNGs into docs/showcase/ (e.g. billy-00-cover.png,
     billy-03.png, billy-04.png, billy-06.png) and replace this comment with:
     <p align="center">
       <img src="docs/showcase/billy-00-cover.png" width="80%" alt="Billy's Broccoli Path — cover" />
     </p>
     <p align="center">
       <img src="docs/showcase/billy-03.png" width="32%" />
       <img src="docs/showcase/billy-04.png" width="32%" />
       <img src="docs/showcase/billy-06.png" width="32%" />
     </p> -->

> **Ages 4–7** — _"For every little explorer who finds their way home, one tiny green tree at a time."_

<table>
<tr><td width="33%" valign="top">

**The Path of Pebbles**

Beyond the bushes, Billy found a narrow pebble path he had never noticed before. It curled like a
gray ribbon between tall ferns and whispering trees… until he suddenly realized he couldn't see his
house at all.

</td><td width="33%" valign="top">

**Lost and Little**

Billy stopped walking and listened, but all he heard were rustling leaves and an owl far away. The
pebble path now looked twisty instead of fun, and the shadows felt a little bigger than before.

</td><td width="33%" valign="top">

**Broccoli Bread Crumbs**

He picked one tiny piece from the wild plant and took a brave, crunchy bite. Warmth spread through
him — and he followed a line of glowing fireflies that seemed to point the way back home.

</td></tr>
</table>

_Made with a text model for the words, an image model for the art, and a locked character bible so
Billy looks like Billy from cover to end._

## Highlights

| | |
|---|---|
| 🔌 **Zero setup** | Runs on-device out of the box — Chrome Built-in AI (Gemini Nano) or Transformers.js for the words, procedural vector art for the pictures. No key, no account, no cost. |
| 🎛 **Any frontier model** | Then plug in keys to switch to GPT / Claude / Gemini and gpt-image / Imagen / DALL·E. Choose providers and models per task in Settings; type a custom model id for anything new. |
| 📖 **Cinematic reader** | Autoplay "movie mode," swipe/keyboard navigation, ambient audio, and a page-turn feel. |
| 🌍 **Any language** | Write the story in 12 languages (English, Spanish, French, German, Italian, Japanese, Chinese, …). Narration follows where the voice supports it. |
| 🎥 **Auto video, narrated** | Every book is also rendered to a shareable **MP4** while it generates — art, Ken Burns motion, text, and the **selected narration voice baked in** (on-device Kokoro, American by default) with **no background music**. Grab a **silent version** too, ready to attach to social. Entirely in the browser (canvas + MediaRecorder, H.264/AAC with a WebM fallback). Toggle it off in Settings. |
| 🗣 **Read aloud** | Live browser narration with karaoke-style word highlighting, or studio-grade OpenAI voices. |
| 🎨 **Consistent characters** | A generated character description is fused into every illustration prompt so your hero stays the same. |
| 🖼 **Hero from a photo** | Upload a reference photo and a vision model (cloud, or on-device captioning) describes the character; that look drives every page. Or just type the description. |
| 🎬 **Video-ready** | Animate pages into short clips with Veo or Sora when you want motion — or let the free cinematic pan carry the mood. |
| 🧸 **Made for kids' books** | Prompts, guardrails, and layout tuned for warm, safe picture books. |
| 🔌 **Zero-key demo** | A bundled sample story ("Pip and the Lantern Moon") renders with animated vector art, so the whole experience works with no keys at all. |

## Supported models

Configured entirely in the UI (**Settings → Models**). Cloud calls go straight from your browser to
the provider; on-device models never leave your machine.

- **On-device (no key):** Chrome Built-in AI (Gemini Nano) · Transformers.js (Llama 3.2 1B, Qwen2.5) for text · procedural vector art for illustrations · **Kokoro** neural narration
- **Text:** OpenAI GPT-5.1 / GPT-5 / GPT-4.1 / GPT-4o · Anthropic Claude Fable 5 / Opus 4.8 / Opus 4.7 / Sonnet 5 / Haiku 4.5 · Google Gemini 2.5 Pro / Flash
- **Images:** OpenAI `gpt-image-1`, DALL·E 3 · Google Imagen 4 / 3
- **Narration:** On-device Kokoro (8 voices, in the video) · OpenAI speech · live browser voices
- **Video (optional):** Google Veo 3 · OpenAI Sora 2 — or free Ken Burns motion
- **Narration:** Browser voices (free) · OpenAI speech (`gpt-4o-mini-tts`, `tts-1-hd`)

> New model just dropped? Pick "Custom model…" in any dropdown and paste the exact id — no update needed.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Then open **Settings → Models**, paste at least one API key, and start creating. No key? The sample
story on the landing page is fully interactive.

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

**Requirements:** Node 20+.

## Deploy (GitHub Pages)

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes to
Pages on every push to `main`.

1. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Push to `main`. The site deploys to `https://<user>.github.io/storyteller-ai/`.

The Vite `base` is already set to `/storyteller-ai/` for production builds. If you fork under a
different repo name, update `base` in [`vite.config.ts`](vite.config.ts).

## How it's built

- **Vite + React + TypeScript**, no backend.
- A small **provider abstraction** (`src/lib/providers/`) wraps each API with plain `fetch` — no
  vendor SDKs — including the header Anthropic requires for direct browser calls.
- **`src/lib/generate.ts`** orchestrates the pipeline: write → cover → per-page illustration →
  (optional video) → (optional narration), reporting progress to the UI.
- The **demo scenes** (`src/sample/`) are pure animated SVG, so the advertised sample needs no keys.

```
src/
  lib/
    providers/   text · image · video · tts  (per-provider fetch calls)
    generate.ts  the write→illustrate→narrate pipeline
    prompts.ts   the author + art-direction prompts
    catalog.ts   the model catalog that powers Settings
    store.ts     zustand state + settings persistence
  components/
    Landing · Studio · SettingsPanel · reader/StoryReader
  sample/        the bundled zero-key demo story + vector scenes
```

## Privacy

- API keys live only in your browser's `localStorage`.
- Requests go **directly** to OpenAI / Anthropic / Google. Storyteller AI has no server and collects nothing.
- Generated stories are kept in memory for the session.

## License

**[PolyForm Noncommercial 1.0.0](LICENSE)** — free to use, modify, and share for any noncommercial
purpose. **Commercial rights are reserved** by the author, keeping the door open to build a
children's-book product on top of this. For commercial use or licensing, contact the author.

---

<div align="center">
<sub>Storyteller AI · a rewrite of the original openai-storyteller · © 2022–2026 Stephen M Abbott</sub>
</div>
