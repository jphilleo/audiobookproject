// EPUB parsing: metadata, cover, and chapters as plain text with clean titles.
//
// Chapters come from the table of contents, not just the spine: many EPUBs (notably
// Project Gutenberg) put several chapters in one file, addressed by #anchors.
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { parse as parseHtml } from "node-html-parser";
import path from "node:path";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, textNodeName: "#text", htmlEntities: true });

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const textOf = (v) => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v)).trim();
const splitHref = (href) => {
  const [file, frag] = href.split("#");
  return { file: decodeURIComponent(file), frag: frag ? decodeURIComponent(frag) : null };
};
const squash = (s) => s.replace(/\s+/g, " ").trim();

export const countWords = (text) => (text.match(/\S+/g) || []).length;

// Sections that are almost never wanted in an audiobook.
const BOILERPLATE = /project gutenberg|gutenberg\.org|^\s*(copyright|colophon|imprint|uncopyright|table of contents|contents|endnotes|footnotes|index|titlepage|title page|cover page|list of illustrations|about the author|acknowledge?ments|also (available )?by|other (books|titles) by|praise for|reading group guide|discussion questions)\b/i;
// Publishers often style a paragraph as the chapter heading instead of using <h1>: class="h1", "ct", "chapter-title"…
const HEADING_CLASS = /^(h[1-6]|ct|cn|ctn|chaptertitle|chapter[-_]title|chapterhead|chapter[-_]head|chaptitle|chap[-_]title)$/i;
// A section this long with headings inside it is several chapters the table of contents doesn't list.
const LONG_SECTION_WORDS = 12000;
// Top-level TOC entries that group chapters: books, parts, volumes, acts.
const GROUP_TITLE = /^\s*(book|part|volume|act|tome|livre|acte|buch|teil|libro)\b/i;
// TOC entries that are page markers like "{vii}", "[12]" or "Page 4".
const PAGE_LABEL = /^([[{(]\s*[\divxlcdm]+\s*[\]})]|(page|p\.)\s*\d+)$/i;

