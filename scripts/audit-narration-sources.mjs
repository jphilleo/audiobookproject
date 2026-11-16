import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parseEpub} from '../src/epub.js';
import {chunkText} from '../src/tts.js';
import {prepareNarration} from '../src/narration-text.js';
const files=execFileSync('rg',['--files','-g','source.epub',process.argv[2] || '../'],{encoding:'utf8'}).split('\n').filter(x=>x.endsWith('/source.epub'));
const rows=[];
for(const file of files){
 try{
 const b=await parseEpub(await fs.readFile(file));
 const sections=b.sections.filter(s=>s.selected);
 if(!sections){console.log(Object.keys(b));break;}
 const text=sections.map(x=>x.text).join('\n');
 const patterns={decimals:/\d+\.\d+/g,initials:/\b[A-Z]\.\s+[A-Z]\.\s+\p{Lu}\p{Ll}+/gu,softHyphens:/\u00ad/g,abbreviations:/\b(?:St|Rev|Prof|Capt|Col|Gen)\.\s+[A-Z][a-z]+/g};
 const hits={};for(const [name,re] of Object.entries(patterns)){const m=[...text.matchAll(re)];hits[name]={count:m.length,examples:m.slice(0,3).map(x=>text.slice(Math.max(0,x.index-35),x.index+x[0].length+35))};}
 const mismatches = sections.filter(s => chunkText(s.text).map(c=>c.text).join('').replace(/[^\p{L}\p{N}]/gu,'') !== prepareNarration(s.text).replace(/[^\p{L}\p{N}]/gu,'')).map(s=>s.title);
 rows.push({file,title:b.title,sections:sections.length,hits,mismatches});
 }catch(e){rows.push({file,error:String(e)});}
}
await fs.writeFile(process.argv[3] || '../../outputs/christmas-carol-audit/library-risk-scan.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify({books:rows.length, sections:rows.reduce((n,r)=>n+(r.sections||0),0), errors:rows.filter(r=>r.error), textMismatches:rows.filter(r=>r.mismatches?.length).map(r=>({title:r.title,chapters:r.mismatches})), totals:Object.fromEntries(['decimals','initials','softHyphens','abbreviations'].map(k=>[k,rows.reduce((n,r)=>n+(r.hits?.[k].count||0),0)]))},null,2));
