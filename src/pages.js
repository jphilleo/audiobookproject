// Search landing pages. Each is the same app with its own title, headline and defaults,
// so every page is a working converter first, with reference content below it.
import { CONTENT, SAMPLE_BOOK } from "./content.js";
import { shelfHtml, sampleBookHtml } from "./library-pages.js";

const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export const PAGES = {
  "/": {
    title: "Audiobook Project — Free Audiobook Maker for EPUB & PDF",
    description: "Turn any EPUB into an audiobook with natural voices. Chaptered M4B or MP3, plays in Apple Books and podcast apps. Free, no account.",
    h1: "Turn any EPUB into an audiobook.",
    lede: "Upload a book, choose a voice, and start listening in about a minute. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip,.pdf,application/pdf",
    facts: ["Natural voices, no account needed", "Keeps your chapters", "Apple Books and podcast apps"],
  },
  "/epub-to-audiobook": {
    title: "EPUB to Audiobook Converter (Free) — Audiobook Project",
    description: "Convert an EPUB to an audiobook with natural AI voices. Keeps your chapters, exports M4B or MP3. Free, no account.",
    h1: "EPUB to audiobook converter",
    lede: "Upload an EPUB, choose a voice, and get an audiobook with chapters. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip",
    facts: ["Chapters from the book's table of contents", "M4B or MP3", "No account needed"],
  },
  "/epub-to-mp3": {
    title: "Convert EPUB to MP3 (Free) — Audiobook Project",
    description: "Convert an EPUB ebook to an MP3 audiobook with natural voices. One MP3 with chapter markers that plays anywhere. Free.",
    h1: "Convert EPUB to MP3",
    lede: "Turn an ebook into an MP3 audiobook that plays on any device. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip",
    format: "mp3",
    facts: ["One MP3 with chapter markers", "Plays on any phone, player or car", "Natural voices, no account"],
  },
  "/epub-to-m4b": {
    title: "Convert EPUB to M4B Audiobook (Free) — Audiobook Project",
    description: "Convert an EPUB to a chaptered M4B audiobook with cover art for Apple Books, BookPlayer and Audiobookshelf. Free.",
    h1: "Convert EPUB to M4B",
    lede: "Make a chaptered M4B audiobook with cover art for Apple Books, BookPlayer or Audiobookshelf. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip",
    format: "m4b",
    facts: ["Chapter markers and cover art", "Remembers your place", "Natural voices, no account"],
  },
  "/pdf-to-audiobook": {
    title: "PDF to Audiobook Converter (Free) — Audiobook Project",
    description: "Convert a PDF to an audiobook with natural voices. Uses the PDF's bookmarks as chapters and skips page numbers. Free, no account.",
    h1: "PDF to audiobook converter",
    lede: "Upload a PDF, choose a voice, and listen. Works with any PDF that has selectable text. Free.",
    button: "Choose a PDF",
    accept: ".pdf,application/pdf",
    facts: ["Chapters from the PDF's bookmarks", "Skips page numbers and headers", "M4B or MP3"],
  },
  "/ebook-to-audiobook": {
    title: "Ebook to Audiobook Converter (Free) — Audiobook Project",
    description: "Turn an ebook into an audiobook with natural voices. Works with DRM-free EPUB and PDF, keeps chapters, exports M4B or MP3. Free, no account.",
    h1: "Ebook to audiobook converter",
    lede: "Turn a DRM-free ebook into an audiobook with chapters, in a natural voice. Free.",
    button: "Choose an ebook",
    accept: ".epub,application/epub+zip,.pdf,application/pdf",
    facts: ["EPUB and PDF", "Keeps your chapters", "No account needed"],
  },
  "/epub-text-to-speech": {
    title: "EPUB Text to Speech with Natural Voices (Free) — Audiobook Project",
    description: "Read any DRM-free EPUB aloud with natural neural voices, then keep it as an audiobook. Chapters, speed control, M4B or MP3. Free.",
    h1: "EPUB text to speech",
    lede: "Have any EPUB read aloud in a natural voice, and keep the audio to listen anywhere. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip",
    facts: ["Natural neural voices", "0.8× to 2× speed", "Keep the audio as a file"],
  },
  "/listen-to-epub-on-iphone": {
    title: "How to Listen to an EPUB on iPhone (Free) — Audiobook Project",
    description: "Turn an EPUB into an audiobook and listen on your iPhone in Apple Podcasts, BookPlayer or Apple Books. Works in Safari, no app to install. Free.",
    h1: "Listen to an EPUB on your iPhone",
    lede: "Upload an EPUB from your iPhone and listen in your podcast or audiobook app. Works in Safari. Free.",
    button: "Choose an EPUB",
    accept: ".epub,application/epub+zip",
    facts: ["Works in Safari", "Apple Podcasts or BookPlayer", "Remembers your place"],
  },
  "/gutenberg-audiobooks": {
    title: "Project Gutenberg Audiobooks: Any Classic, Free — Audiobook Project",
    description: "Make a free audiobook of any Project Gutenberg book in minutes. Download the EPUB, upload it, and listen with chapters. The license text is skipped automatically.",
    h1: "Audiobooks of Project Gutenberg books",
    lede: "Download any public-domain book from Project Gutenberg as an EPUB, drop it here, and listen. Free.",
    button: "Choose a Gutenberg EPUB",
    accept: ".epub,application/epub+zip",
    facts: ["Gutenberg license skipped", "Chapters kept", "Yours to share"],
  },
  "/audiobooks-for-dyslexia": {
    title: "Free Audiobooks for Dyslexia: Any EPUB or PDF — Audiobook Project",
    description: "Listen to any DRM-free book, textbook or PDF with a natural voice. Free text to speech for readers with dyslexia, with speed control and chapters.",
    h1: "Listen to any book, at your own pace",
    lede: "For readers with dyslexia, low vision or anyone who reads better by ear: turn an EPUB or PDF into audio. Free.",
    button: "Choose a book",
    accept: ".epub,application/epub+zip,.pdf,application/pdf",
    facts: ["Natural voices", "0.8× to 2× speed", "Textbooks and PDFs too"],
  },
  "/manuscript-to-audiobook": {
    title: "Hear Your Manuscript Read Aloud (Free) — Audiobook Project",
    description: "Turn your novel or manuscript into an audiobook to hear it read back. Export from Word, Google Docs, Scrivener or Vellum as EPUB or PDF. Free and private.",
    h1: "Hear your manuscript read aloud",
    lede: "Upload your draft as an EPUB or PDF and listen to it like a reader would. Private and free.",
    button: "Choose your manuscript",
    accept: ".epub,application/epub+zip,.pdf,application/pdf",
    facts: ["Private to you", "Chapters from your headings", "M4B or MP3"],
  },
};

