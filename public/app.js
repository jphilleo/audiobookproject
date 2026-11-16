const $ = (sel, el = document) => el.querySelector(sel);
const WPM = 155; // Kokoro at 1x reads roughly this fast.
const RATES = [1, 1.25, 1.5, 1.75, 2, 0.8];

const icon = {
  chevronLeft: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><text x="12" y="14.5" text-anchor="middle">15</text></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/><text x="12" y="14.5" text-anchor="middle">30</text></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
  podcast: '<svg viewBox="0 0 24 24"><path d="M5 11a7 7 0 0 1 14 0M8 11a4 4 0 0 1 8 0"/><circle cx="12" cy="12.5" r="1.2"/><path d="M12 15v5"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
};

const state = {
  voices: [],
  book: null,
  selected: new Set(),
  voice: "af_heart",
  speed: 1,
  pollTimer: null,
  playing: null, // { bookId, index }
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtInt = (n) => n.toLocaleString();
const duration = (seconds) => {
  if (seconds < 45) return "<1 min"; // a 4-word title page isn't "1 min"
  const mins = Math.max(1, Math.round(seconds / 60));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
};
const listenTime = (words) => duration((words / WPM) * 60);
const clock = (s) => {
  if (!isFinite(s)) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body;
}

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
function thumb(b, cls = "thumb") {
  if (b.cover) return `<img class="${cls}" src="/api/books/${b.id}/cover" alt="">`;
  const inner = cls.includes("lg")
    ? `<span class="gen-title">${esc(b.title)}</span><span class="gen-author">${esc(b.author)}</span>`
    : esc(b.title.trim()[0] || "?");
  return `<div class="${cls} gen" style="--h:${hue(b.title)}" aria-hidden="true">${inner}</div>`;
}

/* ---------- Routing ---------- */
function route() {
  const m = location.hash.match(/^#\/book\/(\w+)/);
  clearTimeout(state.pollTimer);
  previewAudio?.pause();
  if (m) openBook(m[1]);
  else showHome();
  // Section links (#questions) keep their place; switching between home and a book starts at the top.
  if (m || !location.hash) window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
document.querySelectorAll("[data-nav=home]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); location.hash = ""; }));

/* ---------- Home ---------- */
function bookStatus(b) {
  const sel = b.chapters.filter((c) => c.selected);
  const done = sel.filter((c) => c.status === "done").length;
  if (b.chapters.some((c) => c.status === "queued" || c.status === "working")) return `Narrating · ${done} of ${sel.length} chapters`;
  if (done && done === sel.length) return `Ready · ${duration(sel.reduce((n, c) => n + c.durationMs, 0) / 1000)}`;
  if (done) return `${done} of ${sel.length} chapters ready`;
  return `Not started · about ${listenTime(b.selectedWords)}`;
}

async function showHome() {
  $("#home").hidden = false;
  $("#book").hidden = true;
  state.book = null;
  const { books } = await api("/api/books");
  $("#library-wrap").hidden = !books.length;
  $("#library").innerHTML = books.map((b) => `
    <li><button class="lib-row" data-id="${b.id}">
      ${thumb(b)}
      <span><div class="lib-title">${esc(b.title)}</div><div class="sub">${esc(b.author || "Unknown author")} · ${bookStatus(b)}</div></span>
      ${icon.chevronRight}
    </button></li>`).join("");
  $("#library").querySelectorAll(".lib-row").forEach((el) => el.addEventListener("click", () => (location.hash = `#/book/${el.dataset.id}`)));
}

const drop = $("#drop");
const fileInput = $("#file");
drop.addEventListener("click", (e) => {
  if (e.target !== fileInput && !drop.classList.contains("busy")) fileInput.click();
});
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => e.dataTransfer.files[0] && uploadFile(e.dataTransfer.files[0]));
fileInput.addEventListener("change", () => fileInput.files[0] && uploadFile(fileInput.files[0]));

async function uploadFile(file) {
  if (drop.classList.contains("busy")) return;
  const err = $("#upload-error");
  err.hidden = true;
  if (!/\.(epub|pdf)$/i.test(file.name)) { err.textContent = "Only EPUB and PDF files work. Kindle formats (AZW, KFX, MOBI) aren't supported."; err.hidden = false; return; }
  drop.classList.add("busy");
  try {
    const fd = new FormData();
    fd.append("epub", file);
    const book = await api("/api/books", { method: "POST", body: fd });
    location.hash = `#/book/${book.id}`;
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  } finally {
    drop.classList.remove("busy");
    fileInput.value = "";
  }
}

/* ---------- Book ---------- */
async function openBook(id) {
  $("#home").hidden = true;
  $("#book").hidden = false;
  // Don't leave another book's page showing while this one loads.
  if (state.book?.id !== id) $("#book").innerHTML = "";
  try {
    const book = await api(`/api/books/${id}`);
    const fresh = state.book?.id !== id;
    state.book = book;
    if (fresh) {
      state.selected = new Set(book.chapters.filter((c) => c.selected).map((c) => c.index));
      state.voice = book.voice || store.get("voice") || "af_heart";
      renderBook();
    } else {
      update();
    }
    schedulePoll();
  } catch (e) {
    // Books belong to the browser that uploaded them, so a link opened elsewhere lands here.
    $("#book").innerHTML = e.message === "Book not found"
      ? `<a href="#" class="link back">${icon.chevronLeft}Your books</a>
        <h1>This book isn't here</h1>
        <p class="lede">Books are private to the browser that uploaded them, and they're deleted after 30 days. If you uploaded it in another browser or on another device, open it there, or upload the file again.</p>
        <a href="#" class="btn primary">Upload a book</a>`
      : `<a href="#" class="link back">${icon.chevronLeft}Your books</a><p class="error">${esc(e.message)}</p>`;
  }
}

const isBusy = () => state.book?.chapters.some((c) => c.status === "queued" || c.status === "working");

function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (isBusy()) state.pollTimer = setTimeout(() => openBook(state.book.id), 1500);
}

const selectedChapters = () => state.book.chapters.filter((c) => state.selected.has(c.index));

// Landing pages set data-format (e.g. /epub-to-mp3); remember it for later visits.
const preferredFormat = () => {
  const fromPage = document.body.dataset.format;
  if (fromPage) store.set("format", fromPage);
  return fromPage || store.get("format") || "m4b";
};
const isCurrent = (c) => c.status === "done" && c.voice === state.voice && (c.speed ?? 1) === state.speed;

function voiceOptions() {
  if (!state.voices.length) return `<option value="${state.voice}">Loading voices…</option>`;
  const groups = {};
  for (const v of state.voices) (groups[`${v.accent} ${v.gender.toLowerCase()}`] ??= []).push(v);
  return Object.entries(groups).map(([g, vs]) =>
    `<optgroup label="${esc(g)}">${vs.map((v) => `<option value="${v.id}" ${v.id === state.voice ? "selected" : ""}>${esc(v.name)} — ${esc(g)}</option>`).join("")}</optgroup>`
  ).join("");
}

// The free voices only speak English; say so before someone narrates a French or German book.
function languageNote(code) {
  if (!code || /^en\b/i.test(code)) return "";
  let name = code;
  try { name = new Intl.DisplayNames(["en"], { type: "language" }).of(code.split("-")[0]) || code; } catch {}
  return `<p class="lang-note">This book is in ${esc(name)}. The free voices only speak English, so it will be read with English pronunciation and won't sound right.</p>`;
}

function renderBook() {
  const b = state.book;
  $("#book").innerHTML = `
    <a href="#" class="link back">${icon.chevronLeft}Your books</a>
    <div class="book-head">
      ${thumb(b, "thumb lg")}
      <div>
        <h1>${esc(b.title)}</h1>
        <p class="author">${esc(b.author || "Unknown author")}</p>
        <div class="sub" id="book-meta"></div>
      </div>
    </div>

    <div class="create">
      <label class="field-label" for="voice">Voice</label>
      <div class="voice-row">
        <div class="select-wrap"><select id="voice">${voiceOptions()}</select>${icon.chevronDown}</div>
        <button class="btn" id="preview" aria-label="Play a sample">${icon.speaker}<span class="wide-only">Sample</span></button>
      </div>
      ${languageNote(b.language)}
      <div id="action"></div>
      <p class="error" id="book-error" hidden></p>
    </div>

    <div class="list-head">
      <h2>Chapters</h2>
      <span><button class="link" id="sel-all">Select all</button><button class="link" id="sel-none">Select none</button></span>
    </div>
    <ul class="rows" id="chapters"></ul>

    <p class="tail"><button class="link danger" id="delete">Delete this book</button></p>`;

  $("#voice").addEventListener("change", (e) => { state.voice = e.target.value; store.set("voice", state.voice); previewAudio?.pause(); update(); });
  $("#preview").addEventListener("click", previewVoice);
  setPreview("idle");
  $("#sel-all").addEventListener("click", () => { b.chapters.forEach((c) => state.selected.add(c.index)); update(); });
  $("#sel-none").addEventListener("click", () => { state.selected.clear(); update(); });
  $("#delete").addEventListener("click", async () => {
    if (!confirm(`Delete "${b.title}" and its audio? This can't be undone.`)) return;
    if (state.playing?.bookId === b.id) stopPlayer();
    await api(`/api/books/${b.id}`, { method: "DELETE" });
    location.hash = "";
  });
  $("#chapters").addEventListener("change", (e) => {
    if (!e.target.matches("input[type=checkbox]")) return;
    const i = Number(e.target.dataset.index);
    e.target.checked ? state.selected.add(i) : state.selected.delete(i);
    update();
  });
  $("#chapters").addEventListener("click", (e) => {
    const btn = e.target.closest(".ch-play");
    if (btn && !btn.disabled) playChapter(state.book, Number(btn.dataset.index));
  });
  $("#action").addEventListener("click", (e) => {
    const id = e.target.closest("button")?.id;
    if (id === "create") narrate();
    if (id === "stop") stopNarration();
    if (id === "copy-feed") copyFeed(e.target.closest("button"));
    if (id === "listen") {
      const first = selectedChapters().find((c) => c.status === "done");
      if (first) playChapter(state.book, first.index);
    }
  });
  update();
}

function chapterState(c) {
  if (c.status === "working") return `<span class="ch-state working">${Math.round(c.progress * 100)}%</span>`;
  if (c.status === "queued") return `<span class="ch-state">Waiting</span>`;
  if (c.status === "error") return `<span class="ch-state error">Failed</span>`;
  if (c.status === "done") return `<span class="ch-state">${clock(c.durationMs / 1000)}</span>`;
  return `<span class="ch-state">${listenTime(c.words)}</span>`;
}

// Remaining narration time, extrapolated from the chapter currently being narrated.
function etaSeconds(chapters) {
  const working = chapters.find((c) => c.status === "working" && c.progress > 0.05 && c.etaSeconds);
  if (!working) return null;
  const secPerWord = working.etaSeconds / (working.words * (1 - working.progress));
  const queuedWords = chapters.filter((c) => c.status === "queued").reduce((n, c) => n + c.words, 0);
  return working.etaSeconds + queuedWords * secPerWord;
}

function renderAction() {
  const sel = selectedChapters();
  const words = sel.reduce((n, c) => n + c.words, 0);
  const done = sel.filter((c) => c.status === "done");
  const todo = sel.filter((c) => !isCurrent(c));
  const el = $("#action");

  if (isBusy()) {
    const active = state.book.chapters.filter((c) => c.status === "queued" || c.status === "working" || (c.status === "done" && state.selected.has(c.index)));
    const total = active.reduce((n, c) => n + c.words, 0) || 1;
    const progress = active.reduce((n, c) => n + c.words * (c.status === "done" ? 1 : c.status === "working" ? c.progress : 0), 0) / total;
    const n = active.findIndex((c) => c.status === "working") + 1;
    const eta = etaSeconds(active);
    el.innerHTML = `
      <div class="progress-head"><b>${n ? `Narrating chapter ${n} of ${active.length}` : "Starting…"}</b><span class="sub">${eta ? (eta < 60 ? "Less than a minute left" : `About ${duration(eta)} left`) : ""}</span></div>
      <div class="bar"><i style="width:${(progress * 100).toFixed(1)}%"></i></div>
      <div class="actions">
        ${done.length ? `<button class="btn primary" id="listen">${icon.play}Start listening</button>` : ""}
        <button class="btn" id="stop">Stop</button>
      </div>
      <p class="note">You can close this page. Narration keeps going.</p>`;
    return;
  }

  if (sel.length && !todo.length) {
    const secs = done.reduce((n, c) => n + c.durationMs, 0) / 1000;
    const format = preferredFormat();
    const other = format === "mp3" ? "m4b" : "mp3";
    const desc = format === "mp3" ? "MP3 with chapters, plays anywhere" : "M4B with chapters, plays in Apple Books";
    el.innerHTML = `
      <div class="actions">
        <a class="btn primary" href="/api/books/${state.book.id}/audiobook.${format}">${icon.download}Download ${format.toUpperCase()}</a>
        <button class="btn" id="copy-feed">${icon.podcast}Add to podcast app</button>
      </div>
      <p class="note">${duration(secs)} · ${desc} · <a class="link" href="/api/books/${state.book.id}/audiobook.${other}">Get ${other.toUpperCase()} instead</a></p>`;
    return;
  }

  const current = sel.filter(isCurrent).length;
  const todoWords = todo.reduce((n, c) => n + c.words, 0);
  const label = current ? `Narrate ${todo.length} more chapter${todo.length === 1 ? "" : "s"}` : done.length ? "Recreate with this voice" : "Create audiobook";
  el.innerHTML = `
    <button class="btn primary block" id="create" ${sel.length ? "" : "disabled"}>${label} — free</button>
    <p class="note">${sel.length ? `${todo.length} chapter${todo.length === 1 ? "" : "s"} · about ${listenTime(todoWords)} of audio · ${fmtInt(todoWords)} words` : "Select at least one chapter"}</p>`;
}

function update() {
  const b = state.book;
  if (!b || !$("#chapters")) return;
  const keptUntil = new Date(b.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  $("#book-meta").textContent = `${b.chapters.length} chapter${b.chapters.length === 1 ? "" : "s"} · ${fmtInt(b.totalWords)} words · about ${listenTime(b.totalWords)} · kept until ${keptUntil}`;
  const playing = state.playing?.bookId === b.id ? state.playing.index : -1;
  const paused = $("#audio").paused;
  // The list is rebuilt on every change and poll; put keyboard focus back where it was.
  const focused = document.activeElement?.closest?.("#chapters [data-index]");
  const refocus = focused && `#chapters ${focused.matches("input") ? "input" : ".ch-play"}[data-index="${focused.dataset.index}"]`;
  $("#chapters").innerHTML = b.chapters.map((c) => `
    <li class="ch ${state.selected.has(c.index) ? "" : "off"} ${c.index === playing ? "playing" : ""}">
      <label class="ch-main">
        <input type="checkbox" data-index="${c.index}" ${state.selected.has(c.index) ? "checked" : ""}>
        <span class="ch-text"><span class="ch-title">${esc(c.title)}</span>${c.status === "error" ? `<span class="ch-error">${esc(c.error || "Narration failed")}</span>` : ""}</span>
      </label>
      ${chapterState(c)}
      <button class="ch-play" data-index="${c.index}" ${c.status === "done" ? "" : "disabled"} aria-label="Play ${esc(c.title)}">${c.index === playing && !paused ? icon.pause : icon.play}</button>
    </li>`).join("");
  if (refocus) $(refocus)?.focus();
  renderAction();
}

async function copyFeed(btn) {
  const feed = `${location.origin}/api/books/${state.book.id}/feed.xml`;
  try {
    await navigator.clipboard.writeText(feed);
    btn.innerHTML = `${icon.check}Feed link copied`;
    setTimeout(() => { btn.innerHTML = `${icon.podcast}Add to podcast app`; }, 2500);
  } catch {
    prompt("Paste this link into your podcast app:", feed);
  }
}

let previewAudio;
function setPreview(mode) {
  const btn = $("#preview");
  if (!btn) return;
  const [html, label] = {
    idle: [`${icon.speaker}<span class="wide-only">Sample</span>`, "Play a sample"],
    loading: [`<span class="spinner"></span><span class="wide-only">Loading</span>`, "Loading a sample"],
    playing: [`${icon.pause}<span class="wide-only">Stop</span>`, "Stop the sample"],
  }[mode];
  btn.innerHTML = html;
  btn.setAttribute("aria-label", label);
  btn.disabled = mode === "loading";
}
async function previewVoice() {
  if (previewAudio && !previewAudio.paused) return previewAudio.pause();
  setPreview("loading");
  try {
    // Sample the book's own opening lines so it's representative.
    const first = selectedChapters()[0] || state.book.chapters[0];
    const text = (await api(`/api/books/${state.book.id}/text/${first.index}`)).replace(/\s+/g, " ").slice(0, 220).replace(/\s\S*$/, "");
    previewAudio?.pause();
    $("#audio").pause();
    const sample = (previewAudio = new Audio(`/api/preview?voice=${encodeURIComponent(state.voice)}&text=${encodeURIComponent(text)}`));
    ["pause", "ended"].forEach((ev) => sample.addEventListener(ev, () => previewAudio === sample && setPreview("idle")));
    await sample.play();
    if (!sample.paused) setPreview("playing");
  } catch (e) {
    setPreview("idle");
    showBookError(e.message);
  }
}

async function narrate() {
  $("#book-error").hidden = true;
  try {
    state.book = await api(`/api/books/${state.book.id}/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice: state.voice, speed: state.speed, chapters: [...state.selected].sort((a, b) => a - b) }),
    });
    update();
    schedulePoll();
  } catch (e) {
    showBookError(e.message);
  }
}

async function stopNarration() {
  state.book = await api(`/api/books/${state.book.id}/cancel`, { method: "POST" });
  update();
  schedulePoll();
}

function showBookError(msg) {
  const el = $("#book-error");
  el.textContent = msg;
  el.hidden = false;
}

/* ---------- Player ---------- */
const audio = $("#audio");
$("#back15").innerHTML = icon.back;
$("#fwd30").innerHTML = icon.fwd;
$("#playpause").innerHTML = icon.play;

function playChapter(book, index, startAt) {
  const bookId = book.id;
  if (state.playing?.bookId === bookId && state.playing.index === index) {
    audio.paused ? audio.play() : audio.pause();
    return;
  }
  previewAudio?.pause();
  const ch = book.chapters[index];
  state.playing = { bookId, index, book };
  audio.src = `/api/books/${bookId}/audio/${index}.m4a?v=${encodeURIComponent(ch.voice)}-${ch.durationMs}`;
  audio.playbackRate = Number($("#rate").dataset.rate || 1);
  const saved = store.get(`pos:${bookId}`);
  const resume = startAt ?? (saved?.index === index ? saved.time : 0);
  audio.addEventListener("loadedmetadata", () => { if (resume) audio.currentTime = resume; }, { once: true });
  audio.play();
  $("#player").hidden = false;
  document.body.classList.add("has-player");
  $("#player-title").textContent = ch.title;
  $("#player-book").textContent = book.title;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: ch.title, artist: book.author, album: book.title, artwork: book.cover ? [{ src: `/api/books/${bookId}/cover` }] : [] });
  }
  update();
}

// Next or previous narrated chapter, even if the book page isn't open any more.
function step(dir) {
  if (!state.playing) return;
  const book = state.book?.id === state.playing.bookId ? state.book : state.playing.book;
  const list = book.chapters.filter((c) => c.status === "done");
  const i = list.findIndex((c) => c.index === state.playing.index);
  const next = list[i + dir];
  if (next) playChapter(book, next.index, 0);
}

function stopPlayer() {
  audio.pause();
  audio.removeAttribute("src");
  state.playing = null;
  $("#player").hidden = true;
  document.body.classList.remove("has-player");
}

$("#playpause").addEventListener("click", () => (audio.paused ? audio.play() : audio.pause()));
$("#close-player").addEventListener("click", () => {
  // Remember where they stopped so the chapter resumes from here next time.
  if (state.playing) store.set(`pos:${state.playing.bookId}`, { index: state.playing.index, time: audio.currentTime });
  stopPlayer();
  update();
});
$("#back15").addEventListener("click", () => (audio.currentTime = Math.max(0, audio.currentTime - 15)));
$("#fwd30").addEventListener("click", () => (audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30)));
const setRate = (rate) => {
  $("#rate").dataset.rate = rate;
  $("#rate").textContent = `${rate}×`;
  audio.playbackRate = rate;
};
if (RATES.includes(store.get("rate"))) setRate(store.get("rate"));
$("#rate").addEventListener("click", () => {
  const next = RATES[(RATES.indexOf(Number($("#rate").dataset.rate || 1)) + 1) % RATES.length];
  setRate(next);
  store.set("rate", next);
});
// While the thumb is being dragged, playback updates mustn't pull it back.
let seeking = false;
$("#seek").addEventListener("pointerdown", () => (seeking = true));
addEventListener("pointerup", () => (seeking = false));
$("#seek").addEventListener("input", (e) => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; });

const syncPlayButton = () => {
  $("#playpause").innerHTML = audio.paused ? icon.play : icon.pause;
  $("#playpause").setAttribute("aria-label", audio.paused ? "Play" : "Pause");
  update();
};
audio.addEventListener("play", syncPlayButton);
audio.addEventListener("pause", syncPlayButton);
audio.addEventListener("ended", () => step(1));
let lastSave = 0;
audio.addEventListener("timeupdate", () => {
  $("#cur").textContent = clock(audio.currentTime);
  $("#dur").textContent = clock(audio.duration);
  if (audio.duration && !seeking) $("#seek").value = Math.round((audio.currentTime / audio.duration) * 1000);
  if (state.playing && Date.now() - lastSave > 3000) {
    lastSave = Date.now();
    store.set(`pos:${state.playing.bookId}`, { index: state.playing.index, time: audio.currentTime });
  }
});
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
  navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
}

/* ---------- Boot ---------- */
api("/api/voices").then(({ voices }) => {
  state.voices = voices;
  if (state.book && $("#voice")) $("#voice").innerHTML = voiceOptions();
}).catch(() => {});
route();