export async function parseEpub(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("This file isn't a valid EPUB.");
  }
  const read = async (p) => {
    const file = zip.file(p);
    if (!file) throw new Error("This file isn't a valid EPUB.");
    return file.async("string");
  };

  const drm =zip.file("META-INF/sinf.xml") || zip.file("META-INF/rights.xml") ||
    (zip.file("META-INF/encryption.xml") && (await isDrmProtected(await read("META-INF/encryption.xml"))));
  if (drm) throw Object.assign(new Error("This book is DRM-protected, so it can't be converted. Try a DRM-free copy."), { code: "DRM" });

  const container = xml.parse(await read("META-INF/container.xml"));
  const opfPath = asArray(container.container?.rootfiles?.rootfile)[0]?.["full-path"];
  if (!opfPath) throw new Error("This file isn't a valid EPUB.");
  const opfDir = path.posix.dirname(opfPath);
  const resolve = (href, base = opfDir) => path.posix.normalize(path.posix.join(base, href));

  const opf = xml.parse(await read(opfPath)).package;
  const meta = opf.metadata || {};
  const title = squash(textOf(asArray(meta.title)[0])) || "Untitled";
  const author = asArray(meta.creator).map(textOf).filter(Boolean).join(", ");
  const language = textOf(asArray(meta.language)[0]) || "en";
  const description = squash(textOf(asArray(meta.description)[0]).replace(/<[^>]*>/g, " ")).slice(0, 600);

  const manifest = new Map();
  for (const item of asArray(opf.manifest?.item)) manifest.set(item.id, item);

  const toc = await readToc(zip, opf, manifest, resolve);
  const cover = await findCover(zip, meta, manifest, resolve);

  const sections = [];
  const groups = { current: null }; // the latest heading-only TOC entry, shared across files
  const chapterCount = { n: 0 }; // numbers chapters found inside long sections, across the book
  let carried = null; // a chapter heading waiting for its text in the next file
  for (const ref of asArray(opf.spine?.itemref)) {
    const item = manifest.get(ref.idref);
    if (!item || !/x?html/.test(item["media-type"] || "")) continue;
    const href = resolve(splitHref(item.href).file);
    const file = zip.file(href);
    if (!file) throw new Error(`Missing required EPUB section: ${href}`);

    const entries = toc.filter((e) => e.file === href);
    const fileEntry = entries.find((e) => !e.frag);
    const fileTitle = fileEntry?.title;
    const anchors = new Map(entries.filter((e) => e.frag).map((e) => [e.frag, e]));

    for (const part of foldInnerParts(splitDocument(await file.async("string"), anchors, groups), fileEntry, chapterCount)) {
      const text = part.paragraphs.join("\n\n");
      // A chapter heading left at the very end of a file: its text starts the next file.
      if (carried && !part.anchored && !part.heading && !fileTitle) Object.assign(part, { heading: carried.heading, group: carried.group });
      carried = null;
      if (part.inner && !countWords(text)) { carried = part; continue; }
      // A heading with no text of its own ("BOOK IV. CHILDREN OF ADAM") groups the entries after it.
      if (!countWords(text)) {
        if (part.entry && !part.entry.parent && !BOILERPLATE.test(part.entry.title)) groups.current = part.entry;
        continue;
      }
      // A group-level entry with its own text ("BOOK II", one long poem) ends the previous group.
      if (part.entry && !part.entry.parent && GROUP_TITLE.test(part.entry.title)) groups.current = part.group = null;
      const prev = sections[sections.length - 1];
      // A chapter that runs across a file boundary: untitled leading text continues the previous chapter.
      if (prev && !part.anchored && !fileTitle && !part.heading && !BOILERPLATE.test(text.slice(0, 400))) {
        prev.text += `\n\n${text}`;
        continue;
      }
      // Anchored parts use their TOC entry; a file's leading part uses the file's TOC entry.
      const entry = part.entry || (part.anchored ? null : fileEntry);
      sections.push({ title: cleanTitle(entry?.title || part.heading), rawTitle: entry?.title, parent: (entry?.parent || part.group)?.title, text });
    }
  }
  if (!sections.length) throw new Error("No readable text found in this EPUB.");

  return { title, author, language, description, cover, sections: finalizeSections(sections, title) };
}

// Headings inside a TOC section (inner parts) become chapters only when the section is clearly
// several chapters: very long, with at least two such headings. Otherwise they go back into the
// text, so a chapter's own subheadings don't chop it up.
function foldInnerParts(parts, fileEntry, chapterCount) {
  const out = [];
  const words = (p) => countWords(p.paragraphs.join(" ")) + countWords(p.heading || "");
  for (let i = 0; i < parts.length; ) {
    const lead = parts[i];
    let j = i + 1;
    while (j < parts.length && parts[j].inner) j++;
    const inner = parts.slice(i + 1, j);
    const total = words(lead) + inner.reduce((n, p) => n + words(p), 0);
    if (inner.length >= 2 && total > LONG_SECTION_WORDS) {
      // Unnumbered headings ("A thete visits a mod parlor; …") get a chapter number in front.
      const number = (heading) => (/^((chapter|book|part)\b|ch\.|\d+\b|[ivxlcdm]+[.:]\s)/i.test(heading) ? heading : `${++chapterCount.n}. ${heading}`);
      const own = lead.entry || (lead.anchored ? null : fileEntry);
      const group = own || lead.group;
      // A file that opens straight into one of these chapters, with no TOC entry of its own.
      out.push(lead.heading && !own ? { ...lead, heading: number(lead.heading) } : lead);
      for (const p of inner) out.push({ ...p, group, heading: number(p.heading) });
    } else {
      for (const p of inner) lead.paragraphs.push(p.heading, ...p.paragraphs);
      out.push(lead);
    }
    i = j;
  }
  return out;
}

