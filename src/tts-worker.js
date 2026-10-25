// Runs Kokoro off the main thread so the web server stays responsive while narrating.
import { parentPort } from "node:worker_threads";
import { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// fp32 is ~1.6x faster than q8 on Apple Silicon CPUs (and sounds slightly better); q8 is a smaller download.
const tts = KokoroTTS.from_pretrained(MODEL_ID, { dtype: process.env.KOKORO_DTYPE || "fp32", device: "cpu" });

parentPort.on("message", async ({ id, type, text, voice, speed }) => {
  try {
    const model = await tts;
    if (type === "voices") return parentPort.postMessage({ id, result: model.voices });
    if (type === "ready") return parentPort.postMessage({ id, result: true });
    const out = await model.generate(text, { voice, speed });
    const audio = out.audio; // Float32Array @ 24kHz
    parentPort.postMessage({ id, result: audio }, [audio.buffer]);
  } catch (err) {
    parentPort.postMessage({ id, error: String(err?.message || err) });
  }
});
