# Audiobook Project

Free, open-source audiobook maker: EPUB or PDF in, chaptered audiobook out. Lives at [audiobookproject.org](https://audiobookproject.org). Brand guide: `/brand`.

Upload a DRM-free EPUB (or a PDF with selectable text), pick a voice, and listen. Chapters are narrated one at a time with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), an open neural TTS model that runs locally, so free
narration costs only local compute.

- EPUB parsing: title, author, cover, chapter titles from the EPUB3 nav or EPUB2 NCX
- Skips front matter, tiny pages and license boilerplate (Project Gutenberg etc.) by default
- Voice picker with a preview read from the book's own opening lines
- Listen while it's still narrating: each chapter becomes playable as soon as it finishes
- Download a chaptered **M4B** (with cover) for Apple Books / BookPlayer / Audiobookshelf, or one **MP3** with chapter markers
- **Private podcast feed** per book (paste into any podcast app)
- Shows a per-word cost estimate for the future premium tier ($3 per 100k words, not wired up yet)

## Run

Requires Node 20+ and `ffmpeg` on your PATH.

```bash
npm install
npm start            # http://localhost:4800
npm run dev          # same, but restarts on code changes and reloads open tabs
npm run sample       # writes samples/pride-and-prejudice-sample.epub to test with
```

The first start downloads the Kokoro model (~330MB fp32) from Hugging Face. Set `KOKORO_DTYPE=q8` for a ~90MB
download that narrates about 1.6x slower. On an M4 Mac, fp32 narrates at ~5x real time (a 120k-word novel takes about 2.7 hours).

Voice recommendations run locally by default. To enable model-based suggestions, set
`VOICE_RECOMMENDATION_MODEL` to a model that supports structured outputs and provide
`OPENAI_API_KEY` in the server environment. Requests include title, author, language and
the embedded description when available. Chapter text stays on the server.

## Layout

- `src/epub.js`: EPUB → metadata + plain-text chapters (split by TOC anchors, captions/page numbers removed, DRM detection)
- `src/pdf.js`: PDF → chapters from bookmarks or "Chapter N" headings, running headers/footers removed
- `src/pages.js`: search landing pages (`/epub-to-audiobook`, `/epub-to-mp3`, `/epub-to-m4b`, `/pdf-to-audiobook`), sitemap
- `src/tts.js`: TTS client, voice list, text chunking; `src/tts-worker.js` runs Kokoro on a worker thread
- `src/audio.js`: PCM → AAC per chapter, chaptered M4B via ffmpeg
- `src/library.js`: books on disk (`data/books/<id>`), the narration queue
- `server.js`: HTTP API, podcast feed
- `views/`: page templates (`app.html` for the converter pages; About, FAQ, Privacy, Donate, Brand) and the shared `_header`/`_footer`
- `public/`: the web UI script, styles and logo files (no build step)

## Public site

The converter and public-domain library are live at [audiobookproject.org](https://audiobookproject.org).
See [DEPLOY.md](DEPLOY.md) for hosting, library publishing, and the `DONATION_URL` setting.
Leave an optional one-time [tip on Stripe](https://buy.stripe.com/4gMeVdcLP55Z4Me5h348000)
to help cover the cost of the free converter and library.

Accounts, premium voices, translation, and multiple workers are future work.

## License

The code is free software under the [GNU AGPL-3.0](LICENSE). You can use, change and share it,
including commercially, but if you run a modified version for other people (for example as a
website), you have to make your full source code available to them under the same license.

The Audiobook Project name and logo aren't covered by the license. Please don't use them for your
own version.

Only use it with books you own the rights to or that are in the public domain.
