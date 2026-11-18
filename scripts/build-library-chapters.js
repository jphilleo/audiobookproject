// Rebuild with: node scripts/build-library-chapters.js /path/to/source-index.json
// The index maps catalog slugs to local source EPUB paths; only titles enter Git.
import fs from 'node:fs/promises';
import { CATALOG } from '../src/catalog.js';
import { parseEpub } from '../src/epub.js';
const sources = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const result = {};
for (const book of CATALOG) {
  if (!sources[book.slug]) throw new Error(`Missing EPUB: ${book.slug}`);
  const parsed = await parseEpub(await fs.readFile(sources[book.slug]));
  const sections = parsed.sections.filter(s => s.selected);
  if (!sections.length) throw new Error(`No chapters: ${book.slug}`);
  const opening = book.openingIndex === undefined
    ? sections.find(s => /^(?:(?:chapter|book)[\s.:]+(?:0*1|i|one)\b|(?:0*1|i):)/i.test(s.title.trim())) || sections[0]
    : sections.find(s => s.index === book.openingIndex);
  if (!opening) throw new Error(`Missing opening chapter: ${book.slug}`);
  result[book.slug] = { previewIndex: sections.indexOf(opening), titles: sections.map(s => s.title) };
}
await fs.writeFile(new URL('../src/library-chapters.json', import.meta.url), JSON.stringify(result, null, 2)+'\n');
console.log(`Built chapter lists for ${Object.keys(result).length} books`);