// Info pages share the layout but have hand-written content in views/<name>.html.
export const INFO_PAGES = {
  "/about": { view: "about", title: "About — Audiobook Project", description: "Audiobook Project is a free, open-source tool that turns ebooks into audiobooks. Who runs it, why it exists, and how it's funded." },
  "/faq": { view: "faq", title: "FAQ — Audiobook Project", description: "Answers about Audiobook Project: what it costs, which files work, how long it takes, privacy, DRM and listening on your phone." },
  "/privacy": { view: "privacy", title: "Privacy — Audiobook Project", description: "What Audiobook Project stores, for how long, and what it never does with your books." },
  "/donate": { view: "donate", title: "Support Audiobook Project", description: "Audiobook Project is free and open source. Donations pay for the servers that narrate every free audiobook." },
  "/brand/explore": { view: "explore", title: "Logo and type exploration — Audiobook Project", description: "Typeface and seal options, round 6.", hidden: true },
  "/brand": { view: "brand", title: "Brand guide — Audiobook Project", description: "How Audiobook Project looks, sounds and fits together: logo, color, type, layout and voice." },
};

// The source repository (create it under this name before launch).
export const GITHUB_URL = "https://github.com/audiobookproject/audiobookproject";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const NAV = [
  ["/epub-to-audiobook", "EPUB to audiobook"],
  ["/epub-to-mp3", "EPUB to MP3"],
  ["/epub-to-m4b", "EPUB to M4B"],
  ["/pdf-to-audiobook", "PDF to audiobook"],
  ["/ebook-to-audiobook", "Ebook to audiobook"],
];
// Pages about a use rather than a format.
const USES = [
  ["/epub-text-to-speech", "EPUB text to speech"],
  ["/listen-to-epub-on-iphone", "Listen on iPhone"],
  ["/gutenberg-audiobooks", "Project Gutenberg audiobooks"],
  ["/audiobooks-for-dyslexia", "For dyslexia"],
  ["/manuscript-to-audiobook", "For writers"],
];
const TOP_NAV = [
  ["/library", "Library", "wide-only"],
  ["/faq", "FAQ", "wide-only"],
  ["/about", "About", "wide-only"],
  [GITHUB_URL, "GitHub", "wide-only"],
  ["/donate", "Donate", "btn small"],
];
// On phones the menu also carries the links that don't fit in the bar.
const MENU_EXTRA = [["/faq", "FAQ"], ["/about", "About"], [GITHUB_URL, "GitHub"]];
const META_NAV = [["/library", "Library"], ["/about", "About"], ["/faq", "FAQ"], ["/privacy", "Privacy"], ["/donate", "Donate"], ["/brand", "Brand"], [GITHUB_URL, "GitHub"]];

