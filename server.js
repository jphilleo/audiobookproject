import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { listVoices, loadTts, synthesize } from "./src/tts.js";
import { recommendVoice } from "./src/voice-recommendation.js";
import { floatToPcm16, wavHeader } from "./src/audio.js";
import * as lib from "./src/library.js";
import { PAGES, INFO_PAGES, render, appVars, infoVars } from "./src/pages.js";
import { LIBRARY_DIR, publishedBooks, findBook, bookUrl } from "./src/catalog.js";
import { libraryVars, bookVars, feedXml } from "./src/library-pages.js";
import { DEV, RELOAD_SCRIPT, devReload } from "./src/dev-reload.js";

const PORT = Number(process.env.PORT || 4800);
const MAX_UPLOAD_MB = 50;
const root = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Behind Cloudflare (or any proxy), trust X-Forwarded-Proto so HTTPS is detected and cookies are marked secure.
if (process.env.TRUST_PROXY) app.set("trust proxy", true);
app.use(express.json());
if (DEV) devReload(app, root);
// Pages: converter landing pages share views/app.html; info pages have their own views. All share the header/footer partials.
const origin = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
const view = (name) => fs.promises.readFile(path.join(root, "views", `${name}.html`), "utf8");
const layout = async (name) => ({ template: await view(name), header: await view("_header"), footer: await view("_footer") });
const sendHtml = (res, html) => res.set("Cache-Control", "no-cache").type("html").send(DEV ? html.replace("</body>", `${RELOAD_SCRIPT}</body>`) : html);
for (const route of Object.keys(PAGES)) {
  app.get(route, async (req, res) => sendHtml(res, render(await layout("app"), route, appVars(route, origin(req)))));
}
for (const [route, page] of Object.entries(INFO_PAGES)) {
  app.get([route, `${route}/`], async (req, res) => sendHtml(res, render(await layout(page.view), route, infoVars(route, origin(req)))));
}
// The public-domain library: an index, a page and a podcast feed per finished book, and the audio itself.
app.get(["/library", "/library/"], async (req, res) => sendHtml(res, render(await layout("library"), "/library", libraryVars(origin(req)))));
app.get("/library/:author/:slug", async (req, res, next) => {
  const book = findBook(req.params.author, req.params.slug);
  if (!book) return next();
  sendHtml(res, render(await layout("book"), "/library", bookVars(book, origin(req))));
});
app.get("/library/:author/:slug/feed.xml", (req, res, next) => {
  const book = findBook(req.params.author, req.params.slug);
  if (!book?.ready) return next();
  res.type("application/rss+xml").send(feedXml(book, origin(req)));
});
// Finished audio never changes in place, so it can be cached for a long time.
// Only the audio and covers are public; source files, manifests and logs are not.
app.use("/library-audio", (req, res, next) => (/\.(m4a|m4b|mp3|jpg|png|svg|webp)$/i.test(req.path) ? next() : res.status(404).end()),
  express.static(LIBRARY_DIR, { index: false, maxAge: "30d" }));

app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`));
app.get("/sitemap.xml", (req, res) => {
  const urls = [...Object.keys(PAGES), ...Object.entries(INFO_PAGES).filter(([, p]) => !p.hidden).map(([r]) => r), "/library", ...publishedBooks().map(bookUrl)].map((r) => `<url><loc>${origin(req)}${r}</loc></url>`).join("");
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

// Always revalidate the UI files so browsers never show a stale version after an update.
app.get("/samples/pride-and-prejudice-sample.epub", (_req, res) =>
  res.type("application/epub+zip").sendFile(path.join(root, "samples", "pride-and-prejudice-sample.epub")));
app.use(express.static(path.join(root, "public"), { index: false, extensions: ["html"], setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") }));

// Anonymous owner cookie: lets a browser see its own books without an account. Not used for tracking.
const OWNER_COOKIE = "ap_owner";
app.use("/api", (req, res, next) => {
  const match = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${OWNER_COOKIE}=([a-f0-9]{32})`));
  req.ownerId = match?.[1];
  if (!req.ownerId) {
    req.ownerId = crypto.randomBytes(16).toString("hex");
    res.cookie(OWNER_COOKIE, req.ownerId, { httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: 365 * 86400000 });
  }
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

const publicBook = (b) => {
  const selectedWords = b.chapters.filter((c) => c.selected).reduce((n, c) => n + c.words, 0);
  const totalWords = b.chapters.reduce((n, c) => n + c.words, 0);
  return { ...b, ownerId: undefined, cancelRequested: undefined, description: undefined, totalWords, selectedWords, expiresAt: lib.expiresAt(b), estimate: lib.estimate(selectedWords) };
};
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => res.status(400).json({ error: String(err.message || err) }));
// Private routes: only the browser that uploaded a book can see or change it.
// Audio, cover, download and feed URLs stay reachable by their unguessable id so podcast apps can fetch them.
const need = (req) => {
  const b = lib.getBook(req.params.id);
  if (!b || b.ownerId !== req.ownerId) throw new Error("Book not found");
  return b;
};
const byId = (req) => { const b = lib.getBook(req.params.id); if (!b) throw new Error("Book not found"); return b; };

app.get("/api/voices", wrap(async (_req, res) => res.json({ voices: await listVoices(), pricing: lib.PRICING })));

