// Development only (`npm run dev`): the open tab reloads itself after a change.
// node --watch restarts the server when its code changes, and a restarted server has a new boot id,
// so tabs that reconnect with a different id reload. Files served straight from disk (public/,
// views/) don't restart anything, so they're watched here and trigger a reload directly.
import fs from "node:fs";
import path from "node:path";

export const DEV = process.argv.includes("--dev");

const BOOT = Date.now().toString(36);
const clients = new Set();

export const RELOAD_SCRIPT = `<script>(() => {
  let boot;
  const events = new EventSource("/__dev/reload");
  events.onmessage = (e) => { if (e.data === "reload" || (boot && e.data !== boot)) location.reload(); boot ??= e.data; };
})();</script>`;

export function devReload(app, root) {
  app.get("/__dev/reload", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }).flushHeaders();
    res.write(`retry: 300\ndata: ${BOOT}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
  });
  let timer;
  for (const dir of ["public", "views"]) {
    fs.watch(path.join(root, dir), { recursive: true }, (_event, file) => {
      if (file && /(^|\/)\./.test(file)) return; // editors' temporary files
      clearTimeout(timer);
      timer = setTimeout(() => { for (const res of clients) res.write("data: reload\n\n"); }, 80);
    });
  }
  console.log("Dev mode: open tabs reload after changes");
}
