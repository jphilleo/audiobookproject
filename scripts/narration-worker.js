import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CATALOG } from '../src/catalog.js';
import { selectJob, recover, finishAttempt, requestedBooks } from '../src/narration-scheduler.js';
const root = path.resolve(process.env.NARRATION_WORKER_DIR || 'data/narration');
const library = path.resolve(process.env.LIBRARY_DIR || 'library');
const audio = path.join(root, 'audio');
const requestsFile = path.join(process.env.REQUEST_DIR || 'data/requests','requests.json');
const read = async (file, fallback) => { try {return JSON.parse(await fs.readFile(file,'utf8'));} catch(e) {if(e.code === 'ENOENT') return fallback; throw e;} };
await fs.mkdir(audio,{recursive:true,mode:0o700});
// systemd and flock also prevent simultaneous workers, including during deployments.
let state = await read(path.join(root,'state.json'),{jobs:{}});
for (const [order,b] of CATALOG.entries()) state.jobs[b.slug] ||= {slug:b.slug,order,status:'queued',failures:0};
recover(state.jobs);
const save = async () => { state.updated = Date.now(); await fs.writeFile(path.join(root,'state.json.tmp'),JSON.stringify(state),{mode:0o600});await fs.rename(path.join(root,'state.json.tmp'),path.join(root,'state.json')); };
let stopping=false, child=null, yielding=false, cooperative=false;
const stopChild=()=>{if(!child)return;try{cooperative?child.kill('SIGTERM'):process.kill(-child.pid,'SIGTERM');}catch{}};
process.on('SIGTERM',()=>{stopping=true;stopChild();});
process.on('SIGINT',()=>{stopping=true;stopChild();});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function reservationsNow() {
 const assigned=await read(path.join(root,'reservations.json'),[]), excluded=[];
 for(const slug of assigned)if(!await fs.access(path.join(audio,slug,'.mac-ready')).then(()=>true,()=>false))excluded.push(slug);
 return excluded;
}
async function published(slug) { const m=await read(path.join(library,slug,'manifest.json'),{}); return m.ready && m.m4b && m.mp3; }
async function health() {
  const disk=await fs.statfs(root);if(disk.bavail*disk.bsize<20e9)return 'Low disk space';
  const mem=await fs.readFile('/proc/meminfo','utf8');if(Number(mem.match(/MemAvailable:\s+(\d+)/)?.[1]||0)<1500000)return 'Low available memory';
  const pressure=await fs.readFile('/proc/pressure/memory','utf8');if(Number(pressure.match(/some avg10=([\d.]+)/)?.[1]||0)>1)return 'Memory pressure';
  // Website response time and active converter requests take precedence over catalog work.
  const started=Date.now();
  try {const r=await fetch(process.env.WORKER_HEALTH_URL || 'http://127.0.0.1:4800/',{signal:AbortSignal.timeout(2000)});await r.arrayBuffer();if(!r.ok||Date.now()-started>750)return 'Website response time';}catch{return 'Website unavailable';}
  const books=process.env.DATA_DIR || '/var/lib/audiobook/books';
  for(const dir of await fs.readdir(books).catch(()=>[])) {
    const b=await read(path.join(books,dir,'book.json'),{});
    if(b.chapters?.some(c=>['queued','working'].includes(c.status)))return 'Interactive conversion in progress';
  }
  return null;
}
async function run(script,args,job) {
  const log=await fs.open(path.join(root,`${job.slug}.log`),'a',0o600);
  let monitoring=false;
  const monitor=setInterval(async()=>{
    if(monitoring||yielding)return;monitoring=true;
    try {
      const requests=await read(requestsFile,{requests:{}}), reservations=await reservationsNow();
      const next=selectJob(state.jobs,requests,reservations);
      const reason=await health();
      if(stopping||reason||(next && next.slug!==job.slug && requestedBooks(requests).has(next.slug))) {
        yielding=true;state.reason=reason || 'Reader request has priority';await save();stopChild();
      }
    } catch {yielding=true;stopChild();}finally{monitoring=false;}
  },10000);
  try {
    return await new Promise(resolve=>{
      cooperative=script.endsWith('/narrate-queued.js');
      child=spawn(process.execPath,[script,...args],{detached:true,env:{...process.env,LIBRARY_DIR:audio,KOKORO_DTYPE:'fp32'},stdio:['ignore',log.fd,log.fd]});
      child.on('error',()=>resolve(1));child.on('close',code=>resolve(yielding||stopping?75:code??1));
    });
  } finally {clearInterval(monitor);while(monitoring)await delay(10);child=null;await log.close();}
}
await save();
while(!stopping) {
  try {
    // Publish completion observed externally (e.g. Mac); never schedule a second copy.
    for(const job of Object.values(state.jobs)) if(job.status!=='complete' && await published(job.slug)) finishAttempt(job,0);
    const requests=await read(requestsFile,{requests:{}});
    const reservations=await reservationsNow();
    state.priorities=[...requestedBooks(requests).keys()];
    state.reason=await health();
    const job=selectJob(state.jobs,requests,reservations);
    if(state.reason||!job) {state.active=null;await save();await delay(10000);continue;}
    yielding=false;state.active=job.slug;state.reason=null;job.status='generating';job.started=Date.now();await save();
    let code=0;
    const proof=await read(path.join(audio,job.slug,'delivery.json'),{});
    if(!proof.verified) {
      const imported=await fs.access(path.join(audio,job.slug,'.mac-ready')).then(()=>true,()=>false);
      if(!imported)code=await run('scripts/narrate-queued.js',[job.slug],job);
      if(code===0){job.status='checking';await save();code=await run('scripts/verify-request-book.js',[audio,job.slug],job);}
    }
    if(code===0){job.status='publishing';await save();code=await run('scripts/publish-worker-book.js',[audio,library,job.slug],job);}
    finishAttempt(job,code);state.active=null;await save();
  } catch(e) {if(state.active)finishAttempt(state.jobs[state.active],1);state.active=null;state.reason=`Worker paused: ${e.code || e.name}`;await save();await delay(10000);}
}
recover(state.jobs);state.active=null;state.reason='Stopped';await save();
