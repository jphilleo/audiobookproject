// Book storage on disk and the single background worker that narrates chapters.
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseEpub } from "./epub.js";
import { parsePdf } from "./pdf.js";
import { chunkText, synthesize, SAMPLE_RATE } from "./tts.js";
import { floatToPcm16, silence, encodeChapter, buildAudiobook } from "./audio.js";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(import.meta.dirname, "..", "data", "books"));

// Pricing shown to users. Free voices cost us only local compute.
export const PRICING = {
  free: { label: "Free voices (Kokoro)", perThousandWords: 0 },
  premium: { label: "Premium voices", perThousandWords: 0.03 }, // $3 per 100k words
};

const books = new Map(); // id -> book (metadata + chapter status; text lives on disk)
const queue = []; // { bookId, index }
let working = false;

const bookDir = (id) => path.join(DATA_DIR, id);
const save = (book) => fs.writeFile(path.join(bookDir(book.id), "book.json"), JSON.stringify(book, null, 2));

export async function loadLibrary() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const id of await fs.readdir(DATA_DIR)) {
    try {
      const book = JSON.parse(await fs.readFile(path.join(bookDir(id), "book.json"), "utf8"));
      // Anything interrupted by a restart goes back to idle.
      for (const ch of book.chapters) if (ch.status !== "done") Object.assign(ch, { status: "idle", progress: 0 });
      books.set(id, book);
    } catch {}
  }
}

export function estimate(words) {
  return Object.fromEntries(Object.entries(PRICING).map(([k, p]) => [k, { ...p, cost: Math.round(words * p.perThousandWords * 100 / 1000) / 100 }]));
}

export async function addBook(buffer, filename, ownerId) {
  const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  const parsed = isPdf ? await parsePdf(buffer, filename) : await parseEpub(buffer);
  const id = crypto.randomBytes(8).toString("hex");
  const dir = bookDir(id);
  await fs.mkdir(path.join(dir, "text"), { recursive: true });
  await fs.mkdir(path.join(dir, "audio"), { recursive: true });

  let cover = null;
  if (parsed.cover) {
    const ext = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/gif": "gif" }[parsed.cover.mediaType] || "jpg";
    cover = `cover.${ext}`;
    await fs.writeFile(path.join(dir, cover), parsed.cover.data);
  }
  for (const s of parsed.sections) await fs.writeFile(path.join(dir, "text", `${s.index}.txt`), s.text);

  const book = {
    id,
    filename,
    title: parsed.title,
    author: parsed.author,
    language: parsed.language,
    cover,
    ownerId,
    createdAt: new Date().toISOString(),
    voice: null,
    chapters: parsed.sections.map(({ index, title, words, selected }) => ({
      index, title, words, selected, status: "idle", progress: 0, durationMs: 0, voice: null,
    })),
  };
  books.set(id, book);
  await save(book);
  return book;
}

export const getBook = (id) => books.get(id);
// Each browser only ever sees its own books (identified by an anonymous cookie, not an account).
export const listBooks = (ownerId) => [...books.values()].filter((b) => b.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Books and their audio are deleted this long after upload.
export const RETENTION_DAYS = 30;
export const expiresAt = (book) => new Date(new Date(book.createdAt).getTime() + RETENTION_DAYS * 86400000).toISOString();

export async function deleteExpired() {
  const now = new Date().toISOString();
  for (const book of [...books.values()]) if (expiresAt(book) < now) await deleteBook(book.id);
}

export async function startNarration(id, { voice, speed = 1, chapters }) {
  const book = books.get(id);
  if (!book) throw new Error("Book not found");
  const wanted = new Set(chapters);
  book.voice = voice;
  book.speed = speed;
  for (const ch of book.chapters) {
    ch.selected = wanted.has(ch.index);
    // Re-narrate if the voice changed; otherwise keep finished chapters.
    if (ch.selected && (ch.status !== "done" || ch.voice !== voice || ch.speed !== speed) && ch.status !== "queued" && ch.status !== "working") {
      Object.assign(ch, { status: "queued", progress: 0 });
      queue.push({ bookId: id, index: ch.index });
    }
  }
  book.built = {};
  await save(book);
  runQueue();
  return book;
}

export async function cancelNarration(id) {
  const book = books.get(id);
  if (!book) return;
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].bookId === id) queue.splice(i, 1);
  for (const ch of book.chapters) if (ch.status === "queued") ch.status = "idle";
  book.cancelRequested = true;
  await save(book);
}

