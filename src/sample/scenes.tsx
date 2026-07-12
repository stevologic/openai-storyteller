import { useId, type ReactNode } from 'react';
import './scenes.css';

/* ============================================================
   Storyteller AI demo art — a self-contained, animated vector world.
   The SAME <Fox> is drawn on every page, so the bundled demo also
   demonstrates the character-consistency idea behind the real app.
   All scenes share a 1600×900 (16:9) stage.
   ============================================================ */

const W = 1600;
const H = 900;

/* ---------- Reusable primitives ---------- */

function Stars({ count = 60, seed = 1 }: { count?: number; seed?: number }): ReactNode {
  // Deterministic pseudo-random so the sky is stable between renders.
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const stars = Array.from({ length: count }, (_, i) => {
    const x = rand() * W;
    const y = rand() * (H * 0.62);
    const r = 1 + rand() * 2.6;
    const delay = rand() * 4;
    return <circle key={i} className="sl-star" cx={x} cy={y} r={r} fill="#fdf6e3" style={{ animationDelay: `${delay}s` }} />;
  });
  return <g>{stars}</g>;
}

function Moon({ cx, cy, r, uid }: { cx: number; cy: number; r: number; uid: string }): ReactNode {
  return (
    <g>
      <circle className="sl-moonglow" cx={cx} cy={cy} r={r * 2.1} fill={`url(#${uid}-moonglow)`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-moon)`} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.25} r={r * 0.13} fill="#efe0ad" opacity="0.6" />
      <circle cx={cx + r * 0.28} cy={cy + r * 0.18} r={r * 0.09} fill="#efe0ad" opacity="0.5" />
      <circle cx={cx + r * 0.05} cy={cy - r * 0.42} r={r * 0.07} fill="#efe0ad" opacity="0.5" />
    </g>
  );
}

function Firefly({ x, y, scale = 1 }: { x: number; y: number; scale?: number }): ReactNode {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sl-firefly">
        <g transform={`scale(${scale})`} className="sl-firefly-core">
          <circle cx="0" cy="0" r="22" fill="#fce38a" opacity="0.28" />
          <circle cx="0" cy="0" r="11" fill="#fff6c8" opacity="0.55" />
          <circle cx="0" cy="0" r="5" fill="#fffdf0" />
        </g>
      </g>
    </g>
  );
}

function Cloud({ x, y, scale = 1, opacity = 0.5 }: { x: number; y: number; scale?: number; opacity?: number }): ReactNode {
  return (
    <g className="sl-cloud" transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <ellipse cx="0" cy="0" rx="90" ry="34" fill="#b7a9e0" />
      <ellipse cx="70" cy="10" rx="70" ry="28" fill="#b7a9e0" />
      <ellipse cx="-70" cy="12" rx="66" ry="26" fill="#b7a9e0" />
    </g>
  );
}

function Hills({ palette }: { palette: string[] }): ReactNode {
  return (
    <g>
      <path d={`M0,${H * 0.72} C ${W * 0.25},${H * 0.62} ${W * 0.5},${H * 0.78} ${W},${H * 0.66} L${W},${H} L0,${H} Z`} fill={palette[0]} />
      <path d={`M0,${H * 0.82} C ${W * 0.3},${H * 0.72} ${W * 0.62},${H * 0.9} ${W},${H * 0.78} L${W},${H} L0,${H} Z`} fill={palette[1]} />
      <path d={`M0,${H * 0.92} C ${W * 0.35},${H * 0.84} ${W * 0.7},${H} ${W},${H * 0.9} L${W},${H} L0,${H} Z`} fill={palette[2]} />
    </g>
  );
}

function Flower({ x, y, color }: { x: number; y: number; color: string }): ReactNode {
  return (
    <g className="sl-sway" transform={`translate(${x} ${y})`}>
      <rect x="-2" y="0" width="4" height="46" rx="2" fill="#3c6b4a" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-2" rx="6" ry="12" fill={color} transform={`rotate(${a}) translate(0 -12)`} />
      ))}
      <circle cx="0" cy="-2" r="6" fill="#ffe08a" />
    </g>
  );
}

/** The recurring hero — a small, brave fox. Drawn identically everywhere. */
export function Fox({
  x,
  y,
  scale = 1,
  flip = false,
}: {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
}): ReactNode {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* Tail */}
      <path d="M-52,-42 C-150,-58 -158,-172 -98,-206 C-74,-158 -58,-112 -44,-72 Z" fill="#e07f37" />
      <path d="M-128,-188 C-152,-176 -158,-150 -142,-134 C-118,-150 -110,-172 -108,-192 Z" fill="#fbe8d3" />
      {/* Body */}
      <ellipse cx="0" cy="-74" rx="74" ry="88" fill="#f4a259" />
      {/* Belly */}
      <ellipse cx="4" cy="-54" rx="44" ry="60" fill="#fbe8d3" />
      {/* Front paws */}
      <ellipse cx="-26" cy="-8" rx="21" ry="15" fill="#fbe8d3" />
      <ellipse cx="30" cy="-8" rx="21" ry="15" fill="#fbe8d3" />
      {/* Head (gently bobbing) */}
      <g className="sl-bob">
        {/* Ears */}
        <path d="M-54,-198 L-28,-150 L-74,-158 Z" fill="#f4a259" />
        <path d="M54,-198 L28,-150 L74,-158 Z" fill="#f4a259" />
        <path d="M-52,-188 L-36,-156 L-64,-162 Z" fill="#3a2a4a" />
        <path d="M52,-188 L36,-156 L64,-162 Z" fill="#3a2a4a" />
        {/* Head */}
        <circle cx="0" cy="-150" r="60" fill="#f4a259" />
        {/* Cheek ruff */}
        <path d="M-60,-150 C-82,-138 -82,-116 -60,-116 C-52,-130 -52,-140 -60,-150 Z" fill="#fbe8d3" />
        <path d="M60,-150 C82,-138 82,-116 60,-116 C52,-130 52,-140 60,-150 Z" fill="#fbe8d3" />
        {/* Muzzle */}
        <path d="M-36,-150 C-36,-118 -18,-100 0,-100 C18,-100 36,-118 36,-150 Z" fill="#fbe8d3" />
        {/* Eyes */}
        <g className="sl-eyes">
          <ellipse cx="-24" cy="-160" rx="8" ry="11" fill="#2b1d33" />
          <ellipse cx="24" cy="-160" rx="8" ry="11" fill="#2b1d33" />
          <circle cx="-21" cy="-164" r="2.6" fill="#fff" />
          <circle cx="27" cy="-164" r="2.6" fill="#fff" />
        </g>
        {/* Nose */}
        <path d="M-9,-130 L9,-130 L0,-119 Z" fill="#2b1d33" />
      </g>
    </g>
  );
}

/* ---------- Shared gradient defs (unique per scene instance) ---------- */

function SkyDefs({ uid, sky, moon = true }: { uid: string; sky: [string, string, string]; moon?: boolean }): ReactNode {
  return (
    <defs>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={sky[0]} />
        <stop offset="55%" stopColor={sky[1]} />
        <stop offset="100%" stopColor={sky[2]} />
      </linearGradient>
      {moon && (
        <>
          <radialGradient id={`${uid}-moon`} cx="0.4" cy="0.4" r="0.7">
            <stop offset="0%" stopColor="#fffdf3" />
            <stop offset="100%" stopColor="#f6e6ad" />
          </radialGradient>
          <radialGradient id={`${uid}-moonglow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fdeeb8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fdeeb8" stopOpacity="0" />
          </radialGradient>
        </>
      )}
    </defs>
  );
}

