/** Real storybooks generated with Storyteller AI, shown on the landing page.
 *  Images live in `public/showcase/` and are referenced under the Vite base.
 *  The gallery section renders only when this list is non-empty.
 *
 *  To add a book: export it from the reader ("Save file"), drop the page PNGs
 *  into public/showcase/, and add entries here. */

export interface ShowcasePage {
  /** File under public/showcase/, e.g. "billy-01.png". */
  file: string;
  /** Lyrical page header. */
  header: string;
  /** One line of the page's prose. */
  caption: string;
}

export interface ShowcaseBook {
  title: string;
  ageRange: string;
  style: string;
  pages: ShowcasePage[];
}

const base = import.meta.env.BASE_URL;
export const showcaseSrc = (file: string): string => `${base}showcase/${file}`;

export const SHOWCASE: ShowcaseBook[] = [];
