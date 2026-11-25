// Stable URLs and factual metadata shared by library pages and the sitemap.
import { publishedBooks, bookUrl } from './catalog.js';
import reading from './library-reading.json' with {type:'json'};
export const SEO_UPDATED = '2026-11-25';
export const authorUrl = slug => `/library/authors/${slug}`;
export function authorGroups(books = publishedBooks()) {
  const groups = new Map();
  for (const b of books) {
    if (!groups.has(b.authorSlug)) groups.set(b.authorSlug, {slug:b.authorSlug,name:b.author,books:[]});
    groups.get(b.authorSlug).books.push(b);
  }
  return [...groups.values()].filter(a=>a.books.length>1).sort((a,b)=>a.name.localeCompare(b.name));
}
export function relatedBooks(book, books = publishedBooks()) {
  // Source subjects connect related books; rotate ties so every page does not
  // funnel readers into the same four alphabetically first completed books.
  const candidates=books.filter(b=>b.slug!==book.slug);
  const terms=b=>new Set((reading[b.slug]?.subjects||[]).flatMap(s=>s.toLowerCase().split(/--|—/)).map(s=>s.trim()).filter(s=>s && !['fiction','novels','short stories','english','american','literature','juvenile fiction','translations into english'].includes(s)));
  const own=terms(book);
  const score=b=>Number(b.authorSlug===book.authorSlug)*100+[...terms(b)].filter(s=>own.has(s)).length*10;
  const ordered=[...books].sort((a,b)=>a.slug.localeCompare(b.slug));
  const index=ordered.findIndex(b=>b.slug===book.slug);
  const distance=b=>(ordered.findIndex(x=>x.slug===b.slug)-index+ordered.length)%ordered.length;
  return candidates.sort((a,b)=>score(b)-score(a)||distance(a)-distance(b)).slice(0,4);
}
export function bookModified(book) {
  const date=String(book.builtAt || '').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= new Date().toISOString().slice(0,10) && date > SEO_UPDATED ? date : SEO_UPDATED;
}
export function librarySitemapEntries(books = publishedBooks()) {
  const groups=authorGroups(books);
  const latest=books.reduce((d,b)=>bookModified(b)>d?bookModified(b):d,SEO_UPDATED);
  return [{url:'/library',modified:latest},{url:'/library/authors',modified:latest},...groups.map(a=>({url:authorUrl(a.slug),modified:a.books.reduce((d,b)=>bookModified(b)>d?bookModified(b):d,SEO_UPDATED)})),...books.map(b=>({url:bookUrl(b),modified:bookModified(b)}))];
}
