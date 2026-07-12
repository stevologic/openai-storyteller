<div align="center">

# ✦ Storyteller AI

### Living storybooks, told by AI.

Turn a single bedtime idea into a **fully illustrated, narrated children's picture book** —
using whichever frontier AI models you already have keys for.

**[▶ Live demo & sample story →](https://stevologic.github.io/storyteller-ai/)**

</div>

---

Storyteller AI is a complete rewrite of the original _openai-storyteller_. The old Flask + DALL·E 2
app is gone; in its place is a fast, single-page web app that:

- **writes** an original, age-appropriate story with GPT, Claude, or Gemini,
- **illustrates** every page and the cover with gpt-image, Imagen, or DALL·E — keeping the hero
  visually consistent across pages via a locked "character bible,"
- **reads it aloud** with word-by-word highlighting (free in-browser voices, or an AI voice), and
- **presents it** in an immersive, cinematic reader with full-bleed art, Ken Burns motion,
  page-turn transitions, and an ambient soundscape.

Everything runs **in your browser**. You bring your own API keys; they're stored locally and sent
directly to each provider — never to a Storyteller AI server (there isn't one).

## Highlights

| | |
|---|---|
| 🎛 **Any frontier model** | Choose providers and models for text, images, video, and narration right in the Settings panel. Type a custom model id for anything new. |
| 📖 **Cinematic reader** | Autoplay "movie mode," swipe/keyboard navigation, ambient audio, and a page-turn feel. |
| 🗣 **Read aloud** | Live browser narration with karaoke-style word highlighting, or studio-grade OpenAI voices. |
| 🎨 **Consistent characters** | A generated character description is fused into every illustration prompt so your hero stays the same. |
| 🎬 **Video-ready** | Animate pages into short clips with Veo or Sora when you want motion — or let the free cinematic pan carry the mood. |
| 🧸 **Made for kids' books** | Prompts, guardrails, and layout tuned for warm, safe picture books. |
| 🔌 **Zero-key demo** | A bundled sample story ("Pip and the Lantern Moon") renders with animated vector art, so the whole experience works with no keys at all. |

## Supported models

Configured entirely in the UI (**Settings → Models**). All calls go straight from your browser to
the provider.

- **Text:** OpenAI GPT-5.1 / GPT-5 / GPT-4.1 / GPT-4o · Anthropic Claude Fable 5 / Opus 4.8 / Opus 4.7 / Sonnet 5 / Haiku 4.5 · Google Gemini 2.5 Pro / Flash
- **Images:** OpenAI `gpt-image-1`, DALL·E 3 · Google Imagen 4 / 3
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
