// The library book page: play chapter by chapter, carry on to the next one, and remember where
// you stopped (in this browser only).
const audio = document.getElementById("lib-audio");
const playBtn = document.getElementById("lib-play");
const label = playBtn.querySelector("span");
const initialLabel = label.textContent;
const nowPlaying = document.getElementById("lib-now-playing");
const seek = document.getElementById("lib-seek");
const position = document.getElementById("lib-position");
const playbackError = document.getElementById("lib-playback-error");
const rows = [...document.querySelectorAll(".lib-chapters button[data-src]")];
const key = `lib:${location.pathname}`;
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};
let current = 0;
let loaded = -1;
let pending = 0;
let finished = false;

const PLAY = '<path d="M8 5.5v13l10.5-6.5z"/>', PAUSE = '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>';

function clock(seconds) {
  const n = Math.floor(seconds);
  const minutes = Math.floor(n / 60);
  const remainder = String(n % 60).padStart(2, "0");
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

const at = () => pending ?? audio.currentTime;
const duration = () => Number(rows[current].dataset.duration);

function sync() {
  const playing = !audio.paused && !audio.ended;
  playBtn.querySelector("svg").innerHTML = playing ? PAUSE : PLAY;
  label.textContent = playing ? "Pause" : seek ? "Play" : finished ? "Play again" : current > 0 || at() > 0 ? "Resume" : initialLabel;
  rows.forEach((r, i) => {
    const title = r.querySelector(".lib-ch-title").textContent;
    if (i === current) r.setAttribute("aria-current", "true");
    else r.removeAttribute("aria-current");
    r.classList.toggle("playing", i === current && playing);
    if (seek) r.setAttribute("aria-label", `${i === current && playing ? "Pause" : "Play"} ${title}, ${r.querySelector(".lib-ch-time").textContent}`);
  });
  if (seek) {
    const title = rows[current].querySelector(".lib-ch-title").textContent;
    if (nowPlaying.textContent !== title) nowPlaying.textContent = title;
    syncPosition();
  }
}

function syncPosition() {
  if (seek) {
    const elapsed = clock(Math.min(at(), duration()));
    const total = rows[current].querySelector(".lib-ch-time").textContent;
    seek.max = Math.floor(duration());
    seek.value = Math.floor(at());
    seek.setAttribute("aria-valuetext", `${elapsed} of ${total}`);
    position.textContent = `${elapsed} / ${total}`;
  }
}

function select(i, start = 0) {
  current = i;
  pending = start;
  finished = false;
  rows[i].closest("details")?.setAttribute("open", "");
}

function play(i) {
  playbackError.hidden = true;
  if (i !== current || finished) select(i);
  if (loaded !== current || audio.error) {
    loaded = current;
    audio.src = rows[current].dataset.src;
  } else if (audio.ended) {
    audio.currentTime = 0;
    pending = null;
  }
  sync();
  audio.play().catch((error) => {
    if (error.name !== "AbortError") playbackError.hidden = false;
    sync();
  });
}

playBtn.addEventListener("click", () => {
  if (!audio.paused) return audio.pause();
  play(finished ? 0 : current);
});
rows.forEach((r, i) => r.addEventListener("click", () => (i === current && !audio.paused ? audio.pause() : play(i))));
audio.addEventListener("ended", () => {
  if (current + 1 < rows.length) play(current + 1);
  else { finished = true; store.set(null); sync(); }
});
audio.addEventListener("loadedmetadata", () => {
  if (pending !== null) {
    audio.currentTime = Math.min(pending, Math.max(0, audio.duration - 0.1));
    pending = null;
  }
  sync();
});
const save = () => {
  if (!finished) store.set({ chapter: current, at: at() });
};
audio.addEventListener("play", sync);
audio.addEventListener("pause", () => {
  if (loaded === current) save();
  sync();
});
audio.addEventListener("timeupdate", () => {
  if (pending === null && audio.readyState && Math.floor(audio.currentTime) % 5 === 0) save();
  syncPosition();
});
seek?.addEventListener("input", () => {
  const target = Math.min(Number(seek.value), Math.max(0, duration() - 0.1));
  if (loaded === current && audio.readyState) audio.currentTime = Math.min(target, Math.max(0, audio.duration - 0.1));
  else pending = target;
  finished = false;
  save();
  sync();
});

// Pick up where this browser left off.
const saved = store.get();
if (Number.isInteger(saved?.chapter) && rows[saved.chapter] && Number.isFinite(saved.at)) {
  select(saved.chapter, Math.max(0, Math.min(saved.at, Number(rows[saved.chapter].dataset.duration) - 0.1)));
}
sync();

// The feed link goes to the clipboard for pasting into a podcast app.
const feedBtn = document.getElementById("lib-feed");
const feedLabel = feedBtn?.querySelector("span");
let feedReset;
feedBtn?.addEventListener("click", async () => {
  const url = feedBtn.dataset.feed;
  try {
    await navigator.clipboard.writeText(url);
    clearTimeout(feedReset);
    feedLabel.textContent = "Link copied";
    feedReset = setTimeout(() => { feedLabel.textContent = "Copy podcast link"; }, 3500);
  } catch {
    prompt("Paste this link into your podcast app:", url);
  }
});
