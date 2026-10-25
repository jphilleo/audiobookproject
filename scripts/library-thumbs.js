// Makes cover-sm.jpg next to each finished library book's cover. The server also does this on
// demand, so this is only needed to prepare thumbnails ahead of time.
import { readyBooks, smallCover } from "../src/catalog.js";
for (const b of readyBooks()) console.log(b.slug, smallCover(b));
