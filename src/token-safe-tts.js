// Plan using Kokoro's own phonemizer/tokenizer, never a character-count estimate.
export const MAX_MODEL_TOKENS = 510; // Includes boundary tokens; conservative model budget.
export async function planSpeech(model, text, voice) {
  const planner = Object.create(model);
  planner.tokenizer = (phonemes, options) => model.tokenizer(phonemes, { ...options, truncation: false });
  planner.generate_from_ids = async ids => ids;
  async function split(value) {
    const ids = await planner.generate(value, { voice });
    const tokens = ids.dims.at(-1);
    if (tokens <= MAX_MODEL_TOKENS) return [{ text: value, tokens, ids }];
    const breaks = [...value.matchAll(/\s+/gu)].filter(m => m.index > 0 && m.index + m[0].length < value.length);
    if (!breaks.length) throw new Error('A single unbroken passage exceeds the speech token budget. Review it before narration.');
    const boundary = breaks.reduce((best,m) => Math.abs(m.index-value.length/2)<Math.abs(best.index-value.length/2)?m:best);
    return [...await split(value.slice(0,boundary.index).trim()), ...await split(value.slice(boundary.index).trim())];
  }
  return split(text);
}
export function validateWaveform(audio) {
  if (!(audio instanceof Float32Array) || audio.length < 240) throw new Error('Speech model returned empty or implausibly short audio');
  let peak=0;
  for (const value of audio) { if (!Number.isFinite(value)) throw new Error('Speech model returned non-finite audio'); peak=Math.max(peak,Math.abs(value)); }
  if (peak < 0.00001) throw new Error('Speech model returned silent audio');
  // Avoid clipping the raw floating waveform when converting it to PCM16.
  if (peak > 0.98) { const gain=0.98/peak; for(let i=0;i<audio.length;i++)audio[i]*=gain; }
  return audio;
}
export async function generateSpeech(model, text, voice, speed=1) {
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('Narration speed must be between 0.5 and 2');
  const segments=await planSpeech(model,text,voice); const parts=[];
  for (const segment of segments) {
    if(parts.length)parts.push(new Float32Array(2880));
    parts.push(validateWaveform((await model.generate_from_ids(segment.ids,{voice,speed})).audio));
  }
  const result=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.length;}
  return result;
}
