import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {Analytics,installAnalytics,visitorFromRequest} from '../src/analytics.js';
const routes=['/','/library/a/book','/requests'];const books=['book'];
test('analytics strips private fields, rejects arbitrary pages/events and retains only 90 days',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analytics-'));let now=new Date('2026-11-20T12:00:00Z');
 try{
 const a=new Analytics({dir,routes,books,now:()=>now});await a.init();
 assert.equal(a.record({event:'page_view',path:'/library/a/book?email=secret@example.com#private',email:'secret@example.com',book:'private uploaded title',device:'desktop',source:'https://private.example.com'}),true);
 assert.equal(a.record({event:'request_confirmed',path:'/'}),false);
 assert.equal(a.record({event:'page_view',path:'/api/books/private-token'}),false);
 assert.equal(a.record({event:'page_view',path:'/requests/'+'a'.repeat(64)}),true);
 await a.flush();const disk=await fs.readFile(path.join(dir,'counts.json'),'utf8');
 for(const sensitive of ['secret@example.com','private uploaded title','private.example.com','a'.repeat(64)])assert.ok(!disk.includes(sensitive));
 const b=new Analytics({dir,routes,books,now:()=>now});await b.init();assert.equal(b.report().reduce((n,r)=>n+r.count,0),2);
 now=new Date('2027-02-19T12:00:00Z');assert.equal(b.report(90).length,0);await b.flush();assert.equal(await fs.readFile(path.join(dir,'counts.json'),'utf8'),'{}');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('collector requires same origin, honors opt-out, gates admin and never sets a tracking cookie',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'analytics-http-'));const app=express();app.use(express.json());
 const stats=await installAnalytics(app,{dir,routes,books,password:'a-long-random-test-password-only',origin:'https://example.com'});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
 const post=(body,headers={})=>fetch(url+'/api/analytics',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com',...headers},body:JSON.stringify(body)});
 try{
 assert.equal((await fetch(url+'/admin/analytics/data')).status,401);
 assert.equal((await post({event:'page_view',path:'/'},{Origin:'https://evil.com'})).status,403);
 assert.equal((await post({event:'page_view',path:'/'},{DNT:'1'})).status,204);
 assert.equal(stats.report().length,0);
 assert.equal((await post({event:'request_confirmed',path:'/'})).status,400);
 const res=await post({event:'page_view',path:'/'});assert.equal(res.status,204);assert.equal(res.headers.get('set-cookie'),null);
 const report=await fetch(url+'/admin/analytics/data',{headers:{Authorization:'Basic '+Buffer.from('admin:a-long-random-test-password-only').toString('base64')}});
 assert.equal(report.status,200);assert.match(report.headers.get('cache-control'),/no-store/);assert.equal((await report.json()).rows[0].count,1);
 }finally{await stats.stop();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('browser sends sanitized paths and coarse sources, honors GPC and attributes playback to original book',async()=>{
 const script=await fs.readFile(new URL('../public/analytics.js',import.meta.url),'utf8');
 function run(optout=false){const sent=[];const context={localStorage:{getItem:()=>JSON.stringify({allow:false,expires:Date.now()+864e5})},window:{},navigator:{globalPrivacyControl:optout},location:{pathname:'/requests/'+'b'.repeat(64),href:'https://example.com/requests/private?email=secret',hostname:'example.com'},document:{referrer:'https://google.com/search?q=private',addEventListener(){}},matchMedia:()=>({matches:false}),fetch:(_url,o)=>{sent.push(JSON.parse(o.body));return Promise.resolve();},URL};vm.runInNewContext(script,context);return {sent,track:context.window.audiobookAnalytics};}
 const x=run();assert.equal(x.sent[0].path,'/requests');assert.equal(x.sent[0].source,'google');assert.ok(!JSON.stringify(x.sent).includes('private'));
 x.track('chapter_play',{path:'/library/a/book'});assert.equal(x.sent[1].book,'book');assert.equal(x.sent[1].path,'/library/a/book');assert.deepEqual(run(true).sent,[]);
});

test('unique browsers deduplicate across dates, stages and formats with matched funnel denominators',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'visitors-'));let now=new Date('2026-11-10T12:00:00Z');
 try{
 const a=new Analytics({dir,routes,books,now:()=>now});await a.init();
 const event=(visitor,event)=>a.record({event,visitor,path:'/',book:'book',format:'m4b'},event==='download_served');
 const alice='a'.repeat(32),bob='b'.repeat(32),outsider='c'.repeat(32);
 event(alice,'page_view');event(alice,'page_view');event(alice,'chapter_play');event(alice,'download_click');
 event(bob,'page_view');event(bob,'download_served');event(outsider,'chapter_play');
 a.record({event:'page_view',path:'/'}); // Anonymous traffic must not dilute the consented denominator.
 now=new Date('2026-11-20T12:00:00Z');event(alice,'page_view');event(alice,'download_served');
 const f=a.funnel(30);assert.equal(f.visitors,2);assert.equal(f.listeners,1);assert.equal(f.downloaders,2);assert.equal(f.both,1);assert.equal(f.listenRate,0.5);assert.equal(f.downloadRate,1);assert.equal(f.listenerDownloadRate,1);
 const week=a.funnel(7);assert.equal(week.visitors,1);assert.equal(week.listeners,0);assert.equal(week.listenerDownloadRate,null);
 await a.flush();const disk=await fs.readFile(path.join(dir,'visitors.json'),'utf8');assert.ok(!disk.includes(alice));assert.ok(!disk.includes('book'));assert.ok(!disk.includes('/library'));
 const b=new Analytics({dir,routes,books,now:()=>now});await b.init();assert.deepEqual(b.funnel(),f);
 now=new Date('2027-03-01T00:00:00Z');assert.equal(b.funnel(90).visitors,0);assert.equal(b.funnel().downloadRate,null);await b.flush();assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'visitors.json'),'utf8')).days,{});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('server download attribution accepts only an anonymous cookie and honors opt-out',()=>{
 const req=headers=>({get:k=>headers[k.toLowerCase()]});const id='d'.repeat(32);
 assert.equal(visitorFromRequest(req({cookie:'other=value; ap_analytics='+id})),id);
 assert.equal(visitorFromRequest(req({cookie:'ap_analytics=person@example.com'})),undefined);
 assert.equal(visitorFromRequest(req({cookie:'ap_analytics='+id,dnt:'1'})),undefined);
 assert.equal(visitorFromRequest(req({cookie:'ap_analytics='+id,'sec-gpc':'1'})),undefined);
});
test('consent creates a stable browser ID only after opt-in and withdrawal stops identification',async()=>{
 const script=await fs.readFile(new URL('../public/analytics.js',import.meta.url),'utf8');let stored=null,cookie='',choiceClick;const sent=[];
 const doc={referrer:'',getElementById:()=>null,createElement:()=>({setAttribute(){},addEventListener:(_,fn)=>{choiceClick=fn;},remove(){}}),body:{append(){}},addEventListener(){}};
 Object.defineProperty(doc,'cookie',{get:()=>cookie,set:v=>{cookie=v.includes('Max-Age=0;')?'':v.split(';')[0];}});
 function load(gpc=false){const context={window:{},localStorage:{getItem:()=>stored,setItem:(_,v)=>{stored=v;}},crypto:crypto.webcrypto,Uint8Array,navigator:{globalPrivacyControl:gpc},document:doc,location:{pathname:'/',protocol:'https:',href:'https://example.com/',hostname:'example.com'},matchMedia:()=>({matches:true}),fetch:(_u,o)=>{sent.push(JSON.parse(o.body));return Promise.resolve();},URL};vm.runInNewContext(script,context);return context.window.audiobookAnalytics;}
 const track=load();assert.equal(sent[0].visitor,undefined);assert.equal(cookie,'');
 choiceClick({target:{closest:()=>({dataset:{choice:'yes'}})}});const id=sent.at(-1).visitor;assert.match(id,/^[a-f0-9]{32}$/);assert.equal(sent.at(-1).event,'visitor_visit');
 load();assert.equal(sent.at(-1).visitor,id);track('chapter_play');assert.equal(sent.at(-1).visitor,id);
 stored=JSON.stringify({allow:false,expires:Date.now()+864e5});track('page_view');assert.equal(sent.at(-1).visitor,undefined);assert.equal(cookie,'');
 const length=sent.length;load(true);assert.equal(sent.length,length);
});
