import test from 'node:test';import assert from 'node:assert/strict';
import {CATALOG} from '../src/catalog.js';
import {bookVars} from '../src/library-pages.js';
import {authorGroups,relatedBooks,librarySitemapEntries,bookModified,SEO_UPDATED} from '../src/library-seo.js';
import reading from '../src/library-reading.json' with {type:'json'};
const previews=CATALOG.map(b=>({...b,preview:true,ready:false,voice:{name:'Emma'},durationMs:123000,chapters:[{title:'Chapter One',file:'chapters/001.m4a',durationMs:123000}]}));
test('all 200 books have unique canonical URLs, titles, descriptions and truthful parseable structured data',()=>{
 const seen={title:new Set(),description:new Set(),canonical:new Set()};
 for(const b of previews){const vars=bookVars(b,'https://audiobookproject.org');
  for(const key of Object.keys(seen)){assert.ok(vars[key]);assert.ok(!seen[key].has(vars[key]),key+': '+b.slug);seen[key].add(vars[key]);}
  assert.ok(!/first.chapter|preview/i.test(vars.editionDetails));assert.ok(!vars.requestForm);
  const schemas=[...vars.jsonld.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
  assert.equal(schemas[0]['@type'],'Book');assert.equal(schemas[0].duration,undefined);assert.equal(schemas[0].workExample['@type'],'AudioObject');assert.equal(schemas[0].workExample.duration,'PT123S');assert.equal(schemas[1]['@type'],'BreadcrumbList');
 }
 assert.equal(seen.canonical.size,200);
});
test('author hubs and sitemap contain only real public pages and stable modification dates',()=>{
 const groups=authorGroups(previews);assert.equal(groups.length,33);assert.ok(groups.every(a=>a.books.length>=2));
 const entries=librarySitemapEntries(previews);assert.equal(entries.length,235);assert.equal(new Set(entries.map(e=>e.url)).size,235);assert.ok(entries.every(e=>e.modified===SEO_UPDATED));assert.ok(entries.every(e=>!e.url.includes('/requests/')));
 assert.equal(bookModified({builtAt:'2099-01-01'}),SEO_UPDATED);
});

test('every book has distinct source-backed reading material, safely rendered',()=>{
 assert.equal(Object.keys(reading).length,CATALOG.length);
 const excerpts=new Set();
 for(const book of previews){
  const r=reading[book.slug];
  assert.equal(r.source,`https://standardebooks.org/ebooks/${book.source}`);
  assert.match(r.sourceSha256,/^[a-f0-9]{64}$/);
  assert.ok(r.synopsis.length);assert.ok(r.excerpt.split(/\s+/).length>=30);
  assert.ok(!excerpts.has(r.excerpt));excerpts.add(r.excerpt);
  const v=bookVars(book,'https://example.org');
  assert.match(v.reading,/Read an excerpt/);assert.match(v.about,/Standard Ebooks/);
  assert.ok(!/<script/i.test(v.reading));
 }
 assert.deepEqual(reading.meditations.translators,['George Long']);
 const translated=previews.find(b=>b.slug==='crime-and-punishment');
 assert.match(bookVars(translated,'https://example.org').editionDetails,/Constance Garnett/);
});

test('related links stay within the catalog and diversify beyond completed books',()=>{
 const linked=new Set();
 for(const b of previews){const links=relatedBooks(b,previews);assert.equal(new Set(links.map(x=>x.slug)).size,4);for(const r of links){assert.notEqual(r.slug,b.slug);linked.add(r.slug);}}
 assert.ok(linked.size>150,`Only ${linked.size} books receive related links`);
});
test('related books exclude the current book and prioritize the same author',()=>{
 const b=previews.find(b=>b.author==='Charles Dickens');const related=relatedBooks(b,previews);assert.ok(related.every(r=>r.slug!==b.slug));assert.equal(related[0].author,b.author);
});
test('complete-book schema includes full downloads and correct duration',()=>{
 const b={...previews[0],ready:true,preview:false,m4b:{file:'book.m4b',bytes:12345},mp3:{file:'book.mp3',bytes:12345}};
 const v=bookVars(b,'https://example.org');const ld=JSON.parse([...v.jsonld.matchAll(/<script[^>]*>(.*?)<\/script>/g)][0][1]);assert.equal(ld['@type'],'Audiobook');assert.equal(ld.encoding.length,2);assert.equal(ld.duration,'PT123S');assert.match(v.editionDetails,/Complete recording/);
});


test('all books share the dock and chapter layout while downloads reflect availability',()=>{
 for(const ready of [false,true]) {
  const book={...previews[0],ready,m4b:ready?{file:'book.m4b',bytes:100}:undefined,mp3:ready?{file:'book.mp3',bytes:100}:undefined};
  const v=bookVars(book,'https://example.org',{delivery:true});
  assert.equal(v.bookClass,'lib-full');assert.equal(v.chaptersHeading,'Chapters');
  assert.equal(v.previewPlay,'');assert.equal(v.previewIntro,'');
  assert.match(v.player,/lib-player-dock/);assert.match(v.player,/id="lib-seek"/);
  assert.equal((v.player.match(/id="lib-audio"/g)||[]).length,1);
  assert.match(v.chapters,/lib-ch-icon/);assert.match(v.about,/About the audiobook/);
  assert.match(v.player,/id="lib-next"[^>]*disabled/);
  if(ready) {assert.match(v.downloads,/Download M4B/);assert.match(v.feedLink,/rss/);}
  else {assert.equal(v.downloads,'');assert.equal(v.feedLink,'');assert.match(v.requestForm,/Get the full audiobook free/);}
 }
});

test('source chapter lists cover the whole catalog without making missing audio playable',async()=>{
 const {default:lists}=await import('../src/library-chapters.json',{with:{type:'json'}});
 assert.equal(Object.keys(lists).length,200);
 for(const book of previews){
  const toc=lists[book.slug];assert.ok(toc.titles.length);assert.ok(toc.previewIndex>=0 && toc.previewIndex<toc.titles.length);
  const v=bookVars(book,'https://example.org');
  assert.equal((v.chapters.match(/<li>/g)||[]).length,toc.titles.length);
  assert.equal((v.chapters.match(/data-src=/g)||[]).length,1);
  assert.equal((v.chapters.match(/lib-ch-time/g)||[]).length,1);
  assert.match(v.chapters,new RegExp(`data-chapter-number="${toc.previewIndex+1}" data-chapter-total="${toc.titles.length}"`));
 }
 const alice=lists['alices-adventures-in-wonderland'];assert.equal(alice.titles.length,13);assert.equal(alice.titles[0],'All in the Golden Afternoon');assert.match(alice.titles[12],/Alice’s Evidence/);
});
