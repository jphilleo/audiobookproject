// The page gutters on wide screens: a sea of audio-waveform bars along the bottom (livelier while
// a book is playing), a humpback that now and then leaps out of it, and an "On this page" list that
// appears once you scroll into a page's sections. Purely decorative apart from the list; nothing
// here shows on narrow screens.

const WIDE = matchMedia("(min-width: 1240px)");
const CALM = matchMedia("(prefers-reduced-motion: reduce)");

// The logo's humpback, drawn flat: facing right, snout at x=100, centre line y=0, belly down.
const BODY = "M100 1.6C99.4 -2.6 94 -5.4 86 -7.2C76 -9.6 64 -11.6 54 -11.6C46 -11.6 40 -10.6 35.6 -9.6C34 -10.8 32.2 -11.2 30.6 -10.2C25 -8 18 -4.4 10 -2C7.4 -2.4 5.2 -5 4.4 -9C3.8 -12.6 2.4 -15.6 -.6 -17.4C-1.2 -13.8 -3.2 -8.4 -4.2 -5.6C-4.6 -3.6 -3.4 -1.2 -1.6 0C-3.4 1.2 -4.6 3.6 -4.2 5.6C-3.2 8.4 -1.2 13.8 -.6 17.4C2.4 15.6 3.8 12.6 4.4 9C5.2 5 7.4 2.4 10 2C18 4.4 30 10.6 44 12.6C58 14.4 72 13.6 84 10.2C92 8 98.6 5.6 100 1.6Z";
const FIN = "M69.4 10.4C64.8 15 58.4 19.8 51.6 23.6C50.2 24.4 49.2 23.4 50 22.2C54.6 17.2 59.6 13 63.8 9.8Z";
const EYE = [76.2, -0.6, 1.25];

// Path data as [command, points[]] so every point can be bent before drawing.
function parse(d) {
  const out = [];
  for (const [, cmd, nums] of d.matchAll(/([MCZ])([^MCZ]*)/g)) {
    const n = (nums.match(/-?\d*\.?\d+/g) || []).map(Number);
    const pts = [];
    for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    if (cmd === "C") for (let i = 0; i < pts.length; i += 3) out.push(["C", pts.slice(i, i + 3)]);
    else out.push([cmd, pts]);
  }
  return out;
}
const SHAPES = [parse(BODY), parse(FIN)];

const H = 260;          // a sea's canvas height: the water plus room above it for leaps
const SURFACE = H - 74; // the top row of the water
// [depth below the surface, bar spacing, bar width, max height, opacity, drift px/s]
const GUTTER_ROWS = [[0, 5, 2, 15, 0.55, 14], [24, 4.5, 1.6, 10, 0.34, -10], [46, 4, 1.3, 7, 0.2, 7]];
const OCEAN_ROWS = [[0, 5, 2, 16, 0.55, 14], [18, 4.6, 1.7, 12, 0.4, -10], [34, 4.2, 1.5, 9, 0.28, 8], [50, 4, 1.3, 7, 0.18, -6], [64, 3.8, 1.2, 5, 0.1, 5]];

// Loudness along the water, like the envelope of someone speaking: bursts and pauses.
function envelope(u, seed) {
  const phrase = 0.5 + 0.5 * Math.sin(u * 0.07 + seed + 1.4 * Math.sin(u * 0.023 + seed));
  const syllable = 0.55 + 0.45 * Math.sin(u * 0.41 + seed * 3);
  return 0.16 + 0.84 * Math.pow(phrase, 1.6) * syllable;
}
const swell = (x, t, depth, row) => SURFACE + depth + 2.6 * Math.sin(x / 42 + t * 0.7 + row * 1.7);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// A leap, k from 0 to 1: up from under the water, a slow arc, and back in nose first.
const LEAP_MS = 2900, BLOW_MS = 4400;
function leapPose(k, cx, W) {
  const p = k + 0.05 * Math.sin(2 * Math.PI * k);           // linger near the top
  const D = Math.min(170, W - 110), rise = 150;
  const x = cx - D / 2 + D * p, y = SURFACE + 34 - rise * 4 * p * (1 - p);
  const angle = 0.86 * Math.atan2(-rise * 4 * (1 - 2 * p), D);
  const bend = 0.009 + 0.026 * Math.pow(1 - p, 3) + 0.02 * Math.pow(p, 3); // arched hardest at launch and dive
  const flick = (24 * Math.sin(2 * Math.PI * 1.7 * k) * (1 - 0.5 * k) + 18 * Math.pow(Math.max(0, k - 0.6) / 0.4, 2)) * Math.PI / 180;
  return { x, y, angle, bend, flick, scale: 0.82 };
}
// A blow: the back and head roll up to the surface, a spout of mist, then a dive that lifts the
// tail flukes out of the water.
function blowPose(k, cx) {
  const up = ease(k / 0.22), dive = ease((k - 0.62) / 0.38);
  return {
    x: cx - 12 + 26 * k + 10 * dive, y: SURFACE + 18 - 21 * up + 20 * dive + 80 * ease((k - 0.88) / 0.12),  // flukes high, then gone under
    angle: -0.09 * up + 1.4 * dive, bend: 0.012 - 0.03 * dive,
    flick: 0.12 * Math.sin(k * 9) * (1 - dive) - 0.45 * dive, scale: 0.82,
  };
}
const BLOWHOLE = [74, -9.6];

