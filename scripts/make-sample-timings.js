// Estimates when each word starts in the voice samples (public/samples/<voice>-<passage>.mp3), so the
// sampler can highlight words as they're read. Kokoro doesn't report timestamps, so this finds the pauses
// with ffmpeg, pins them to the punctuation they most likely belong to, and spreads the words in between
// by length. Writes public/samples/timings.json. Run with: node scripts/make-sample-timings.js
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const OUT = path.resolve("public/samples");
// Pause weight after a word, in letters' worth of time.
const PAUSE = { ",": 3, ";": 4, ":": 4, ".": 6, "!": 6, "?": 6 };

function silences(file) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"]);
    let log = "";
    p.stderr.on("data", (d) => (log += d));
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code} on ${file}`));
      const [, h, m, s] = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
      const duration = h * 3600 + m * 60 + Number(s);
      const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((x) => Number(x[1]));
      const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((x) => Number(x[1]));
      resolve({ duration, gaps: starts.map((start, i) => [start, ends[i] ?? duration]) });
    });
  });
}

// Returns the start time (seconds) of each whitespace-separated word in text.
export function wordTimes(text, { duration, gaps }) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = words.map((w) => (w.match(/[\p{L}\p{N}]/gu)?.length || 1) + 1);
  const pause = words.map((w) => PAUSE[w.replace(/["'”’)\]]+$/, "").slice(-1)] || 0);

  // Speech runs between the leading and trailing silence; the gaps in between are skipped over.
  let from = 0, to = duration;
  if (gaps[0]?.[0] < 0.1) from = gaps.shift()[1];
  if (gaps.at(-1)?.[1] > duration - 0.1) to = gaps.pop()[0];
  gaps = gaps.filter(([a, b]) => a > from && b < to);
  const speech = to - from - gaps.reduce((t, [a, b]) => t + b - a, 0);
  const toReal = (s) => { // speech time -> real time; a point on a gap lands after it
    let t = from + s;
    for (const [a, b] of gaps) if (t >= a - 1e-6) t += b - a;
    return t;
  };

  // Word i starts at weight position pos[i]; each gap is pinned to the punctuated word end closest to it.
  const pos = [0];
  for (let i = 0; i < words.length; i++) pos.push(pos[i] + weight[i] + pause[i]);
  const total = pos.at(-1);
  const anchors = [[0, 0]]; // [word index, speech time]
  let speechBefore = 0, prev = from;
  for (const [a, b] of gaps) {
    speechBefore += a - prev; prev = b;
    let best = -1;
    for (let i = anchors.at(-1)[0] + 1; i < words.length; i++) {
      if (!pause[i - 1]) continue;
      if (best < 0 || Math.abs(pos[i] / total - speechBefore / speech) < Math.abs(pos[best] / total - speechBefore / speech)) best = i;
    }
    if (best > 0 && Math.abs(pos[best] / total - speechBefore / speech) < 0.12) anchors.push([best, speechBefore]);
  }
  anchors.push([words.length, speech]);

  const times = [];
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, s0] = anchors[k], [i1, s1] = anchors[k + 1];
    // The pause before an anchor is the gap (or the trailing silence), so leave it out of the spread.
    const span = pos[i1] - pos[i0] - pause[i1 - 1];
    for (let i = i0; i < i1; i++) times.push(+toReal(s0 + ((pos[i] - pos[i0]) / span) * (s1 - s0)).toFixed(3));
  }
  return times;
}

export async function makeSampleTimings(voices, passages) {
  const timings = {};
  for (const voice of voices) {
    for (const [key, text] of Object.entries(passages)) {
      timings[`${voice}-${key}`] = wordTimes(text, await silences(path.join(OUT, `${voice}-${key}.mp3`)));
    }
  }
  await fs.writeFile(path.join(OUT, "timings.json"), JSON.stringify(timings) + "\n");
  console.log("timings", Object.keys(timings).length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { VOICES, PASSAGES } = await import("./make-site-samples.js");
  await makeSampleTimings(VOICES, PASSAGES);
}
