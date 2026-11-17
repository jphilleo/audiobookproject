import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BookRequests } from '../src/book-requests.js';
import { bookVars } from '../src/library-pages.js';
async function setup(t, overrides = {}) {
 const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-requests-')); t.after(() => fs.rm(dir, {recursive:true,force:true}));
 let time = 1000000, ready = false; const mail = [], generated = [];
 const options = { dir, origin:'https://example.org', lookup:slug => slug === 'book' ? {slug,title:'A book',authorSlug:'author'} : null, available:async()=>ready, generate:async slug=>{generated.push(slug);ready=true;}, send:async m=>mail.push(m), now:()=>time, ...overrides };
 const q = new BookRequests(options); await q.init();
 const request = async(email='reader@example.org',format='m4b',ip='127.0.0.1')=>{await q.request({slug:'book',email,format,ip});return Object.values(q.state.requests).find(r=>r.email===email&&r.format===format)?.token;};
 const finish = async()=>{await q.tick();if(q.generating)await q.generating;await q.tick();};
 return {q,options,mail,generated,request,finish,advance:ms=>{time+=ms;},setReady:()=>{ready=true;}};
}
test('confirmation gates generation; email delivery follows verified availability',async t=>{
 const {q,request,finish,generated,mail}=await setup(t);const token=await request();
 await finish();assert.equal(generated.length,0);assert.equal(mail.length,1);assert.match(mail[0].text,/press Confirm/);
 await q.confirm(token);await finish();assert.deepEqual(generated,['book']);assert.equal(q.status(token).status,'ready');assert.equal(mail.length,2);assert.match(mail[1].text,/full audiobook/);
 await finish();assert.equal(mail.length,2);
});
test('two readers and formats share one generation job',async t=>{
 const {q,request,finish,generated,mail}=await setup(t);
 const a=await request(),b=await request('other@example.org','mp3','2');await q.confirm(a);await q.confirm(b);await finish();
 assert.equal(generated.length,1);assert.equal(mail.length,2);assert.equal(q.status(b).format,'mp3');
});
test('completed books send links without regeneration',async t=>{
 const {q,request,finish,generated,setReady}=await setup(t);setReady();const token=await request();await q.confirm(token);await finish();assert.equal(generated.length,0);assert.equal(q.status(token).status,'ready');
});
test('duplicate submissions, invalid inputs, and throttling',async t=>{
 const {q,request}=await setup(t);await request();await request();assert.equal(Object.keys(q.state.requests).length,1);
 await assert.rejects(q.request({slug:'../book',email:'x@y.z',format:'m4b',ip:'2'}));
 await assert.rejects(q.request({slug:'book',email:'x@y.z\r\nBcc:x@y.z',format:'m4b',ip:'2'}));
 await assert.rejects(q.request({slug:'book',email:'x@y.z',format:'exe',ip:'2'}));
 for(let i=0;i<3;i++)await request();await assert.rejects(request(),/Too many/);
});
test('email retries reuse identical payload and key across restart',async t=>{
 let attempts=[];const {q,request,options,advance}=await setup(t,{send:async m=>{attempts.push(m);throw new Error('offline');}});
 await request();await q.tick();advance(600000);
 const restarted=new BookRequests(options);await restarted.init();await restarted.tick();
 assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);
});
test('long generation does not block new confirmation emails',async t=>{
 let resolve;const gate=new Promise(r=>resolve=r);
 const {q,request,mail}=await setup(t,{generate:()=>gate});const a=await request();await q.confirm(a);await q.tick();
 await request('next@example.org','mp3','2');await q.tick();assert.equal(mail.length,1);assert.equal(mail[0].to,'next@example.org');resolve();await q.generating;
});
test('failures never expose a ready download and send a truthful failure notice',async t=>{
 const {q,request,finish,advance,mail}=await setup(t,{generate:async()=>{throw new Error('broken');}});
 const a=await request();await q.confirm(a);for(let i=0;i<3;i++){await finish();advance(2000000);}
 await q.tick();assert.equal(q.status(a).status,'failed');assert.match(mail[0].text,/No download is ready/);
});
test('expired and canceled tokens cannot trigger work or reveal addresses',async t=>{
 const {q,request,advance}=await setup(t);const a=await request();assert.equal(q.status(a).email,undefined);advance(3*86400000);assert.equal(q.status(a),null);await assert.rejects(q.confirm(a));
 const b=await request('new@example.org');await q.cancel(b);assert.equal(q.get(b),null);
});
test('preview offers full book only when delivery is enabled, without claiming completion',()=>{
 const b={slug:'book',authorSlug:'author',title:'A book',author:'Author',preview:true,ready:false,voice:{name:'Emma'},durationMs:1000,description:'A description',source:'author/book',chapters:[{title:'One',file:'chapters/001.m4a',durationMs:1000}]};
 const off=bookVars(b,'https://example.org');assert.equal(off.requestForm,'');
 const on=bookVars(b,'https://example.org',{delivery:true});assert.match(on.requestForm,/Get the full audiobook free/);assert.match(on.requestForm,/several days/);assert.doesNotMatch(on.title,/Complete/);assert.match(on.meta,/preview/);assert.doesNotMatch(on.jsonld,/AudioObject/);
});
test('interrupted jobs recover as queued and corrupt durable state fails closed',async t=>{
 const {q,request,options}=await setup(t);const token=await request();await q.confirm(token);
 q.state.jobs.book.status='working';await q.save();const resumed=new BookRequests(options);await resumed.init();assert.equal(resumed.state.jobs.book.status,'queued');
 await fs.writeFile(path.join(options.dir,'requests.json'),'broken');await assert.rejects(new BookRequests(options).init());
});