// Flat whale point → screen: flex the tail, bend the body along an arc, then place it.
function mapper(pose) {
  const { x, y, angle, bend, flick, scale } = pose;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return ([px, py]) => {
    const w = Math.max(0, Math.min(1, (26 - px) / 30)) ** 1.4;      // tail flex, strongest at the flukes
    if (w > 0) {
      const a = flick * w, dx = px - 26, dy = py;
      px = 26 + dx * Math.cos(a) - dy * Math.sin(a); py = dx * Math.sin(a) + dy * Math.cos(a);
    }
    const R = 1 / bend, a = (px - 50) / R, r = R - py;                  // back arched up
    const bx = r * Math.sin(a), by = R - r * Math.cos(a);
    return [x + scale * (bx * ca - by * sa), y + scale * (bx * sa + by * ca)];
  };
}

function drawWhale(ctx, map, bg, scale) {
  for (const shape of SHAPES) {
    ctx.beginPath();
    for (const [cmd, pts] of shape) {
      const q = pts.map(map);
      if (cmd === "M") ctx.moveTo(...q[0]);
      else if (cmd === "C") ctx.bezierCurveTo(...q[0], ...q[1], ...q[2]);
      else ctx.closePath();
    }
    ctx.fill();
  }
  const [ex, ey] = map(EYE);
  ctx.save(); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ex, ey, EYE[2] * scale, 0, 7); ctx.fill(); ctx.restore();
}

// One stretch of sea on its own canvas: a gutter, or the open water at the bottom of the page.
class Sea {
  constructor(el, seed, rows) {
    this.el = el; this.seed = seed; this.rows = rows;
    this.canvas = el.appendChild(document.createElement("canvas"));
    this.ctx = this.canvas.getContext("2d");
    this.whales = []; this.drops = []; this.mist = []; this.ripples = [];
  }
  resize() {
    const dpr = devicePixelRatio || 1;
    this.W = this.el.clientWidth;
    this.canvas.width = this.W * dpr; this.canvas.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // A whale appears: a leap or a blow, at a spot along the water (the middle of a gutter).
  add(type, now, cx = this.W / 2) {
    if (this.W > 120) this.whales.push({ type, start: now, cx, splashed: [false, false] });
  }
  splash(x, now, forward) {
    for (let i = 0; i < 9; i++) {
      const s = (Math.random() - 0.5) * 2;
      this.drops.push({ x: x + s * 10, y: SURFACE, vx: s * 70 + forward * 25, vy: -(110 + Math.random() * 150), r: 1 + Math.random() * 1.4 });
    }
    this.ripples.push({ x, born: now });
  }
  draw(now, dt, colors, energy) {
    const { ctx, W } = this; const t = now / 1000;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.brand; ctx.strokeStyle = colors.brand;

    // Whales, hidden below the surface so they really come out of the water.
    this.whales = this.whales.filter((w) => {
      const k = (now - w.start) / (w.type === "leap" ? LEAP_MS : BLOW_MS);
      if (k >= 1) return false;
      const pose = w.type === "leap" ? leapPose(k, w.cx, W) : blowPose(k, w.cx);
      const map = mapper(pose);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, SURFACE + 3); ctx.clip();
      drawWhale(ctx, map, colors.bg, pose.scale); ctx.restore();
      if (w.type === "leap") {
        if (!w.splashed[0] && k > 0.1) { w.splashed[0] = true; this.splash(pose.x + 18, now, 1); }
        if (!w.splashed[1] && k > 0.86) { w.splashed[1] = true; this.splash(pose.x + 14, now, -0.4); }
      } else {
        if (!w.splashed[0] && k > 0.12) { w.splashed[0] = true; this.ripples.push({ x: pose.x + 10, born: now }); }
        if (k > 0.3 && k < 0.5) {                                    // the spout: a V of mist from the blowhole
          const [bx, by] = map(BLOWHOLE);
          for (let i = 0; i < 4; i++) {
            const spread = Math.random() * 2 - 1;                     // a bushy V: wider the higher it goes
            this.mist.push({ x: bx + spread * 2, y: by, vx: spread * 46, vy: -(170 + Math.random() * 90), r: 1 + Math.random() * 1.4, life: 0 });
          }
        }
      }
      return true;
    });

    // Spray: drops thrown up that fall back under gravity.
    this.drops = this.drops.filter((d) => {
      d.vy += 520 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y > SURFACE + 4) return false;
      ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
      return true;
    });
    // Mist from a blow: rises, slows, spreads and fades.
    this.mist = this.mist.filter((m) => {
      m.life += dt; m.vy += 90 * dt; m.vx *= 1 - 0.6 * dt; m.vy *= 1 - 1.8 * dt;
      m.x += m.vx * dt; m.y += m.vy * dt; m.r += 2.4 * dt;
      if (m.life > 1.6) return false;
      ctx.globalAlpha = 0.38 * (1 - m.life / 1.6); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fill();
      return true;
    });
    // Rings spreading where a whale broke the surface.
    this.ripples = this.ripples.filter((r) => {
      const a = (now - r.born) / 1400;
      if (a >= 1) return false;
      ctx.globalAlpha = 0.6 * (1 - a); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(r.x, SURFACE + 2, 8 + 46 * a, 2 + 6 * a, 0, 0, 7); ctx.stroke();
      return true;
    });

