// Uses curl's maintained S3 signer. Credentials go through stdin, never argv/logs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { CATALOG } from '../src/catalog.js';
const [library,slug]=process.argv.slice(2);
if(!CATALOG.some(b=>b.slug===slug))throw new Error('Unknown book');
const {R2_ACCESS_KEY_ID:key,R2_SECRET_ACCESS_KEY:secret,R2_ENDPOINT:endpoint,R2_BUCKET:bucket,LIBRARY_AUDIO_URL:base}=process.env;
if(!key||!secret||!endpoint||!bucket||!base)throw new Error('Storage credentials are not configured');
if(!/^[a-f0-9]+$/i.test(key)||!/^[a-f0-9]+$/i.test(secret))throw new Error('Invalid storage credentials');
const folder=path.join(library,slug),file=path.join(folder,'manifest.json');
const manifest=JSON.parse(await fs.readFile(file,'utf8'));
const files=[...manifest.chapters,manifest.m4b,manifest.mp3];
if(manifest.ready && manifest.audioStorage==='r2' && manifest.offloadedAt) {
 for(const item of files)await fs.rm(path.join(folder,item.file),{force:true});
 process.exit(0);
}
if(!manifest.ready||manifest.audioStorage!=='origin')process.exit(0);
for(const item of files) {
 const local=path.join(folder,item.file),hash=crypto.createHash('sha256');
 for await(const chunk of createReadStream(local))hash.update(chunk);
 const expected=hash.digest('hex'),object=[slug,...item.file.split('/')].map(encodeURIComponent).join('/');
 const publicUrl=`${base}/${object}`;
 async function verified() {
  const response=await fetch(publicUrl,{signal:AbortSignal.timeout(1800000)});
  if(!response.ok){await response.body?.cancel();return false;}
  const h=crypto.createHash('sha256');for await(const chunk of response.body)h.update(chunk);
  return h.digest('hex')===expected;
 }
 if(!await verified()) {
  await new Promise((resolve,reject)=>{
   const child=spawn('curl',['-4','--config','-','--fail','--silent','--show-error','--max-time','1800','--limit-rate','4M','--upload-file',local,'--header',`Content-Type: ${item.file.endsWith('.mp3')?'audio/mpeg':'audio/mp4'}`,'--header','Cache-Control: public, max-age=2592000',`${endpoint}/${bucket}/${object}`],{stdio:['pipe','ignore','ignore']});
   child.stdin.end(`aws-sigv4 = "aws:amz:auto:s3"\nuser = "${key}:${secret}"\n`);
   child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Cloud upload failed')));
  });
  if(!await verified())throw new Error('Cloud checksum mismatch');
 }
 const range=await fetch(publicUrl,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(30000)});
 if(range.status!==206)throw new Error('Cloud playback range check failed');
 await range.body?.cancel();
}
manifest.audioStorage='r2';manifest.offloadedAt=new Date().toISOString();
await fs.writeFile(file+'.offload-tmp',JSON.stringify(manifest,null,2));await fs.rename(file+'.offload-tmp',file);
// Old origin URLs are redirected by the website after the manifest switch.
for(const item of files)await fs.rm(path.join(folder,item.file),{force:true});
console.log(slug,'uploaded, checksum-verified, and offloaded');
