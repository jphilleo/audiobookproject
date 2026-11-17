import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]);await fs.mkdir(root,{recursive:true});
const audio=await fs.readFile(process.argv[3]);
const owner='a'.repeat(32);const chapters=Array.from({length:3},(_,index)=>({index,title:`Chapter ${index+1}`,words:30,selected:true,status:'done',progress:1,durationMs:13125,voice:'af_heart',speed:1,fingerprint:'old'}));
for(const [id,title]of [['c'.repeat(16),'Audit One'],['d'.repeat(16),'Audit Two'],['e'.repeat(16),'Missing Export']]){
 const dir=path.join(root,'books',id);await fs.mkdir(path.join(dir,'audio'),{recursive:true});await fs.mkdir(path.join(dir,'text'),{recursive:true});
 const ch=chapters.map(c=>({...c}));const key=ch.map(c=>`${c.index}:${c.fingerprint}:${c.voice}:${c.durationMs}`).join(',');
 await fs.writeFile(path.join(dir,'book.json'),JSON.stringify({id,title,author:'Audit',ownerId:owner,language:'en',voice:'af_heart',speed:1,cover:'cover.svg',createdAt:new Date().toISOString(),chapters:ch,built:id.startsWith('e')?{m4b:key}:{}}));
 await fs.writeFile(path.join(dir,'cover.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" onload="document.documentElement.setAttribute(\'data-audit-script-ran\',\'yes\')"><rect width="50" height="50" fill="green"/></svg>');
 for(const c of ch){await fs.writeFile(path.join(dir,'audio',`${c.index}.m4a`),audio);await fs.writeFile(path.join(dir,'text',`${c.index}.txt`),'This is a short audit passage.');}
}
for(const [slug,ready]of [['a-christmas-carol',true],['the-strange-case-of-dr-jekyll-and-mr-hyde',true],['pride-and-prejudice',false]]){
 const dir=path.join(root,'library',slug);await fs.mkdir(path.join(dir,'chapters'),{recursive:true});const ch=chapters.slice(0,ready?3:1).map((c,i)=>({title:c.title,file:`chapters/00${i+1}.m4a`,durationMs:13125,words:30}));
 for(const c of ch)await fs.writeFile(path.join(dir,c.file),audio);
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({ready,preview:!ready,chapters:ch,voice:{id:'af_heart',name:'Heart'},cover:null,durationMs:13125*ch.length,builtAt:'2026-11-16T12:00:00Z',m4b:{file:'book.m4b',bytes:1000},mp3:{file:'book.mp3',bytes:1000}}));
}
console.log(root);
