import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { installRequestRoutes } from '../src/request-routes.js';
test('HTTP request, confirmation, privacy, cancellation and origin checks',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'request-http-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const prior={...process.env};Object.assign(process.env,{BOOK_REQUESTS_ENABLED:'1',RESEND_API_KEY:'test-only',REQUEST_EMAIL_FROM:'test@example.org',PUBLIC_URL:'http://127.0.0.1',REQUEST_DIR:dir});
 t.after(()=>{for(const key of ['BOOK_REQUESTS_ENABLED','RESEND_API_KEY','REQUEST_EMAIL_FROM','PUBLIC_URL','REQUEST_DIR']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}});
 const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));
 const mails=[];const queue=await installRequestRoutes(app,{send:async m=>mails.push(m),available:async()=>true,generate:async()=>{throw new Error('should not generate');}});t.after(()=>queue.stop());
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const base=`http://127.0.0.1:${server.address().port}`, origin='http://127.0.0.1';
 const payload={slug:'a-christmas-carol',email:'reader@example.org',format:'mp3'};
 let response=await fetch(base+'/api/library-requests',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://bad.example'},body:JSON.stringify(payload)});assert.equal(response.status,403);
 response=await fetch(base+'/api/library-requests',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(payload)});assert.equal(response.status,202);assert.doesNotMatch(await response.text(),/reader@example/);
 const token=Object.values(queue.state.requests)[0].token;
 response=await fetch(base+'/requests/'+token);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('referrer-policy'),'same-origin');assert.match(response.headers.get('cache-control'),/no-store/);assert.match(await response.text(),/Confirm audiobook request/);
 // Merely opening an email link must not start generation (email scanners may follow links).
 assert.equal(queue.get(token).confirmed,false);
 response=await fetch(base+'/requests/'+token+'/download');assert.equal(response.status,404);
 response=await fetch(base+'/requests/'+token+'/confirm',{method:'POST',headers:{origin},redirect:'manual'});assert.equal(response.status,303);
 await queue.tick();if(queue.generating)await queue.generating;await queue.tick();assert.equal(queue.status(token).status,'ready');assert.equal(mails.length,1);
 response=await fetch(base+'/requests/'+token+'/cancel',{method:'POST',headers:{origin}});assert.equal(response.status,200);assert.equal(queue.get(token),null);
 response=await fetch(base+'/requests/'+token);assert.equal(response.status,404);
});
