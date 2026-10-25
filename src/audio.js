// PCM handling and ffmpeg encoding: per-chapter AAC files and a chaptered M4B.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { SAMPLE_RATE } from "./tts.js";

export function floatToPcm16(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
  }
  return buf;
}

export const silence = (seconds) => Buffer.alloc(Math.round(seconds * SAMPLE_RATE) * 2);

export function wavHeader(dataBytes) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim()}`))));
  });
}

export async function encodeChapter(pcmPath, outPath) {
  // Normalize to a typical spoken-word loudness so chapters (and voices) play at the same volume.
  await ffmpeg(["-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", pcmPath, "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ar", String(SAMPLE_RATE), "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", outPath]);
}

const escapeMeta = (s) => String(s).replace(/([=;#\\\n])/g, "\\$1");

// chapters: [{ title, file, durationMs }]. format: "m4b" (AAC, copied) or "mp3" (re-encoded, ID3 chapters).
export async function buildAudiobook({ title, author, coverPath, chapters, outPath, format = "m4b" }) {
  const dir = path.dirname(outPath);
  const listPath = path.join(dir, "concat.txt");
  const metaPath = path.join(dir, "chapters.ffmeta");

  await fs.writeFile(listPath, chapters.map((c) => `file '${path.resolve(c.file).replace(/'/g, "'\\''")}'`).join("\n"));

  let start = 0;
  let meta = `;FFMETADATA1\ntitle=${escapeMeta(title)}\nartist=${escapeMeta(author)}\nalbum=${escapeMeta(title)}\ngenre=Audiobook\n`;
  for (const c of chapters) {
    const end = start + c.durationMs;
    meta += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${start}\nEND=${end}\ntitle=${escapeMeta(c.title)}\n`;
    start = end;
  }
  await fs.writeFile(metaPath, meta);

  // SVG covers can't be embedded in audio files.
  const cover = coverPath && !coverPath.endsWith(".svg") ? coverPath : null;
  const args = ["-f", "concat", "-safe", "0", "-i", listPath, "-i", metaPath];
  if (cover) args.push("-i", cover);
  args.push("-map", "0:a", "-map_metadata", "1", "-map_chapters", "1");
  if (cover) args.push("-map", "2:v", "-c:v", "copy", "-disposition:v:0", "attached_pic");
  if (format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", "64k", "-id3v2_version", "3", "-f", "mp3", outPath);
  else args.push("-c:a", "copy", "-f", "mp4", outPath);
  await ffmpeg(args);
}
