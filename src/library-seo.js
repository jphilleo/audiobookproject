// Stable URLs and factual metadata shared by library pages and the sitemap.
import { publishedBooks, bookUrl } from './catalog.js';
export const SEO_UPDATED = '2026-11-17';
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
  // Same-author discovery first; complete recordings are useful alternatives to samples.
  const candidates=books.filter(b=>b.slug!==book.slug);
  return candidates.sort((a,b)=>Number(b.authorSlug===book.authorSlug)-Number(a.authorSlug===book.authorSlug)||Number(b.ready)-Number(a.ready)||a.title.localeCompare(b.title)).slice(0,4);
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