const links = (items, route) => items.map(([href, label, cls]) =>
  `<a href="${href}"${cls ? ` class="${cls}"` : ""}${href === route ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ");

// Fills {{header}}/{{footer}} from the partials, then every {{var}}.
export function render({ template, header, footer }, route, vars) {
  const all = {
    topnav: links(TOP_NAV, route),
    menunav: `<span class="menu-extra menu-top">${links([["/library", "Library"]], route)}</span>
      <span class="menu-label">Convert</span>\n      ${links(NAV, route)}\n      <span class="menu-label">Uses</span>\n      ${links(USES, route)}` +
      `\n      <span class="menu-extra">${links(MENU_EXTRA, route)}</span>`,
    nav: links(NAV, route),
    usesnav: links(USES, route),
    metanav: links(META_NAV, route),
    github: GITHUB_URL,
    ...vars,
  };
  const fill = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => all[k] ?? "");
  return fill(template.replace("{{header}}", header).replace("{{footer}}", footer));
}

export function appVars(route, origin) {
  const p = PAGES[route];
  return {
    title: esc(p.title),
    description: esc(p.description),
    canonical: esc(`${origin}${route}`),
    h1: esc(p.h1),
    lede: esc(p.lede),
    button: esc(p.button),
    accept: esc(p.accept),
    format: esc(p.format || ""),
    facts: p.facts.map((f) => `<li>${CHECK}${esc(f)}</li>`).join("\n        "),
    origin: esc(origin),
    seo: seoHtml(route),
    jsonld: jsonLd(route, origin),
  };
}

const SHELVES = {
  "/": { heading: "No book handy? Start with a classic", intro: "Free audiobooks of public-domain books, made with the same voices." },
  "/gutenberg-audiobooks": { heading: "In the library", intro: "Free to play or download, with more on the way.", more: "All books", listen: true },
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The reference content below the converter. Content strings are trusted, hand-written HTML.
function seoHtml(route) {
  const c = CONTENT[route];
  if (!c) return "";
  const steps = `<h2 id="how-to">${esc(c.steps.h2)}</h2>
      <ol class="steps">
        ${c.steps.items.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join("\n        ")}
      </ol>`;
  // The library shelf sits right after the steps on the pages where people most often have no book handy.
  const shelf = SHELVES[route] ? `\n      ${shelfHtml(SHELVES[route])}` : "";
  // What helps someone decide stays open; reference material and questions fold into one list,
  // still in the page for search engines.
  const sections = c.sections.filter((s) => s.visible).map((s) => `      <h2 id="${slug(s.h2)}">${esc(s.h2)}</h2>${s.html}`).join("\n");
  const folded = [
    ...c.sections.filter((s) => !s.visible).map((s) => `<details id="${slug(s.h2)}"><summary><h3>${esc(s.h2)}</h3></summary><div class="qa-body">${s.html}</div></details>`),
    ...c.faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="qa-body"><p>${esc(a)}</p></div></details>`),
  ];
  const faqs = `<h2 id="questions">Good to know</h2>
      <div class="qa">
        ${folded.join("\n        ")}
      </div>`;
  const html = `<div class="seo">\n      ${steps}${shelf}\n${sections}\n      ${faqs}\n    </div>`;
  return html.replace("<!--sample-book-->", () => sampleBookHtml() ?? SAMPLE_BOOK);
}

// Structured data: the app itself, its questions, and where the page sits in the site.
function jsonLd(route, origin) {
  const p = PAGES[route], c = CONTENT[route];
  const url = `${origin}${route}`;
  const graph = [{
    "@type": "WebApplication",
    name: "Audiobook Project",
    url,
    description: p.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (runs in the browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  }];
  if (route === "/") graph.push({ "@type": "Organization", name: "Audiobook Project", url: origin, logo: `${origin}/brand/icon-512.png`, sameAs: [GITHUB_URL] });
  else graph.push({ "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Audiobook Project", item: `${origin}/` },
    { "@type": "ListItem", position: 2, name: p.h1, item: url },
  ] });
  if (c) graph.push({ "@type": "FAQPage", mainEntity: c.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  // Escape "<" so the JSON can never close the script tag.
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
}

export function infoVars(route, origin) {
  const p = INFO_PAGES[route];
  return { title: esc(p.title), description: esc(p.description), canonical: esc(`${origin}${route}`) };
}
