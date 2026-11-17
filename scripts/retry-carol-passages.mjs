import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {synthesize,closeTts} from '../src/tts.js';import {floatToPcm16,wavHeader} from '../src/audio.js';
const dir=path.resolve(process.argv[2]);const out=path.join(dir,'retry-candidates');await fs.mkdir(out,{recursive:true});

const results=[];
try{for(const [chapter,index]of [['001',200],['002',150]]){
 const audit=JSON.parse(await fs.readFile(path.join(dir,'chapters',`${chapter}.audit.json`),'utf8'));const text=audit.chunks[index].text;
 for(let attempt=0;attempt<3;attempt++){
  const synthesisText=attempt===0?text:attempt===1?text.replace(/[“”]/g,''):text.replace(/[“”]/g,'').replace(/[.]$/,'');
  const audio=await synthesize(synthesisText,'af_heart');const pcm=floatToPcm16(audio);const file=path.join(out,`${chapter}-${index}-${attempt}.wav`);await fs.writeFile(file,Buffer.concat([wavHeader(pcm.length),pcm]));results.push({chapter,index,attempt,text,synthesisText,file,sha256:crypto.createHash('sha256').update(pcm).digest('hex')});console.log(results.at(-1));
 }
}}finally{await closeTts();}
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
