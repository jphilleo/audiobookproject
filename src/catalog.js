// The public-domain library: free audiobooks we've made ourselves, one per book here.
// Texts come from Standard Ebooks (public domain, CC0). Audio and covers are made by
// scripts/narrate-library.js into LIBRARY_DIR/<slug>/; a book appears on the site only once its
// manifest says it's ready.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
];

export const bookDir = (slug) => path.join(LIBRARY_DIR, slug);
export const bookUrl = (b) => `/library/${b.authorSlug}/${b.slug}`;
export const sourceUrl = (b) => `https://standardebooks.org/ebooks/${b.source}`;
export const epubUrl = (b) => `${sourceUrl(b)}/downloads/${b.source.split("/").join("_")}.epub?source=download`;

// The finished books, with their manifests (chapters, durations, files). Re-read when a manifest
// changes, so books appear as soon as narration finishes without restarting the server.
const cache = new Map();
export function readyBooks() {
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
    if (entry.manifest.ready) out.push({ ...b, ...entry.manifest });
  }
  return out;
}
export const findBook = (authorSlug, slug) => readyBooks().find((b) => b.authorSlug === authorSlug && b.slug === slug);

// A 360px-wide cover-sm.jpg next to the cover, for shelves and grids. Returns its name, or the
// full cover if a thumbnail can't be made.
export function smallCover(b) {
  if (!b.cover || b.cover.endsWith(".svg")) return b.cover;
  const out = path.join(bookDir(b.slug), "cover-sm.jpg");
  if (fs.existsSync(out)) return "cover-sm.jpg";
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(bookDir(b.slug), b.cover), "-vf", "scale=360:-2", "-q:v", "4", out]);
  return r.status === 0 ? "cover-sm.jpg" : b.cover;
}
