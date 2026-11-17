import test from 'node:test';import assert from 'node:assert/strict';
import {CATALOG} from '../src/catalog.js';
import {bookVars} from '../src/library-pages.js';
import {authorGroups,relatedBooks,librarySitemapEntries,bookModified} from '../src/library-seo.js';
const previews=CATALOG.map(b=>({...b,preview:true,ready:false,voice:{name:'Emma'},durationMs:123000,chapters:[{title:'Chapter One',file:'chapters/001.m4a',durationMs:123000}]}));
test('all 200 books have unique canonical URLs, titles, descriptions and truthful parseable structured data',()=>{
 const seen={title:new Set(),description:new Set(),canonical:new Set()};
 for(const b of previews){const vars=bookVars(b,'https://audiobookproject.org');
  for(const key of Object.keys(seen)){assert.ok(vars[key]);assert.ok(!seen[key].has(vars[key]),key+': '+b.slug);seen[key].add(vars[key]);}
  assert.ok(vars.editionDetails.includes('First-chapter sample'));assert.ok(!vars.requestForm);
  const schemas=[...vars.jsonld.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
  assert.equal(schemas[0]['@type'],'Book');assert.equal(schemas[0].duration,undefined);assert.equal(schemas[0].workExample['@type'],'AudioObject');assert.equal(schemas[0].workExample.duration,'PT123S');assert.equal(schemas[1]['@type'],'BreadcrumbList');
 }
 assert.equal(seen.canonical.size,200);
});
test('author hubs and sitemap contain only real public pages and stable modification dates',()=>{
 const groups=authorGroups(previews);assert.equal(groups.length,33);assert.ok(groups.every(a=>a.books.length>=2));
 const entries=librarySitemapEntries(previews);assert.equal(entries.length,235);assert.equal(new Set(entries.map(e=>e.url)).size,235);assert.ok(entries.every(e=>e.modified==='2026-11-17'));assert.ok(entries.every(e=>!e.url.includes('/requests/')));
 assert.equal(bookModified({builtAt:'2099-01-01'}),'2026-11-17');
});
test('related books exclude the current book and prioritize the same author',()=>{
 const b=previews.find(b=>b.author==='Charles Dickens');const related=relatedBooks(b,previews);assert.ok(related.every(r=>r.slug!==b.slug));assert.equal(related[0].author,b.author);
});
test('complete-book schema includes full downloads and correct duration',()=>{
 const b={...previews[0],ready:true,preview:false,m4b:{file:'book.m4b',bytes:12345},mp3:{file:'book.mp3',bytes:12345}};
 const v=bookVars(b,'https://example.org');const ld=JSON.parse([...v.jsonld.matchAll(/<script[^>]*>(.*?)<\/script>/g)][0][1]);assert.equal(ld['@type'],'Audiobook');assert.equal(ld.encoding.length,2);assert.equal(ld.duration,'PT123S');assert.match(v.editionDetails,/Complete recording/);
});
