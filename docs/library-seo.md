# Library SEO pages

Updated 2026-11-17. All 200 published books have individual, server-rendered pages with unique titles, descriptions, canonical URLs, book details, source links, and discovery links. Author names connect to 33 collections with multiple published books, plus an author index.

Metadata describes actual availability: complete recordings use Audiobook data and download encodings; preview pages use Book data with a clearly labeled sample AudioObject. Email requests remain gated until delivery is configured. Do not advertise unavailable full files as ready downloads.

The sitemap includes the book pages and author collections with stable modification dates. Update SEO_UPDATED only for material shared-template changes. Recording dates may advance individual lastmod values. Trailing slashes redirect to canonical library paths.

Validation: npm test covers every catalog book's metadata, unique canonical URLs, author groups, sample versus complete structured data, and private-page exclusion. Check rendered desktop/mobile layouts and audit the live sitemap after deployment. These changes make pages discoverable and descriptive; indexing and ranking remain Google's decisions.

## 2026-11-25: useful content on every book page

All 200 catalog entries now include an attributed source-edition synopsis,
subjects, translator credits where present, and a short reading excerpt.
Regenerate `src/library-reading.json` with `node scripts/build-library-reading.js
/path/to/source-index.json`; the local index maps catalog slugs to original
Standard Ebooks EPUBs. The generator verifies each edition's identifier and
chapter alignment, stores a source hash, and skips heading-only part dividers
when selecting a reading passage. All imported text is escaped when rendered.
No EPUB filesystem paths or private request data are published.

Titles explicitly pair each book with “Audiobook”. Related links prioritize the
same author and source subjects, with rotating ties instead of repeatedly
promoting the same completed books. Sitemap lastmod reflects this material
shared-template update. Existing playback and actual availability remain intact.

Search Console inspection on November 25 found both Dracula and The Princess
and the Goblin indexed, despite being listed in the older exclusions report.
The only reported 404 was https://audio.audiobookproject.org/ (the file-storage
root), not a missing book page. Do not redirect arbitrary missing media to HTML
or report the old exclusion totals as current. These changes do not guarantee
indexing or ranking.
