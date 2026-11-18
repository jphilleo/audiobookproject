// Single-process durable request queue. Keep this store outside all public/static directories.
import fs from 'node:fs/promises';
import { requestEmail } from './request-presentation.js';
import path from 'node:path';
import crypto from 'node:crypto';
const DAY = 86400000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export class BookRequests {
  constructor({ dir, origin, lookup, generate, available, send, now = Date.now, maxJobs = 20 }) {
    Object.assign(this, { dir, origin, lookup, generate, available, send, now, maxJobs });
    this.chain = Promise.resolve(); this.running = false;
  }
  async init() {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
    try { this.state = JSON.parse(await fs.readFile(path.join(this.dir, 'requests.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; this.state = { requests: {}, jobs: {}, limits: {}, salt: crypto.randomBytes(32).toString('hex') }; }
    for (const job of Object.values(this.state.jobs)) if (job.status === 'working') job.status = 'queued';
    await this.save();
  }
  async save() {
    const file = path.join(this.dir, 'requests.json');
    await fs.writeFile(file + '.tmp', JSON.stringify(this.state), { mode: 0o600 });
    await fs.rename(file + '.tmp', file);
  }
  locked(fn) { const result = this.chain.then(fn); this.chain = result.catch(() => {}); return result; }
  prune() {
    const now = this.now();
    for (const [id, r] of Object.entries(this.state.requests)) if (r.expires < now) delete this.state.requests[id];
    for (const [id, entry] of Object.entries(this.state.limits)) if (entry.until < now) delete this.state.limits[id];
  }
  async request({ slug, email, format, ip, website }) {
    return this.locked(async () => {
      this.prune();
      if (website) return;
      if (!this.lookup(slug)) throw new Error('Book not found.');
      if (!['m4b', 'mp3'].includes(format)) throw new Error('Choose M4B or MP3.');
      email = String(email || '').trim().toLowerCase();
      if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || /[\r\n]/.test(email)) throw new Error('Enter a valid email address.');
      const key = hash(`${this.state.salt}:${ip}`), now = this.now();
      const limit = this.state.limits[key] ||= { count: 0, until: now + DAY };
      if (limit.count >= 5) throw new Error('Too many requests. Please try again tomorrow.');
      limit.count++;
      // Same response for duplicate requests; never disclose whether an address has requested a book.
      if (Object.values(this.state.requests).some(r => r.email === email && r.slug === slug && r.format === format && r.created > now - DAY)) { await this.save(); return; }
      if (Object.values(this.state.requests).filter(r => r.email === email && r.created > now - DAY).length >= 3) { await this.save(); return; }
      if (Object.keys(this.state.requests).length >= 1000) throw new Error('Requests are full right now. Please try again later.');
      const token = crypto.randomBytes(32).toString('hex');
      this.state.requests[hash(token)] = { token, slug, email, format, created: now, expires: now + 2 * DAY, confirmed: false, confirmation: { tries: 0 }, delivery: { tries: 0 } };
      await this.save();
    });
  }
  async confirm(token) {
    return this.locked(async () => {
      const r = this.get(token);
      if (!r) throw new Error('This request has expired. Please request the book again.');
      if (r.confirmed) return;
      const job = this.state.jobs[r.slug];
      if (!job && Object.values(this.state.jobs).filter(j => ['queued', 'working'].includes(j.status)).length >= this.maxJobs) throw new Error('The preparation queue is full. Please try confirming again later.');
      r.confirmed = true; r.expires = this.now() + 90 * DAY;
      if (!job) this.state.jobs[r.slug] = { slug: r.slug, status: 'queued', created: this.now(), attempts: 0 };
      await this.save();
    });
  }
  get(token) { if (!/^[a-f0-9]{64}$/.test(token || '')) return null; const r = this.state.requests[hash(token)]; return r && r.expires > this.now() ? r : null; }
  status(token) {
    const r = this.get(token); if (!r) return null;
    const job = this.state.jobs[r.slug];
    return { book: this.lookup(r.slug), format: r.format, confirmed: r.confirmed, status: !r.confirmed ? 'unconfirmed' : job?.status || 'queued', emailSent: Boolean(r.delivery.sent) };
  }
  async cancel(token) { return this.locked(async () => { delete this.state.requests[hash(token)]; await this.save(); }); }
  async mail(r, kind, text, subject) {
    const item = r[kind] ||= { tries: 0 }; const now = this.now();
    if (item.sent || item.tries >= 6 || item.next > now || !this.get(r.token)) return;
    if (item.firstAttempt && now - item.firstAttempt > 23 * 3600000) { item.needsReview = true; return; }
    const daily = this.state.mailBudget;
    if (daily?.until > now && daily.count >= 90) return;
    // Stable persisted payload + idempotency key prevent repeated emails across restarts/retries.
    await this.locked(async () => { if (!this.state.mailBudget || this.state.mailBudget.until <= now) this.state.mailBudget = { until: now + DAY, count: 0 };
      this.state.mailBudget.count++; item.firstAttempt ||= now; item.payload ||= { to: r.email, subject, text, html: requestEmail({book: this.lookup(r.slug), format:r.format, kind, link:`${this.origin}/requests/${r.token}`}) }; item.tries++; item.next = now + Math.min(3600000, 60000 * 2 ** item.tries); await this.save(); });
    try {
      await this.send({ ...item.payload, key: `${hash(r.token)}-${kind}` });
      await this.locked(async () => { item.sent = this.now(); delete item.payload; if (kind === 'delivery') r.expires = this.now() + 30 * DAY; await this.save(); });
    } catch { /* Retained for retry; no addresses or provider payloads in logs. */ }
  }
  async tick() {
    if (this.running) return; this.running = true;
    try {
      await this.locked(async () => { this.prune(); await this.save(); });
      for (const r of Object.values(this.state.requests).sort((a,b) => Number(b.confirmed) - Number(a.confirmed))) {
        const book = this.lookup(r.slug); if (!book) continue;
        const link = `${this.origin}/requests/${r.token}`;
        if (!r.confirmed) await this.mail(r, 'confirmation', `Confirm your request for ${book.title} (${r.format.toUpperCase()}):\n\n${link}\n\nOpen the link and press Confirm. It expires in 48 hours. If you did not request this audiobook, ignore this email. We will not prepare it or send further emails unless you confirm.`, `Confirm your audiobook request: ${book.title}`);
        else {
          const job = this.state.jobs[r.slug];
          if (job?.status === 'ready') await this.mail(r, 'delivery', `Your full audiobook of ${book.title} is ready in ${r.format.toUpperCase()}:\n\n${link}\n\nThis download page is available for 30 days. This is the audiobook you requested, not a mailing-list subscription.`, `Your audiobook is ready: ${book.title}`);
          if (job?.status === 'failed') await this.mail(r, 'failure', `We could not finish your audiobook of ${book.title}. No download is ready. You can check the request or remove your email here:\n\n${link}\n\nWe are sorry we could not fulfill this request.`, `Audiobook preparation unsuccessful: ${book.title}`);
        }
      }
      if (this.generating) return;
      const job = Object.values(this.state.jobs).find(j => j.status === 'queued' && (!j.next || j.next <= this.now()) && Object.values(this.state.requests).some(r => r.slug === j.slug && r.confirmed));
      if (!job) return;
      await this.locked(async () => { job.status = 'working'; job.attempts++; await this.save(); });
      this.generating = (async () => { try {
        if (!(await this.available(job.slug))) await this.generate(job.slug);
        if (!(await this.available(job.slug))) throw new Error('Full audiobook verification failed');
        await this.locked(async () => { job.status = 'ready'; job.completed = this.now(); await this.save(); });
      } catch {
        await this.locked(async () => { job.status = job.attempts >= 3 ? 'failed' : 'queued'; job.next = this.now() + 300000 * job.attempts; await this.save(); });
      } })().catch(() => console.error('Book preparation state could not be saved')).finally(() => { this.generating = null; });
    } finally { this.running = false; }
  }
}

export async function sendResend({ to, subject, text, html, key }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from: process.env.REQUEST_EMAIL_FROM, to: [to], subject, text, html }),
  });
  if (!response.ok) throw new Error(`Email provider status ${response.status}`);
  const result = await response.json(); if (!result.id) throw new Error('Email provider did not accept message');
}
