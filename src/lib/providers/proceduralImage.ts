/* Zero-key, offline illustrator. Renders a unique but cohesive vector scene for
   each page as an SVG data URL. The palette is seeded from the story's art-style
   text (identical across pages → consistent mood), while the composition is
   seeded from the full page prompt → a different scene every spread. */

const W = 1600;
const H = 1000;

interface Palette {
  sky: [string, string];
  body: string; // sun / moon
  glow: string;
  hills: [string, string, string];
  tree: string;
  particle: string;
  night: boolean;
}

const PALETTES: Palette[] = [
  { sky: ['#ffd9a0', '#ff9e7d'], body: '#fff2c4', glow: '#ffe6a8', hills: ['#e08a6b', '#c76b58', '#8f4a44'], tree: '#5a2f3a', particle: '#fff3c4', night: false },
  { sky: ['#3a2b6b', '#c76b9e'], body: '#ffd98a', glow: '#ffcaa0', hills: ['#4a2f6b', '#3a2450', '#26173a'], tree: '#1c1030', particle: '#ffd98a', night: true },
  { sky: ['#0f1440', '#2a3a7a'], body: '#f4efd0', glow: '#dfe4ff', hills: ['#1b2350', '#141a3e', '#0d1130'], tree: '#0a0c22', particle: '#ffffff', night: true },
  { sky: ['#bfe6d0', '#7bbf95'], body: '#fff6d0', glow: '#fdf3c0', hills: ['#4e8f6b', '#3a7050', '#28513a'], tree: '#1f3a2a', particle: '#fff6d0', night: false },
  { sky: ['#cfeafe', '#a7d8ff'], body: '#fff3b0', glow: '#fff6cc', hills: ['#9ccf7a', '#7ab85e', '#5a9a44'], tree: '#3a6b2f', particle: '#ffffff', night: false },
  { sky: ['#bfe9ff', '#5ab0e0'], body: '#fff2c4', glow: '#e8f6ff', hills: ['#3f8fb0', '#2f6f95', '#1f4f75'], tree: '#173a52', particle: '#ffffff', night: false },
  { sky: ['#ffd6f0', '#c9b6ff'], body: '#fff3c4', glow: '#ffe9f6', hills: ['#b79ce0', '#9a7ecf', '#7a5fb0'], tree: '#4a2f6b', particle: '#ffffff', night: false },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pineTree(x: number, base: number, scale: number, color: string): string {
  const w = 42 * scale;
  const h = 150 * scale;
  const trunk = `<rect x="${x - 5 * scale}" y="${base - 12 * scale}" width="${10 * scale}" height="${18 * scale}" fill="${color}"/>`;
  const tiers = [0, 1, 2]
    .map((i) => {
      const ty = base - 12 * scale - i * (h / 3.2);
      const tw = w * (1 - i * 0.22);
      return `<path d="M${x - tw} ${ty} L${x} ${ty - h / 2.4} L${x + tw} ${ty} Z" fill="${color}"/>`;
    })
    .join('');
  return trunk + tiers;
}

/** Pick a palette from the art-style text — by mood keyword when one is present,
 *  otherwise well-distributed by a seeded RNG (avoids mod-N clustering). */
function pickPalette(styleSeed: string): Palette {
  const s = styleSeed.toLowerCase();
  if (/night|dark|moon|star|midnight|nocturnal/.test(s)) return PALETTES[2];
  if (/dusk|evening|twilight|sunset|purple|lilac/.test(s)) return PALETTES[1];
  if (/forest|wood|jungle|emerald|mossy/.test(s)) return PALETTES[3];
  if (/sea|ocean|water|beach|aqua|underwater/.test(s)) return PALETTES[5];
  if (/dream|pastel|candy|magic|whimsical|fairy/.test(s)) return PALETTES[6];
  if (/dawn|sunrise|morning|golden|warm|amber/.test(s)) return PALETTES[0];
  if (/meadow|field|garden|sunny|bright|day/.test(s)) return PALETTES[4];
  return PALETTES[Math.floor(mulberry32(hash(styleSeed))() * PALETTES.length)];
}

/** Build a deterministic SVG scene. `styleSeed` fixes the palette per book. */
function buildScene(prompt: string, styleSeed: string): string {
  const pal = pickPalette(styleSeed);
  const rnd = mulberry32(hash(prompt));
  const uid = (hash(prompt) % 100000).toString(36);

  const bodyX = 200 + rnd() * (W - 400);
  const bodyY = 140 + rnd() * 220;
  const bodyR = 70 + rnd() * 70;

  // Stars (night) or clouds (day).
  let sky = '';
  if (pal.night) {
    let stars = '';
    const n = 60 + Math.floor(rnd() * 50);
    for (let i = 0; i < n; i++) {
      stars += `<circle cx="${rnd() * W}" cy="${rnd() * H * 0.62}" r="${0.7 + rnd() * 2}" fill="#fff" opacity="${0.4 + rnd() * 0.6}"/>`;
    }
    sky = stars;
  } else {
    let clouds = '';
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const cx = rnd() * W;
      const cy = 80 + rnd() * 260;
      const s = 0.7 + rnd() * 0.8;
      clouds += `<g opacity="0.5" transform="translate(${cx} ${cy}) scale(${s})"><ellipse cx="0" cy="0" rx="90" ry="30" fill="#fff"/><ellipse cx="70" cy="10" rx="66" ry="24" fill="#fff"/><ellipse cx="-70" cy="10" rx="60" ry="22" fill="#fff"/></g>`;
    }
    sky = clouds;
  }

  // Three layered hills.
  const hills = pal.hills
    .map((c, layer) => {
      const baseY = H * (0.62 + layer * 0.12);
      const amp = 60 - layer * 12;
      const pts: string[] = [`M0 ${baseY}`];
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const x = (W / steps) * i;
        const y = baseY + Math.sin(i * 1.3 + rnd() * 6) * amp - rnd() * amp;
        pts.push(`Q ${x - W / steps / 2} ${y} ${x} ${baseY - (rnd() - 0.4) * amp}`);
      }
      pts.push(`L${W} ${H} L0 ${H} Z`);
      return `<path d="${pts.join(' ')}" fill="${c}"/>`;
    })
    .join('');

  // Trees on the front hill.
  let trees = '';
  const treeCount = 3 + Math.floor(rnd() * 5);
  for (let i = 0; i < treeCount; i++) {
    const tx = 60 + rnd() * (W - 120);
    const base = H * 0.9 - rnd() * 40;
    const s = 0.5 + rnd() * 0.9;
    trees += pineTree(tx, base, s, pal.tree);
  }

  // Floating particles (fireflies / motes).
  let motes = '';
  const moteCount = 10 + Math.floor(rnd() * 14);
  for (let i = 0; i < moteCount; i++) {
    motes += `<circle cx="${rnd() * W}" cy="${H * 0.4 + rnd() * H * 0.45}" r="${1.5 + rnd() * 3.5}" fill="${pal.particle}" opacity="${0.3 + rnd() * 0.5}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.sky[0]}"/>
      <stop offset="100%" stop-color="${pal.sky[1]}"/>
    </linearGradient>
    <radialGradient id="glow${uid}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vig${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#050310" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky${uid})"/>
  ${sky}
  <circle cx="${bodyX}" cy="${bodyY}" r="${bodyR * 2.1}" fill="url(#glow${uid})"/>
  <circle cx="${bodyX}" cy="${bodyY}" r="${bodyR}" fill="${pal.body}"/>
  ${hills}
  ${trees}
  ${motes}
  <rect width="${W}" height="${H}" fill="url(#vig${uid})"/>
</svg>`;
}

/** Returns an SVG data URL for the given illustration prompt.
 *  `styleKey` (the art-style sentence) keeps the palette consistent per book. */
export function proceduralImage(prompt: string, styleKey: string): string {
  const svg = buildScene(prompt, styleKey || prompt);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
