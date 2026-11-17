import fs from 'node:fs/promises';
import path from 'node:path';
import {outlineStarts} from '../../src/pdf.js';
import {feedXml,bookVars,audioUrl} from '../../src/library-pages.js';
import * as lib from '../../src/library.js';
const results=[];const save=(id,actual)=>results.push({id,actual});
try {save(23,await outlineStarts({getOutline:async()=>[{title:'First',dest:[0,{name:'FitR'},0,600,500,700]},{title:'Second',dest:[0,{name:'FitR'},0,400,500,500]}]},[[{text:'Opening words',y:700},{text:'Later words',y:500}]]));}catch(e){save(23,e.message);}
await lib.loadLibrary();
const a=lib.getBook('c'.repeat(16)),b=lib.getBook('d'.repeat(16)),e=lib.getBook('e'.repeat(16));
save(55,{path:await lib.audiobookPath(e.id),exists:await fs.access(await lib.audiobookPath(e.id)).then(()=>true,()=>false)});
b.chapters[2].status='queued';
save(39,{selected:b.chapters.filter(c=>c.selected).length,done:b.chapters.filter(c=>c.status==='done').length,export:await lib.audiobookPath(b.id)});
await fs.rm(lib.audioPath(a.id,2));
save(42,{status:a.chapters[2].status,fileExists:await fs.access(lib.audioPath(a.id,2)).then(()=>true,()=>false)});
b.chapters[1].status='queued';await fs.writeFile(path.join(lib.DATA_DIR,b.id,'book.json'),JSON.stringify(b));await lib.loadLibrary();save(43,lib.getBook(b.id).chapters.map(c=>c.status));
const changed=await lib.startNarration(e.id,{voice:'nonexistent-voice',speed:-2,chapters:[999,1.5]});
save(47,{selected:changed.chapters.filter(c=>c.selected).length,status:'resolved successfully'});save(48,{acceptedSpeed:changed.speed});save(49,{acceptedVoice:changed.voice});
const fake={slug:'audit-remote-only',title:'Audit',author:'Audit',authorSlug:'audit',ready:true,chapters:[{title:'One',file:'chapter.m4a',durationMs:1000}],voice:{name:'Heart'}};
save(70,feedXml(fake,'https://example.test').match(/<enclosure[^>]+>/)?.[0]);
const first=feedXml(fake,'https://example.test');await new Promise(r=>setTimeout(r,1100));save(71,{pubDatesChanged:first!==feedXml(fake,'https://example.test')});
save(72,audioUrl({...fake,audioSha256:'a'.repeat(64)},'chapter.m4a'));
try{bookVars({...fake,chapters:undefined},'https://example.test');}catch(e){save(74,e.message);}
await fs.writeFile(process.argv[2],JSON.stringify(results,null,2));console.log(results);
