import { prepareNarration } from "../src/narration-text.js";
// Narrates the public-domain library (src/catalog.js) into LIBRARY_DIR/<slug>/:
//   source.epub, cover.*, chapters/NNN.m4a, <slug>.m4b, <slug>.mp3, manifest.json
// Resumable: finished chapters are kept, so it can be stopped and run again.
//   node scripts/narrate-library.js            all books, shortest first
//   node scripts/narrate-library.js frankenstein
//   LIBRARY_DIR=/path/to/previews node scripts/narrate-library.js --preview frankenstein
import fs from "node:fs/promises";
import path from "node:path";
import { CATALOG, LIBRARY_VOICE, bookDir, epubUrl } from "../src/catalog.js";
import { parseEpub, countWords } from "../src/epub.js";
import { synthesize, chunkText, listVoices, SAMPLE_RATE } from "../src/tts.js";
import { recommendVoice } from "../src/voice-recommendation.js";
import { floatToPcm16, silence, encodeChapter, buildAudiobook } from "../src/audio.js";

const exists = (p) => fs.access(p).then(() => true, () => false);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function source(book) {
  const file = path.join(bookDir(book.slug), "source.epub");
  if (!(await exists(file))) {
    const res = await fetch(epubUrl(book));
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${epubUrl(book)}`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return parseEpub(await fs.readFile(file));
}

async function narrate(book, preview) {
  const dir = bookDir(book.slug);
  const manifestPath = path.join(dir, "manifest.json");
  let old;
  if (await exists(manifestPath)) {
    old = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (preview && old.ready) throw new Error("Use a separate directory for first-chapter previews");
    if (!preview && old.preview) throw new Error("Use a separate directory for complete audiobooks");
  }
  await fs.mkdir(path.join(dir, "chapters"), { recursive: true });
  const parsed = await source(book);
  const selected = parsed.sections.filter((s) => s.selected);
  let opening = book.openingIndex === undefined
    ? selected.find((s) => /^(?:(?:chapter|book)[\s.:]+(?:0*1|i|one)\b|(?:0*1|i):)/i.test(s.title.trim()))
    : selected.find((s) => s.index === book.openingIndex);
  if (preview && book.openingTitle && opening?.title !== book.openingTitle) throw new Error("The source edition's chapter list has changed");
  if (preview && book.openingEndIndex !== undefined) {
    const sections = selected.filter((s) => s.index >= book.openingIndex && s.index <= book.openingEndIndex);
    if (sections.length !== book.openingEndIndex - book.openingIndex + 1) throw new Error("Configured chapter sections are missing");
    opening = {
      title: book.previewTitle,
      text: sections.map((s) => `${s.title}\n\n${s.text}`).join("\n\n"),
      words: sections.reduce((sum, s) => sum + s.words, 0),
    };
  }
  const chapters = preview ? [opening || selected[0]].filter(Boolean) : selected;
  if (!chapters.length) throw new Error("No narratable chapters found");

  let cover = null;
  if (parsed.cover) {
    const ext = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp" }[parsed.cover.mediaType] || "jpg";
    cover = `cover.${ext}`;
    await fs.writeFile(path.join(dir, cover), parsed.cover.data);
  }

  let voice = old?.voice;
  if (!voice) {
    const existingAudio = (await fs.readdir(path.join(dir, "chapters"))).some((name) => name.endsWith(".m4a"));
    if (existingAudio) voice = LIBRARY_VOICE;
    else {
      const voices = await listVoices();
      const picked = book.voiceId ? voices.find((v) => v.id === book.voiceId)
        : (await recommendVoice({ ...book, language: parsed.language }, voices))?.voice;
      if (book.voiceId && !picked) throw new Error(`Unknown catalog voice: ${book.voiceId}`);
      voice = picked ? { id: picked.id, name: picked.name } : LIBRARY_VOICE;
    }
  }
  const manifest = { ready: false, voice, cover, words: chapters.reduce((n, c) => n + c.words, 0), chapters: [] };
  if (preview) manifest.preview = true;
  const save = () => fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  if (!old) await save();
  log(book.slug, `${chapters.length} chapters, ${manifest.words} words`);

  for (const [i, ch] of chapters.entries()) {
    const name = String(i + 1).padStart(3, "0");
    const file = path.join(dir, "chapters", `${name}.m4a`), pcmPath = path.join(dir, "chapters", `${name}.pcm`), lenPath = `${file}.ms`;
    if (!(await exists(file)) || !(await exists(lenPath))) {
      const started = Date.now();
      // The parser strips chapter headings from the text, so the title is announced first, as in the app.
      const parts = [];
      for (const c of [{ text: prepareNarration(ch.title, { heading: true }), paragraphEnd: true }, ...chunkText(ch.text)]) {
        parts.push(floatToPcm16(await synthesize(c.text, voice.id)), silence(c.paragraphEnd ? 0.45 : 0.12));
      }
      const pcm = Buffer.concat(parts);
      await fs.writeFile(pcmPath, pcm);
      await encodeChapter(pcmPath, file);
      await fs.rm(pcmPath, { force: true });
      const ms = Math.round((pcm.length / 2 / SAMPLE_RATE) * 1000);
      await fs.writeFile(lenPath, String(ms));
      log(book.slug, `${i + 1}/${chapters.length}`, ch.title, `${Math.round(ms / 1000)}s audio in ${Math.round((Date.now() - started) / 1000)}s`);
    }
    manifest.chapters.push({ title: ch.title, words: countWords(ch.text), file: `chapters/${name}.m4a`, durationMs: Number(await fs.readFile(lenPath, "utf8")) });
    await save();
  }

  manifest.durationMs = manifest.chapters.reduce((n, c) => n + c.durationMs, 0);
  if (preview) {
    await save();
    log(book.slug, "first chapter ready", chapters[0].title);
    return;
  }
  for (const format of ["m4b", "mp3"]) {
    await buildAudiobook({
      title: book.title, author: book.author,
      coverPath: cover && !cover.endsWith(".svg") ? path.join(dir, cover) : null,
      chapters: manifest.chapters.map((c) => ({ title: c.title, file: path.join(dir, c.file), durationMs: c.durationMs })),
      outPath: path.join(dir, `${book.slug}.${format}`), format,
    });
    manifest[format] = { file: `${book.slug}.${format}`, bytes: (await fs.stat(path.join(dir, `${book.slug}.${format}`))).size };
  }
  manifest.ready = true;
  manifest.builtAt = new Date().toISOString();
  await save();
  log(book.slug, "ready", `${Math.round(manifest.durationMs / 60000)} min`);
}

const preview = process.argv.includes("--preview");
const wanted = process.argv.slice(2).filter((arg) => arg !== "--preview");
if (preview && !process.env.LIBRARY_DIR) throw new Error("Set LIBRARY_DIR to a separate directory for previews");
const books = wanted.length ? CATALOG.filter((b) => wanted.includes(b.slug)) : CATALOG;
for (const book of books) {
  try { await narrate(book, preview); } catch (e) { log(book.slug, "failed:", e.message); process.exitCode = 1; }
}
process.exit(process.exitCode || 0);