function Stage({ children, ...rest }: { children: ReactNode } & Record<string, unknown>): ReactNode {
  return (
    <svg className="scene-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" {...rest}>
      {children}
    </svg>
  );
}

const NIGHT: [string, string, string] = ['#160f3d', '#2a1c5c', '#5b3f7a'];
const DEEP: [string, string, string] = ['#0f0a2e', '#1d1450', '#3a2769'];
const HILLS_NIGHT = ['#2b1f57', '#211849', '#171139'];

/* ============================================================
   Scenes
   ============================================================ */

function SceneCover(): ReactNode {
  const uid = useId();
  return (
    <Stage>
      <SkyDefs uid={uid} sky={NIGHT} />
      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
      <Stars count={70} seed={7} />
      <Moon cx={W * 0.5} cy={H * 0.3} r={120} uid={uid} />
      <Cloud x={W * 0.2} y={H * 0.34} scale={1.1} opacity={0.35} />
      <Cloud x={W * 0.8} y={H * 0.22} scale={0.9} opacity={0.3} />
      <Hills palette={HILLS_NIGHT} />
      <Firefly x={W * 0.66} y={H * 0.6} scale={1.1} />
      <Firefly x={W * 0.35} y={H * 0.68} scale={0.8} />
      <Flower x={W * 0.2} y={H * 0.86} color="#e58fb0" />
      <Flower x={W * 0.82} y={H * 0.88} color="#9ec6ff" />
      <Fox x={W * 0.5} y={H * 0.92} scale={1.15} />
    </Stage>
  );
}

