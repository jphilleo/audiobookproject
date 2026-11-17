import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {parseEpub} from '../src/epub.js';import {chapterChunks} from '../src/tts.js';
const dir=path.resolve(process.argv[2]);const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));assert.equal(manifest.ready,true);assert.equal(manifest.chapters.length,5);
const source=(await parseEpub(await fs.readFile(path.join(dir,'source.epub')))).sections.filter(s=>s.selected);assert.equal(source.length,5);
const report={voice:manifest.voice,chapters:[],decode:[]};
for(const [i,c]of manifest.chapters.entries()){
 const raw=source[i];raw.text=raw.text.replace(/\bSt\. Paul’s Churchyard/g,'Saint Paul’s Churchyard');assert.equal(c.title,raw.title);
 const planned=chapterChunks(c.title,raw.text);const audit=JSON.parse(await fs.readFile(path.join(dir,'chapters',`${String(i+1).padStart(3,'0')}.audit.json`),'utf8'));
 assert.deepEqual(audit.chunks.map(x=>x.text),planned.map(x=>x.text));assert.equal(audit.fingerprint,c.fingerprint);
 let maxTokens=0;let pcmBytes=0;
 for(const [j,chunk]of audit.chunks.entries()){
  assert.equal(chunk.segments.map(x=>x.text).join(' ').replace(/\s+/g,' '),chunk.text.replace(/\s+/g,' '));
  for(const s of chunk.segments){assert.ok(s.tokens<=510 && s.tokens>0);maxTokens=Math.max(maxTokens,s.tokens);}
  const pcm=await fs.readFile(path.join(dir,'checkpoints',c.fingerprint,`${j}.pcm`));assert.equal(pcm.length,chunk.bytes);assert.ok(pcm.length>0);assert.equal(crypto.createHash('sha256').update(pcm).digest('hex'),chunk.sha256);
  pcmBytes+=pcm.length+Math.round((chunk.paragraphEnd?.45:.12)*24000)*2;
 }
 assert.equal(c.durationMs,Math.round(pcmBytes/48));
 report.chapters.push({title:c.title,words:c.words,chunks:audit.chunks.length,maxTokens,durationMs:c.durationMs,sourceCoverage:'exact prepared-text match',checkpointHashes:'all verified'});
}
for(const file of [...manifest.chapters.map(c=>c.file),manifest.m4b.file,manifest.mp3.file]){
 const result=spawnSync(process.env.FFMPEG||'ffmpeg',['-hide_banner','-v','error','-i',path.join(dir,file),'-map','0:a','-f','null','-'],{encoding:'utf8',timeout:180000});
 assert.equal(result.status,0,`${file}: ${result.stderr}`);assert.equal(result.stderr,'',file);report.decode.push({file,completeDecode:true});
}
await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
