// EPUB parsing: metadata, cover, and chapters as plain text with clean titles.
//
// Chapters come from the table of contents, not just the spine: many EPUBs (notably
// Project Gutenberg) put several chapters in one file, addressed by #anchors.
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { parse as parseHtml } from "node-html-parser";
import path from "node:path";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, textNodeName: "#text" });

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const textOf = (v) => (v == null ? "" : typeof v === "object" ? String(v["#text"] ?? "") : String(v)).trim();
const splitHref = (href) => {
  const [file, frag] = href.split("#");
  return { file: decodeURIComponent(file), frag: frag ? decodeURIComponent(frag) : null };
};
const squash = (s) => s.replace(/\s+/g, " ").trim();

export const countWords = (text) => (text.match(/\S+/g) || []).length;

// Sections that are almost never wanted in an audiobook.
const BOILERPLATE = /project gutenberg|gutenberg\.org|^\s*(copyright|colophon|imprint|uncopyright|table of contents|contents|endnotes|footnotes|index|titlepage|title page|list of illustrations)\b/i;
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

  const manifest = new Map();
  for (const item of asArray(opf.manifest?.item)) manifest.set(item.id, item);

  const toc = await readToc(zip, opf, manifest, resolve);
  const cover = await findCover(zip, meta, manifest, resolve);

  const sections = [];
  for (const ref of asArray(opf.spine?.itemref)) {
    const item = manifest.get(ref.idref);
    if (!item || !/x?html/.test(item["media-type"] || "")) continue;
    const href = resolve(splitHref(item.href).file);
    const file = zip.file(href);
    if (!file) continue;

    const entries = toc.filter((e) => e.file === href);
    const fileTitle = entries.find((e) => !e.frag)?.title;
    const anchors = new Map(entries.filter((e) => e.frag).map((e) => [e.frag, e.title]));

    for (const part of splitDocument(await file.async("string"), anchors)) {
      const text = part.paragraphs.join("\n\n");
      if (!countWords(text)) continue;
      const prev = sections[sections.length - 1];
      // A chapter that runs across a file boundary: untitled leading text continues the previous chapter.
      if (prev && !part.anchored && !fileTitle && !part.heading && !BOILERPLATE.test(text.slice(0, 400))) {
        prev.text += `\n\n${text}`;
        continue;
      }
      // Anchored parts use their TOC entry; a file's leading part uses the file's TOC entry.
      sections.push({ title: cleanTitle(part.title || (part.anchored ? null : fileTitle) || part.heading), text });
    }
  }
  if (!sections.length) throw new Error("No readable text found in this EPUB.");

  return { title, author, language, cover, sections: finalizeSections(sections, title) };
}

// Shared by the EPUB and PDF parsers: index, count, tidy and pre-select sections.
export function finalizeSections(sections, bookTitle) {
  const lettersOnly = (s) => s.toLowerCase().replace(/[^\p{L}]/gu, "");
  for (const [index, s] of sections.entries()) {
    // Drop trailing all-caps printer's lines ("CHISWICK PRESS:—CHARLES WHITTINGHAM AND CO…"), keep short sign-offs like "R.W."
    const paras = s.text.split("\n\n");
    while (paras.length > 1 && !/\p{Ll}/u.test(paras.at(-1)) && countWords(paras.at(-1)) >= 4) paras.pop();
    s.text = paras.join("\n\n");
    s.index = index;
    s.title ||= `Section ${index + 1}`;
    s.words = countWords(s.text);
    // Pre-select real chapters; leave out tiny pages, title pages and license/front matter.
    s.selected = s.words >= 150 && lettersOnly(s.title) !== lettersOnly(bookTitle) && !BOILERPLATE.test(s.title) && !BOILERPLATE.test(s.text.slice(0, 400));
  }
  return sections.filter((s) => s.words > 0);
}

// Adobe ADEPT, Apple FairPlay, Kobo, Readium LCP and similar all leave an encryption.xml.
// Font obfuscation (IDPF and Adobe variants) also uses it but is harmless, so ignore those.
const FONT_OBFUSCATION = /idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/i;
async function isDrmProtected(encryptionXml) {
  const doc = xml.parse(encryptionXml);
  return asArray(doc.encryption?.EncryptedData).some((e) => !FONT_OBFUSCATION.test(e.EncryptionMethod?.Algorithm || ""));
}

