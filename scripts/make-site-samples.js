// Renders the audio samples used on the site's pages: a few voices reading classic opening lines
// (public/samples/<voice>-<passage>.mp3) and a short sample audiobook in M4B and MP3
// (public/samples/sample-audiobook.*). Run with: node scripts/make-site-samples.js
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { synthesize, chunkText, SAMPLE_RATE } from "../src/tts.js";
import { floatToPcm16, silence, encodeChapter, buildAudiobook } from "../src/audio.js";

const OUT = path.resolve("public/samples");

export const VOICES = ["af_heart", "af_bella", "am_michael", "am_fenrir", "bf_emma", "bm_george"];
export const PASSAGES = {
  melville: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.",
  austen: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
  dickens: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.",
};

// Three of Aesop's fables, retold briefly, as a short audiobook with chapters.
const FABLES = [
  ["The Tortoise and the Hare", "A hare was forever laughing at the tortoise for being so slow. One day the tortoise had heard enough. \"Race me,\" he said, \"and we'll see who's slow.\"\n\nThe hare shot off and was soon so far ahead that he lay down under a tree for a nap. The tortoise kept walking. He didn't stop, and he didn't hurry.\n\nWhen the hare woke up, he ran as fast as he could, but the tortoise was already crossing the finish line.\n\nSlow and steady wins the race."],
  ["The Fox and the Grapes", "A hungry fox saw a bunch of ripe grapes hanging high on a vine. He jumped for them, and missed. He backed up, ran, and jumped again, and missed again.\n\nAfter a while he gave up and walked away with his nose in the air. \"They were probably sour anyway,\" he said.\n\nIt's easy to look down on what you can't have."],
  ["The Boy Who Cried Wolf", "A shepherd boy, bored on the hillside, shouted \"Wolf! Wolf!\" just to watch the villagers come running. They found no wolf, and he laughed at them. He did it again the next day, and they came again.\n\nThen one evening a wolf really did come. The boy shouted as loud as he could, but no one came. They'd stopped believing him.\n\nNobody believes a liar, even when he tells the truth."],
];

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

async function speak(text, voice) {
  const parts = [];
  for (const c of chunkText(text)) {
    parts.push(floatToPcm16(await synthesize(c.text, voice)), silence(c.paragraphEnd ? 0.7 : 0.25));
  }
  return Buffer.concat(parts);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "samples-"));

  for (const voice of VOICES) {
    for (const [key, text] of Object.entries(PASSAGES)) {
      const pcmPath = path.join(tmp, `${voice}-${key}.pcm`);
      await fs.writeFile(pcmPath, await speak(text, voice));
      await ffmpeg(["-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", pcmPath, "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ar", String(SAMPLE_RATE), "-c:a", "libmp3lame", "-b:a", "64k", path.join(OUT, `${voice}-${key}.mp3`)]);
      console.log("sample", voice, key);
    }
  }

  const chapters = [];
  for (const [i, [title, text]] of FABLES.entries()) {
    const pcm = await speak(text, "af_heart");
    const pcmPath = path.join(tmp, `ch${i}.pcm`), file = path.join(tmp, `ch${i}.m4a`);
    await fs.writeFile(pcmPath, pcm);
    await encodeChapter(pcmPath, file);
    chapters.push({ title, file, durationMs: Math.round((pcm.length / 2 / SAMPLE_RATE) * 1000) });
  }
  for (const format of ["m4b", "mp3"]) {
    await buildAudiobook({ title: "Three Fables (Audiobook Project sample)", author: "Aesop", coverPath: path.resolve("public/brand/icon-512.png"), chapters, outPath: path.join(tmp, `sample.${format}`), format });
    await fs.copyFile(path.join(tmp, `sample.${format}`), path.join(OUT, `sample-audiobook.${format}`));
  }
  console.log("sample audiobook", chapters.map((c) => `${c.title} ${Math.round(c.durationMs / 1000)}s`).join(", "));
  const { makeSampleTimings } = await import("./make-sample-timings.js");
  await makeSampleTimings(VOICES, PASSAGES);
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
