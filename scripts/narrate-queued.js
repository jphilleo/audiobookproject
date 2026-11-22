import { narrationFingerprint } from "../src/narration-version.js";
// Narrates the public-domain library (src/catalog.js) into LIBRARY_DIR/<slug>/:
//   source.epub, cover.*, chapters/NNN.m4a, <slug>.m4b, <slug>.mp3, manifest.json
// Resumable: finished chapters are kept, so it can be stopped and run again.
//   node scripts/narrate-library.js            all books, shortest first
//   node scripts/narrate-library.js frankenstein
//   LIBRARY_DIR=/path/to/previews node scripts/narrate-library.js --preview frankenstein
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { CATALOG, LIBRARY_VOICE, bookDir, epubUrl } from "../src/catalog.js";
import { parseEpub, countWords } from "../src/epub.js";
import { synthesize, chapterChunks, listVoices, planNarration, closeTts, SAMPLE_RATE } from "../src/tts.js";
import { recommendVoice } from "../src/voice-recommendation.js";
import { floatToPcm16, silence, encodeChapter, buildAudiobook } from "../src/audio.js";

// Scheduler-only entry point. Audio operations match narrate-library.js; cooperative
// yields happen only after a durable chunk checkpoint. Exit 75 is not a failure.
let yielding = false;
process.on('SIGTERM', () => { yielding = true; });
process.on('SIGINT', () => { yielding = true; });
function checkpoint() { if (yielding) { const e = new Error('Yielded at checkpoint'); e.code = 'YIELD'; throw e; } }
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
  // Edition-specific pronunciation, not a global guess about ambiguous St.
  if(book.slug === "a-christmas-carol") for(const section of selected) section.text=section.text.replace(/\bSt\. Paul’s Churchyard/g,"Saint Paul’s Churchyard");
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
  const save = async () => { await fs.writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2)); await fs.rename(`${manifestPath}.tmp`,manifestPath); };
  await save();
  log(book.slug, `${chapters.length} chapters, ${manifest.words} words`);

  for (const [i, ch] of chapters.entries()) {
    checkpoint();
    const name = String(i + 1).padStart(3, "0");
    const file = path.join(dir, "chapters", `${name}.m4a`), pcmPath = path.join(dir, "chapters", `${name}.pcm`), lenPath = `${file}.ms`;
    const fingerprint = narrationFingerprint({title: ch.title, text: ch.text, voice: voice.id,
      selection: chapters.map(c => ({title:c.title,index:c.index}))});
    const prior = old?.chapters?.[i];
    const reusable = prior?.fingerprint === fingerprint && Number.isFinite(prior.durationMs) && prior.durationMs > 0
      && await exists(file) && await exists(lenPath);
    if (!reusable) {
      const started = Date.now();
      // The parser strips chapter headings from the text, so the title is announced first, as in the app.
      const chunkDir=path.join(dir,"checkpoints",fingerprint);
      await fs.mkdir(chunkDir,{recursive:true});
      const record=[];
      const output=await fs.open(pcmPath,"w");let bytes=0;
      try {
        for (const [index,c] of chapterChunks(ch.title,ch.text).entries()) {
          const chunkPath=path.join(chunkDir,`${index}.pcm`);
          const metadataPath=path.join(chunkDir,`${index}.json`);
          let pcm, metadata;
          try {
            metadata=JSON.parse(await fs.readFile(metadataPath,"utf8")); pcm=await fs.readFile(chunkPath);
            if(metadata.text!==c.text || pcm.length===0 || pcm.length%2 || createHash("sha256").update(pcm).digest("hex")!==metadata.sha256)throw new Error("Invalid checkpoint");
          } catch {
            const segments=await planNarration(c.text,voice.id);
            pcm=floatToPcm16(await synthesize(c.text,voice.id));
            metadata={text:c.text,segments,bytes:pcm.length,sha256:createHash("sha256").update(pcm).digest("hex")};
            await fs.writeFile(`${chunkPath}.tmp`,pcm);await fs.rename(`${chunkPath}.tmp`,chunkPath);
            await fs.writeFile(`${metadataPath}.tmp`,JSON.stringify(metadata));await fs.rename(`${metadataPath}.tmp`,metadataPath);
          }
          checkpoint();
          await output.writeFile(pcm); const pause=silence(c.paragraphEnd?0.45:0.12);await output.writeFile(pause);
          bytes+=pcm.length+pause.length; record.push({...metadata,paragraphEnd:c.paragraphEnd});
          if(index%25===0)log(book.slug,`chapter ${i+1}: ${index+1} chunks verified`);
        }
      } finally { await output.close(); }
      await fs.writeFile(path.join(dir,"chapters",`${name}.audit.json`),JSON.stringify({fingerprint,chunks:record},null,2));
      await encodeChapter(pcmPath, `${file}.new.m4a`);
      await fs.rename(`${file}.new.m4a`, file);
      await fs.rm(pcmPath, { force: true });
      const ms = Math.round((bytes / 2 / SAMPLE_RATE) * 1000);
      await fs.writeFile(lenPath, String(ms));
      log(book.slug, `${i + 1}/${chapters.length}`, ch.title, `${Math.round(ms / 1000)}s audio in ${Math.round((Date.now() - started) / 1000)}s`);
    }
    manifest.chapters.push({ fingerprint, title: ch.title, words: countWords(ch.text), file: `chapters/${name}.m4a`, durationMs: Number(await fs.readFile(lenPath, "utf8")) });
    await save();
  }

  manifest.durationMs = manifest.chapters.reduce((n, c) => n + c.durationMs, 0);
  if (preview) {
    await save();
    log(book.slug, "first chapter ready", chapters[0].title);
    return;
  }
  for (const format of ["m4b", "mp3"]) {
    checkpoint();
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
for(const slug of wanted) if(!CATALOG.some(b=>b.slug===slug))throw new Error(`Unknown book: ${slug}`);
const books = wanted.length ? CATALOG.filter((b) => wanted.includes(b.slug)) : CATALOG;
for (const book of books) {
  try { await narrate(book, preview); } catch (e) { log(book.slug, "failed:", e.message); process.exitCode = e.code === 'YIELD' ? 75 : 1; break; }
}
await closeTts();