    // The water: rows of waveform bars riding a slow swell, in front of the whales.
    this.rows.forEach(([depth, gap, bw, maxH, op, speed], row) => {
      const drift = t * speed * (1 + energy * 0.6);
      for (let x = (-drift % gap + gap) % gap; x < W; x += gap) {
        const u = x + drift;
        let h = maxH * envelope(u, this.seed + row * 2.1) * (1 + energy * 0.9);
        if (energy > 0) h *= 0.75 + 0.25 * Math.sin(t * 11 + u * 0.9);       // a live level meter while reading
        h = Math.max(h, 1.2);
        const edge = Math.min(1, x / 40, (W - x) / 40);                       // fade out at the edges
        ctx.globalAlpha = op * Math.max(0, edge);
        ctx.fillRect(x - bw / 2, swell(x, t, depth, row) - h / 2, bw, h);
      }
    });
    ctx.globalAlpha = 1;
  }
}

function buildSea() {
  // Keep the water above either player, including resized or replaced docks.
  // Embedded pages already end above the parent player's dock.
  let player;
  const positionSea = () => {
    const height = player?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty("--sea-player-height", `${height}px`);
  };
  const playerSize = new ResizeObserver(positionSea);
  const watchPlayer = () => {
    const next = document.querySelector(".lib-player-dock, #player");
    if (next === player) return;
    playerSize.disconnect();
    player = next;
    if (player) playerSize.observe(player);
    positionSea();
  };
  new MutationObserver(watchPlayer).observe(document.body, { childList: true });
  watchPlayer();
  // The gutters' water, fixed to the bottom of the window on wide screens.
  const fixed = document.createElement("div");
  fixed.className = "sea";
  fixed.style.bottom = "var(--sea-player-height, 0px)";
  fixed.setAttribute("aria-hidden", "true");
  document.body.append(fixed);
  const gutters = ["left", "right"].map((name, i) => {
    const el = fixed.appendChild(document.createElement("div"));
    el.className = `sea-side ${name}`;
    return new Sea(el, i * 3.7 + 1, GUTTER_ROWS);
  });
  // The open sea across the whole bottom of the page, below the footer, on every screen.
  const oceanEl = document.createElement("div");
  oceanEl.className = "ocean";
  oceanEl.setAttribute("aria-hidden", "true");
  document.body.append(oceanEl);
  const ocean = new Sea(oceanEl, 9.3, OCEAN_ROWS);
  const seas = [...gutters, ocean];

  let energy = 0, last = performance.now(), running = false, atSea = false;
  const colors = {};
  const readColors = () => { const cs = getComputedStyle(document.body); colors.brand = cs.getPropertyValue("--brand").trim() || "#1f5640"; colors.bg = cs.backgroundColor; };
  // The gutters run from the window's edge to 24px short of the content, whatever width this page uses.
  const MIN_GUTTER = 140;
  let gutterW = 0;
  const measure = () => {
    const left = Math.min(...[...document.querySelectorAll("main, .foot")].map((el) => el.getBoundingClientRect().left));
    gutterW = Math.max(0, Math.floor(left - 24));
    document.documentElement.style.setProperty("--sea-gutter", `${gutterW}px`);
    document.documentElement.style.setProperty("--content-left", `${left}px`);
  };
  const active = () => (WIDE.matches && !atSea && gutterW >= MIN_GUTTER ? gutters : []).concat(atSea ? [ocean] : []);
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    energy += ((document.body.classList.contains("speaking") ? 1 : 0) - energy) * Math.min(1, dt * 3);
    active().forEach((s) => s.draw(now, dt, colors, energy));
    requestAnimationFrame(frame);
  };
  const start = () => {
    measure(); readColors(); seas.forEach((s) => s.resize()); // resizing also clears a gutter that's now too narrow
    if (document.hidden || !active().length) { running = false; return; }
    if (CALM.matches) { running = false; seas.forEach((s) => s.draw(0, 0, colors, 0)); return; } // a still sea
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  };
  addEventListener("resize", start);
  document.addEventListener("visibilitychange", start);
  WIDE.addEventListener("change", start);
  CALM.addEventListener("change", start);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

  // Reaching the bottom: the gutters' water gives way to the open sea, and a couple of whales say hello.
  let greeted = 0;
  new IntersectionObserver(([e]) => {
    atSea = e.isIntersecting;
    document.body.classList.toggle("at-sea", atSea);
    start();
    if (atSea && !CALM.matches && performance.now() - greeted > 8000) {
      greeted = performance.now();
      ocean.add("leap", greeted + 300, ocean.W * (0.25 + Math.random() * 0.15));
      ocean.add("blow", greeted + 1500, ocean.W * (0.62 + Math.random() * 0.2));
    }
  }, { threshold: 0.6 }).observe(oceanEl);
  start();

  // Now and then a whale leaps or blows: in one gutter at a time, or out in the open sea.
  let n = 0;
  const visit = (type) => {
    if (!running || CALM.matches) return;
    type ||= Math.random() < 0.55 ? "leap" : "blow";
    const now = performance.now();
    if (atSea) ocean.add(type, now, ocean.W * (0.15 + Math.random() * 0.7));
    else if (WIDE.matches && gutterW >= MIN_GUTTER) gutters[n++ % 2].add(type, now);
  };
  document.addEventListener("sea:leap", () => visit("leap")); // lets the page (or a curious visitor) call a whale
  document.addEventListener("sea:blow", () => visit("blow"));
  setTimeout(() => visit("leap"), 4000);
  setInterval(() => visit(), 18000);
  return { gutters, ocean };
}

