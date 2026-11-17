// Changing extraction, preparation, model configuration, or dependencies invalidates reuse.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const files = ['epub.js','pdf.js','narration-text.js','tts.js','tts-worker.js','audio.js','library.js','narration-version.js','../scripts/narrate-library.js'];
const versionHash = createHash('sha256');
for (const file of files) versionHash.update(readFileSync(new URL(file, import.meta.url)));
versionHash.update(readFileSync(new URL('../package-lock.json', import.meta.url)));
export const NARRATION_VERSION = versionHash.digest('hex');
export function narrationFingerprint({ title, text, voice, speed = 1, selection = null }) {
  return createHash('sha256').update(JSON.stringify({version: NARRATION_VERSION, title, text, voice, speed, selection,
    dtype: process.env.KOKORO_DTYPE || 'fp32', modelVersion: process.env.NARRATION_MODEL_VERSION || 'Kokoro-82M-v1.0-ONNX'})).digest('hex');
}
export function requireIdleNarration(book) {
  if (book.chapters.some(c => c.status === 'queued' || c.status === 'working')) {
    throw new Error('Stop the current narration before changing chapters, voice, or speed.');
  }
}
