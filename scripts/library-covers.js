// Fetches each catalog book's EPUB from Standard Ebooks (if it isn't here yet) and saves its cover
// and a small thumbnail, so books can show up as placeholders before they're narrated.
//   node scripts/library-covers.js
import fs from "node:fs/promises";
import path from "node:path";
import { CATALOG, bookDir, epubUrl, smallCover } from "../src/catalog.js";
import { parseEpub } from "../src/epub.js";

for (const b of CATALOG) {
  const dir = bookDir(b.slug), epub = path.join(dir, "source.epub");
  await fs.mkdir(dir, { recursive: true });
  try { await fs.access(epub); } catch {
    const res = await fetch(epubUrl(b));
    if (!res.ok) { console.log(b.slug, "download failed", res.status); continue; }
    await fs.writeFile(epub, Buffer.from(await res.arrayBuffer()));
  }
  const { cover } = await parseEpub(await fs.readFile(epub));
  if (!cover || cover.mediaType === "image/svg+xml") { console.log(b.slug, "no cover"); continue; }
  const name = cover.mediaType === "image/png" ? "cover.png" : "cover.jpg";
  try { await fs.access(path.join(dir, name)); } catch { await fs.writeFile(path.join(dir, name), cover.data); }
  const thumb = smallCover({ ...b, cover: name });
  console.log(b.slug, thumb, (await fs.stat(path.join(dir, thumb))).size, "bytes");
}
process.exit(0);
