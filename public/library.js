// The library book page: play chapter by chapter, carry on to the next one, and remember where
// you stopped (in this browser only).
const audio = document.getElementById("lib-audio");
const playBtn = document.getElementById("lib-play");
const label = playBtn.querySelector("span");
const initialLabel = label.textContent;
const player = document.getElementById("lib-player");
const nowPlaying = document.getElementById("lib-now-playing");
const playbackError = document.getElementById("lib-playback-error");
const rows = [...document.querySelectorAll(".lib-chapters button[data-src]")];
const key = `lib:${location.pathname}`;
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
};
let current = -1;

const PLAY = '<path d="M8 5.5v13l10.5-6.5z"/>', PAUSE = '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>';

function sync() {
  const playing = !audio.paused && !audio.ended;
  playBtn.querySelector("svg").innerHTML = playing ? PAUSE : PLAY;
  label.textContent = playing ? "Pause" : audio.ended ? "Play again" : current > 0 || audio.currentTime > 1 ? "Resume" : initialLabel;
  rows.forEach((r, i) => r.toggleAttribute("aria-current", i === current));
  rows.forEach((r, i) => r.classList.toggle("playing", i === current && playing));
}

function load(i, at = 0) {
  current = i;
  audio.src = rows[i].dataset.src;
  if (at) audio.addEventListener("loadedmetadata", () => { audio.currentTime = at; }, { once: true });
  rows[i].closest("details")?.setAttribute("open", "");
  if (player) {
    player.hidden = false;
    nowPlaying.textContent = rows[i].querySelector(".lib-ch-title").textContent;
  }
}

function play(i, at = 0) {
  playbackError.hidden = true;
  if (i !== current) load(i, at);
  audio.play().catch((error) => {
    if (error.name !== "AbortError") playbackError.hidden = false;
    sync();
  });
}

playBtn.addEventListener("click", () => {
  if (!audio.paused) return audio.pause();
  play(audio.ended ? 0 : Math.max(current, 0));
});
rows.forEach((r, i) => r.addEventListener("click", () => (i === current && !audio.paused ? audio.pause() : play(i))));
audio.addEventListener("ended", () => {
  if (current + 1 < rows.length) play(current + 1);
  else { store.set(null); sync(); }
});
["play", "pause", "loadedmetadata"].forEach((e) => audio.addEventListener(e, sync));
audio.addEventListener("timeupdate", () => {
  if (Math.floor(audio.currentTime) % 5 === 0) store.set({ chapter: current, at: audio.currentTime });
});

// Pick up where this browser left off.
const saved = store.get();
if (saved && rows[saved.chapter] && (saved.chapter > 0 || saved.at > 1)) { load(saved.chapter, saved.at); sync(); label.textContent = "Resume"; }

// The feed link goes to the clipboard for pasting into a podcast app.
const feedBtn = document.getElementById("lib-feed");
feedBtn?.addEventListener("click", async () => {
  const url = feedBtn.dataset.feed;
  try {
    await navigator.clipboard.writeText(url);
    feedBtn.textContent = "Link copied. Paste it into your podcast app.";
    setTimeout(() => { feedBtn.textContent = "Add to podcast app"; }, 3500);
  } catch {
    prompt("Paste this link into your podcast app:", url);
  }
});