// Ordered TOC entries: { file, frag, title }. EPUB3 nav first, then EPUB2 NCX.
async function readToc(zip, opf, manifest, resolve) {
  const entries = [];
  const add = (base, href, label) => {
    const t = squash(label || "");
    if (!href || !t) return;
    const { file, frag } = splitHref(href);
    if (frag && PAGE_LABEL.test(t)) return;
    entries.push({ file: resolve(file, base), frag, title: t });
  };
  const items = [...manifest.values()];

  const nav = items.find((i) => (i.properties || "").split(/\s+/).includes("nav"));
  if (nav && zip.file(resolve(nav.href))) {
    const navDir = path.posix.dirname(resolve(nav.href));
    const root = parseHtml(await zip.file(resolve(nav.href)).async("string"));
    const navs = root.querySelectorAll("nav");
    const tocNav = navs.find((n) => /toc/.test(n.getAttribute("epub:type") || n.getAttribute("type") || n.getAttribute("role") || "")) || navs[0];
    for (const a of tocNav?.querySelectorAll("a") || []) add(navDir, a.getAttribute("href"), a.text);
  }

  const ncxId = opf.spine?.toc;
  const ncx = (ncxId && manifest.get(ncxId)) || items.find((i) => i["media-type"] === "application/x-dtbncx+xml");
  if (!entries.length && ncx && zip.file(resolve(ncx.href))) {
    const ncxDir = path.posix.dirname(resolve(ncx.href));
    const doc = xml.parse(await zip.file(resolve(ncx.href)).async("string"));
    const walk = (points) => {
      for (const p of asArray(points)) {
        add(ncxDir, p.content?.src, textOf(p.navLabel?.text));
        walk(p.navPoint);
      }
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

// "CHAPTER XLIII." → "Chapter 43"; "I" → "Chapter 1"; "He rode a black horse. CHAPTER III." → "Chapter 3".
export function cleanTitle(raw) {
  if (!raw) return "";
  let t = squash(raw).replace(/[.:]+$/, "");
  const numbered = t.match(/\b(chapter|part|book|letter|volume|canto|act|scene)\s+([ivxlcdm]+|\d+)\b\.?\s*[:.—–-]?\s*(.*)$/i);
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
  if (t.length > 4 && t === t.toUpperCase()) t = t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return t;
}

/* ---------- Text extraction ---------- */

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "div", "pre", "dt", "dd", "tr", "figcaption", "section", "article", "aside", "header", "footer", "table", "ul", "ol", "dl", "td", "th"]);
const BLOCK_SEL = [...BLOCK_TAGS].join(",");
// Things a narrator should never read: images' captions, page numbers, footnote markers.
const SKIP_CLASS = /\b(caption|figcenter|figleft|figright|pageno|pagenum|page-?number|x-ebookmaker-pageno|noteref|footnote-?ref)\b/i;
const SKIP_TYPE = /\b(noteref|pagebreak|footnote|endnote|rearnote)\b/;

function prune(root) {
  for (const el of root.querySelectorAll("*")) {
    const tag = el.rawTagName?.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "figure" || tag === "figcaption" || tag === "sup" && /^\s*[\d*†‡§]+\s*$/.test(el.text)) { el.remove(); continue; }
    // Tables full of links are tables of contents or lists of illustrations.
    if (tag === "table" && el.querySelectorAll("a[href]").length >= 3) { el.remove(); continue; }
    if (SKIP_CLASS.test(el.getAttribute("class") || "") || SKIP_TYPE.test(el.getAttribute("epub:type") || "") || el.getAttribute("role") === "figure" || el.getAttribute("role") === "doc-noteref") { el.remove(); continue; }
    // Decorative drop caps drawn as images: <img alt="M"> + "R. BENNET".
    if (tag === "img") {
      const alt = (el.getAttribute("alt") || "").trim();
      el.replaceWith(/^\p{L}{1,2}$/u.test(alt) ? alt : "");
    }
  }
}

// Walk the document in order, emitting paragraphs and starting a new part at each TOC anchor.
export function splitDocument(html, anchors = new Map()) {
  const root = parseHtml(html, { blockTextElements: { script: false, style: false, pre: true } });
  const body = root.querySelector("body") || root;
  prune(body);

  const parts = [{ title: null, anchored: false, heading: "", paragraphs: [] }];
  let pending = null;
  const startPart = (frag) => {
    const cur = parts[parts.length - 1];
    if (cur.paragraphs.length) parts.push({ title: anchors.get(frag), anchored: true, heading: "", paragraphs: [] });
    else Object.assign(cur, { title: anchors.get(frag), anchored: true });
  };

  const walk = (node) => {
    if (node.nodeType !== 1) return;
    const id = node.getAttribute("id");
    if (id && anchors.has(id)) pending = id;
    const tag = node.rawTagName?.toLowerCase();
    const isLeafBlock = BLOCK_TAGS.has(tag) && !node.querySelector(BLOCK_SEL);
    if (!isLeafBlock) {
      for (const child of node.childNodes) walk(child);
      return;
    }
    for (const d of node.querySelectorAll("[id]")) if (anchors.has(d.getAttribute("id"))) pending = d.getAttribute("id");
    let text = squash(node.text);
    // Skip empties and bare page numbers.
    if (!text || /^[\divxlcdm]+\.?$/i.test(text)) return;
    if (pending) { startPart(pending); pending = null; }
    const part = parts[parts.length - 1];
    // The chapter's own heading becomes its title, not narrated body text.
    if (/^h[1-6]$/.test(tag) && !part.paragraphs.length) {
      part.heading = part.heading ? `${part.heading} ${text}` : text;
      return;
    }
    // Small-caps chapter openings ("IT is a truth", "MR. BENNET was") would be spelled out.
    if (!part.paragraphs.length) text = text.replace(/^(?:[“"']?[A-Z][A-Z’'.]+\s+)+/, (m) => m.toLowerCase().replace(/(^[“"']?|\s)\p{L}/gu, (c) => c.toUpperCase()));
    part.paragraphs.push(text);
  };
  for (const child of body.childNodes) walk(child);
  return parts;
}

// Single-document convenience (used by tests and tooling).
export function htmlToText(html) {
  const parts = splitDocument(html);
  return { text: parts.flatMap((p) => p.paragraphs).join("\n\n"), heading: parts[0]?.heading || "" };
}
