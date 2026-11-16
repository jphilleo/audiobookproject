// The public-domain library: free audiobooks we've made ourselves, one per book here.
// Texts come from Standard Ebooks (public domain, CC0). Audio and covers are made by
// scripts/narrate-library.js into LIBRARY_DIR/<slug>/; a book appears on the site only once its
// manifest marks it as a complete book or a first-chapter preview.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import expansion from "./library-expansion.json" with { type: "json" };

export const LIBRARY_DIR = path.resolve(process.env.LIBRARY_DIR || path.join(import.meta.dirname, "..", "library"));
export const LIBRARY_VOICE = { id: "af_heart", name: "Heart" };

// Descriptions are hand-written. Keep them short and true.
export const CATALOG = [
  {
    slug: "the-strange-case-of-dr-jekyll-and-mr-hyde", authorSlug: "robert-louis-stevenson",
    title: "Strange Case of Dr Jekyll and Mr Hyde", shortTitle: "Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson", year: 1886,
    source: "robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde",
    description: "A London lawyer keeps running into the same nasty little man, Edward Hyde, and can't work out why his respectable friend Dr Jekyll keeps covering for him. It's short and creepy, and even if you know the twist it's worth hearing how it unfolds.",
  },
  {
    slug: "a-christmas-carol", authorSlug: "charles-dickens",
    title: "A Christmas Carol", author: "Charles Dickens", year: 1843,
    source: "charles-dickens/a-christmas-carol",
    description: "Scrooge, three ghosts and one long night. Dickens loved reading this one aloud himself, to packed halls, for years. It's made for listening.",
  },
  {
    slug: "alices-adventures-in-wonderland", authorSlug: "lewis-carroll",
    title: "Alice's Adventures in Wonderland", shortTitle: "Alice in Wonderland", author: "Lewis Carroll", year: 1865,
    source: "lewis-carroll/alices-adventures-in-wonderland/john-tenniel",
    description: "Alice follows a white rabbit down a hole and nothing makes sense after that. The wordplay and the silly poems are even better out loud.",
  },
  {
    slug: "the-time-machine", authorSlug: "h-g-wells",
    title: "The Time Machine", author: "H. G. Wells", year: 1895,
    source: "h-g-wells/the-time-machine",
    description: "A Victorian inventor travels 800,000 years into the future and comes back with a story his dinner guests can't quite believe. Wells more or less invented the time-travel story here, and it's still a quick, strange, unsettling read.",
  },
  {
    slug: "frankenstein", authorSlug: "mary-shelley",
    title: "Frankenstein", author: "Mary Shelley", year: 1818,
    source: "mary-shelley/frankenstein",
    description: "Victor Frankenstein builds a man, then runs from what he's made. It's sadder and stranger than the movies, and a big part of it is told by the creature in his own words.",
  },
  {
    slug: "pride-and-prejudice", authorSlug: "jane-austen",
    title: "Pride and Prejudice", author: "Jane Austen", year: 1813,
    source: "jane-austen/pride-and-prejudice",
    description: "Elizabeth Bennet and Mr Darcy get each other wrong for most of a book. It's funny and sharp, and still the best first-impressions story there is.",
  },
  {
    slug: "the-adventures-of-sherlock-holmes", authorSlug: "arthur-conan-doyle",
    title: "The Adventures of Sherlock Holmes", shortTitle: "Sherlock Holmes", author: "Arthur Conan Doyle", year: 1892,
    source: "arthur-conan-doyle/the-adventures-of-sherlock-holmes",
    description: "Twelve Sherlock Holmes cases, told by Watson. Each one stands on its own, so it's a good book to dip in and out of.",
  },
  {
    slug: "dracula", authorSlug: "bram-stoker",
    title: "Dracula", author: "Bram Stoker", year: 1897,
    source: "bram-stoker/dracula",
    description: "Told in letters and diary entries, starting with a young lawyer's trip to a castle in Transylvania. It's slower and spookier than the movies.",
  },
  {
    slug: "meditations", authorSlug: "marcus-aurelius",
    title: "Meditations", author: "Marcus Aurelius", year: "c. 180",
    source: "marcus-aurelius/meditations/george-long",
    description: "A Roman emperor's private notes to himself about staying calm, doing his job and not worrying what people think. Short entries, easy to take a few at a time. Translated by George Long.",
  },
  {
    slug: "moby-dick", authorSlug: "herman-melville",
    title: "Moby-Dick", author: "Herman Melville", year: 1851,
    source: "herman-melville/moby-dick",
    description: "Ishmael signs on to a whaling ship and finds himself under Captain Ahab, who wants one thing: the white whale that took his leg. Long and strange, with whole chapters about whales between the chase.",
  },
  ...expansion,
];

export const bookDir = (slug) => path.join(LIBRARY_DIR, slug);
export const bookUrl = (b) => `/library/${b.authorSlug}/${b.slug}`;
export const sourceUrl = (b) => `https://standardebooks.org/ebooks/${b.source}`;
export const epubUrl = (b) => `${sourceUrl(b)}/downloads/${b.source.split("/").join("_")}.epub?source=download`;

// Re-read changed manifests so complete books and previews can appear without a restart.
const cache = new Map();
export function publishedBooks() {
  const out = [];
  for (const b of CATALOG) {
    const file = path.join(bookDir(b.slug), "manifest.json");
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    let entry = cache.get(file);
    if (!entry || entry.mtime !== stat.mtimeMs) {
      try { entry = { mtime: stat.mtimeMs, manifest: JSON.parse(fs.readFileSync(file, "utf8")) }; } catch { continue; }
      cache.set(file, entry);
    }
    if (entry.manifest.ready || (entry.manifest.preview && entry.manifest.chapters?.length === 1)) {
      out.push({ ...b, ...entry.manifest });
    }
  }
  return out;
}
export const readyBooks = () => publishedBooks().filter((b) => b.ready);
export const findBook = (authorSlug, slug) => publishedBooks().find((b) => b.authorSlug === authorSlug && b.slug === slug);

// Every book in the catalog with where it stands: "ready", "narrating" (some chapters done) or
// "soon", plus its cover if we have one yet. Used for placeholders while books are being made.
export function libraryStatus() {
  const published = new Map(publishedBooks().map((b) => [b.slug, b]));
  const staged = new Set(expansion.map((b) => b.slug));
  return CATALOG.flatMap((b) => {
    const book = published.get(b.slug);
    if (book) return { ...book, state: book.ready ? "ready" : "preview" };
    if (staged.has(b.slug)) return [];
    const dir = bookDir(b.slug);
    const cover = ["cover.jpg", "cover.png", "cover.webp"].find((f) => fs.existsSync(path.join(dir, f))) || null;
    const narrating = fs.existsSync(path.join(dir, "chapters")) && fs.readdirSync(path.join(dir, "chapters")).some((f) => f.endsWith(".m4a"));
    return { ...b, cover, state: narrating ? "narrating" : "soon" };
  });
}

// A small cover-sm.jpg (300px wide, about 15 KB) next to the cover, for shelves and grids.
// Returns its name, or the full cover if a thumbnail can't be made.
export function smallCover(b) {
  if (!b.cover || b.cover.endsWith(".svg")) return b.cover;
  const out = path.join(bookDir(b.slug), "cover-sm.jpg");
  if (fs.existsSync(out)) return "cover-sm.jpg";
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(bookDir(b.slug), b.cover), "-vf", "scale=300:-2", "-q:v", "6", out]);
  return r.status === 0 ? "cover-sm.jpg" : b.cover;
}