const previewCache = new Map();
app.get("/api/preview", wrap(async (req, res) => {
  const voice = String(req.query.voice || "af_heart");
  const text = String(req.query.text || "It was the best of times, it was the worst of times.").slice(0, 300);
  const key = `${voice}|${text}`;
  if (!previewCache.has(key)) {
    const pcm = floatToPcm16(await synthesize(text, voice));
    previewCache.set(key, Buffer.concat([wavHeader(pcm.length), pcm]));
  }
  res.type("audio/wav").send(previewCache.get(key));
}));

app.get("/api/books", (req, res) => res.json({ books: lib.listBooks(req.ownerId).map(publicBook) }));

app.post("/api/books", upload.single("epub"), wrap(async (req, res) => {
  if (!req.file) throw new Error("Upload an .epub file");
  const book = await lib.addBook(req.file.buffer, req.file.originalname, req.ownerId);
  res.json(publicBook(book));
}));

app.get("/api/books/:id", wrap(async (req, res) => res.json(publicBook(need(req)))));

app.post("/api/books/:id/voice-recommendation", wrap(async (req, res) => {
  const book = need(req);
  res.set("Cache-Control", "private, no-store").json({ recommendation: await recommendVoice(book, await listVoices()) });
}));

app.get("/api/books/:id/text/:index", wrap(async (req, res) => {
  need(req);
  res.type("text/plain").send(await fs.promises.readFile(path.join(lib.DATA_DIR, req.params.id, "text", `${Number(req.params.index)}.txt`), "utf8"));
}));

app.post("/api/books/:id/narrate", wrap(async (req, res) => {
  need(req);
  const { voice, speed, chapters } = req.body || {};
  if (!voice) throw new Error("Pick a voice");
  if (!Array.isArray(chapters) || !chapters.length) throw new Error("Pick at least one chapter");
  res.json(publicBook(await lib.startNarration(req.params.id, { voice, speed: Number(speed) || 1, chapters: chapters.map(Number) })));
}));

app.post("/api/books/:id/cancel", wrap(async (req, res) => { need(req); await lib.cancelNarration(req.params.id); res.json(publicBook(need(req))); }));
app.delete("/api/books/:id", wrap(async (req, res) => { need(req); await lib.deleteBook(req.params.id); res.json({ ok: true }); }));

app.get("/api/books/:id/cover", (req, res) => {
  const p = lib.coverPath(req.params.id);
  p ? res.sendFile(p) : res.status(404).end();
});

app.get("/api/books/:id/audio/:index.m4a", (req, res) => {
  const p = lib.audioPath(req.params.id, req.params.index);
  fs.existsSync(p) ? res.type("audio/mp4").sendFile(p) : res.status(404).end();
});

app.get("/api/books/:id/audiobook.:format", wrap(async (req, res) => {
  const book = byId(req);
  const { format } = req.params;
  if (format !== "m4b" && format !== "mp3") throw new Error("Unknown format");
  const p = await lib.audiobookPath(req.params.id, format);
  const name = `${book.title}${book.author ? ` - ${book.author}` : ""}.${format}`.replace(/[\/\\:*?"<>|]/g, "");
  res.download(p, name);
}));

// Private podcast feed: paste into Apple Podcasts / Overcast / Pocket Casts to listen with resume + speed control.
const xmlEscape = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
app.get("/api/books/:id/feed.xml", wrap(async (req, res) => {
  const book = byId(req);
  const base = `${origin(req)}/api/books/${book.id}`;
  const created = new Date(book.createdAt).getTime();
  const items = book.chapters.filter((c) => c.status === "done").map((c) => {
    const size = fs.statSync(lib.audioPath(book.id, c.index)).size;
    // Stagger pubDates so podcast apps list chapters in reading order.
    const pub = new Date(created + (book.chapters.length - c.index) * -60000).toUTCString();
    return `<item><title>${xmlEscape(c.title)}</title><guid isPermaLink="false">${book.id}-${c.index}-${c.voice}</guid><pubDate>${pub}</pubDate><itunes:episode>${c.index + 1}</itunes:episode><itunes:duration>${Math.round(c.durationMs / 1000)}</itunes:duration><enclosure url="${base}/audio/${c.index}.m4a" length="${size}" type="audio/mp4"/></item>`;
  });
  res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>${xmlEscape(book.title)}</title><description>${xmlEscape(`${book.title}${book.author ? ` by ${book.author}` : ""}, narrated privately for you.`)}</description>
<itunes:author>${xmlEscape(book.author)}</itunes:author><itunes:block>Yes</itunes:block><itunes:type>serial</itunes:type>
${book.cover ? `<itunes:image href="${base}/cover"/>` : ""}
${items.join("\n")}
</channel></rss>`);
}));

app.use((err, _req, res, _next) => res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? `File is larger than ${MAX_UPLOAD_MB}MB` : String(err.message || err) }));

await lib.loadLibrary();
await lib.deleteExpired();
setInterval(() => lib.deleteExpired().catch((err) => console.error("Cleanup failed:", err)), 3600000);
app.listen(PORT, () => console.log(`Audiobook prototype on http://localhost:${PORT}`));
loadTts().then(() => console.log("Kokoro voice model loaded"));
