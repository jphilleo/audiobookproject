// Usage: node scripts/build-library-reading.js /path/to/source-index.json
// Extract source-backed reading material, never generated plot claims. EPUB paths stay local.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { parse } from 'node-html-parser';
import { CATALOG, sourceUrl } from '../src/catalog.js';
import { parseEpub } from '../src/epub.js';
import chapters from '../src/library-chapters.json' with {type:'json'};
const sources=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const array=v=>v==null?[]:Array.isArray(v)?v:[v];
const text=v=>String(typeof v==='object'?v?.['#text']||'':v||'').trim();
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',removeNSPrefix:true});
const result={};
for(const b of CATALOG){
  const bytes=await fs.readFile(sources[b.slug]);
  const zip=await JSZip.loadAsync(bytes);
  const container=xml.parse(await zip.file('META-INF/container.xml').async('string'));
  const opf=xml.parse(await zip.file(array(container.container.rootfiles.rootfile)[0]['full-path']).async('string')).package;
  const m=opf.metadata;
  if(!array(m.identifier).some(v=>text(v).includes(sourceUrl(b))))throw new Error(`Wrong source: ${b.slug}`);
  const parsed=await parseEpub(bytes);
  const sections=parsed.sections.filter(s=>s.selected);
  const sample=sections[chapters[b.slug].previewIndex];
  if(!sample || sample.title!==chapters[b.slug].titles[chapters[b.slug].previewIndex])throw new Error(`Chapter mismatch: ${b.slug}`);
  // Some editions begin with a part divider. Excerpt the first actual passage,
  // retaining its own title rather than presenting a date as reading material.
  const opening=sections.slice(chapters[b.slug].previewIndex).find(s=>s.text.trim().split(/\s+/).length>=80);
  if(!opening)throw new Error(`No substantial reading passage: ${b.slug}`);
  const prose=opening.text.replace(/\s+/g,' ').trim();
  // End at a word boundary, with an explicit ellipsis when the excerpt is shortened.
  const words=prose.split(' ');
  const excerpt=words.slice(0,160).join(' ')+(words.length>160?' …':'');
  const description=parse(text(array(m.description)[0]));
  const paragraphs=description.querySelectorAll('p').map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!paragraphs.length && description.textContent.trim())paragraphs.push(description.textContent.replace(/\s+/g,' ').trim());
  const roles=array(m.meta).filter(v=>v.property==='role'&&text(v)==='trl').map(v=>v.refines?.replace(/^#/,''));
  const translators=array(m.contributor).filter(v=>roles.includes(v.id)).map(text);
  const subjects=[...new Set(array(m.subject).map(text).filter(Boolean))];
  result[b.slug]={source:sourceUrl(b),sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),synopsis:paragraphs,subjects,translators,excerptTitle:opening.title,excerpt};
}
await fs.writeFile(new URL('../src/library-reading.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(`Built source-backed reading material for ${Object.keys(result).length} books`);