function ScenePage1(): ReactNode {
  // Inside the dark burrow, unable to sleep.
  const uid = useId();
  return (
    <Stage>
      <defs>
        <radialGradient id={`${uid}-burrow`} cx="0.5" cy="0.42" r="0.75">
          <stop offset="0%" stopColor="#3a2a4a" />
          <stop offset="70%" stopColor="#241a33" />
          <stop offset="100%" stopColor="#150f22" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-burrow)`} />
      {/* cozy root arches */}
      <path d={`M0,0 L0,${H} L${W},${H} L${W},0 C ${W * 0.7},${H * 0.16} ${W * 0.3},${H * 0.16} 0,0 Z`} fill="#1c1430" opacity="0.6" />
      {/* a little bed */}
      <ellipse cx={W * 0.5} cy={H * 0.86} rx={360} ry={70} fill="#4a3766" />
      <ellipse cx={W * 0.5} cy={H * 0.83} rx={330} ry={60} fill="#5d4780" />
      {/* single moonbeam from a gap */}
      <path d={`M${W * 0.78},0 L${W * 0.9},0 L${W * 0.64},${H} L${W * 0.5},${H} Z`} fill="#fdeeb8" opacity="0.08" />
      <Firefly x={W * 0.8} y={H * 0.2} scale={0.7} />
      <Fox x={W * 0.5} y={H * 0.9} scale={1.05} />
    </Stage>
  );
}

function ScenePage2(): ReactNode {
  // A firefly appears at the round window.
  const uid = useId();
  return (
    <Stage>
      <SkyDefs uid={uid} sky={DEEP} />
      <rect width={W} height={H} fill="#1b1430" />
      {/* wall */}
      <rect width={W} height={H} fill="#241a38" />
      {/* round window to the night */}
      <circle cx={W * 0.66} cy={H * 0.4} r={210} fill={`url(#${uid}-sky)`} />
      <clipPath id={`${uid}-win`}>
        <circle cx={W * 0.66} cy={H * 0.4} r={210} />
      </clipPath>
      <g clipPath={`url(#${uid}-win)`}>
        <Stars count={40} seed={3} />
        <Moon cx={W * 0.72} cy={H * 0.3} r={64} uid={uid} />
      </g>
      <circle cx={W * 0.66} cy={H * 0.4} r={210} fill="none" stroke="#3d2c58" strokeWidth={16} />
      <Firefly x={W * 0.66} y={H * 0.4} scale={1.2} />
      <Fox x={W * 0.3} y={H * 0.92} scale={1.05} />
    </Stage>
  );
}

function ScenePage3(): ReactNode {
  // Following the firefly into the meadow.
  const uid = useId();
  return (
    <Stage>
      <SkyDefs uid={uid} sky={NIGHT} />
      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
      <Stars count={80} seed={11} />
      <Moon cx={W * 0.82} cy={H * 0.22} r={90} uid={uid} />
      <Cloud x={W * 0.3} y={H * 0.28} scale={1} opacity={0.3} />
      <Hills palette={HILLS_NIGHT} />
      <Flower x={W * 0.12} y={H * 0.82} color="#e58fb0" />
      <Flower x={W * 0.24} y={H * 0.9} color="#9ec6ff" />
      <Flower x={W * 0.88} y={H * 0.84} color="#ffd27a" />
      <Firefly x={W * 0.56} y={H * 0.5} scale={1.1} />
      <Firefly x={W * 0.7} y={H * 0.62} scale={0.7} />
      <Fox x={W * 0.32} y={H * 0.94} scale={1.05} />
    </Stage>
  );
}

function ScenePage4(): ReactNode {
  // Up the hill toward the great Moon.
  const uid = useId();
  return (
    <Stage>
      <SkyDefs uid={uid} sky={['#1a1348', '#3a2570', '#7a4f86']} />
      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
      <Stars count={60} seed={5} />
      <Moon cx={W * 0.5} cy={H * 0.34} r={150} uid={uid} />
      {/* one big hill rising to the right */}
      <path d={`M0,${H} L0,${H * 0.86} C ${W * 0.4},${H * 0.7} ${W * 0.7},${H * 0.5} ${W},${H * 0.42} L${W},${H} Z`} fill="#2b1f57" />
      <path d={`M0,${H} L0,${H * 0.94} C ${W * 0.4},${H * 0.82} ${W * 0.75},${H * 0.64} ${W},${H * 0.58} L${W},${H} Z`} fill="#1d1544" />
      <Firefly x={W * 0.6} y={H * 0.4} scale={1} />
      <Fox x={W * 0.64} y={H * 0.66} scale={0.95} />
    </Stage>
  );
}

