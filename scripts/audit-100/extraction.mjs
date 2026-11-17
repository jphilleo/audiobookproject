import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {htmlToText,parseEpub,cleanTitle,finalizeSections,splitDocument} from '../../src/epub.js';
import {pageLines,outlineStarts,parsePdf} from '../../src/pdf.js';
import {chunkText} from '../../src/tts.js';
import {floatToPcm16} from '../../src/audio.js';
const results=[];
const save=(id,input,actual)=>results.push({id,input,actual});
for(const [id,html] of [
 [1,'<p>Word<sup epub:type="noteref">2</sup>.</p>'],
 [2,'<p>The array element is values[1].</p>'],
 [3,'<p><ruby>東京<rt>とうきょう</rt></ruby></p>'],
 [4,'<p hidden>Hidden draft.</p><p>Published text.</p>'],
 [5,'<p><del>Old version.</del><ins>New version.</ins></p>'],
 [6,'<p>The sign read <img alt="KEEP OUT"/>.</p>'],
 [16,'<p>First line<br/>Second line<br/>Third line</p>'],
])save(id,html,htmlToText(html));
async function epub({items,spine,files,nav=false}){
 const z=new JSZip();z.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
 z.file('book.opf',`<package><metadata><title>Test</title><creator>Author</creator><meta name="cover" content="cover"/></metadata><manifest>${items}</manifest><spine>${spine}</spine></package>`);
 for(const [name,body]of Object.entries(files))z.file(name,body);
 try{const b=await parseEpub(await z.generateAsync({type:'nodebuffer'}));return {cover:Boolean(b.cover),sections:b.sections.map(s=>({title:s.title,text:s.text,selected:s.selected}))};}catch(e){return {error:e.message};}
}
const c='<item id="c" href="c.xhtml" media-type="application/xhtml+xml"/>';
const body='<body><h1>Chapter One</h1><p>Main story.</p></body>';
save(7,'spine linear=no is supplemental',await epub({items:c+'<item id="s" href="s.xhtml" media-type="application/xhtml+xml"/>',spine:'<itemref idref="c"/><itemref idref="s" linear="no"/>',files:{'c.xhtml':body,'s.xhtml':'<p>Supplemental answer key.</p>'}}));
save(8,'second required spine file missing',await epub({items:c+'<item id="s" href="missing.xhtml" media-type="application/xhtml+xml"/>',spine:'<itemref idref="c"/><itemref idref="s"/>',files:{'c.xhtml':body}}));
save(9,'cover href is cover%20image.png',await epub({items:c+'<item id="cover" href="cover%20image.png" media-type="image/png" properties="cover-image"/>',spine:'<itemref idref="c"/>',files:{'c.xhtml':body,'cover image.png':'image'}}));
save(10,'nav href is nav%20page.xhtml',await epub({items:c+'<item id="nav" href="nav%20page.xhtml" media-type="application/xhtml+xml" properties="nav"/>',spine:'<itemref idref="c"/>',files:{'c.xhtml':'<p>Story.</p>','nav page.xhtml':'<nav epub:type="toc"><a href="c.xhtml">Named Chapter</a></nav>'}}));
save(11,'fragment-only links in nav/spine file',await epub({items:'<item id="c" href="c.xhtml" media-type="application/xhtml+xml" properties="nav"/>',spine:'<itemref idref="c"/>',files:{'c.xhtml':'<body><nav epub:type="toc"><a href="#one">Named One</a><a href="#two">Named Two</a></nav><p id="one">First.</p><p id="two">Second.</p></body>'}}));
save(12,'invalid Roman numerals in title',Object.fromEntries(['IIX','CIVIL','Chapter IC'].map(x=>[x,cleanTitle(x)])));
save(13,'meaningful prefix before Chapter IV',cleanTitle('Thoughts on Chapter IV'));
save(14,'three short chapters with headings but no TOC',await epub({items:c,spine:'<itemref idref="c"/>',files:{'c.xhtml':'<h1>Chapter 1</h1><p>One.</p><h1>Chapter 2</h1><p>Two.</p><h1>Chapter 3</h1><p>Three.</p>'}}));
const anchors=new Map([['one',{title:'One',children:0}],['two',{title:'Two',children:0}]]);
save(15,'two TOC anchors in one paragraph',splitDocument('<p><span id="one">First.</span><span id="two">Second.</span></p>',anchors).map(p=>({entry:p.entry?.title,text:p.paragraphs})));
function pdf(texts,lang){
 const z=[];const add=x=>(z.push(x),z.length);add('');add('');const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const kids=[];
 for(const lines of texts){const stream='BT /F1 12 Tf 50 700 Td '+lines.map((x,i)=>(i?'0 -16 Td ':'')+'('+x+') Tj').join(' ')+' ET';const st=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${st} 0 R >>`));}
 z[0]=`<< /Type /Catalog /Pages 2 0 R ${lang?'/Lang ('+lang+')':''} >>`;z[1]=`<< /Type /Pages /Kids [${kids.map(x=>x+' 0 R').join(' ')}] /Count ${kids.length} >>`;
 let s='%PDF-1.4\n';const offsets=[];z.forEach((x,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${x}\nendobj\n`;});const pos=Buffer.byteLength(s);s+=`xref\n0 ${z.length+1}\n0000000000 65535 f \n`+offsets.map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Root 1 0 R /Size ${z.length+1} >>\nstartxref\n${pos}\n%%EOF`;return Buffer.from(s);
}
try{save(17,'selectable 3-word PDF',await parsePdf(pdf([['A short story.']])));}catch(e){save(17,'selectable 3-word PDF',e.message);}
const prose=Array(8).fill('The traveler walks through the village and speaks to people.');
const mixed=await parsePdf(pdf([prose,[],prose]));save(18,'three-page PDF, middle page has no selectable text',{sections:mixed.sections.length,warnings:mixed.warnings||null,words:mixed.sections.reduce((n,s)=>n+s.words,0)});
save(19,'PDF catalog Lang=fr', (await parsePdf(pdf([prose],'fr'))).language);
const it=(str,x,y)=>({str,width:40,transform:[1,0,0,12,x,y]});
save(21,'two columns supplied row-by-row',await pageLines({getTextContent:async()=>({items:[it('Left one',50,700),it('Right one',350,700),it('Left two',50,680),it('Right two',350,680)]})}));
save(22,'two outline parts each containing two chapters',await outlineStarts({getOutline:async()=>[{title:'Part A',dest:[0],items:[{title:'A1',dest:[1]},{title:'A2',dest:[2]}]},{title:'Part B',dest:[3],items:[{title:'B1',dest:[4]},{title:'B2',dest:[5]}]}]}));
save(24,'page view lower-left is y=100, header y=850',await pageLines({view:[0,100,600,900],getTextContent:async()=>({items:[it('Body at 790',50,790)]})}));
save(25,'short narrative chapter title differs from book only by number',finalizeSections([{title:'Book 2',text:'This story continues.'}],'Book 1'));
const unicode='a'.repeat(379)+'\u{10400}'+'b';save(27,'supplementary letter straddles 380-code-unit boundary',chunkText(unicode).map(c=>({text:c.text.slice(-5),wellFormed:c.text.isWellFormed()})));
save(28,'NaN and infinities in generated waveform',[...floatToPcm16(new Float32Array([NaN,Infinity,-Infinity]))]);
await fs.writeFile(process.argv[2],JSON.stringify(results,null,2));console.log(results.map(r=>({id:r.id,actual:r.actual})));
