import fs from 'node:fs/promises';
import path from 'node:path';
import {synthesize,closeTts} from '../src/tts.js';
import {floatToPcm16,wavHeader} from '../src/audio.js';
const dir=path.resolve(process.argv[2]);await fs.mkdir(dir,{recursive:true});
const text='“A merry Christmas, uncle! God save you!” cried a cheerful voice. It was the voice of Scrooge’s nephew, who came upon him so quickly that this was the first intimation he had of his approach. “Bah!” said Scrooge, “Humbug!”';
try{for(const [id,name] of [['af_heart','Heart'],['bm_george','George'],['bf_emma','Emma']]){const pcm=floatToPcm16(await synthesize(text,id));await fs.writeFile(path.join(dir,`${id}.wav`),Buffer.concat([wavHeader(pcm.length),pcm]));console.log(name,pcm.length/48000);}}finally{await closeTts();}