function ScenePage5(): ReactNode {
  // Meeting the Moon, who has a gentle face.
  const uid = useId();
  const mx = W * 0.62;
  const my = H * 0.4;
  const r = 200;
  return (
    <Stage>
      <SkyDefs uid={uid} sky={DEEP} moon={false} />
      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
      <Stars count={70} seed={13} />
      {/* Big friendly moon with a face */}
      <circle className="sl-moonglow" cx={mx} cy={my} r={r * 1.7} fill="#fdeeb8" opacity="0.5" />
      <circle cx={mx} cy={my} r={r} fill="#fbeeb0" />
      <circle cx={mx - 70} cy={my - 40} r={22} fill="#efdf9a" opacity="0.7" />
      <circle cx={mx + 60} cy={my + 30} r={16} fill="#efdf9a" opacity="0.6" />
      {/* face */}
      <g className="sl-eyes">
        <circle cx={mx - 60} cy={my - 20} r={12} fill="#8a6f2e" />
        <circle cx={mx + 60} cy={my - 20} r={12} fill="#8a6f2e" />
      </g>
      <path d={`M${mx - 55},${my + 40} Q ${mx},${my + 80} ${mx + 55},${my + 40}`} fill="none" stroke="#8a6f2e" strokeWidth={9} strokeLinecap="round" />
      <circle cx={mx - 92} cy={my + 30} r={20} fill="#f6b8a0" opacity="0.5" />
      <circle cx={mx + 92} cy={my + 30} r={20} fill="#f6b8a0" opacity="0.5" />
      <Hills palette={HILLS_NIGHT} />
      <Firefly x={W * 0.3} y={H * 0.5} scale={1} />
      <Fox x={W * 0.2} y={H * 0.95} scale={1} flip />
    </Stage>
  );
}

function ScenePage6(): ReactNode {
  // Home again, asleep, with the firefly as a nightlight.
  const uid = useId();
  return (
    <Stage>
      <defs>
        <radialGradient id={`${uid}-burrow`} cx="0.6" cy="0.4" r="0.8">
          <stop offset="0%" stopColor="#4a3766" />
          <stop offset="70%" stopColor="#2a1f42" />
          <stop offset="100%" stopColor="#181026" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-burrow)`} />
      <ellipse cx={W * 0.5} cy={H * 0.84} rx={380} ry={80} fill="#4a3766" />
      <ellipse cx={W * 0.5} cy={H * 0.8} rx={350} ry={68} fill="#5d4780" />
      {/* blanket */}
      <path d={`M${W * 0.5 - 300},${H * 0.8} q 300,-70 600,0 l 0,120 l -600,0 Z`} fill="#7c63a8" />
      {/* sleeping fox — same fox, curled: reuse standing fox smaller, eyes closed via blink freeze is fine */}
      <Fox x={W * 0.5} y={H * 0.86} scale={0.9} />
      {/* Zzz */}
      <g fill="#fff6c8" opacity="0.85" fontFamily="Fraunces, serif">
        <text x={W * 0.66} y={H * 0.4} fontSize="46">z</text>
        <text x={W * 0.7} y={H * 0.33} fontSize="62">Z</text>
        <text x={W * 0.75} y={H * 0.25} fontSize="82">Z</text>
      </g>
      <Firefly x={W * 0.3} y={H * 0.3} scale={1.1} />
    </Stage>
  );
}

function SceneEnd(): ReactNode {
  const uid = useId();
  return (
    <Stage>
      <SkyDefs uid={uid} sky={NIGHT} />
      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
      <Stars count={90} seed={17} />
      <Moon cx={W * 0.5} cy={H * 0.36} r={110} uid={uid} />
      <Hills palette={HILLS_NIGHT} />
      <Firefly x={W * 0.4} y={H * 0.58} scale={1} />
      <Firefly x={W * 0.62} y={H * 0.64} scale={0.8} />
    </Stage>
  );
}

/* ---------- Scene registry ---------- */

const SCENES: Record<string, () => ReactNode> = {
  cover: SceneCover,
  p1: ScenePage1,
  p2: ScenePage2,
  p3: ScenePage3,
  p4: ScenePage4,
  p5: ScenePage5,
  p6: ScenePage6,
  end: SceneEnd,
};

export function DemoScene({ sceneId }: { sceneId: string }): ReactNode {
  const Comp = SCENES[sceneId] ?? SceneEnd;
  return <Comp />;
}

export const DEMO_SCENE_IDS = Object.keys(SCENES);
