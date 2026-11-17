import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEpub} from '../src/epub.js';
import {chunkText,synthesize,closeTts} from '../src/tts.js';
import {floatToPcm16,wavHeader,silence} from '../src/audio.js';
const dir=path.resolve(process.argv[2]);await fs.mkdir(dir,{recursive:true});
const chapters=(await parseEpub(await fs.readFile(process.argv[3]))).sections.filter(s=>s.selected);
const specs=[['opening',0,'Marley was dead'],['dialogue',0,'A merry Christmas, uncle'],['family',2,'God bless us every one']];
const passages=specs.map(([name,index,needle])=>{const p=chapters[index].text.split(/\n{2,}/);let start=p.findIndex(x=>x.includes(needle));if(start<0)throw Error(needle);if(name==='family')start=Math.max(0,start-2);let text='';for(let i=start;i<p.length&&text.split(/\s+/).length<220;i++)text+=(text?'\n\n':'')+p[i];return {name,text,words:text.split(/\s+/).length};});
await fs.writeFile(path.join(dir,'passages.json'),JSON.stringify(passages,null,2));const results=[];
try{for(const voice of ['bf_emma','bm_george'])for(const passage of passages){const parts=[];for(const c of chunkText(passage.text)){parts.push(floatToPcm16(await synthesize(c.text,voice)),silence(c.paragraphEnd?.45:.12));}const pcm=Buffer.concat(parts);const file=`${voice}-${passage.name}.wav`;await fs.writeFile(path.join(dir,file),Buffer.concat([wavHeader(pcm.length),pcm]));results.push({voice,passage:passage.name,file,words:passage.words,seconds:pcm.length/48000});console.log(results.at(-1));}}finally{await closeTts();}
await fs.writeFile(path.join(dir,'samples.json'),JSON.stringify(results,null,2));
