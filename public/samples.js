// Players for the voice samples and the sample audiobook on the landing pages.
// Only one plays at a time, and neither touches the main audiobook player.
const players = [];
const stopOthers = (me) => players.forEach((p) => p !== me && p.pause());

function playButton(btn, audio) {
  const sync = () => {
    const on = !audio.paused && !audio.ended;
    btn.classList.toggle("playing", on);
    btn.setAttribute("aria-label", on ? "Pause" : btn.dataset.label);
  };
  btn.dataset.label = btn.getAttribute("aria-label");
  ["play", "pause", "ended"].forEach((e) => audio.addEventListener(e, sync));
}

// Word start times per sample (made by scripts/make-sample-timings.js), for highlighting as it reads.
let timings;
const loadTimings = () => (timings ??= fetch("/samples/timings.json").then((r) => r.json()).catch(() => ({})));

// Voice sampler: pick a voice, a line and a speed.
for (const el of document.querySelectorAll("[data-sampler]")) {
  const audio = new Audio();
  audio.preload = "none";
  players.push(audio);
  const btn = el.querySelector(".sampler-play"), select = el.querySelector("select"), text = el.querySelector(".sampler-text");
  let voice = el.querySelector("[data-voice][aria-checked=true]").dataset.voice, speed = 1;
  const src = () => `/samples/${voice}-${select.value}.mp3`;
  let words = [], times = [], current = -1, frame;
  const setText = (t) => {
    text.replaceChildren(...t.split(/(\s+)/).map((w) => (/\S/.test(w) ? Object.assign(document.createElement("span"), { textContent: w }) : w)));
    words = [...text.querySelectorAll("span")];
    current = -1;
  };
  const highlight = (i) => {
    if (i === current) return;
    words[current]?.classList.remove("reading");
    words[i]?.classList.add("reading");
    current = i;
  };
  const tick = () => {
    let i = times.length - 1;
    while (i >= 0 && times[i] > audio.currentTime) i--;
    highlight(i);
    frame = requestAnimationFrame(tick);
  };
  audio.addEventListener("play", async () => {
    times = (await loadTimings())[`${voice}-${select.value}`] || [];
    cancelAnimationFrame(frame);
    if (!audio.paused) tick();
  });
  audio.addEventListener("pause", () => cancelAnimationFrame(frame));
  audio.addEventListener("ended", () => highlight(-1));
  setText(text.textContent);

  const play = () => {
    if (!audio.src.endsWith(src())) { audio.src = src(); highlight(-1); }
    audio.playbackRate = speed;
    stopOthers(audio);
    audio.play();
  };
  const pick = (group, attr, value) => group.forEach((b) => b.setAttribute("aria-checked", String(b.dataset[attr] === value)));
  const voices = [...el.querySelectorAll("[data-voice]")], speeds = [...el.querySelectorAll("[data-speed]")];

  playButton(btn, audio);
  btn.addEventListener("click", () => (audio.paused || audio.ended ? play() : audio.pause()));
  voices.forEach((b) => b.addEventListener("click", () => { voice = b.dataset.voice; pick(voices, "voice", voice); play(); }));
  speeds.forEach((b) => b.addEventListener("click", () => {
    speed = Number(b.dataset.speed); pick(speeds, "speed", b.dataset.speed);
    audio.playbackRate = speed;
    if (audio.paused) play();
  }));
  select.addEventListener("change", () => { setText(select.selectedOptions[0].dataset.text); play(); });
}

// Sample audiobook: play/pause and jump between chapters. Chapters are either start times in one
// file (data-start) or separate files (data-src, as in the library), which play one after another.
for (const el of document.querySelectorAll("[data-sample-book]")) {
  const audio = el.querySelector("audio");
  players.push(audio);
  const btn = el.querySelector(".sampler-play"), chapters = [...el.querySelectorAll("[data-start], [data-src]")];
  const files = chapters[0]?.dataset.src != null;
  let index = 0;
  const mark = () => chapters.forEach((c, i) => c.toggleAttribute("aria-current", !audio.paused && (files ? i === index : c === chapters.filter((x) => Number(x.dataset.start) <= audio.currentTime + 0.05).pop())));
  const go = (i) => {
    stopOthers(audio);
    if (files) { index = i; audio.src = chapters[i].dataset.src; } else audio.currentTime = Number(chapters[i].dataset.start);
    audio.play();
  };
  playButton(btn, audio);
  btn.addEventListener("click", () => {
    if (!audio.paused && !audio.ended) return audio.pause();
    if (files && !audio.getAttribute("src")) return go(0);
    stopOthers(audio);
    audio.play();
  });
  chapters.forEach((c, i) => c.addEventListener("click", () => go(i)));
  audio.addEventListener("ended", () => { if (files && index + 1 < chapters.length) go(index + 1); });
  ["timeupdate", "pause", "play"].forEach((e) => audio.addEventListener(e, mark));
}
