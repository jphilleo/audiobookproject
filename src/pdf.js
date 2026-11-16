// PDF parsing: text from each page with headers, footers and page numbers removed,
// split into chapters by the PDF's bookmarks, by "Chapter N" headings, or by page ranges.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cleanTitle, countWords, finalizeSections } from "./epub.js";

const PAGE_NUMBER = /^\s*(page\s*)?[\divxlc]+(\s*(of|\/)\s*\d+)?\s*$/i;
const HEADING = /^(chapter|part|book|section|letter)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b.{0,60}$/i;
const PAGES_PER_SECTION = 10;

export async function parsePdf(buffer, filename = "") {
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err?.name === "PasswordException") throw new Error("This PDF is password-protected, so it can't be read.");
    throw new Error("This file isn't a valid PDF.");
  }

  const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
  const title = (info?.Title || "").trim() || filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled";
  const author = (info?.Author || "").trim();

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push(await pageLines(await doc.getPage(i)));
  stripRunningHeaders(pages);

  const totalWords = pages.reduce((n, p) => n + countWords(p.map((l) => l.text).join(" ")), 0);
  if (totalWords < 50) throw new Error("This PDF has no selectable text (it's probably a scan), so it can't be read aloud.");

  // Every word as written in the document, to decide whether a line-end hyphen is real ("half-clothed") or soft.
  const vocab = new Set(pages.flatMap((p) => p.flatMap((l) => l.text.toLowerCase().match(/[\p{L}-]+/gu) || [])));

  const starts = (await outlineStarts(doc)) || headingStarts(pages) || pageRangeStarts(pages.length);
  const sections = [];
  if (starts[0].page > 0) starts.unshift({ page: 0, line: 0, title: "Front matter" });
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s], to = starts[s + 1];
    const lines = [];
    for (let p = from.page; p < (to ? to.page + 1 : pages.length); p++) {
      const begin = p === from.page ? from.line : 0;
      const end = to && p === to.page ? to.line : pages[p].length;
      lines.push(...pages[p].slice(begin, end));
    }
    sections.push({ title: cleanTitle(from.title), text: toParagraphs(lines, from.skipHeading, vocab) });
  }

  await task.destroy();
  return { title, author, language: "en", cover: null, sections: finalizeSections(sections, title) };
}

// Lines on a page: { text, x, y, para (starts a paragraph) }.
async function pageLines(page) {
  const { items } = await page.getTextContent();
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!("str" in it)) continue;
    const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10;
    if (!cur || Math.abs(y - cur.y) > h * 0.5) {
      if (cur?.text.trim()) lines.push(cur);
      cur = { text: "", x, y, h };
    }
    cur.text += it.str;
    if (it.hasEOL) { if (cur.text.trim()) lines.push(cur); cur = null; }
  }
  if (cur?.text.trim()) lines.push(cur);

  for (const l of lines) l.text = l.text.replace(/\s+/g, " ").trim();
  // Paragraph starts: a bigger-than-usual vertical gap, or an indented first line.
  const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] || 12;
  const minX = Math.min(...lines.map((l) => l.x));
  lines.forEach((l, i) => {
    const gap = i ? lines[i - 1].y - l.y : Infinity;
    // A page's first line continues the previous page's paragraph unless it's indented.
    l.para = i === 0 ? l.x > minX + 6 : gap > medianGap * 1.4 || gap < 0 || (l.x > minX + 6 && /[.!?:"”’)]$/.test(lines[i - 1].text));
  });
  return lines.filter((l) => !PAGE_NUMBER.test(l.text));
}

// Remove running headers/footers: first/last lines that repeat across many pages (digits ignored).
function stripRunningHeaders(pages) {
  if (pages.length < 4) return;
  const key = (t) => t.toLowerCase().replace(/\d+/g, "#");
  const counts = new Map();
  for (const p of pages) for (const l of [...p.slice(0, 2), ...p.slice(-2)]) counts.set(key(l.text), (counts.get(key(l.text)) || 0) + 1);
  const threshold = Math.max(3, pages.length * 0.3);
  for (const p of pages) {
    for (const edge of [0, 1, -1, -2]) {
      const i = edge < 0 ? p.length + edge : edge;
      if (p[i] && counts.get(key(p[i].text)) >= threshold) p[i].drop = true;
    }
    for (let i = p.length - 1; i >= 0; i--) if (p[i].drop) p.splice(i, 1);
  }
}

// Chapter starts from the PDF's bookmarks (outline). Uses the top level, or the level below a single root.
async function outlineStarts(doc) {
  let outline = await doc.getOutline().catch(() => null);
  if (!outline?.length) return null;
  if (outline.length === 1 && outline[0].items?.length) outline = outline[0].items;
  const starts = [];
  for (const item of outline) {
    try {
      const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      if (!dest?.[0]) continue;
      const page = typeof dest[0] === "number" ? dest[0] : await doc.getPageIndex(dest[0]);
      starts.push({ page, line: 0, title: item.title, skipHeading: true });
    } catch {}
  }
  starts.sort((a, b) => a.page - b.page);
  // Several bookmarks on one page: keep the first.
  const unique = starts.filter((s, i) => i === 0 || s.page !== starts[i - 1].page);
  return unique.length >= 2 ? unique : null;
}

// Chapter starts from "Chapter N" style headings at the start of a paragraph.
function headingStarts(pages) {
  const starts = [];
  pages.forEach((lines, page) => lines.forEach((l, line) => {
    if ((l.para || line === 0) && HEADING.test(l.text)) starts.push({ page, line, title: l.text, skipHeading: true });
  }));
  const first = starts[0];
  return starts.length >= 2 || (first?.page === 0 && first.line === 0) ? starts : null;
}

function pageRangeStarts(n) {
  const starts = [];
  for (let p = 0; p < n; p += PAGES_PER_SECTION) {
    const last = Math.min(n, p + PAGES_PER_SECTION);
    starts.push({ page: p, line: 0, title: last === p + 1 ? `Page ${last}` : `Pages ${p + 1}–${last}` });
  }
  return starts;
}

// Join lines into paragraphs, repairing words hyphenated across line breaks.
function toParagraphs(lines, skipHeading, vocab) {
  const paras = [];
  let buf = "";
  lines.forEach((l, i) => {
    // The chapter's own heading is announced from its title, so don't read it twice.
    if (skipHeading && i === 0 && (HEADING.test(l.text) || l.text.length < 60)) return;
    // A lowercase start after an unfinished line ("be-" / "sides") is never a new paragraph.
    const continues = /[\p{L},;-]$/u.test(buf) && /^\p{Ll}/u.test(l.text);
    if (l.para && buf && !continues) { paras.push(buf); buf = ""; }
    if (!buf) buf = l.text;
    else if (/\p{Ll}-$/u.test(buf) && /^\p{Ll}/u.test(l.text)) {
      const left = buf.match(/([\p{L}-]+)-$/u)[1].toLowerCase(), right = l.text.match(/^[\p{L}-]+/u)[0].toLowerCase();
      // Keep the hyphen if the document writes this word with one and never without.
      const keep = vocab.has(`${left}-${right}`) || (!vocab.has(left + right) && /-/.test(left));
      buf = keep ? buf + l.text : buf.slice(0, -1) + l.text;
    } else buf += ` ${l.text}`;
  });
  if (buf) paras.push(buf);
  return paras.join("\n\n");
}
