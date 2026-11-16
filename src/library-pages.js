// Pages for the public-domain library: the shelf shown on landing pages, the library index,
// each book's page and its podcast feed. Book data comes from src/catalog.js.
import fs from "node:fs";
import path from "node:path";
import { readyBooks, libraryStatus, bookUrl, sourceUrl, bookDir, smallCover, CATALOG } from "./catalog.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const xmlEscape = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
// Covers are served by this server. Audio can live elsewhere (Cloudflare R2): set LIBRARY_AUDIO_URL
// to the bucket's public address and audio links point there instead.
const AUDIO_BASE = (process.env.LIBRARY_AUDIO_URL || "").replace(/\/+$/, "");
export const fileUrl = (b, file) => `/library-audio/${b.slug}/${file}`;
export const audioUrl = (b, file) => {
  if (b.audioStorage === "origin" && /^[a-f0-9]{64}$/.test(b.audioSha256)) {
    return `${fileUrl(b, file)}?v=${b.audioSha256.slice(0, 12)}`;
  }
  if (!AUDIO_BASE || b.audioStorage === "origin") return fileUrl(b, file);
  if (!b.ready && b.preview) return `${AUDIO_BASE}/previews/${b.slug}.m4a`;
  return `${AUDIO_BASE}/${b.slug}/${file}`;
};
const abs = (origin, url) => (/^https?:/.test(url) ? url : `${origin}${url}`);
// Feeds give each episode's size; the file may only exist in remote storage, so this can be missing.
const fileSize = (b, file) => { try { return fs.statSync(path.join(bookDir(b.slug), file)).size; } catch { return null; } };

