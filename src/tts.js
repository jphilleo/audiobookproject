// Free tier TTS: Kokoro-82M running locally via ONNX. No API keys, no per-book cost.
// Inference runs in a worker thread (tts-worker.js); this module is the main-thread client.
import { prepareNarration } from "./narration-text.js";
import { Worker } from "node:worker_threads";

export const SAMPLE_RATE = 24000;
const MAX_CHUNK_CHARS = 380; // Kokoro truncates past ~510 phoneme tokens.

let worker;
let nextId = 0;
const pending = new Map();
function call(msg) {
  if (!worker) {
    worker = new Worker(new URL("./tts-worker.js", import.meta.url));
    worker.on("message", ({ id, result, error }) => {
      const p = pending.get(id);
      pending.delete(id);
      error ? p?.reject(new Error(error)) : p?.resolve(result);
    });
    worker.on("error", (err) => {
      for (const p of pending.values()) p.reject(err);
      pending.clear();
      worker = null;
    });
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...msg });
  });
}

export const loadTts = () => call({ type: "ready" });

// Kokoro voice ids are <lang><gender>_<name>: a=American, b=British; f/m.
const ACCENTS = { a: "American", b: "British" };
let voicesPromise;
export async function listVoices() {
  voicesPromise ??= call({ type: "voices" });
  return Object.entries(await voicesPromise).map(([id, v]) => ({
    id,
    name: v.name || id.split("_")[1],
    accent: ACCENTS[id[0]] || id[0],
    gender: id[1] === "f" ? "Female" : "Male",
    grade: v.overallGrade || "",
  }));
}

// Returns a Float32Array @ 24kHz mono.
export const synthesize = (text, voice, speed = 1) => call({ type: "generate", text: prepareNarration(text), voice, speed });

// Split a chapter into speakable chunks. Each chunk records whether it ends a paragraph
// so we can insert a slightly longer pause there.
export function chunkText(text) {
  const chunks = [];
  for (const para of prepareNarration(text).split(/\n{2,}/)) {
    const sentences = para.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g)?.map((s) => s.trim()).filter(Boolean) || [para];
    let buf = "";
    const flush = () => {
      if (buf) chunks.push({ text: buf, paragraphEnd: false });
      buf = "";
    };
    for (let s of sentences) {
      // Hard-split monster sentences on commas/semicolons, then on spaces.
      while (s.length > MAX_CHUNK_CHARS) {
        let cut = Math.max(s.lastIndexOf(", ", MAX_CHUNK_CHARS), s.lastIndexOf("; ", MAX_CHUNK_CHARS));
        if (cut < MAX_CHUNK_CHARS / 3) cut = s.lastIndexOf(" ", MAX_CHUNK_CHARS);
        if (cut <= 0) cut = MAX_CHUNK_CHARS;
        flush();
        chunks.push({ text: s.slice(0, cut + 1).trim(), paragraphEnd: false });
        s = s.slice(cut + 1).trim();
      }
      if (buf && buf.length + s.length + 1 > MAX_CHUNK_CHARS) flush();
      buf = buf ? `${buf} ${s}` : s;
    }
    flush();
    if (chunks.length) chunks[chunks.length - 1].paragraphEnd = true;
  }
  return chunks.filter((c) => /[\p{L}\p{N}]/u.test(c.text));
}
