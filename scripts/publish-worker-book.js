// Publish only a fully decoded, verified recording. Keep the old page live until
// every new file exists; the final manifest rename is the publication boundary.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { CATALOG } from '../src/catalog.js';
const [root,library,slug]=process.argv.slice(2);
if(!CATALOG.some(b=>b.slug===slug))throw new Error('Unknown book');
const source=path.join(root,slug), target=path.join(library,slug);
const proof=JSON.parse(await fs.readFile(path.join(source,'delivery.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
if(!proof.verified||proof.slug!==slug||!manifest.ready||manifest.preview||proof.chapters!==manifest.chapters.length)throw new Error('Unverified recording');
for(const format of ['m4b','mp3']) {
 const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(path.join(source,manifest[format].file)))hash.update(chunk);
 if(hash.digest('hex')!==proof[format].sha256)throw new Error('Download checksum mismatch');
}
const version=`recording-${proof.m4b.sha256.slice(0,16)}`;
await fs.mkdir(path.join(target,version,'chapters'),{recursive:true});
for(const item of [...manifest.chapters,manifest.m4b,manifest.mp3]) {
 const dest=path.join(target,version,item.file);await fs.copyFile(path.join(source,item.file),dest+'.tmp');await fs.rename(dest+'.tmp',dest);item.file=`${version}/${item.file}`;
}
if(manifest.cover)await fs.copyFile(path.join(source,manifest.cover),path.join(target,manifest.cover));
manifest.audioStorage='origin';
await fs.writeFile(path.join(target,'manifest.json.worker-tmp'),JSON.stringify(manifest,null,2));
await fs.rename(path.join(target,'manifest.json.worker-tmp'),path.join(target,'manifest.json'));
// Only disposable working audio is removed. Source, verification and pronunciation
// audits remain available, and published files are retained.
for(const name of ['checkpoints','chapters',`${slug}.m4b`,`${slug}.mp3`]) {
 if(name==='chapters') {
  for(const f of await fs.readdir(path.join(source,name)))if(/\.(m4a|ms|pcm)$/.test(f))await fs.rm(path.join(source,name,f),{force:true});
 } else await fs.rm(path.join(source,name),{recursive:true,force:true});
}
