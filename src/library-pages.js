// Pages for the public-domain library: the shelf shown on landing pages, the library index,
// each book's page and its podcast feed. Book data comes from src/catalog.js.
import fs from "node:fs";
import path from "node:path";
import { readyBooks, publishedBooks, libraryStatus, bookUrl, sourceUrl, bookDir, smallCover, CATALOG } from "./catalog.js";

import { authorGroups, authorUrl, relatedBooks } from "./library-seo.js";

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
  if (!b.ready && b.preview) {
    const version = /^[a-z0-9-]+$/.test(b.previewRelease || "") ? `${b.previewRelease}/` : "";
    return `${AUDIO_BASE}/previews/${version}${b.slug}.m4a`;
  }
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
    ? `<img class="${cls}" src="${fileUrl(b, file)}" alt="${esc(b.title)} book cover" loading="${cls.includes("lg") ? "eager" : "lazy"}">`
    : `<span class="${cls} gen" aria-hidden="true"><span>${esc(name(b))}</span><span>${esc(b.author)}</span></span>`;
}

// What a placeholder says while its book isn't ready.
const STATE = { narrating: "Narrating now", soon: "Coming soon" };
// Playable books and previews link to their pages. Other titles stay placeholders.
function card(b, { listen = false, lengthLine = false, delivery = false } = {}) {
  const caption = `${cover(b)}<strong>${esc(name(b))}</strong><span>${esc(b.author)}</span>`;
  if (b.state === "preview") return `<li><a href="${bookUrl(b)}">${caption}<span class="lib-listen">${delivery ? "Full audiobook by email · Listen to sample" : `First chapter · ${length(b.durationMs)}`}</span></a></li>`;
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

export function libraryVars(origin, { delivery = false } = {}) {
  const books = publishedBooks();
  const grid = `<ul class="lib-grid">
      ${ordered().map((b) => card(b, { lengthLine: true, delivery })).join("\n      ")}
    </ul>`;
  const ld = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "Free audiobooks of public-domain books", url: `${origin}/library`,
    hasPart: books.map((b) => ({ "@type": b.ready ? "Audiobook" : "Book", name: b.title, url: `${origin}${bookUrl(b)}` })),
  };
  return {
    title: "Free Public-Domain Audiobooks — Audiobook Project",
    description: delivery ? "Free audiobooks of public-domain classics. Listen to samples and request the full book in M4B or MP3 by email. Finished recordings are also available instantly." : "Listen to first chapters and complete audiobooks of public-domain classics. Download complete books in M4B or MP3. No account needed.",
    libraryIntro: delivery ? "Public-domain classics, read aloud by AI voices. Listen to a sample and get the full audiobook free by email. Books that need preparation enter the queue after you confirm your address; finished recordings can be downloaded instantly." : "Public-domain classics, read aloud by AI voices. Listen to a first chapter or a complete audiobook. Complete books are also available to download or add to a podcast app.",
    canonical: esc(`${origin}/library`),
    grid,
    browseAuthors: '<p><a href="/library/authors">Browse audiobooks by author</a></p>',
    jsonld: jsonLdTag(ld),
  };
}

/* ---------- A book ---------- */