// The water swells while narration is playing.
function followAudio() {
  const audio = document.getElementById("audio");
  if (!audio) return;
  const set = () => document.body.classList.toggle("speaking", !audio.paused && !audio.ended);
  ["play", "pause", "ended", "emptied"].forEach((e) => audio.addEventListener(e, set));
}

// "On this page": the page's sections, shown in the left gutter once you've scrolled into them.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function buildContents() {
  const heads = [...document.querySelectorAll(".seo h2, main.prose h2")];
  if (heads.length < 3) return;
  heads.forEach((h) => { h.id ||= slug(h.textContent); });
  const nav = document.createElement("nav");
  nav.className = "toc";
  nav.setAttribute("aria-label", "On this page");
  nav.innerHTML = `<span class="toc-label">On this page</span>` +
    heads.map((h) => `<a href="#${h.id}">${h.textContent}</a>`).join("") +
    `<a class="toc-top" href="#">Back to top</a>`;
  document.body.append(nav);
  const links = [...nav.querySelectorAll("a[href^='#']:not(.toc-top)")];
  // Scroll without a hashchange: the converter uses the hash for its own routing.
  const behavior = () => (CALM.matches ? "auto" : "smooth");
  nav.querySelector(".toc-top").addEventListener("click", (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: behavior() }); });
  links.forEach((a, i) => a.addEventListener("click", (e) => {
    e.preventDefault();
    heads[i].scrollIntoView({ behavior: behavior() });
    history.replaceState(null, "", `#${heads[i].id}`);
  }));

  let queued = false;
  const update = () => {
    queued = false;
    const visible = heads.filter((h) => h.offsetParent);  // the app hides its sections while a book is open
    const show = visible.length > 0 && visible[0].getBoundingClientRect().top < innerHeight * 0.45;
    nav.classList.toggle("shown", show);
    let current = visible.filter((h) => h.getBoundingClientRect().top < 140).pop() || visible[0];
    links.forEach((a, i) => a.toggleAttribute("aria-current", heads[i] === current && show));
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  addEventListener("hashchange", update);
  update();
}

buildSea();
followAudio();
buildContents();
