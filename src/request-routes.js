import fs from 'node:fs/promises';
import { visitorFromRequest } from './analytics.js';
import { requestPage } from './request-presentation.js';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BookRequests, sendResend } from './book-requests.js';
import { CATALOG, publishedBooks, bookUrl } from './catalog.js';
import { audioUrl } from './library-pages.js';
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const requestsEnabled = () => process.env.BOOK_REQUESTS_ENABLED === '1' && Boolean(process.env.RESEND_API_KEY && process.env.REQUEST_EMAIL_FROM && process.env.PUBLIC_URL);
export async function installRequestRoutes(app, overrides = {}) {
  if (!requestsEnabled()) return;
  const dir = path.resolve(process.env.REQUEST_DIR || 'data/requests');
  const audioDir = path.join(dir, 'audio');
  const origin = new URL(process.env.PUBLIC_URL).origin;
  const lookup = slug => CATALOG.find(b => b.slug === slug);
  const existing = slug => publishedBooks().find(b => b.slug === slug && b.ready && b.m4b && b.mp3);
  async function local(slug) {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(audioDir, slug, 'delivery.json'), 'utf8'));
      if (manifest.slug !== slug || !manifest.verified) return null;
      for (const f of ['m4b', 'mp3']) if ((await fs.stat(path.join(audioDir, slug, `${slug}.${f}`))).size !== manifest[f].bytes) return null;
      return manifest;
    } catch { return null; }
  }
  const run = (cmd, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: 'ignore' });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error('Preparation failed')));
  });
  const queue = new BookRequests({ dir, origin, lookup, send: overrides.send || sendResend,
    available: overrides.available || (async slug => Boolean(existing(slug) || await local(slug))),
    generate: overrides.generate || (async slug => {
      const stats = await fs.statfs(dir); if (stats.bavail * stats.bsize < 15e9) throw new Error('Insufficient space');
      await run('nice', ['-n', '10', process.execPath, 'scripts/narrate-library.js', slug], { env: { ...process.env, LIBRARY_DIR: audioDir } });
      await run(process.execPath, ['scripts/verify-request-book.js', audioDir, slug]);
    }),
  });
  await queue.init();
  const track = (req,event,slug,format) => {
    if(req.get('DNT')==='1'||req.get('Sec-GPC')==='1')return;
    app.locals.analytics?.record({event,path:'/requests',book:slug,format,visitor:visitorFromRequest(req)},true);
  };
  const sameOrigin = (req, res, next) => {
    if (req.get('origin') !== origin) return res.status(403).json({ error: 'Please submit the form from this site.' });
    next();
  };
  app.use('/requests', (_req, res, next) => { res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'same-origin' }); next(); });
  app.post('/api/library-requests', sameOrigin, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await queue.request({ ...req.body, ip: req.ip }); track(req,'request_accepted',req.body.slug,req.body.format); res.status(202).json({ message: 'Check your email for a confirmation link. If it does not arrive, check spam or try again tomorrow. We start preparing the book after you confirm.' }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  const page = requestPage;
  app.get('/requests/:token', (req, res) => {
    const status = queue.status(req.params.token);
    if (!status) return res.status(404).type('html').send(page('Request expired', '<p>Please return to the library to request a new download.</p>'));
    const { book, format, confirmed } = status;
    const message = { queued: 'Your full audiobook is queued for preparation. We will email you when it is ready. Longer books and busy queues can take several days; no delivery date is guaranteed.', working: 'Your full audiobook is being prepared and checked. We will email you when the download is ready.', failed: 'We could not finish this recording after several attempts. No complete download is available. Please try again later.', ready: 'Your full audiobook is ready. This request page expires 30 days after the delivery email is sent.' }[status.status];
    const body = !confirmed ? `<p>Confirm that you requested the full audiobook in ${format.toUpperCase()}. This is free and does not subscribe you to marketing emails.</p><form method="post" action="/requests/${req.params.token}/confirm"><button class="btn primary">Confirm audiobook request</button></form>` : `<p>${message}</p>${status.status === 'ready' ? `<a class="btn primary" href="/requests/${req.params.token}/download">Download ${format.toUpperCase()}</a>` : ''}`;
    res.type('html').send(page(book.title, `${body}<p><a class="btn request-listen" href="${bookUrl(book)}">${status.status === 'ready' ? 'Listen online' : 'Listen while you wait'} &rarr;</a></p><form class="request-cancel" method="post" action="/requests/${req.params.token}/cancel"><button class="request-cancel-button">Cancel request and remove my email</button></form>`, {book, format, status: status.status}));
  });
  app.post('/requests/:token/confirm', sameOrigin, async (req, res) => {
    try { const before=queue.get(req.params.token); const wasConfirmed=before?.confirmed; await queue.confirm(req.params.token); if(!wasConfirmed)track(req,'request_confirmed',before?.slug,before?.format); res.redirect(303, `/requests/${req.params.token}`); }
    catch (e) { res.status(400).type('html').send(page('Unable to confirm', `<p>${escape(e.message)}</p>`)); }
  });
  app.post('/requests/:token/cancel', sameOrigin, async (req, res) => { await queue.cancel(req.params.token); res.type('html').send(page('Request removed', '<p>Your email address and this request have been removed.</p>')); });
  app.get('/requests/:token/download', async (req, res) => {
    const r = queue.get(req.params.token);
    if (!r?.confirmed || queue.status(req.params.token).status !== 'ready') return res.status(404).end();
    const b = existing(r.slug);
    if (b) {track(req,'download_served',r.slug,r.format); return res.redirect(302, audioUrl(b, b[r.format].file));}
    if (!(await local(r.slug))) return res.status(503).send('Download temporarily unavailable. Please try again later.');
    res.on('finish',()=>{if(res.statusCode===200)track(req,'download_served',r.slug,r.format);});
    res.download(path.join(audioDir, r.slug, `${r.slug}.${r.format}`), `${r.slug}.${r.format}`);
  });
  const timer = setInterval(() => queue.tick().catch(() => console.error('Book request queue check failed')), 10000); timer.unref();
  queue.tick().catch(() => console.error('Book request queue startup check failed'));
  queue.stop = () => clearInterval(timer);
  return queue;
}
