import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
for(const corrupt of [false,true])test(`cloud offload ${corrupt?'retains local files on corruption':'verifies files before switching and deleting'}`,async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'offload-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const slug='a-christmas-carol',dir=path.join(root,slug);await fs.mkdir(dir);
 const m={ready:true,audioStorage:'origin',chapters:[{file:'001.m4a'}],m4b:{file:'book.m4b'},mp3:{file:'book.mp3'}};
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(m));
 for(const name of ['001.m4a','book.m4b','book.mp3'])await fs.writeFile(path.join(dir,name),'recorded audio fixture '+name);
 const objects=new Map();let puts=0;
 const server=http.createServer(async(req,res)=>{
  const parsed=new URL(req.url,'http://test');
  const key=parsed.pathname.replace(/^\/bucket/,'');
  if(req.method==='GET')assert.match(parsed.searchParams.get('v'),/^[a-f0-9]{16}$/);
  if(req.method==='PUT') {
   assert.match(req.headers.authorization,/AWS4-HMAC-SHA256/);
   let chunks=[];for await(const chunk of req)chunks.push(chunk);objects.set(key,Buffer.concat(chunks));puts++;res.end();return;
  }
  assert.ok(objects.has(key),'upload must precede the first public read');
  if(req.headers.range){res.writeHead(206).end(objects.get(key).subarray(0,1024));return;}
  res.end(corrupt?'corrupt':objects.get(key));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const code=await new Promise(resolve=>{
  const child=spawn(process.execPath,['scripts/offload-worker-book.js',root,slug],{env:{...process.env,R2_ACCESS_KEY_ID:'a'.repeat(32),R2_SECRET_ACCESS_KEY:'b'.repeat(64),R2_ENDPOINT:base,R2_BUCKET:'bucket',LIBRARY_AUDIO_URL:base,OFFLOAD_RETRY_MS:'1'},stdio:'ignore'});
  child.on('close',resolve);
 });
 const after=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 if(corrupt){assert.notEqual(code,0);assert.equal(after.audioStorage,'origin');await fs.access(path.join(dir,'001.m4a'));}
 else {assert.equal(code,0);assert.equal(puts,3);assert.equal(after.audioStorage,'r2');assert.match(after.audioRevision,/^[a-f0-9]{16}$/);await assert.rejects(fs.access(path.join(dir,'001.m4a')));}
});

test('public links include the verified cloud revision',async()=>{
 process.env.LIBRARY_AUDIO_URL='https://audio.example.org';
 const {audioUrl}=await import('../src/library-pages.js?cloud-revision-test');
 const book={slug:'book',ready:true,audioStorage:'r2',audioRevision:'0123456789abcdef'};
 assert.equal(audioUrl(book,'chapter.m4a'),'https://audio.example.org/book/chapter.m4a?v=0123456789abcdef');
});
