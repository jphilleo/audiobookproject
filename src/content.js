// Content shown below the converter on each landing page. It has to earn its place: short, plain,
// and useful to someone deciding whether to use the tool, with real samples where they help.
// Only the steps and sections marked `visible` show in full; the rest folds into "Good to know".
// It doubles as the page's search content and FAQ structured data, so keep every claim true to
// what the app actually does (limits, formats, bitrates, how chapters are found).

// Free voices with samples in public/samples (made by scripts/make-site-samples.js).
const SAMPLE_VOICES = [
  ["af_heart", "Heart", "US"], ["af_bella", "Bella", "US"], ["am_michael", "Michael", "US"],
  ["am_fenrir", "Fenrir", "US"], ["bf_emma", "Emma", "UK"], ["bm_george", "George", "UK"],
];
const SAMPLE_LINES = [
  ["melville", "Moby-Dick", "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world."],
  ["austen", "Pride and Prejudice", "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."],
  ["dickens", "A Tale of Two Cities", "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness."],
];
const PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';

const SAMPLER = `
    <div class="sampler" data-sampler>
      <div class="sampler-voices" role="radiogroup" aria-label="Voice">
        ${SAMPLE_VOICES.map(([id, name, accent], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-voice="${id}">${name}<span>${accent}</span></button>`).join("")}
      </div>
      <blockquote class="sampler-text">${SAMPLE_LINES[0][2]}</blockquote>
      <div class="sampler-bar">
        <button type="button" class="sampler-play" aria-label="Play sample">${PLAY}</button>
        <select aria-label="Book">${SAMPLE_LINES.map(([id, book, text]) => `<option value="${id}" data-text="${text.replace(/"/g, "&quot;")}">${book}</option>`).join("")}</select>
        <div class="sampler-speed" role="radiogroup" aria-label="Speed">
          ${["0.8", "1", "1.5", "2"].map((s) => `<button type="button" role="radio" aria-checked="${s === "1"}" data-speed="${s}">${s}×</button>`).join("")}
        </div>
      </div>
    </div>`;

// The fallback sample, used until a library book is ready to play here instead.
export const SAMPLE_BOOK = `
    <div class="sample-book" data-sample-book>
      <audio preload="none" src="/samples/sample-audiobook.mp3"></audio>
      <div class="sample-book-head">
        <button type="button" class="sampler-play" aria-label="Play the sample audiobook">${PLAY}</button>
        <div><strong>Three Fables</strong><span>A 77-second sample · 3 chapters · voice: Heart</span></div>
      </div>
      <ol class="sample-chapters">
        <li><button type="button" data-start="0">The Tortoise and the Hare<span>0:30</span></button></li>
        <li><button type="button" data-start="29.9">The Fox and the Grapes<span>0:21</span></button></li>
        <li><button type="button" data-start="51.25">The Boy Who Cried Wolf<span>0:26</span></button></li>
      </ol>
      <div class="sample-downloads"><a class="btn" href="/samples/sample-audiobook.m4b" download>Download M4B</a><a class="btn" href="/samples/sample-audiobook.mp3" download>Download MP3</a></div>
    </div>`;

// Sections shared between pages.
const VOICES = {
  visible: true,
  h2: "Hear the voices",
  html: `
    <p>Six of the free voices, reading a classic opening line. Try a few speeds too. Once you upload a book, you can hear any voice read your own first page.</p>${SAMPLER}`,
};

const FORMATS = {
  h2: "Try the formats",
  html: `
    <p>Play the sample here, or download it and open it in the app you'd actually use.</p><!--sample-book-->
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Best for</th><th>Plays in</th></tr></thead>
      <tbody>
        <tr><td>M4B</td><td>Audiobook apps. Chapters, cover art, remembers your place.</td><td>Apple Books, BookPlayer, Smart AudioBook Player, Audiobookshelf, VLC</td></tr>
        <tr><td>MP3</td><td>Playing on anything, including car stereos.</td><td>Every phone, computer and player, or a USB stick in the car</td></tr>
        <tr><td>Podcast feed</td><td>Listening on your phone. Each chapter is an episode.</td><td>Apple Podcasts, Overcast, Pocket Casts, any podcast app</td></tr>
      </tbody>
    </table></div>
    <p>On a phone, the podcast feed is the easiest: paste one link into your podcast app and every chapter shows up as an episode. All three are 64 kbps mono, about 29 MB per hour.</p>`,
};

// The short version, for pages where the format isn't the question.
const FORMATS_BRIEF = {
  h2: "What you get",
  html: `
    <p>An <a href="/epub-to-m4b">M4B</a> for audiobook apps, one <a href="/epub-to-mp3">MP3</a> that plays anywhere, or a private podcast feed where each chapter is an episode. On a phone, the podcast feed is the easiest.</p>`,
};

const BOOKS = {
  h2: "Which books work",
  html: `
    <p>DRM-free EPUBs, and PDFs with real text in them, up to 50 MB. <a href="https://www.gutenberg.org" rel="noopener">Project Gutenberg</a> and <a href="https://standardebooks.org" rel="noopener">Standard Ebooks</a> have tens of thousands of free classics. Books from indie authors who sell DRM-free work too, and so does your own writing.</p>
    <p>Books bought from Kindle, Apple Books, Kobo or Google Play usually won't work, because DRM locks them to that store's app. Scanned PDFs (photos of pages) don't work yet.</p>`,
};