export function bookVars(b, origin, { delivery = false } = {}) {
  const url = `${origin}${bookUrl(b)}`;
  const feed = esc(`${url}/feed.xml`);
  const bookTitle = esc(b.title);
  const author = authorGroups().find(a=>a.slug===b.authorSlug);
  const authorLink = author ? `<a href="${authorUrl(b.authorSlug)}">${esc(b.author)}</a>` : esc(b.author);
  const related = relatedBooks(b);
  const chapters = b.chapters.map((c, i) => `<li><button type="button" data-src="${esc(audioUrl(b, c.file))}" data-index="${i}" data-duration="${c.durationMs / 1000}">${b.ready ? '<span class="lib-ch-icon" aria-hidden="true"></span>' : ""}<span class="lib-ch-title">${esc(c.title)}</span><span class="lib-ch-time">${clock(c.durationMs)}</span></button></li>`);
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
    author: { "@type": "Person", name: b.author },
    readBy: { "@type": "Person", name: `${b.voice.name} (AI voice)` },
    duration: `PT${Math.round(b.durationMs / 1000)}S`,
    image: b.cover ? `${origin}${fileUrl(b, b.cover)}` : undefined,
    isAccessibleForFree: true, inLanguage: "en", description: b.description,
    encoding: b.ready ? ["m4b", "mp3"].map((f) => ({ "@type": "AudioObject", contentUrl: abs(origin, audioUrl(b, b[f].file)), encodingFormat: f === "mp3" ? "audio/mpeg" : "audio/mp4", contentSize: megabytes(b[f].bytes) })) : undefined,
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Library", item: `${origin}/library` },
    ...(author ? [{ "@type": "ListItem", position: 2, name: b.author, item: `${origin}${authorUrl(b.authorSlug)}` }] : []),
    { "@type": "ListItem", position: author ? 3 : 2, name: b.title, item: url },
  ] };
  const play = `<button type="button" class="btn primary" id="lib-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg><span>${b.ready ? "Play" : "Play chapter 1"}</span></button>`;
  const skip = (seconds, forward = false) => `<button type="button" class="btn lib-skip" data-skip="${forward ? seconds : -seconds}" aria-label="${forward ? "Forward" : "Back"} ${seconds} seconds">
          <svg viewBox="0 0 32 32" aria-hidden="true"><g${forward ? ' transform="translate(32 0) scale(-1 1)"' : ""}><path d="M16 6a11 11 0 1 1-9.5 5.5"/><path class="lib-skip-arrow" d="M17 2.5 12 6l5 3.5z"/></g><text x="16" y="18" text-anchor="middle" dominant-baseline="middle">${seconds}</text></svg>
        </button>`;
  const error = '<p id="lib-playback-error" role="alert" hidden>Audio couldn’t play. Try again in a moment.</p>';
  const description = `<p class="lib-about">${esc(b.description)}</p>`;
  const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>';
  const requestForm = delivery ? `<details class="lib-request"><summary class="btn lib-download">${downloadIcon}${b.ready ? "Email me a download link" : "Get the full audiobook free"}</summary>
      <form data-book-request data-slug="${esc(b.slug)}">
        <p>${b.ready ? "We’ll email you a link to the complete recording after you confirm your address." : "Listen to the sample now. Confirm your email and we’ll prepare the full audiobook and send a download link. Preparation can take several days, depending on book length and the queue."}</p>
        <label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
        <fieldset><legend>Download format</legend><label><input type="radio" name="format" value="m4b" checked> M4B · audiobook apps, with chapters</label><label><input type="radio" name="format" value="mp3"> MP3 · most audio players</label></fieldset>
        <label class="request-honey" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <button class="btn primary" type="submit">Email me a confirmation link</button>
        <p class="lib-request-note">Only emails about this request. No mailing list. <a href="/privacy">Privacy</a></p>
        <p data-request-status role="status" aria-live="polite"></p>
      </form></details>` : "";
  return {
    requestForm,
    title: esc(b.ready ? `${b.title} by ${b.author} — Free Complete Audiobook` : delivery ? `${b.title} by ${b.author} — Free Audiobook` : `${b.title} Audiobook by ${b.author} — Free Sample`),
    description: esc(b.ready ? `Listen to the complete audiobook of ${b.title} by ${b.author} free. ${length(b.durationMs)}, ${b.chapters.length} chapters. Stream online or download M4B or MP3.` : delivery ? `Get ${b.title} by ${b.author} as a free M4B or MP3 audiobook by email. Listen to a sample now; the full recording is prepared after you confirm your request.` : `Listen to the first chapter of ${b.title} by ${b.author} free. ${length(b.durationMs)}.`),
    canonical: esc(url),
    ogimage: b.cover ? esc(`${origin}${fileUrl(b, b.cover)}`) : esc(`${origin}/brand/icon-512.png`),
    booktitle: bookTitle,
    author: esc(b.author),
    authorLink,
    year: b.year ? ` · ${esc(b.year)}` : "",
    cover: cover(b, "lib-cover lg"),
    meta: esc(`${b.ready ? `Complete audiobook · ${length(b.durationMs)} · ${b.chapters.length} chapters` : `First chapter preview · ${length(b.durationMs)}`} · read by ${b.voice.name}, an AI voice`),
    bookClass: b.ready ? "lib-full" : "",
    previewPlay: b.ready ? "" : `<div class="lib-actions">${play}</div>`,
    player: b.ready ? `<section class="lib-player-dock" aria-label="Audiobook player"><div class="lib-player">
        <div class="lib-track">
          ${b.cover ? cover(b, "lib-cover lib-player-cover") : ""}
          <div class="lib-track-text">
            <p class="lib-track-book"><span>${bookTitle}</span> <span id="lib-chapter-number">· 1 / ${b.chapters.length}</span></p>
            <p id="lib-now-playing" class="lib-now-playing" aria-live="polite">${esc(b.chapters[0].title)}</p>
          </div>
        </div>
        <div class="lib-transport">
          <button type="button" class="btn lib-chapter-step" id="lib-previous" aria-label="Previous chapter" title="Previous chapter" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h3v14H5zM19 5v14L9 12z"/></svg></button>
          ${skip(15)}
          ${play}
          ${skip(30, true)}
          <button type="button" class="btn lib-chapter-step" id="lib-next" aria-label="Next chapter" title="Next chapter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h3v14h-3zM5 5l10 7-10 7z"/></svg></button>
        </div>
        <details class="lib-speed-menu" id="lib-speed-menu">
          <summary id="lib-speed" aria-label="Playback speed, 1×"><span id="lib-speed-label">1×</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary>
          <div class="lib-speed-panel" role="group" aria-label="Playback speed">
            <p>Playback speed</p>
            ${[0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => `<button type="button" data-rate="${rate}" aria-pressed="${rate === 1}"><span>${rate}×</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></button>`).join("")}
          </div>
        </details>
        <div class="lib-timeline">
        <input id="lib-seek" type="range" min="0" max="${b.chapters[0].durationMs / 1000}" step="1" value="0" aria-label="Chapter position" aria-valuetext="0:00 of ${clock(b.chapters[0].durationMs)}">
        <p id="lib-position" class="lib-position">0:00 / ${clock(b.chapters[0].durationMs)}</p>
        </div>
        <audio id="lib-audio" preload="none"></audio>
        ${error}
      </div></section>` : "",
    downloads: b.ready ? `<div class="lib-downloads">
        <a class="btn lib-download" href="${esc(audioUrl(b, b.m4b.file))}" download aria-label="Download M4B, ${megabytes(b.m4b.bytes)}">${downloadIcon}M4B <span class="lib-size">${megabytes(b.m4b.bytes)}</span></a>
        <a class="btn lib-download" href="${esc(audioUrl(b, b.mp3.file))}" download aria-label="Download MP3, ${megabytes(b.mp3.bytes)}">${downloadIcon}MP3 <span class="lib-size">${megabytes(b.mp3.bytes)}</span></a>
        <details class="lib-podcasts">
          <summary class="btn">Podcast apps <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
          <div class="lib-podcast-panel">
            <p><strong>Apple Podcasts</strong></p>
            <p>Copy the feed link, then open Podcasts. On iPhone, go to Library and tap the More button. On Mac, open the File menu. Choose <strong>Follow a Show by URL</strong> and paste the link.</p>
            <p>In other podcast apps, look for an option to add a show by RSS link.</p>
            <button type="button" class="btn" id="lib-feed" data-feed="${feed}">Copy feed link</button>
            <span id="lib-feed-status" role="status"></span>
          </div>
        </details>
      </div>` : "",
    previewIntro: b.ready ? "" : `<audio id="lib-audio" preload="none"></audio>${error}${description}`,
    about: b.ready ? `<h2 class="lib-about-heading">About the audiobook</h2>${description}` : "",
    chaptersHeading: b.ready ? "Chapters" : "First chapter",
    feedLink: b.ready ? `<link rel="alternate" type="application/rss+xml" title="${bookTitle} (podcast feed)" href="${feed}">` : "",
    chapters: list,
    source: esc(sourceUrl(b)),
    editionDetails: `<section class="lib-edition"><h2>About this recording</h2><dl>
      <div><dt>Book</dt><dd>${bookTitle}${b.year ? ` (${esc(b.year)})` : ""}, by ${authorLink}</dd></div>
      <div><dt>Narration</dt><dd>${esc(b.voice.name)}, an AI voice using Kokoro · English</dd></div>
      <div><dt>Available now</dt><dd>${b.ready ? `Complete recording · ${length(b.durationMs)} · ${b.chapters.length} chapters` : `First-chapter sample · ${length(b.durationMs)}`}</dd></div>
      <div><dt>Text edition</dt><dd><a href="${esc(sourceUrl(b))}" rel="noopener">Read the source edition at Standard Ebooks</a></dd></div></dl>
      ${b.ready ? '<p>Choose M4B for audiobook apps with chapter navigation, or MP3 for broad audio-player support. You can also listen to every chapter on this page.</p>' : delivery ? '<p>To get the full recording, request M4B or MP3 above and confirm your email. We will send a download link after preparation and checks are complete.</p>' : '<p>The first chapter is available to listen to now. Full-book downloads are not available on this page yet.</p>'}
      </section>`,
    related: related.length ? `<section class="lib-related"><h2>More audiobooks to explore</h2><ul>${related.map(r=>`<li><a href="${bookUrl(r)}">${esc(r.title)}</a><span>${esc(r.author)} · ${r.ready ? 'Complete audiobook' : 'Free sample'}</span></li>`).join('')}</ul>${author ? `<p><a href="${authorUrl(author.slug)}">All ${esc(author.name)} audiobooks</a></p>` : ''}</section>` : '',
    jsonld: jsonLdTag(b.ready ? {...ld, "@id":`${url}#audiobook`} : {
      "@context":"https://schema.org", "@type":"Book", "@id":`${url}#book`, name:b.title, url,
      author:{"@type":"Person",name:b.author}, description:b.description, inLanguage:'en',
      image:b.cover ? `${origin}${fileUrl(b,b.cover)}` : undefined,
      workExample:{"@type":"AudioObject",name:`${b.title} — first-chapter sample`,description:'An AI-narrated first-chapter sample, not the complete audiobook.',duration:`PT${Math.round(b.durationMs/1000)}S`,contentUrl:abs(origin,audioUrl(b,b.chapters[0].file)),encodingFormat:'audio/mp4',isAccessibleForFree:true}
    }) + jsonLdTag(crumbs),
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


export function authorsVars(origin) {
  const authors=authorGroups();
  return { title:'Audiobooks by Author — Audiobook Project', description:'Browse free audiobook recordings and samples by author. Explore classic books, source editions, narrators and available downloads.', canonical:esc(`${origin}/library/authors`), heading:'Audiobooks by author', intro:'Explore authors with several books in the library. Each book page identifies the recording or sample available to listen to.',
    content:`<ul class="lib-author-list">${authors.map(a=>`<li><a href="${authorUrl(a.slug)}">${esc(a.name)}</a><span>${a.books.length} books</span></li>`).join('')}</ul>`,jsonld:jsonLdTag({'@context':'https://schema.org','@type':'CollectionPage',name:'Audiobooks by author',url:`${origin}/library/authors`}) };
}
export function authorVars(slug, origin, {delivery=false}={}) {
  const a=authorGroups().find(a=>a.slug===slug);if(!a)return null;
  const books=[...a.books].sort((x,y)=>x.title.localeCompare(y.title));const url=`${origin}${authorUrl(slug)}`;
  return {title:esc(`${a.name} Audiobooks — Free Recordings & Samples`),description:esc(`Explore ${books.length} books by ${a.name}, including ${books.slice(0,2).map(b=>b.shortTitle||b.title).join(' and ')}. Listen to AI-narrated recordings and samples.`),canonical:esc(url),heading:esc(`${a.name} audiobooks`),intro:esc(`Explore ${books.length} books by ${a.name}. Listen to a sample, check the narrator and source edition, and see which complete recordings are available.`),
    content:`<p><a href="/library/authors">All authors</a></p><ul class="lib-author-books">${books.map(b=>`<li><h2><a href="${bookUrl(b)}">${esc(b.title)}</a></h2><p>${esc(b.description)}</p><p>${b.ready ? `Complete audiobook · ${length(b.durationMs)} · M4B and MP3` : delivery ? 'Free sample · Full recording by email after preparation' : `First-chapter sample · ${length(b.durationMs)}`}</p></li>`).join('')}</ul>`,
    jsonld:jsonLdTag({'@context':'https://schema.org','@type':'CollectionPage',name:`${a.name} audiobooks`,url,mainEntity:{'@type':'ItemList',numberOfItems:books.length,itemListElement:books.map((b,i)=>({'@type':'ListItem',position:i+1,name:b.title,url:`${origin}${bookUrl(b)}`}))}})+jsonLdTag({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Library',item:`${origin}/library`},{'@type':'ListItem',position:2,name:'Authors',item:`${origin}/library/authors`},{'@type':'ListItem',position:3,name:a.name,item:url}]}) };
}
