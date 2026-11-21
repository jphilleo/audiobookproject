import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const CLIENT_EVENTS = new Set(['visitor_visit','page_view','chapter_play','chapter_complete','audio_error','download_click','podcast_open','podcast_copy']);
const SERVER_EVENTS = new Set(['request_accepted','request_confirmed','download_served','upload_complete','narration_started']);
export class Analytics {
  constructor({dir, routes=[], books=[], now=()=>new Date()}) {
    this.dir=dir;this.routes=new Set(routes);this.books=new Set(books);this.now=now;this.days={};this.dirty=false;this.writes=Promise.resolve();this.visitors={};
  }
  async init() {
    await fs.mkdir(this.dir,{recursive:true,mode:0o700});
    try {this.days=JSON.parse(await fs.readFile(path.join(this.dir,'counts.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    try {const saved=JSON.parse(await fs.readFile(path.join(this.dir,'visitors.json'),'utf8'));this.visitors=saved.days;this.visitorSalt=saved.salt;this.visitorStarted=saved.started;}
    catch(e){if(e.code!=='ENOENT')throw e;this.visitorSalt=crypto.randomBytes(32).toString('hex');this.visitorStarted=this.now().toISOString();this.dirty=true;}
    this.prune();
  }
  prune() {const cutoff=new Date(this.now().getTime()-89*864e5).toISOString().slice(0,10);for(const store of [this.days,this.visitors])for(const d of Object.keys(store))if(d<cutoff){delete store[d];this.dirty=true;}}
  page(value) {
    const p=String(value||'').split(/[?#]/)[0].replace(/\/$/,'')||'/';
    if(this.routes.has(p))return p;
    if(/^\/requests\/[a-f0-9]{64}(?:\/(?:confirm|download|cancel))?$/.test(p))return '/requests';
    return null;
  }
  record(input, server=false) {
    if(!input || !(CLIENT_EVENTS.has(input.event)||(server && SERVER_EVENTS.has(input.event))))return false;
    const page=this.page(input.path);if(!page)return false;
    const book=this.books.has(input.book)?input.book:'';
    const format=['m4b','mp3'].includes(input.format)?input.format:'';
    const device=['mobile','desktop'].includes(input.device)?input.device:'unknown';
    const source=['direct','internal','google','bing','duckduckgo','social','other'].includes(input.source)?input.source:'unknown';
    const key=JSON.stringify([input.event,page,book,format,device,source]);
    this.prune();const day=this.now().toISOString().slice(0,10);const bucket=this.days[day] ||= {};
    if(!(key in bucket) && Object.keys(bucket).length>=20000)return false;
    // Store only daily stage flags per pseudonymous browser, never its pages or books.
    const stage={visitor_visit:1,page_view:1,chapter_play:2,download_click:4,download_served:8}[input.event];
    if(stage && /^[a-f0-9]{32}$/.test(input.visitor||'')) {
      const id=crypto.createHmac('sha256',this.visitorSalt).update(input.visitor).digest('hex');
      const visitors=this.visitors[day] ||= {};
      if(id in visitors || Object.keys(visitors).length<100000)visitors[id]=(visitors[id]||0)|stage;
    }
    // Opting in on the current page establishes a visitor without another page view.
    if(input.event!=='visitor_visit')bucket[key]=(bucket[key]||0)+1;
    this.dirty=true;return true;
  }
  flush() {
    this.writes=this.writes.catch(()=>{}).then(async()=>{
      if(!this.dirty)return;this.dirty=false;
      try{await fs.writeFile(path.join(this.dir,'counts.tmp'),JSON.stringify(this.days),{mode:0o600});await fs.rename(path.join(this.dir,'counts.tmp'),path.join(this.dir,'counts.json'));
        await fs.writeFile(path.join(this.dir,'visitors.tmp'),JSON.stringify({salt:this.visitorSalt,started:this.visitorStarted,days:this.visitors}),{mode:0o600});await fs.rename(path.join(this.dir,'visitors.tmp'),path.join(this.dir,'visitors.json'));}catch(e){this.dirty=true;throw e;}
    });return this.writes;
  }
  funnel(days=30) {
    this.prune();const cutoff=new Date(this.now().getTime()-(days-1)*864e5).toISOString().slice(0,10);
    const flags=new Map();for(const [day,visitors] of Object.entries(this.visitors))if(day>=cutoff)for(const [id,bits] of Object.entries(visitors))flags.set(id,(flags.get(id)||0)|bits);
    const all=[...flags.values()].filter(bits=>bits&1);
    const visitors=all.length,listeners=all.filter(b=>b&2).length,downloadClicks=all.filter(b=>b&4).length,downloadsServed=all.filter(b=>b&8).length;
    const downloaders=all.filter(b=>b&12).length,both=all.filter(b=>(b&2)&&(b&12)).length;
    const rate=(n,d)=>d?n/d:null;
    return {started:this.visitorStarted,visitors,listeners,downloaders,downloadClicks,downloadsServed,both,
      listenRate:rate(listeners,visitors),downloadRate:rate(downloaders,visitors),listenerDownloadRate:rate(both,listeners)};
  }
  report(days=30) {
    this.prune();const cutoff=new Date(this.now().getTime()-(days-1)*864e5).toISOString().slice(0,10);
    const rows=[];for(const [day,bucket] of Object.entries(this.days))if(day>=cutoff)for(const [key,count] of Object.entries(bucket)){const [event,page,book,format,device,source]=JSON.parse(key);rows.push({day,event,page,book,format,device,source,count});}return rows;
  }
}
export function visitorFromRequest(req) {
  if(req.get('DNT')==='1'||req.get('Sec-GPC')==='1')return undefined;
  return /(?:^|;\s*)ap_analytics=([a-f0-9]{32})(?:;|$)/.exec(req.get('cookie')||'')?.[1];
}
export async function installAnalytics(app,{routes,books,dir=process.env.ANALYTICS_DIR,password=process.env.ANALYTICS_PASSWORD,origin=process.env.PUBLIC_URL}={}) {
  if(!dir)return;
  if(!password || password.length<24 || !origin)throw new Error('Analytics requires a strong dashboard password and public URL');
  const stats=new Analytics({dir,routes,books});await stats.init();
  app.locals.analytics=stats;
  const reportError=()=>console.error('Analytics persistence failed');
  const timer=setInterval(()=>stats.flush().catch(reportError),5000);timer.unref();
  const limits=new Map();const reset=setInterval(()=>limits.clear(),60000);reset.unref();
  const allowedOrigin=new URL(origin).origin;
  const optedOut=req=>req.get('DNT')==='1'||req.get('Sec-GPC')==='1';
  app.post('/api/analytics', (req,res)=>{
    res.set('Cache-Control','no-store');
    if(req.get('origin')!==allowedOrigin)return res.status(403).end();
    if(optedOut(req)||/bot|crawler|spider|headless/i.test(req.get('user-agent')||''))return res.status(204).end();
    const key=req.ip;const count=limits.get(key)||0;
    if(count>=120 || (!limits.has(key)&&limits.size>=10000))return res.status(429).end();limits.set(key,count+1);
    if(Buffer.byteLength(JSON.stringify(req.body||{}))>2048)return res.status(413).end();
    if(!stats.record(req.body))return res.status(400).end();
    res.status(204).end();
  });
  const digest=s=>crypto.createHash('sha256').update(s).digest();
  app.use('/admin/analytics',(req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
    const basic=req.get('authorization')||'';const decoded=basic.startsWith('Basic ')?Buffer.from(basic.slice(6),'base64').toString():'';
    if(!crypto.timingSafeEqual(digest(decoded),digest(`admin:${password}`)))return res.status(401).set('WWW-Authenticate','Basic realm="Audiobook analytics", charset="UTF-8"').send('Sign in to view analytics.');next();
  });
  app.get('/admin/analytics',async(req,res)=>res.type('html').send(await fs.readFile(new URL('../views/analytics.html',import.meta.url),'utf8')));
  app.get('/admin/analytics/data',(req,res)=>{const days=[7,30,90].includes(Number(req.query.days))?Number(req.query.days):30;res.json({rows:stats.report(days),funnel:stats.funnel(days)});});
  // Aggregate successful converter actions without reading uploaded content or identifiers.
  app.use((req,res,next)=>{
    if(!optedOut(req))res.on('finish',()=>{
      if(res.statusCode<200||res.statusCode>=300)return;
      if(req.method==='POST'&&req.path==='/api/books')stats.record({event:'upload_complete',path:'/'},true);
      if(req.method==='POST'&&/^\/api\/books\/[^/]+\/narrate$/.test(req.path))stats.record({event:'narration_started',path:'/'},true);
    });next();
  });
  stats.stop=async()=>{clearInterval(timer);clearInterval(reset);await stats.flush();};return stats;
}