// Shared by the EPUB and PDF parsers: index, count, tidy and pre-select sections.
export function finalizeSections(sections, bookTitle) {
  const lettersOnly = (s) => s.toLowerCase().replace(/[^\p{L}]/gu, "");
  for (const s of sections) {
    s.words = countWords(s.text);
  }
  sections = sections.filter((s) => s.words > 0);

  // Titles that only make sense with their parent: a story's bare "I.", "II." parts, or "Scene 1"
  // in every act. Prefix the parent: "A Scandal in Bohemia · Part 1", "Act 2 · Scene 1: …".
  const count = sections.reduce((m, s) => m.set(s.title, (m.get(s.title) || 0) + 1), new Map());
  const label = (s) => s.title.match(/^(\p{L}+ \d+)\b/u)?.[1];
  const labels = sections.reduce((m, s) => (label(s) ? m.set(label(s), (m.get(label(s)) || 0) + 1) : m), new Map());
  // Numbering that restarts (Scene 1 in every act) gets context on every numbered section,
  // so Act 4's unique "Scene 7" reads like its siblings.
  const restarts = [...labels.values()].some((n) => n > 1);
  // Repeated titles get context only when every copy has some; otherwise the list reads unevenly.
  const everyHasParent = sections.reduce((m, s) => m.set(s.title, (m.get(s.title) ?? true) && !!s.parent), new Map());
  for (const s of sections) {
    if (!s.parent) continue;
    const context = cleanTitle(s.parent).replace(/^([ivxlcdm]+|\d+)\.\s+(\p{L})/iu, (m, n, c) => c.toUpperCase());
    const bare = s.rawTitle && toNumber(s.rawTitle.replace(/[.:]+$/, "").trim());
    if (!s.title) s.title = context;
    // Bare numbers under the book's own half-title ("Dracula" › "I") are just chapters.
    else if (bare) s.title = lettersOnly(context) === lettersOnly(bookTitle) ? `Chapter ${bare}` : `${context} · Part ${bare}`;
    else if ((count.get(s.title) > 1 && everyHasParent.get(s.title)) || (restarts && label(s))) s.title = `${context} · ${s.title}`;
  }

  // Pre-select the book itself; leave out boilerplate, title pages and the tiny pages around the
  // text. Short pieces between real chapters (poems, letters, interludes) stay in, and a book made
  // of short pieces (a poetry collection) uses a lower bar.
  const median = [...sections].map((s) => s.words).sort((a, b) => a - b)[sections.length >> 1] || 0;
  const minWords = median < 400 ? 30 : 150;
  const boiler = (s) => /^(?:copyright(?: page)?|colophon|imprint|uncopyright|table of contents|contents|endnotes|footnotes|index|title ?page|cover(?: page)?|list of illustrations|about the author|acknowledgements?|acknowledgments?)[:.\s]*$/i.test(s.title)
    || /^\s*\*{3}\s*(?:START|END) OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.test(s.text);
  const titlePage = (s) => s.words < 150 && lettersOnly(s.title) === lettersOnly(bookTitle);
  const real = sections.map((s) => s.words >= 150 && !boiler(s) && !titlePage(s));
  const first = real.indexOf(true), last = real.lastIndexOf(true);
  for (const [index, s] of sections.entries()) {
    s.index = index;
    s.title ||= `Section ${index + 1}`;
    // A short part opener ("Part the First" and its epigraph) is kept so you hear where the part starts.
    const opener = GROUP_TITLE.test(s.title) && index < last;
    s.selected = !boiler(s) && !titlePage(s) && (s.words >= minWords || /^(?:epilogue|afterword|prologue|chapter|stave|canto|scene|act|part|book)\b/i.test(s.title) || opener || (first >= 0 && index > first));
    delete s.rawTitle;
    delete s.parent;
  }
  return sections;
}

// Adobe ADEPT, Apple FairPlay, Kobo, Readium LCP and similar all leave an encryption.xml.
// Font obfuscation (IDPF and Adobe variants) also uses it but is harmless, so ignore those.
const FONT_OBFUSCATION = /idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/i;
async function isDrmProtected(encryptionXml) {
  const doc = xml.parse(encryptionXml);
  return asArray(doc.encryption?.EncryptedData).some((e) => !FONT_OBFUSCATION.test(e.EncryptionMethod?.Algorithm || ""));
}