// "3 h 12 min", "47 min", or "12:05" for a chapter.
export function length(ms) {
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${Math.max(1, min)} min`;
}
export function clock(ms) {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
const megabytes = (bytes) => `${Math.round(bytes / 1e6)} MB`;
const name = (b) => b.shortTitle || b.title;

// Shelves and grids use a small cover; the book page uses the full one.
function cover(b, cls = "lib-cover") {
  const file = cls.includes("lg") ? b.cover : smallCover(b);
  return b.cover
    ? `<img class="${cls}" src="${fileUrl(b, file)}" alt="" loading="lazy">`
    : `<span class="${cls} gen" aria-hidden="true"><span>${esc(name(b))}</span><span>${esc(b.author)}</span></span>`;
}

// What a placeholder says while its book isn't ready.
const STATE = { narrating: "Narrating now", soon: "Coming soon" };
// Playable books and previews link to their pages. Other titles stay placeholders.
function card(b, { listen = false, lengthLine = false } = {}) {
  const caption = `${cover(b)}<strong>${esc(name(b))}</strong><span>${esc(b.author)}</span>`;
  if (b.state === "preview") return `<li><a href="${bookUrl(b)}">${caption}<span class="lib-listen">First chapter · ${length(b.durationMs)}</span></a></li>`;
  if (b.state !== "ready") return `<li class="lib-pending"><div>${caption}<span class="lib-badge">${STATE[b.state]}</span></div></li>`;
  const extra = listen ? '<span class="lib-listen">Listen now</span>' : lengthLine ? `<span>${length(b.durationMs)}</span>` : "";
  return `<li><a href="${bookUrl(b)}">${caption}${extra}</a></li>`;
}
// Complete books first, then previews, then upcoming titles.
const ordered = () => {
  const all = libraryStatus();
  return ["ready", "preview", "narrating", "soon"].flatMap((state) => all.filter((b) => b.state === state));
};

// A row of covers, for landing pages.
export function shelfHtml({ heading, intro, more = "Browse the library", listen = false }) {
  const books = ordered().slice(0, 6);
  if (!books.length) return "";
  return `<div class="lib-head"><h2 id="library">${esc(heading)}</h2><a href="/library">${esc(more)}</a></div>
      <p>${intro}${books.some((b) => b.state === "ready" || b.state === "preview") ? "" : " The first ones are being narrated right now."}</p>
      <ul class="lib-shelf">
        ${books.map((b) => card(b, { listen })).join("\n        ")}
      </ul>`;
}

/* ---------- The library index ---------- */

export function libraryVars(origin) {
  const books = readyBooks();
  const grid = `<ul class="lib-grid">
      ${ordered().map((b) => card(b, { lengthLine: true })).join("\n      ")}
    </ul>`;
  const ld = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "Free audiobooks of public-domain books", url: `${origin}/library`,
    hasPart: books.map((b) => ({ "@type": "Audiobook", name: b.title, url: `${origin}${bookUrl(b)}` })),
  };
  return {
    title: "Free Public-Domain Audiobooks — Audiobook Project",
    description: "Listen to first chapters and complete audiobooks of public-domain classics. Download complete books in M4B or MP3. No account needed.",
    canonical: esc(`${origin}/library`),
    grid,
    jsonld: jsonLdTag(ld),
  };
}

/* ---------- A book ---------- */

export function bookVars(b, origin) {
  const url = `${origin}${bookUrl(b)}`;
  const feed = esc(`${url}/feed.xml`);
  const bookTitle = esc(b.title);
  const chapters = b.chapters.map((c, i) => `<li><button type="button" data-src="${audioUrl(b, c.file)}" data-index="${i}"><span class="lib-ch-title">${esc(c.title)}</span><span class="lib-ch-time">${clock(c.durationMs)}</span></button></li>`);
  const SHOWN = 10;
  const list = chapters.length > SHOWN + 2
    ? `${chapters.slice(0, SHOWN).join("\n        ")}
      </ol>
      <details class="lib-more"><summary>Show all ${chapters.length} chapters</summary><ol class="lib-chapters" start="${SHOWN + 1}">
        ${chapters.slice(SHOWN).join("\n        ")}
      </ol></details>`
    : `${chapters.join("\n        ")}
      </ol>`;
  const ld = {
    "@context": "https://schema.org", "@type": "Audiobook", name: b.title, url,
    author: { "@type": "Person", name: b.author }, datePublished: b.year ? String(b.year) : undefined,
    readBy: { "@type": "Person", name: `${b.voice.name} (AI voice)` },
    duration: `PT${Math.round(b.durationMs / 60000)}M`,
    image: b.cover ? `${origin}${fileUrl(b, b.cover)}` : undefined,
    isAccessibleForFree: true, inLanguage: "en", description: b.description,
    encoding: b.ready ? ["m4b", "mp3"].map((f) => ({ "@type": "AudioObject", contentUrl: abs(origin, audioUrl(b, b[f].file)), encodingFormat: f === "mp3" ? "audio/mpeg" : "audio/mp4", contentSize: megabytes(b[f].bytes) })) : undefined,
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Library", item: `${origin}/library` },
    { "@type": "ListItem", position: 2, name: b.title, item: url },
  ] };
  return {
    title: esc(`${b.title} ${b.ready ? "Audiobook (Free)" : "First Chapter"} by ${b.author} — Audiobook Project`),
    description: esc(b.ready ? `Listen to ${b.title} by ${b.author} free. ${length(b.durationMs)}, ${b.chapters.length} chapters. Play it here, download M4B or MP3, or add it to your podcast app.` : `Listen to the first chapter of ${b.title} by ${b.author} free. ${length(b.durationMs)}.`),
    canonical: esc(url),
    ogimage: b.cover ? esc(`${origin}${fileUrl(b, b.cover)}`) : esc(`${origin}/brand/icon-512.png`),
    booktitle: bookTitle,
    author: esc(b.author),
    year: b.year ? ` · ${esc(b.year)}` : "",
    cover: cover(b, "lib-cover lg"),
    meta: esc(`${b.ready ? `${length(b.durationMs)} · ${b.chapters.length} chapters` : `First chapter preview · ${length(b.durationMs)}`} · read by ${b.voice.name}, an AI voice`),
    chaptersHeading: b.ready ? "Chapters" : "First chapter",
    bookdescription: esc(b.description),
    feedLink: b.ready ? `<link rel="alternate" type="application/rss+xml" title="${bookTitle} (podcast feed)" href="${feed}">` : "",
    downloads: b.ready ? `<a class="btn" href="${esc(audioUrl(b, b.m4b.file))}" download>M4B <span class="lib-size">${megabytes(b.m4b.bytes)}</span></a>
          <a class="btn" href="${esc(audioUrl(b, b.mp3.file))}" download>MP3 <span class="lib-size">${megabytes(b.mp3.bytes)}</span></a>
          <button type="button" class="btn" id="lib-feed" data-feed="${feed}">Add to podcast app</button>` : "",
    chapters: list,
    source: esc(sourceUrl(b)),
    jsonld: (b.ready ? jsonLdTag(ld) : "") + jsonLdTag(crumbs),
  };
}

// A public podcast feed: each chapter is an episode, in reading order.
export function feedXml(b, origin) {
  const built = new Date(b.builtAt || Date.now()).getTime();
  const items = b.chapters.map((c, i) => {
    const pub = new Date(built - (b.chapters.length - i) * 60000).toUTCString();
    return `<item><title>${xmlEscape(c.title)}</title><guid isPermaLink="false">${b.slug}-${i + 1}</guid><pubDate>${pub}</pubDate><itunes:episode>${i + 1}</itunes:episode><itunes:duration>${Math.round(c.durationMs / 1000)}</itunes:duration><enclosure url="${abs(origin, audioUrl(b, c.file))}"${fileSize(b, c.file) ? ` length="${fileSize(b, c.file)}"` : ""} type="audio/mp4"/></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>${xmlEscape(b.title)}</title><link>${origin}${bookUrl(b)}</link><language>en</language>
<description>${xmlEscape(`${b.title} by ${b.author}, read aloud by an AI voice. ${b.description}`)}</description>
<itunes:author>${xmlEscape(b.author)}</itunes:author><itunes:type>serial</itunes:type>
${b.cover ? `<itunes:image href="${origin}${fileUrl(b, b.cover)}"/>` : ""}
${items.join("\n")}
</channel></rss>`;
}

const jsonLdTag = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

// The "Try the formats" sample on landing pages: A Christmas Carol from the library once it's
// finished, so the demo is a real book you can keep. Null until then.
export function sampleBookHtml() {
  const b = readyBooks().find((x) => x.slug === "a-christmas-carol") || readyBooks()[0];
  if (!b) return null;
  const PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  return `
    <div class="sample-book" data-sample-book>
      <audio preload="none"></audio>
      <div class="sample-book-head">
        <button type="button" class="sampler-play" aria-label="Play ${esc(b.title)}">${PLAY}</button>
        <div><strong><a href="${bookUrl(b)}">${esc(b.title)}</a></strong><span>${esc(b.author)} · ${length(b.durationMs)} · ${b.chapters.length} chapters · voice: ${esc(b.voice.name)}</span></div>
      </div>
      <ol class="sample-chapters">
        ${b.chapters.slice(0, 5).map((c) => `<li><button type="button" data-src="${audioUrl(b, c.file)}">${esc(c.title)}<span>${clock(c.durationMs)}</span></button></li>`).join("\n        ")}
      </ol>
      <div class="sample-downloads"><a class="btn" href="${audioUrl(b, b.m4b.file)}" download>Download M4B <span class="lib-size">${megabytes(b.m4b.bytes)}</span></a><a class="btn" href="${audioUrl(b, b.mp3.file)}" download>Download MP3 <span class="lib-size">${megabytes(b.mp3.bytes)}</span></a></div>
    </div>`;
}
