// Only create delivery.json after all chapters and both full downloads decode successfully.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { CATALOG } from '../src/catalog.js';
import { parseEpub } from '../src/epub.js';
const [root, slug] = process.argv.slice(2);
if (!CATALOG.some(b => b.slug === slug)) throw new Error('Unknown book');
const dir = path.resolve(root, slug), manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json')));
const source = await parseEpub(await fs.readFile(path.join(dir, 'source.epub')));
const selected = source.sections.filter(s => s.selected);
if (!manifest.ready || manifest.preview || manifest.chapters.length !== selected.length || !selected.length) throw new Error('Incomplete audiobook');
for (let i = 0; i < selected.length; i++) if (manifest.chapters[i].title !== selected[i].title || !(manifest.chapters[i].durationMs > 0)) throw new Error('Chapter coverage mismatch');
const decode = file => new Promise((resolve, reject) => {
 const p = spawn('ffmpeg', ['-v','error','-xerror','-i',file,'-map','0:a:0','-f','null','-','-progress','pipe:1','-nostats'], {stdio:['ignore','pipe','ignore']});
 let progress='';p.stdout.on('data', b=>{progress+=b;if(progress.length>100000)progress=progress.slice(-50000);});
 p.on('error',reject);p.on('close', c=>{
  const times=[...progress.matchAll(/^out_time_us=(\d+)$/gm)];
  c===0 && times.length ? resolve(Number(times.at(-1)[1])/1000) : reject(new Error('Audio decode failed'));
 });
});
const durationMatches = (actual, expected) => Math.abs(actual-expected) <= Math.max(2000,expected*.02);
for (const ch of manifest.chapters) {
 const duration = await decode(path.join(dir, ch.file));
 if (!durationMatches(duration,ch.durationMs) || (ch.words && (duration/ch.words<140 || duration/ch.words>1500))) throw new Error('Chapter duration mismatch');
}
const proof = { slug, verified: true, chapters: selected.length, checkedAt: new Date().toISOString() };
for (const format of ['m4b','mp3']) {
 const file = path.join(dir, `${slug}.${format}`); const duration = await decode(file);
 if (!durationMatches(duration,manifest.chapters.reduce((n,c)=>n+c.durationMs,0))) throw new Error('Full download duration mismatch');
 const hash = crypto.createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk);
 proof[format] = { bytes: (await fs.stat(file)).size, sha256: hash.digest('hex') };
}
await fs.writeFile(path.join(dir, 'delivery.json.tmp'), JSON.stringify(proof));
await fs.rename(path.join(dir, 'delivery.json.tmp'), path.join(dir, 'delivery.json'));
// Verified delivery files and the sources/audits remain; regenerable PCM no longer occupies disk.
await fs.rm(path.join(dir, 'checkpoints'), { recursive: true, force: true });