// Questions used on several pages.
const Q = {
  free: ["Is it free?", "Yes. The standard voices are free, with no account, trial or watermark. Premium voices will cost a little per word when they launch, and you'll always see the price first."],
  account: ["Do I need an account?", "No. Your books are remembered in your browser for 30 days."],
  howLong: ["How long does it take?", "About a minute for the first chapter, and you can start listening right away. A whole novel takes a few hours. You can close the tab while it works."],
  language: ["What languages does it support?", "English for now, with American and British voices."],
  kindle: ["Will my Kindle or Apple Books purchases work?", "Usually not. Those books are DRM-protected, and we don't convert them or help remove DRM."],
  rights: ["Can I share the audiobook?", "If the book is public domain, yes. Otherwise it's for your own listening."],
  chapters: ["Does it keep the chapters?", "Yes. They come from the book's own table of contents, and you can untick any you don't want read."],
};

export const CONTENT = {
  "/": {
    steps: {
      h2: "How it works",
      items: [
        ["Upload a book", "A DRM-free EPUB, or a PDF with selectable text."],
        ["Pick a voice", "Hit Sample to hear it read your book first."],
        ["Start listening", "The first chapter is ready in about a minute, and a whole novel in a few hours. It keeps going even if you close the tab."],
        ["Take it with you", "Download an M4B or MP3, or add it to your podcast app."],
      ],
    },
    sections: [
      VOICES,
      FORMATS,
      BOOKS,
    ],
    faqs: [Q.free, Q.account, Q.language],
  },

  "/epub-to-audiobook": {
    steps: {
      h2: "How to convert an EPUB to an audiobook",
      items: [
        ["Upload the EPUB", "Any DRM-free EPUB up to 50 MB."],
        ["Check the chapters", "They come from the book's table of contents. Copyright pages and the like are unticked for you."],
        ["Pick a voice", "Hit Sample to hear it read your first page."],
        ["Listen or download", "Start with the first chapter in about a minute, then grab the M4B or MP3."],
      ],
    },
    sections: [
      {
        h2: "What happens to your book",
        html: `
    <ul>
      <li>Chapters keep their real titles, so your app shows "Chapter 3: The Storm", not "Track 07". This works even when the publisher put several chapters in one file.</li>
      <li>The copyright page, table of contents, index and Project Gutenberg license are skipped. You can tick them back on.</li>
      <li>The book's cover becomes the audiobook's cover art.</li>
    </ul>`,
      },
      VOICES,
      FORMATS_BRIEF,
      BOOKS,
    ],
    faqs: [
      Q.free,
      ["What about MOBI, AZW3 or KFX files?", "Not directly. If the book is DRM-free, convert it to EPUB with Calibre first. Books from the Kindle store won't work."],
      ["Does it read images and tables?", "It reads the text. Images are skipped and tables are read as plain text, so books full of charts don't make great audio."],
    ],
  },

  "/epub-to-mp3": {
    steps: {
      h2: "How to convert an EPUB to MP3",
      items: [
        ["Upload the EPUB", "MP3 is already selected on this page."],
        ["Pick a voice", "Hit Sample to hear it read your first page."],
        ["Download the MP3", "One file for the whole book, with chapter markers and cover art."],
        ["Copy it anywhere", "Your phone, an old MP3 player, or a USB stick for the car."],
      ],
    },
    sections: [
      {
        h2: "Why MP3",
        html: `
    <p>It plays on everything. If you're not sure what your car or player supports, pick MP3. A 10-hour novel comes out around 290 MB.</p>
    <p>If you mostly listen in an audiobook app, <a href="/epub-to-m4b">M4B</a> is a little nicer: same sound, but apps remember your place in it.</p>`,
      },
      VOICES,
      FORMATS,
      BOOKS,
    ],
    faqs: [
      Q.free,
      ["Will my car show the chapters?", "Most car stereos ignore chapter markers and just play the file, but many remember where you stopped."],
      Q.howLong,
    ],
  },

  "/epub-to-m4b": {
    steps: {
      h2: "How to convert an EPUB to M4B",
      items: [
        ["Upload the EPUB", "M4B is already selected on this page."],
        ["Pick a voice", "Hit Sample to hear it read your first page."],
        ["Download the M4B", "One file with chapters, the cover, and the title and author."],
        ["Open it in your app", "Apple Books, BookPlayer, Audiobookshelf or VLC."],
      ],
    },
    sections: [
      {
        h2: "What's an M4B?",
        html: `
    <p>It's the standard audiobook file. The audio inside is the same as an M4A, but the .m4b ending tells your app it's a book, so it shows the chapters and remembers where you stopped. The whole book is one file, which makes it easy to keep and move around.</p>`,
      },
      {
        h2: "Opening an M4B",
        html: `
    <ul>
      <li><strong>Mac:</strong> double-click it to open it in Apple Books. It syncs to your iPhone through Finder.</li>
      <li><strong>iPhone on its own:</strong> save it to Files and open it in BookPlayer.</li>
      <li><strong>Android:</strong> Smart AudioBook Player or Voice.</li>
      <li><strong>Windows:</strong> VLC plays it with chapters.</li>
      <li><strong>Audiobookshelf, Plex or Jellyfin:</strong> drop it in your audiobooks folder as Author / Title / file.m4b.</li>
    </ul>`,
      },
      VOICES,
      { ...FORMATS, visible: true },
      BOOKS,
    ],
    faqs: [
      Q.free,
      Q.howLong,
    ],
  },

  "/pdf-to-audiobook": {
    steps: {
      h2: "How to convert a PDF to an audiobook",
      items: [
        ["Upload the PDF", "Any PDF with selectable text, up to 50 MB."],
        ["Check the chapters", "They come from the PDF's bookmarks or its \"Chapter\" headings. Untick what you don't need."],
        ["Pick a voice", "Hit Sample to hear it read your first page."],
        ["Listen or download", "Start in about a minute, or grab the M4B or MP3."],
      ],
    },
    sections: [
      {
        h2: "Will my PDF work?",
        html: `
    <p>Open it and try to highlight a sentence. If you can, it'll work. PDFs exported from Word, Google Docs or LaTeX are fine, and so are most ebooks and papers. Scanned PDFs are pictures of pages, so there's no text to read yet.</p>`,
      },
      {
        h2: "What gets cleaned up",
        html: `
    <ul>
      <li>Headers and footers that repeat on every page are removed.</li>
      <li>Page numbers are removed, so you won't hear "forty-two" mid-sentence.</li>
      <li>Chapters come from the bookmarks, then from "Chapter" headings, and otherwise the document is split into even sections.</li>
    </ul>
    <p>If the book also comes as an EPUB, use that. It keeps cleaner text. Two-column layouts and heavy footnotes can come out a little jumbled.</p>`,
      },
      VOICES,
      FORMATS_BRIEF,
    ],
    faqs: [
      Q.free,
      ["Does it work for textbooks and papers?", "Yes, if the text is selectable. Untick the references and appendices. Equations and charts don't work well as audio."],
    ],
  },

  "/ebook-to-audiobook": {
    steps: {
      h2: "How to turn an ebook into an audiobook",
      items: [
        ["Get a DRM-free copy", "EPUB is best. A PDF with real text works too."],
        ["Upload it", "Chapters are found automatically."],
        ["Pick a voice", "Hit Sample to hear it read your first page."],
        ["Listen or download", "Start in about a minute, or grab the M4B or MP3."],
      ],
    },
    sections: [
      {
        h2: "Which ebook files work",
        html: `
    <div class="table-wrap"><table>
      <thead><tr><th>File</th><th>Works?</th><th></th></tr></thead>
      <tbody>
        <tr><td>EPUB</td><td>Yes</td><td>Best results. <a href="/epub-to-audiobook">EPUB to audiobook</a></td></tr>
        <tr><td>PDF</td><td>If it has real text</td><td><a href="/pdf-to-audiobook">PDF to audiobook</a></td></tr>
        <tr><td>MOBI, AZW3</td><td>Convert first</td><td>If DRM-free, turn it into an EPUB with Calibre.</td></tr>
        <tr><td>Kindle store books</td><td>No</td><td>Locked to the Kindle app.</td></tr>
      </tbody>
    </table></div>`,
      },
      VOICES,
      FORMATS_BRIEF,
    ],
    faqs: [Q.free, Q.chapters, Q.language],
  },

  "/epub-text-to-speech": {
    steps: {
      h2: "How to have an EPUB read aloud",
      items: [
        ["Upload the EPUB", "Any DRM-free EPUB."],
        ["Pick a voice", "Each one can read your first page before you decide."],
        ["Start listening", "The first chapter is ready in about a minute."],
        ["Keep it", "Download it or add it to your podcast app, so it plays with the screen off."],
      ],
    },
    sections: [
      VOICES,
      {
        h2: "Why not just use read-aloud?",
        html: `
    <p>Phones and ebook apps can read a page aloud, but usually in a robotic voice, only while the app is open, and with nothing to keep. Turning the book into audio once means you can listen with the screen off, offline, in the car, or on another device.</p>
    <p>For a quick paragraph, read-aloud is fine. For a whole book, this is easier.</p>`,
      },
      FORMATS_BRIEF,
      BOOKS,
    ],
    faqs: [
      Q.free,
      ["Can I change the speed?", "Yes, from 0.8× to 2× in the player. Your podcast or audiobook app has its own speed control too."],
      ["Does it work offline?", "Making the audiobook needs a connection. Once you've downloaded it, it plays offline."],
    ],
  },

  "/listen-to-epub-on-iphone": {
    steps: {
      h2: "How to listen to an EPUB on iPhone",
      items: [
        ["Open this page in Safari", "Tap Choose an EPUB and pick the book from Files."],
        ["Pick a voice and start", "The first chapter is ready in about a minute."],
        ["Add it to Apple Podcasts", "Tap Add to podcast app to copy the link. In Apple Podcasts, go to Library, tap ⋯, then Follow a Show by URL."],
        ["Or use BookPlayer", "Download the M4B to Files and open it in the free BookPlayer app."],
      ],
    },
    sections: [
      {
        h2: "Podcast app or BookPlayer?",
        html: `
    <p>The podcast app is the quickest to set up, and each chapter shows up as an episode. BookPlayer is a proper audiobook player, with chapters, a sleep timer and bookmarks. Both remember where you were and work with CarPlay and AirPods.</p>
    <p>Apple Books can open EPUBs, but it won't read them aloud as an audiobook. iOS has Speak Screen (in Accessibility settings), but it reads one page at a time and stops when you leave the app.</p>`,
      },
      VOICES,
      FORMATS,
    ],
    faqs: [
      ["Do I need to install an app?", "No. It works in Safari, and Apple Podcasts is already on your iPhone."],
      ["Can I lock my phone while it works?", "Yes. The narration happens on our servers."],
      ["Will it remember where I stopped?", "Yes, in Apple Podcasts, BookPlayer and Apple Books."],
      Q.free,
      Q.kindle,
    ],
  },

  "/gutenberg-audiobooks": {
    steps: {
      h2: "How to make an audiobook from a Project Gutenberg book",
      items: [
        ["Find the book", "Search gutenberg.org. There are over 70,000."],
        ["Download the EPUB", "The EPUB3 version usually has the best table of contents."],
        ["Upload it here", "The Gutenberg license and header are skipped, so it starts with the actual book."],
        ["Listen and share", "Public-domain audiobooks are yours to share."],
      ],
    },
    sections: [
      {
        h2: "More classics to make yourself",
        html: `
    <ul class="cols">
      <li>Pride and Prejudice</li><li>Moby-Dick</li><li>The Adventures of Sherlock Holmes</li><li>Dracula</li><li>Jane Eyre</li>
      <li>The Great Gatsby</li><li>A Tale of Two Cities</li><li>The Count of Monte Cristo</li><li>Meditations</li><li>The Odyssey</li>
    </ul>
    <p><a href="https://standardebooks.org" rel="noopener">Standard Ebooks</a> has many of the same books, cleaned up and nicely formatted. They often read even better. Public domain depends on your country, so check before sharing outside the US.</p>`,
      },
      {
        h2: "What about LibriVox?",
        html: `
    <p><a href="https://librivox.org" rel="noopener">LibriVox</a> has free recordings by volunteers, and if they've done your book and you like the reader, go listen there. This is for the books they haven't recorded, or when you want one voice all the way through.</p>`,
      },
      VOICES,
      FORMATS_BRIEF,
    ],
    faqs: [
      ["Are these audiobooks free?", "Yes. The books are free from Project Gutenberg and narration with the standard voices is free here."],
      Q.howLong,
    ],
  },

  "/audiobooks-for-dyslexia": {
    steps: {
      h2: "How to listen to any book or PDF",
      items: [
        ["Upload it", "A DRM-free EPUB, or a PDF you can highlight text in, like a handout or article."],
        ["Pick a voice you like", "It matters more than you'd think. Try a few."],
        ["Start listening", "The first chapter is ready in about a minute."],
        ["Set your pace", "Anywhere from 0.8× to 2×."],
      ],
    },
    sections: [
      VOICES,
      {
        h2: "School readings",
        html: `
    <p>Most class readings are PDFs, and those work if you can highlight the text. Headers and page numbers are removed, and the PDF's bookmarks become chapters, so you can jump to the one you were assigned. Untick references and appendices to skip them.</p>
    <p>If you have a documented print disability, <a href="https://www.bookshare.org" rel="noopener">Bookshare</a> and <a href="https://learningally.org" rel="noopener">Learning Ally</a> also offer free accessible textbooks.</p>`,
      },
      FORMATS_BRIEF,
    ],
    faqs: [
      ["Is it free for students?", "It's free for everyone. No account, no trial."],
      ["Can it read my textbook?", "If it's a DRM-free EPUB or a PDF with selectable text, yes. Textbooks from online stores are often DRM-protected."],
      ["Does it highlight words as it reads?", "No. It makes audio, not a read-along view. A lot of people play it while following along in their usual reader."],
      Q.language,
    ],
  },

  "/manuscript-to-audiobook": {
    steps: {
      h2: "How to hear your manuscript read aloud",
      items: [
        ["Export your draft", "As an EPUB if you can. Otherwise a PDF."],
        ["Upload it", "Your chapter headings become chapters."],
        ["Pick a voice", "Hear it read your opening first."],
        ["Listen like a reader", "On a walk or in the car. Note what trips you up."],
      ],
    },
    sections: [
      {
        h2: "Why listen to your own draft",
        html: `
    <p>You'll hear what your eye skips: the word you used three times in a paragraph, the sentence that never ends, the dialogue nobody would say out loud. It's an old editing trick, and an audiobook lets you do it for the whole book, away from your desk.</p>`,
      },
      {
        h2: "Exporting your manuscript",
        html: `
    <div class="table-wrap"><table>
      <thead><tr><th>App</th><th>How</th></tr></thead>
      <tbody>
        <tr><td>Google Docs</td><td>File › Download › EPUB Publication</td></tr>
        <tr><td>Apple Pages</td><td>File › Export To › EPUB</td></tr>
        <tr><td>Scrivener</td><td>File › Compile, then choose ePub</td></tr>
        <tr><td>Vellum, Atticus</td><td>Export the ebook</td></tr>
        <tr><td>Microsoft Word</td><td>Save as PDF. On Windows, turn on "Create bookmarks using Headings" in the options so your chapters come through.</td></tr>
      </tbody>
    </table></div>
    <p>Your draft stays private. It's never public, never used to train AI, and it's deleted after 30 days, or whenever you delete it.</p>`,
      },
      VOICES,
    ],
    faqs: [
      ["Can I upload a Word document?", "Save it as a PDF first, or open it in Google Docs or Pages and export an EPUB."],
      ["How do I get chapters?", "In an EPUB they come from the table of contents. In a PDF, use bookmarks or headings that start with \"Chapter\"."],
      ["Can I sell the audiobook?", "It's your book, so yes. Audiobook stores have their own rules about AI narration, so check those first."],
      Q.free,
      Q.howLong,
    ],
  },
};