// Ordered TOC entries: { file, frag, title, parent, children }. EPUB3 nav first, then EPUB2 NCX.
// The nesting matters: "ACT I" › "SCENE I" needs the act to tell its scenes apart.
async function readToc(zip, opf, manifest, resolve) {
  const entries = [];
  const add = (base, href, label, parent = null) => {
    const t = squash(label || "");
    if (!href || !t) return null;
    const { file, frag } = splitHref(href);
    if (frag && PAGE_LABEL.test(t)) return null;
    const entry = { file: resolve(file, base), frag, title: t, parent, children: 0 };
    if (parent) parent.children++;
    entries.push(entry);
    return entry;
  };
  const items = [...manifest.values()];

  const nav = items.find((i) => (i.properties || "").split(/\s+/).includes("nav"));
  if (nav && zip.file(resolve(nav.href))) {
    const navDir = path.posix.dirname(resolve(nav.href));
    const root = parseHtml(await zip.file(resolve(nav.href)).async("string"));
    const navs = root.querySelectorAll("nav");
    const tocNav = navs.find((n) => /toc/.test(n.getAttribute("epub:type") || n.getAttribute("type") || n.getAttribute("role") || "")) || navs[0];
    const byLink = new Map();
    for (const a of tocNav?.querySelectorAll("a") || []) {
      // <li><a/>…<ol><li><a/></li></ol></li>: the parent is the link heading the enclosing <li>.
      let li = a.parentNode;
      while (li && li.rawTagName?.toLowerCase() !== "li") li = li.parentNode;
      let up = li?.parentNode;
      while (up && up.rawTagName?.toLowerCase() !== "li") up = up.parentNode;
      const parentLink = up?.childNodes.find((c) => c.rawTagName?.toLowerCase() === "a") || up?.querySelector("a");
      byLink.set(a, add(navDir, a.getAttribute("href"), a.text, (parentLink && byLink.get(parentLink)) || null));
    }
  }

  const ncxId = opf.spine?.toc;
  const ncx = (ncxId && manifest.get(ncxId)) || items.find((i) => i["media-type"] === "application/x-dtbncx+xml");
  if (!entries.length && ncx && zip.file(resolve(ncx.href))) {
    const ncxDir = path.posix.dirname(resolve(ncx.href));
    const doc = xml.parse(await zip.file(resolve(ncx.href)).async("string"));
    const walk = (points, parent = null) => {
      for (const p of asArray(points)) walk(p.navPoint, add(ncxDir, p.content?.src, textOf(p.navLabel?.text), parent) || parent);
    };
    walk(doc.ncx?.navMap?.navPoint);
  }
  return entries;
}

