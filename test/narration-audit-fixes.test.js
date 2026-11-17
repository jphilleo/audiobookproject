import test from 'node:test';
import assert from 'node:assert/strict';
import {htmlToText,finalizeSections} from '../src/epub.js';
import {prepareNarration,chapterNarrationBody} from '../src/narration-text.js';
import {chunkText,chapterChunks} from '../src/tts.js';
import {pageLines,toParagraphs,outlineStarts,stripRunningHeaders} from '../src/pdf.js';
import {narrationFingerprint,requireIdleNarration} from '../src/narration-version.js';
const text=h=>htmlToText(h).text;
const long='This is a sentence in the story. '.repeat(30);
test('01: preserve pronoun after a name; retain explicit regnal readings',()=>{
 assert.equal(prepareNarration('The Henry I knew was kind.'),'The Henry I knew was kind.');
 assert.equal(prepareNarration('Henry VIII'), 'Henry the eighth');
 assert.equal(prepareNarration('Henry I',{heading:true}),'Henry the first');
});
test('02: preserve acronyms in opening text',()=>assert.equal(text('<p>US troops arrived.</p>'),'US troops arrived.'));
test('03: preserve Roman-looking ordinary words; remove marked page numbers',()=>{
 assert.equal(text('<p>civil</p><p>mix</p>'),'civil\n\nmix');
 assert.equal(text('<span epub:type="pagebreak">IV</span><p>Story.</p>'),'Story.');
});
test('04: preserve capitalized ending',()=>assert.ok(finalizeSections([{title:'Story',text:long+'\n\nTHE KING IS DEAD AT LAST'}],'Book')[0].text.endsWith('THE KING IS DEAD AT LAST')));
test('05: keep short epilogues without selecting copyright',()=>{
 const s=finalizeSections([{title:'Chapter 1',text:long},{title:'Epilogue',text:'They went home.'},{title:'Copyright',text:long}],'Book');
 assert.equal(s[1].selected,true);assert.equal(s[2].selected,false);
});
test('06: narrative copyright mention is not boilerplate',()=>assert.equal(finalizeSections([{title:'Chapter 1',text:'Copyright was disputed. '+long}],'Book')[0].selected,true));
test('07: preserve exponent; omit linked footnote reference',()=>{
 assert.equal(text('<p>10<sup>2</sup> units.</p>'),'10 squared units.');
 assert.equal(text('<p>Word<a epub:type="noteref" href="#n"><sup>2</sup></a>.</p>'),'Word.');
});
test('08: figure quotations survive',()=>assert.equal(text('<figure><blockquote><p>Come home.</p></blockquote></figure>'),'Come home.'));
test('09: linked data tables survive; marked navigation does not',()=>{
 assert.equal(text('<table><tr><td><a href="#a">Alice</a> paid.</td><td><a href="#b">Bob</a> paid.</td><td><a href="#c">Clara</a> paid.</td></tr></table>'),'Alice paid.\n\nBob paid.\n\nClara paid.');
 assert.equal(text('<nav epub:type="toc"><p>Contents</p></nav><p>Story.</p>'),'Story.');
});
test('10: preserve mixed block/inline text once, in order',()=>assert.equal(text('<div>Before <em>this</em>.<p>Inside.</p>After.</div>'),'Before this.\n\nInside.\n\nAfter.'));
test('11: keep unknown compound; join evidenced line-wrap word',()=>{
 const lines=[{text:'A well-',para:true},{text:'known author.',para:false}];
 assert.equal(toParagraphs(lines,false,new Set()),'A well-known author.');
 assert.equal(toParagraphs([{text:'extra-',para:true},{text:'ordinary.',para:false}],false,new Set(['extraordinary'])),'extraordinary.');
});
test('12: PDF positioning adds spaces only between words',async()=>{
 const item=(str,x,width)=>({str,transform:[1,0,0,10,x,100],width});
 const lines=await pageLines({getTextContent:async()=>({items:[item('Hel',0,15),item('lo',15,10),item('world.',40,30)]})});
 assert.equal(lines[0].text,'Hello world.');
});
test('13: bookmark does not erase short body sentence; exact heading omitted',()=>{
 const lines=[{text:'First sentence.',para:true},{text:'Next.',para:true}];
 assert.equal(toParagraphs(lines,'Chapter 1',new Set()),'First sentence.\n\nNext.');
 assert.equal(toParagraphs([{text:'Chapter 1',para:true},...lines],'Chapter 1',new Set()),'First sentence.\n\nNext.');
});
test('14: zero-based page zero is valid',async()=>assert.equal((await outlineStarts({getOutline:async()=>[{title:'A',dest:[0]},{title:'B',dest:[1]}]}))[0].page,0));
test('15: same-page bookmarks retain positions',async()=>{
 const result=await outlineStarts({getOutline:async()=>[{title:'A',dest:[0,{name:'XYZ'},0,700]},{title:'B',dest:[0,{name:'XYZ'},0,400]}]},[[{y:700},{y:600},{y:400}]]);
 assert.deepEqual(result.map(s=>[s.page,s.line]),[[0,0],[0,2]]);
});
test('16: preserve repeated body text; remove repeated margin header',()=>{
 const pages=Array.from({length:4},()=>[{text:'Running title',margin:true},{text:'Never again.',margin:false},{text:'Never again.',margin:false}]);
 stripRunningHeaders(pages);assert.ok(pages.every(p=>p.length===2&&p.every(l=>l.text==='Never again.')));
});
test('17: CRLF and CR paragraph boundaries survive',()=>{
 for(const separator of ['\r\n\r\n','\r\r'])assert.equal(chunkText('First.'+separator+'Second.').filter(c=>c.paragraphEnd).length,2);
 assert.equal(chapterNarrationBody('Title\r\n\r\nBody.','Title'),'Body.');
});
test('18: long title follows same chunk constraints',()=>{
 const title='A'.repeat(600), chunks=chapterChunks(title,'Story.');
 assert.ok(chunks.every(c=>c.text.length<=380));assert.equal(chunks.map(c=>c.text).join(''),title+'Story.');
});
test('19: queued and working jobs reject setting changes',()=>{
 for(const status of ['queued','working'])assert.throws(()=>requireIdleNarration({chapters:[{status}]}),/Stop the current/);
 assert.doesNotThrow(()=>requireIdleNarration({chapters:[{status:'done'}]}));
});
test('20: generation fingerprint changes with all reusable inputs',()=>{
 const options={title:'One',text:'Text.',voice:'af_heart',speed:1,selection:[1]};const hash=narrationFingerprint(options);
 assert.equal(hash,narrationFingerprint({...options}));
 for(const [key,value] of Object.entries({title:'Two',text:'Different.',voice:'bf_emma',speed:1.2,selection:[2]}))assert.notEqual(hash,narrationFingerprint({...options,[key]:value}));
 const original=process.env.NARRATION_MODEL_VERSION;process.env.NARRATION_MODEL_VERSION='changed-model';
 try{assert.notEqual(hash,narrationFingerprint(options));}finally{if(original===undefined)delete process.env.NARRATION_MODEL_VERSION;else process.env.NARRATION_MODEL_VERSION=original;}
});

test('mixed text directly in body is preserved',()=>assert.equal(text('<body>Before.<p>Inside.</p>After.</body>'),'Before.\n\nInside.\n\nAfter.'));
test('PDF page-only bookmarks can use printed headings; unresolved overlaps fail explicitly',async()=>{
 const doc={getOutline:async()=>[{title:'A',dest:[0]},{title:'B',dest:[0]}]};
 assert.deepEqual((await outlineStarts(doc,[[{text:'A',y:700},{text:'body',y:680},{text:'B',y:400}]])).map(s=>s.line),[0,2]);
 await assert.rejects(outlineStarts(doc,[[{text:'No matching headings',y:700}]]),/multiple bookmarks/);
});
