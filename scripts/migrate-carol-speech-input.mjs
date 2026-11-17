// One-time, staged migration: reuse verified audio only where speech input is unchanged.
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {parseEpub} from '../src/epub.js';import {chapterChunks,synthesize,planNarration,closeTts} from '../src/tts.js';import {prepareNarration,prepareSpeechInput} from '../src/narration-text.js';import {narrationFingerprint} from '../src/narration-version.js';import {floatToPcm16} from '../src/audio.js';
const dir=path.resolve(process.argv[2]);assert.equal(path.basename(dir),'a-christmas-carol');
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));assert.ok(['af_heart','bf_emma'].includes(manifest.voice.id));
const chapters=(await parseEpub(await fs.readFile(path.join(dir,'source.epub')))).sections.filter(s=>s.selected);assert.equal(chapters.length,5);
for(const ch of chapters)ch.text=ch.text.replace(/\bSt\. Paul’s Churchyard/g,'Saint Paul’s Churchyard');
const selection=chapters.map(c=>({title:c.title,index:c.index}));const root=path.join(dir,'checkpoints');const oldDirs=await fs.readdir(root);const report=[];
try{for(const ch of chapters){
 const chunks=chapterChunks(ch.title,ch.text);const fingerprint=narrationFingerprint({title:ch.title,text:ch.text,voice:manifest.voice.id,selection});const destination=path.join(root,fingerprint);await fs.mkdir(destination,{recursive:true});let copied=0,repaired=0;
 for(const candidate of [...new Set([...manifest.chapters.map(c=>c.fingerprint),...oldDirs])]){
  if(candidate===fingerprint)continue;
  const source=path.join(root,candidate);let first;try{first=JSON.parse(await fs.readFile(path.join(source,'0.json'),'utf8'));}catch{continue;}
  if(first.text!==chunks[0].text)continue;
  for(const [i,c]of chunks.entries()){
   let metadata,pcm;try{metadata=JSON.parse(await fs.readFile(path.join(source,`${i}.json`),'utf8'));pcm=await fs.readFile(path.join(source,`${i}.pcm`));}catch{continue;}
   assert.equal(metadata.text,c.text);assert.equal(crypto.createHash('sha256').update(pcm).digest('hex'),metadata.sha256);
   if(prepareSpeechInput(c.text, {voice:manifest.voice.id})!==metadata.segments.map(s=>s.text).join(' ')){
    pcm=floatToPcm16(await synthesize(c.text,manifest.voice.id));metadata={text:c.text,segments:await planNarration(c.text,manifest.voice.id),bytes:pcm.length,sha256:crypto.createHash('sha256').update(pcm).digest('hex')};repaired++;
   }else copied++;
   await fs.writeFile(path.join(destination,`${i}.pcm`),pcm);await fs.writeFile(path.join(destination,`${i}.json`),JSON.stringify(metadata));
  }
  break;
 }
 report.push({title:ch.title,fingerprint,copied,repaired});console.log(report.at(-1));
}}finally{await closeTts();}
await fs.writeFile(path.join(dir,'speech-input-migration.json'),JSON.stringify(report,null,2));