async function findCover(zip, meta, manifest, resolve) {
  const items = [...manifest.values()];
  let item = items.find((i) => (i.properties || "").split(/\s+/).includes("cover-image"));
  if (!item) {
    const coverMeta = asArray(meta.meta).find((m) => m.name === "cover");
    if (coverMeta) item = manifest.get(coverMeta.content);
  }
  if (!item || !/^image\//.test(item["media-type"] || "")) return null;
  const file = zip.file(resolve(item.href));
  if (!file) return null;
  return { mediaType: item["media-type"], data: await file.async("nodebuffer") };
}

/* ---------- Titles ---------- */

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
function romanToInt(s) {
  if (!/^[ivxlcdm]+$/i.test(s)) return null;
  let n = 0;
  const v = s.toLowerCase().split("").map((c) => ROMAN[c]);
  for (let i = 0; i < v.length; i++) n += v[i] < (v[i + 1] || 0) ? -v[i] : v[i];
  return n > 0 && n < 400 ? n : null;
}
const toNumber = (s) => (/^\d+$/.test(s) ? Number(s) : romanToInt(s));
const capitalize = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "the", "to", "with"]);
// "II. THE RED-HEADED LEAGUE" → "II. The Red-Headed League"; "A CASE OF IDENTITY" → "A Case of Identity".
function titleCase(s) {
  const words = s.toLowerCase().split(" ");
  return words.map((w, i) => {
    if (i === 0 && /^[ivxlcdm]+[.:]?$/.test(w) && romanToInt(w.replace(/[.:]$/, ""))) return w.toUpperCase();
    // Lowercase "of", "the"… except at the start or after a numeral or full stop: "II. The League".
    if (i > 0 && SMALL_WORDS.has(w) && !/[.:—!?]$/.test(words[i - 1])) return w;
    return w.replace(/(^|[-‘“"(])(\p{L})/gu, (m, pre, c) => pre + c.toUpperCase());
  }).join(" ");
}

// "CHAPTER XLIII." → "Chapter 43"; "I" → "Chapter 1"; "He rode a black horse. CHAPTER III." → "Chapter 3".
export function cleanTitle(raw) {
  if (!raw) return "";
  let t = squash(raw).replace(/[.:]+$/, "");
  const numbered = t.match(/(?<![\p{L}])(chapter|part|book|letter|volume|canto|act|scene|chapitre|livre|tome|acte|scène|kapitel|teil|buch|akt|capítulo|capitolo|libro)\s+([ivxlcdm]+|\d+)\b\.?\s*[:.—–-]?\s*(.*)$/iu);
  if (numbered) {
    const n = toNumber(numbered[2]);
    if (n) {
      const rest = numbered[3].replace(/[.:]+$/, "").trim();
      t = `${capitalize(numbered[1])} ${n}${rest ? `: ${rest}` : ""}`;
    }
  } else {
    const n = toNumber(t);
    if (n) t = `Chapter ${n}`;
  }
  const letters = t.match(/\p{L}/gu) || [];
  if (t.length > 4 && letters.filter((c) => c !== c.toLowerCase()).length > letters.length * 0.7) t = titleCase(t);
  // A shouted word in an otherwise normal title: "FEDERALIST No. 1" → "Federalist No. 1".
  else t = t.replace(/(?<![\p{L}])\p{Lu}{5,}(?![\p{L}])/gu, (w) => (romanToInt(w) ? w : capitalize(w)));
  return t;
}

/* ---------- Text extraction ---------- */

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "div", "pre", "dt", "dd", "tr", "figcaption", "section", "article", "aside", "header", "footer", "table", "ul", "ol", "dl", "td", "th"]);
const BLOCK_SEL = [...BLOCK_TAGS].join(",");
// Things a narrator should never read: images' captions, page numbers, footnote markers.
const SKIP_CLASS = /\b(caption|figcenter|figleft|figright|pageno|pagenum|page-?number|x-ebookmaker-pageno|noteref|footnote-?ref|footnotes?|endnotes?|pg-boilerplate)\b/i;
const SKIP_TYPE = /\b(noteref|pagebreak|footnote|endnote|rearnote)\b/;

function prune(root) {
  for (const el of root.querySelectorAll("*")) {
    const tag = el.rawTagName?.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "figcaption") { el.remove(); continue; }
    // Only explicitly marked navigation is disposable; linked data tables are content.
    if (/\b(?:toc|landmarks|page-list)\b/.test(el.getAttribute("epub:type") || "") || el.getAttribute("role") === "doc-toc") { el.remove(); continue; }
    if (SKIP_CLASS.test(el.getAttribute("class") || "") || SKIP_TYPE.test(el.getAttribute("epub:type") || "") || el.getAttribute("role") === "doc-noteref") { el.remove(); continue; }
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true" || tag === "del") { el.remove(); continue; }
    if (tag === "sup" && /^\d+$/.test(el.text.trim()) && !el.querySelector('a')) {
      const n = el.text.trim();
      el.replaceWith(n === "2" ? " squared " : n === "3" ? " cubed " : ` to the power of ${n} `);
      continue;
    }
    // Project Gutenberg's header, footer and license: never narrated, never a chapter.
    if (/^pg-(header|footer)$/.test(el.getAttribute("id") || "")) { el.remove(); continue; }
    // Decorative drop caps drawn as images: <img alt="M"> + "R. BENNET".
    if (tag === "img") {
      const alt = (el.getAttribute("alt") || "").trim();
      el.replaceWith(/^\p{L}{1,2}$/u.test(alt) ? alt : "");
    }
  }
}

