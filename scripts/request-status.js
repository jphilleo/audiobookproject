// Private operational summary: no email addresses or bearer links in output.
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=process.env.REQUEST_DIR || 'data/requests';
const s=JSON.parse(await fs.readFile(path.join(dir,'requests.json'),'utf8'));
const requests=Object.values(s.requests);const jobs=Object.values(s.jobs);
console.log(JSON.stringify({requests:requests.length,unconfirmed:requests.filter(r=>!r.confirmed).length,awaitingEmail:requests.filter(r=>r.confirmed&&!r.delivery.sent).length,emailNeedsAttention:requests.filter(r=>['confirmation','delivery','failure'].some(k=>r[k]&&!r[k].sent&&(r[k].tries>=6||r[k].needsReview))).length,jobs:jobs.map(j=>({slug:j.slug,status:j.status,attempts:j.attempts})),mailBudget:s.mailBudget},null,2));
