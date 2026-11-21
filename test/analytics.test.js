import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import vm from 'node:vm';
import {Analytics,installAnalytics} from '../src/analytics.js';
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

const request=(ip='192.0.2.1',headers={})=>({ip,get:k=>({'user-agent':'Test Browser',...headers}[k.toLowerCase()])});
test('daily visitors deduplicate stages, rotate at midnight and survive same-day restarts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'daily-'));let now=new Date('2026-11-20T12:00:00Z');
 try {
 const a=new Analytics({dir,routes,books,now:()=>now});await a.init();
 const first=a.identify(request()),salt=a.visitorSalt;
 assert.equal(a.identify(request()),first);
 const emit=(id,event)=>a.record({event,path:'/'},false,id);
 emit(first,'page_view');emit(first,'page_view');emit(first,'chapter_play');emit(first,'chapter_play');emit(first,'download_click');
 emit(a.identify(request('192.0.2.2')),'page_view');
 emit(a.identify(request('192.0.2.3')),'chapter_play');
 a.record({event:'page_view',path:'/',visitor:'a'.repeat(64)});
 assert.equal(a.funnel(1).visitors,2);assert.equal(a.funnel(1).listeners,1);assert.equal(a.funnel(1).downloadRate,0.5);
 await a.flush();const b=new Analytics({dir,routes,books,now:()=>now});await b.init();assert.equal(b.identify(request()),first);
 now=new Date('2026-11-21T00:00:01Z');const second=a.identify(request());assert.notEqual(second,first);assert.notEqual(a.visitorSalt,salt);
 emit(second,'page_view');emit(second,'download_click');assert.equal(a.funnel(1).listeners,0);assert.equal(a.funnel(1).visitors,1);assert.equal(a.funnel(7).visitors,3);assert.equal(a.funnel(7).both,1);
 await a.flush();const disk=await fs.readFile(path.join(dir,'visitors.json'),'utf8');for(const value of [salt,'192.0.2.1','Test Browser'])assert.ok(!disk.includes(value));
 now=new Date('2027-03-01T00:00:00Z');assert.equal(a.funnel(90).visitors,0);assert.equal(a.funnel().downloadRate,null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('daily identity honors privacy signals and ignores cookies',()=>{
 const a=new Analytics({dir:'/tmp/unused'});a.rotateVisitorSalt();
 for(const headers of [{dnt:'1'},{'sec-gpc':'1'},{'x-analytics-opt-out':'1'},{'user-agent':'crawler'},{'user-agent':''}])assert.equal(a.identify(request(undefined,headers)),undefined);
 assert.equal(a.identify(request()),a.identify(request(undefined,{cookie:'ap_analytics=old'})));
});
test('browser creates no popup or persistent ID and retires the old cookie',async()=>{
 const script=await fs.readFile(new URL('../public/analytics.js',import.meta.url),'utf8');let cookie='ap_analytics=old',choice=null,click;const sent=[];
 const document={referrer:'',addEventListener:(_,fn)=>{click=fn;},get cookie(){return cookie;},set cookie(v){assert.match(v,/Max-Age=0/);cookie='';}};
 const context={window:{},document,localStorage:{getItem:()=>choice,setItem(){assert.fail('Must not store identity');}},navigator:{},location:{pathname:'/',origin:'https://example.com',href:'https://example.com',hostname:'example.com'},matchMedia:()=>({matches:false}),URL,fetch:(_u,o)=>{sent.push(JSON.parse(o.body));return Promise.resolve();}};
 vm.runInNewContext(script,context);assert.equal(cookie,'');assert.equal(sent[0].visitor,undefined);assert.equal(sent[0].excludeVisitor,undefined);
 choice=JSON.stringify({allow:false,expires:Date.now()+864e5});context.window.audiobookAnalytics('page_view');assert.equal(sent.at(-1).excludeVisitor,true);
 click({target:{closest:()=>({href:'https://example.com/requests/'+'a'.repeat(64)+'/download'})}});assert.equal(sent.at(-1).event,'download_click');assert.ok(!JSON.stringify(sent).includes('a'.repeat(64)));
});
test('migration discards old persistent hashes and salt without mixing denominators',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'migration-'));
 try {const old='a'.repeat(64),salt='old-secret-salt';await fs.writeFile(path.join(dir,'visitors.json'),JSON.stringify({salt,days:{'2026-11-20':{[old]:7}}}));
 const a=new Analytics({dir,routes,books,now:()=>new Date('2026-11-20T12:00:00Z')});await a.init();assert.equal(a.funnel().visitors,0);await a.flush();const disk=await fs.readFile(path.join(dir,'visitors.json'),'utf8');assert.ok(!disk.includes(old));assert.ok(!disk.includes(salt));assert.deepEqual(JSON.parse(disk).legacyDaily['2026-11-20'],[1,1,1,0]);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
