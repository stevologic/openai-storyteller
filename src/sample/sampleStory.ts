import type { RenderedStory } from '../lib/types';

/** The bundled demo story. Renders with animated vector scenes (see scenes.tsx)
 *  so the whole reader experience works with zero API keys. */
export const SAMPLE_STORY: RenderedStory = {
  title: 'Pip and the Lantern Moon',
  dedication: 'For everyone who is a little brave in the dark.',
  ageRange: '3–6',
  characterBible:
    'Pip, a small round fox with warm orange fur, a cream belly and cheeks, a white-tipped bushy tail, big dark eyes and tiny triangle ears.',
  artStyle: 'Soft storybook illustration, deep indigo night palette, glowing warm light, gentle rounded shapes.',
  moral: 'The dark is never empty — it is only the world, tucking everyone in for the night.',
  createdAt: 0,
  demo: true,
  coverSceneId: 'cover',
  pages: [
    {
      header: 'A Wide-Awake Night',
      text: 'Deep in a cozy burrow, little Pip could not sleep. The dark felt big and quiet, and Pip pulled the blanket up to his nose.',
      illustration: 'A small fox awake in a dark cozy burrow bedroom.',
      motion: 'zoom-in',
      sceneId: 'p1',
    },
    {
      header: 'A Tap at the Window',
      text: 'Tap, tap. A tiny light danced at the round window. It blinked once, as if to say, "Come along, come see."',
      illustration: 'A glowing firefly at a round window with the moon behind.',
      motion: 'drift',
      sceneId: 'p2',
    },
    {
      header: 'Into the Whispering Meadow',
      text: 'Pip tiptoed outside on soft brave paws. The whole meadow was awake with silver grass and sleepy, nodding flowers.',
      illustration: 'A fox following a firefly through a moonlit meadow.',
      motion: 'pan-right',
      sceneId: 'p3',
    },
    {
      header: 'Up the Silver Hill',
      text: 'The firefly floated up and up a gentle hill. And there at the top, waiting, was the biggest, roundest Moon.',
      illustration: 'A fox climbing a hill toward a large glowing moon.',
      motion: 'zoom-out',
      sceneId: 'p4',
    },
    {
      header: 'What the Moon Knows',
      text: '"The dark is not empty," smiled the Moon. "It is full of quiet friends — the owl, the breeze, and me, keeping watch."',
      illustration: 'A friendly moon with a gentle face speaking to a small fox.',
      motion: 'drift',
      sceneId: 'p5',
    },
    {
      header: 'Home, and Held',
      text: 'Pip curled up warm at home, the firefly glowing soft as a lantern. And the night felt just like a hug. The end.',
      illustration: 'A fox asleep at home with a firefly nightlight glowing.',
      motion: 'zoom-in',
      sceneId: 'p6',
    },
  ],
};
