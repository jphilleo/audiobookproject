// Prepare an isolated preview release using the production extraction and speech fixes.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {CATALOG} from '../src/catalog.js';import {parseEpub} from '../src/epub.js';import {chapterChunks} from '../src/tts.js';import {prepareSpeechInput} from '../src/narration-text.js';import {NARRATION_VERSION} from '../src/narration-version.js';
const root=path.resolve(process.argv[2]);await fs.mkdir(root,{recursive:true});
const work=path.resolve('..');
const american=new Set(['Herman Melville','Mark Twain','Edgar Allan Poe','Louisa May Alcott','F. Scott Fitzgerald','Pauline E. Hopkins','Herman Whitaker','Carolyn Wells','Edgar Rice Burroughs','L. M. Montgomery','Jack London','L. Frank Baum','Ernest Hemingway','Dashiell Hammett','William Faulkner','Nathaniel Hawthorne','William James','Edith Wharton','Winnifred Eaton Reeve','Robert W. Chambers','Franklin W. Dixon','Carolyn Keene','Henry James','Kate Chopin','Joshua Slocum','A. W. Tozer','Willa Cather','Harry Harrison','Solomon Northup','Thomas Bulfinch','Helen Keller']);
const plan=[];
for(const book of CATALOG){
 const voice=american.has(book.author)?'af_heart':'bf_emma';
 const dirs=['library-expansion','library-first-chapters','library-audio','next-library/books','library-previews'];
 const candidates=[...dirs.map(d=>path.join(work,d,book.slug,'source.epub')),path.join(work,'preview-sources',book.slug+'.epub'),path.join(work,'library-100-sources',book.slug+'.epub'),path.join(work,'next-library/sources',book.slug+'.epub')];
 let source;for(const p of candidates){try{await fs.access(p);source=p;break;}catch{}}
 if(!source)throw new Error('No source for '+book.slug);
 const parsed=await parseEpub(await fs.readFile(source));const selected=parsed.sections.filter(s=>s.selected);
 let opening=book.openingIndex===undefined?selected.find(s=>/^(?:(?:chapter|book)[\s.:]+(?:0*1|i|one)\b|(?:0*1|i):)/i.test(s.title.trim()))||selected[0]:selected.find(s=>s.index===book.openingIndex);
 if(book.openingTitle&&opening?.title!==book.openingTitle){const matches=selected.filter(s=>s.title===book.openingTitle);if(matches.length!==1)throw new Error('Opening changed: '+book.slug+' '+JSON.stringify(selected.slice(0,12).map(s=>({i:s.index,t:s.title}))));opening=matches[0];if(book.openingEndIndex!==undefined)throw new Error('Grouped opening moved: '+book.slug);}
 if(book.openingEndIndex!==undefined){const group=selected.filter(s=>s.index>=book.openingIndex&&s.index<=book.openingEndIndex);if(group.length!==book.openingEndIndex-book.openingIndex+1)throw new Error('Missing sections');opening={title:book.previewTitle,text:group.map(s=>`${s.title}\n\n${s.text}`).join('\n\n'),words:group.reduce((n,s)=>n+s.words,0)};}
 if(!opening)throw new Error('No opening: '+book.slug);
 if(book.slug==='a-christmas-carol')opening.text=opening.text.replace(/\bSt\. Paul’s Churchyard/g,'Saint Paul’s Churchyard');
 const full=['a-christmas-carol','the-strange-case-of-dr-jekyll-and-mr-hyde'].includes(book.slug);
 const item={slug:book.slug,title:book.title,author:book.author,authorSlug:book.authorSlug,voice,reason:american.has(book.author)?'Quality-first American English narration for this North American author.':'Quality-first British English narration for this British work or English translation.',source,openingTitle:opening.title,words:opening.words,complete:full};plan.push(item);
 if(full)continue;
 const dir=path.join(root,book.slug);await fs.mkdir(dir,{recursive:true});
 const chunks=chapterChunks(opening.title,opening.text).map(c=>({...c,speech:prepareSpeechInput(c.text,{voice})}));
 const input={...item,version:NARRATION_VERSION,chunks};input.fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
 await fs.writeFile(path.join(dir,'input.json'),JSON.stringify(input));
}
await fs.writeFile(path.join(root,'plan.json'),JSON.stringify(plan,null,2));console.log(plan.length,'books;',plan.filter(b=>!b.complete).length,'previews;',plan.reduce((n,b)=>n+b.words,0),'words');
