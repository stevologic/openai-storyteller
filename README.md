<div align="center">

# ✦ Tiny Book Buddies AI

### Living storybooks, told by AI.

Turn a single bedtime idea into a **fully illustrated, narrated children's picture book** —
using whichever frontier AI models you already have keys for.

**[▶ Live demo → tinybookbuddies.ai](https://tinybookbuddies.ai/)**

<br/>

**Sample stories** (full books written, illustrated, narrated & filmed with the app):
[▶ Stella’s Big Dream Adventure](https://www.youtube.com/watch?v=p-4xSAPUnfc) ·
[▶ Chewie and the Big Big World](https://www.youtube.com/watch?v=SfOBy2t-fRs)

</div>

---

Tiny Book Buddies AI is a complete rewrite of the original _openai-storyteller_. The old Flask + DALL·E 2
app is gone; in its place is a fast, single-page web app that:

- **writes** an original, age-appropriate story with your choice of GPT, Claude, Gemini, or Grok,
- **illustrates** every page — gpt-image / Imagen / Grok — keeping the hero visually consistent across
  pages via a locked "character bible,"
- **reads it aloud** with word-by-word highlighting (a free in-browser voice, or an OpenAI voice),
- **presents it** in an immersive, cinematic reader with full-bleed art, Ken Burns motion,
  page-turn transitions, and an ambient soundscape, and
- **films it** — every book is also rendered to a shareable MP4 while it generates.

**Bring your own API key** from OpenAI, Anthropic, Google, or xAI. Everything runs **in your browser**;
keys are stored locally and sent directly to each provider — never to a Tiny Book Buddies AI server
(there isn't one).

## 📖 A book it made — _Billy's Broccoli Path_

A real storybook Tiny Book Buddies AI generated end-to-end from a one-line idea about a picky eater who
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
| 🎛 **Any frontier model** | Pick GPT / Claude / Gemini / Grok for the words and gpt-image / Imagen / Grok for the art. Choose providers and models per task in Settings; type a custom model id for anything new. |
| 🔑 **Your keys, your browser** | Add an OpenAI, Anthropic, Google, or xAI key in Settings. Keys are stored in localStorage and sent straight to each provider — never to us. |
| 📖 **Cinematic reader** | Autoplay "movie mode," swipe/keyboard navigation, ambient audio, and a page-turn feel. |
| 🌍 **Any language** | Write the story in 12 languages (English, Spanish, French, German, Italian, Japanese, Chinese, Hindi, Arabic, …). |
| 🎥 **Auto video, narrated** | Every book is also rendered to a shareable **MP4** while it generates — art, Ken Burns motion, text, and the **selected OpenAI or Grok narration voice baked in** with **no background music**. Grab a **silent version** too, ready to attach to social. Entirely in the browser (canvas + MediaRecorder, H.264/AAC with a WebM fallback). Toggle it off in Settings. |
| 🗣 **Read aloud** | Live browser narration with karaoke-style word highlighting, or studio-grade OpenAI and Grok voices baked into the video. |
| 🎨 **Consistent characters** | A generated character description is fused into every illustration prompt so your hero stays the same. |
| 🖼 **Hero from a photo** | Upload a reference photo and a vision model describes the character; that look drives every page. Or just type the description. |
| 🎬 **Video-ready** | Animate pages into short clips with Veo, Sora, or Grok Imagine when you want motion — or let the free cinematic pan carry the mood. |
| 🧸 **Made for kids' books** | Prompts, guardrails, and layout tuned for warm, safe picture books. |

## Supported models

Configured entirely in the UI (**Settings → Models**). Cloud calls go straight from your browser to
the provider — bring a key for at least one.

- **Text:** OpenAI GPT-5.1 / GPT-5 / GPT-4.1 / GPT-4o · Anthropic Claude Fable 5 / Opus 4.8 / Opus 4.7 / Sonnet 5 / Haiku 4.5 · Google Gemini 2.5 Pro / Flash · xAI Grok 4 / 4 Fast / 3 / 3 Mini
- **Images:** OpenAI `gpt-image-1`, DALL·E 3 · Google Imagen 4 / 3 · xAI Grok Imagine Image
- **Video (optional):** Google Veo 3 · OpenAI Sora 2 · xAI Grok Imagine Video — or free Ken Burns motion
- **Narration:** OpenAI Speech · xAI Grok Voice · browser speech
- **Narration:** OpenAI speech (`gpt-4o-mini-tts`, `tts-1-hd`, baked into the video) · live browser voices (free)

When you add a key, each dropdown **loads that provider's live model list** (OpenAI / Anthropic / Google /
xAI) and merges the newest models in automatically — the lists above are just the built-in fallback used
when no key is set. A "✓ latest models" badge shows when a live list is in use (cached ~12h).

> New model just dropped and not listed yet? Pick "Custom model…" in any dropdown and paste the exact id.

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
2. Push to `main`. The site publishes to the custom domain **[tinybookbuddies.ai](https://tinybookbuddies.ai/)**.

The apex custom domain serves from the root, so Vite `base` is `/` and [`public/CNAME`](public/CNAME)
pins the domain on every deploy. If you fork to a project page (`<user>.github.io/<repo>/`) instead,
set `base` to `/<repo>/` in [`vite.config.ts`](vite.config.ts) and remove `public/CNAME`.

## How it's built

- **Vite + React + TypeScript**, no backend.
- A small **provider abstraction** (`src/lib/providers/`) wraps each API with plain `fetch` — no
  vendor SDKs — including the header Anthropic requires for direct browser calls.
- **`src/lib/generate.ts`** orchestrates the pipeline: write → cover → per-page illustration →
  (optional video) → (optional narration), reporting progress to the UI.
- The advertised **sample stories** are two full books filmed with the app (linked at the top); a set
  of bundled animated-SVG **demo scenes** (`src/sample/`) also ships as an offline fallback.

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
- Requests go **directly** to OpenAI / Anthropic / Google / xAI. Tiny Book Buddies AI has no server and collects nothing.
- Generated stories are kept in memory for the session.

## Support the project

It's a free, open project. If it brought a little joy, a tiny tip helps keep it growing. 💜

<table>
<tr>
<td align="center" width="50%">

<img src="public/btc.png" alt="Bitcoin donation QR code" width="170" />

**₿ Bitcoin**

`3M9PTxL15b6c8REcHMZCVPbfMomXNZ5AGR`

</td>
<td align="center" width="50%">

<img src="public/doge.png" alt="Dogecoin donation QR code" width="170" />

**Ð Dogecoin**

`DTW2M5oEW97WbmYJRM71qD7uE6xfJs1MUK`

</td>
</tr>
</table>

## License

**[PolyForm Noncommercial 1.0.0](LICENSE)** — free to use, modify, and share for any noncommercial
purpose. **Commercial rights are reserved** by the author, keeping the door open to build a
children's-book product on top of this. For commercial use or licensing, contact the author.

---

<div align="center">
<sub>Tiny Book Buddies AI · a rewrite of the original openai-storyteller · © 2022–2026 Stephen M Abbott</sub>
</div>