async function runQueue() {
  if (working) return;
  working = true;
  try {
    while (queue.length) {
      const { bookId, index } = queue.shift();
      const book = books.get(bookId);
      const ch = book?.chapters[index];
      if (!ch || ch.status !== "queued") continue;
      book.cancelRequested = false;
      try {
        await narrateChapter(book, ch);
      } catch (err) {
        console.error(`Chapter ${index} of ${book.title} failed:`, err);
        Object.assign(ch, { status: book.cancelRequested ? "idle" : "error", error: String(err.message || err) });
      }
      await save(book);
    }
  } finally {
    working = false;
  }
}

async function narrateChapter(book, ch) {
  const dir = bookDir(book.id);
  const text = await fs.readFile(path.join(dir, "text", `${ch.index}.txt`), "utf8");
  // The parser strips chapter headings from the text, so the title is always announced first.
  const chunks = [{ text: ch.title, paragraphEnd: true }, ...chunkText(text)];

  const pcmPath = path.join(dir, "audio", `${ch.index}.pcm`);
  const out = createWriteStream(pcmPath);
  let bytes = 0;
  const write = (buf) => { bytes += buf.length; return new Promise((r) => (out.write(buf) ? r() : out.once("drain", r))); };

  Object.assign(ch, { status: "working", progress: 0, error: null });
  const started = Date.now();
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (book.cancelRequested) throw new Error("Cancelled");
      const audio = await synthesize(chunks[i].text, book.voice, book.speed);
      await write(floatToPcm16(audio));
      await write(silence(chunks[i].paragraphEnd ? 0.45 : 0.12));
      ch.progress = (i + 1) / chunks.length;
      // Rough ETA from throughput so far.
      ch.etaSeconds = Math.round(((Date.now() - started) / (i + 1)) * (chunks.length - i - 1) / 1000);
    }
  } finally {
    await new Promise((r) => out.end(r));
  }

  await encodeChapter(pcmPath, path.join(dir, "audio", `${ch.index}.m4a`));
  await fs.rm(pcmPath, { force: true });
  Object.assign(ch, {
    status: "done",
    progress: 1,
    etaSeconds: 0,
    voice: book.voice,
    speed: book.speed,
    durationMs: Math.round((bytes / 2 / SAMPLE_RATE) * 1000),
  });
}

// Builds (or reuses) the whole-book file. format: "m4b" | "mp3".
export async function audiobookPath(id, format = "m4b") {
  const book = books.get(id);
  if (!book) throw new Error("Book not found");
  const done = book.chapters.filter((c) => c.selected && c.status === "done");
  if (!done.length) throw new Error("No narrated chapters yet");
  const dir = bookDir(id);
  const outPath = path.join(dir, `audiobook.${format}`);
  const key = done.map((c) => `${c.index}:${c.voice}:${c.durationMs}`).join(",");
  book.built ??= {};
  if (book.built[format] !== key) {
    await buildAudiobook({
      title: book.title,
      author: book.author,
      coverPath: book.cover ? path.join(dir, book.cover) : null,
      chapters: done.map((c) => ({ title: c.title, file: path.join(dir, "audio", `${c.index}.m4a`), durationMs: c.durationMs })),
      outPath,
      format,
    });
    book.built[format] = key;
    await save(book);
  }
  return outPath;
}

export async function deleteBook(id) {
  await cancelNarration(id);
  books.delete(id);
  await fs.rm(bookDir(id), { recursive: true, force: true });
}

export const audioPath = (id, index) => path.join(bookDir(id), "audio", `${Number(index)}.m4a`);
export const coverPath = (id) => { const b = books.get(id); return b?.cover ? path.join(bookDir(id), b.cover) : null; };