// Walk the document in order, emitting paragraphs and starting a new part at each TOC anchor.
// XHTML allows <pre/> or <a id="x"/>; an HTML parser reads those as opening tags, and an open
// <pre> swallows the rest of the file as raw text. Close them explicitly.
const VOID_TAGS = "area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr";
const SELF_CLOSING = new RegExp(`<(?!(?:${VOID_TAGS})\\b)([a-zA-Z][\\w:-]*)(\\s[^<>]*?)?\\s*/>`, "g");

export function splitDocument(html, anchors = new Map(), groups = { current: null }) {
  html = html.replace(SELF_CLOSING, "<$1$2></$1>");
  const root = parseHtml(html, { blockTextElements: { script: false, style: false, pre: true } });
  const body = root.querySelector("body") || root;
  prune(body);

  const parts = [{ entry: null, group: groups.current, anchored: false, heading: "", paragraphs: [] }];
  let pending = null;
  const startPart = (frag) => {
    const cur = parts[parts.length - 1];
    const entry = anchors.get(frag);
    if (cur.paragraphs.length) return parts.push({ entry, group: groups.current, anchored: true, heading: "", paragraphs: [] });
    // An entry whose only child starts right below it (a paper and its dateline) keeps its own
    // title; a heading with several children (an act, a book) hands over to the first of them.
    if (cur.entry && entry?.parent === cur.entry && cur.entry.children === 1) return;
    // A heading-only entry in a flat TOC becomes the group for the entries after it.
    if (cur.entry && !entry?.parent && !BOILERPLATE.test(cur.entry.title)) groups.current = cur.entry;
    Object.assign(cur, { entry, group: groups.current, anchored: true });
  };

  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const id = node.getAttribute("id");
    if (id && anchors.has(id)) pending = id;
    const tag = node.rawTagName?.toLowerCase();
    const isLeafBlock = BLOCK_TAGS.has(tag) && !node.querySelector(BLOCK_SEL);
    if (!isLeafBlock) {
      // Keep direct text and inline runs between nested blocks, in source order.
      let inline = "";
      const flushInline = () => {
        if (inline.trim()) walk(parseHtml(`<p>${inline}</p>`).firstChild);
        inline = "";
      };
      for (const child of node.childNodes) {
        const childTag = child.rawTagName?.toLowerCase();
        if (child.nodeType === 1 && (BLOCK_TAGS.has(childTag) || child.querySelector(BLOCK_SEL))) {
          flushInline(); walk(child);
        } else inline += child.toString();
      }
      flushInline();
      return;
    }
    for (const d of node.querySelectorAll("[id]")) if (anchors.has(d.getAttribute("id"))) pending = d.getAttribute("id");
    let text = squash(node.text);
    // Skip empties and bare page numbers.
    if (!text) return;
    if (pending) { startPart(pending); pending = null; }
    const part = parts[parts.length - 1];
    // The chapter's own heading becomes its title, not narrated body text.
    const isHeading = /^h[1-6]$/.test(tag) || (node.getAttribute("class") || "").split(/\s+/).some((c) => HEADING_CLASS.test(c));
    if (isHeading && !part.paragraphs.length) {
      part.heading = part.heading ? `${part.heading} ${text}` : text;
      return;
    }
    // A heading further down may start a chapter the TOC doesn't list (see foldInnerParts).
    if (isHeading) {
      parts.push({ entry: null, group: groups.current, anchored: true, inner: true, heading: text, paragraphs: [] });
      return;
    }
    // Footnote markers stuck to a word ("Pangloss[1]") would be read out as numbers.
    // Literal bracketed numbers are content unless markup identifies a note.
    part.paragraphs.push(text);
  };
  walk(body);
  return parts;
}

// Single-document convenience (used by tests and tooling).
export function htmlToText(html) {
  const parts = splitDocument(html);
  return { text: parts.flatMap((p) => p.paragraphs).join("\n\n"), heading: parts[0]?.heading || "" };
}
