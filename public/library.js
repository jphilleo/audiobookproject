window.initLibraryPlayer = function (scope = document, bookPath = location.pathname) {
// The library book page: play chapter by chapter, carry on to the next one, and remember where
// you stopped (in this browser only).
const audio = scope.getElementById("lib-audio");
const playBtn = scope.getElementById("lib-play");
const label = playBtn.querySelector("span");
const initialLabel = label.textContent;
const previousChapter = scope.getElementById("lib-previous");
const nextChapter = scope.getElementById("lib-next");
const nowPlaying = scope.getElementById("lib-now-playing");
const chapterNumber = scope.getElementById("lib-chapter-number");
const seek = scope.getElementById("lib-seek");
const position = scope.getElementById("lib-position");
const speed = scope.getElementById("lib-speed");
const playbackError = scope.getElementById("lib-playback-error");
const rows = [...scope.querySelectorAll(".lib-chapters button[data-src]")];
const key = `lib:${bookPath}`;
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
    previousChapter.disabled = current === 0;
    nextChapter.disabled = current === rows.length - 1;
    chapterNumber.textContent = `· ${rows[current].dataset.chapterNumber || current + 1} / ${rows[current].dataset.chapterTotal || rows.length}`;
    syncPosition();
  }
}

function syncPosition() {
  if (seek) {
    const elapsed = clock(Math.min(at(), duration()));
    const total = rows[current].querySelector(".lib-ch-time").textContent;
    seek.max = Math.floor(duration());
    seek.value = Math.floor(at());
    seek.style.setProperty("--progress", `${duration() > 0 ? Math.min(at() / duration(), 1) * 100 : 0}%`);
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
  if (window.parent === window && seek) window.audiobookPlayer = controller;
  audio.play().catch((error) => {
    if (error.name !== "AbortError") playbackError.hidden = false;
    sync();
  });
}

playBtn.addEventListener("click", () => {
  if (!audio.paused) return audio.pause();
  play(finished ? 0 : current);
});
previousChapter?.addEventListener("click", () => {
  if (current > 0) play(current - 1);
});
nextChapter?.addEventListener("click", () => {
  if (current + 1 < rows.length) play(current + 1);
});
const toggleChapter = i => (i === current && !audio.paused ? audio.pause() : play(i));
rows.forEach((r, i) => r.addEventListener("click", () => {
  if (seek && window.parent !== window && window.parent.audiobookPlayer) {
    window.parent.openAudiobook(document, location.pathname, i);
  } else toggleChapter(i);
}));
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
function seekTo(seconds) {
  const target = Math.max(0, Math.min(seconds, Math.max(0, duration() - 0.1)));
  if (loaded === current && audio.readyState) audio.currentTime = Math.min(target, Math.max(0, audio.duration - 0.1));
  else pending = target;
  finished = false;
  save();
  sync();
}
seek?.addEventListener("input", () => seekTo(Number(seek.value)));
scope.querySelectorAll(".lib-transport [data-skip]").forEach(button => {
  button.addEventListener("click", () => seekTo(at() + Number(button.dataset.skip)));
});
const speedMenu = scope.getElementById("lib-speed-menu");
if (speedMenu) {
  const options = [...speedMenu.querySelectorAll("[data-rate]")];
  const speedLabel = scope.getElementById("lib-speed-label");
  const closeSpeed = () => { speedMenu.open = false; };
  options.forEach(button => button.addEventListener("click", () => {
    const rate = Number(button.dataset.rate);
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    speedLabel.textContent = `${rate}×`;
    speed.setAttribute("aria-label", `Playback speed, ${rate}×`);
    options.forEach(option => option.setAttribute("aria-pressed", String(option === button)));
    closeSpeed();
    speed.focus();
  }));
  speedMenu.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeSpeed(); speed.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      speedMenu.open = true;
      const index = options.indexOf(event.target);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
        index < 0 ? options.findIndex(o => o.getAttribute("aria-pressed") === "true") :
        (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    }
  });
  speedMenu.addEventListener("focusout", event => {
    if (!speedMenu.contains(event.relatedTarget)) closeSpeed();
  });
  const dismissSpeed = event => {
    if (!speedMenu.isConnected) { document.removeEventListener("pointerdown", dismissSpeed); return; }
    if (!speedMenu.contains(event.target)) closeSpeed();
  };
  document.addEventListener("pointerdown", dismissSpeed);
}


const controller = {
  audio, path: bookPath, dock: scope.querySelector(".lib-player-dock"),
  play, toggleChapter, sync,
};
// Pick up where this browser left off.
const saved = store.get();
if (Number.isInteger(saved?.chapter) && rows[saved.chapter] && Number.isFinite(saved.at)) {
  select(saved.chapter, Math.max(0, Math.min(saved.at, Number(rows[saved.chapter].dataset.duration) - 0.1)));
}
sync();

// The feed link goes to the clipboard for pasting into a podcast app.
const feedBtn = scope.getElementById("lib-feed");
const podcastMenu = feedBtn?.closest("details");
const feedStatus = scope.getElementById("lib-feed-status");
let feedReset;
podcastMenu?.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && podcastMenu.open) {
    event.preventDefault();
    podcastMenu.open = false;
    podcastMenu.querySelector("summary").focus();
  }
});
feedBtn?.addEventListener("click", async () => {
  const url = feedBtn.dataset.feed;
  try {
    await navigator.clipboard.writeText(url);
    clearTimeout(feedReset);
    feedStatus.textContent = "Link copied";
    feedReset = setTimeout(() => { feedStatus.textContent = ""; }, 3500);
  } catch {
    prompt("Paste this link into your podcast app:", url);
  }
});

return controller;
};
window.libraryPlayer = window.initLibraryPlayer();
