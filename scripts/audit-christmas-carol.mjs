// Local, repeatable listening comparisons. Does not publish or replace book files.
import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { prepareNarration } from '../src/narration-text.js';
import { floatToPcm16, wavHeader } from '../src/audio.js';
const out = path.resolve(process.argv[2] || '../../outputs/christmas-carol-audit');
await fs.mkdir(out, {recursive:true});
const cases = [
  {id:'repeated-heading', original:'Stave I: Marley’s Ghost. Marley’s Ghost. Marley was dead, to begin with.', corrected:'Stave one: Marley’s Ghost. Marley was dead, to begin with.', reason:'Announce the heading once, then begin the story'},
  {id:'heading', original:'Stave IV: The Last of the Spirits.', corrected:prepareNarration('Stave IV: The Last of the Spirits.', {heading:true}), reason:'Explicit Roman numeral expansion'},
  {id:'honorific', original:'Three days after sight of this First of Exchange pay to Mr. Ebenezer Scrooge or his order.', corrected:prepareNarration('Three days after sight of this First of Exchange pay to Mr. Ebenezer Scrooge or his order.'), reason:'Expand personal title; prevent a sentence boundary inside the name'},
  {id:'saint', original:'say St. Paul’s Churchyard, for instance', corrected:'say Saint Paul’s Churchyard, for instance', reason:'Book-specific candidate only: St. is ambiguous globally'},
];
const worker = new Worker(new URL('../src/tts-worker.js',import.meta.url));
let nextId=0;
function generate(text) {
  return new Promise((resolve,reject)=> {
    const id=nextId++;
    const handler = msg => {
      if(msg.id!==id)return;
      worker.off('message',handler);
      msg.error ? reject(new Error(msg.error)) : resolve(msg.result);
    };
    worker.on('message',handler);
    worker.postMessage({id,type:'generate',text,voice:'af_heart',speed:1});
  });
}
try {
  for(const c of cases) {
    for(const variant of ['original','corrected']) {
      const audio=await generate(c[variant]);
      const peak = audio.reduce((n,v)=>Math.max(n,Math.abs(v)),0);
      // Leave sample headroom; record raw clipping risk separately below.
      const pcm=floatToPcm16(audio.map(v=>v * Math.min(1,0.95 / (peak || 1))));
      await fs.writeFile(path.join(out,`${c.id}-${variant}.wav`),Buffer.concat([wavHeader(pcm.length),pcm]));
      c[`${variant}Seconds`]=audio.length/24000;
      c[`${variant}ClippedSamples`]=audio.reduce((n,v)=>n+(Math.abs(v)>=1),0);
      console.log(c.id,variant,c[`${variant}Seconds`].toFixed(2)+'s');
    }
  }
  await fs.writeFile(path.join(out,'comparisons.json'),JSON.stringify(cases,null,2));
} finally { await worker.terminate(); }
