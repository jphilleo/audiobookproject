// The worker alone writes this state; the website alone writes requests.json.
export function requestedBooks(requests, now = Date.now()) {
  const result = new Map();
  for (const r of Object.values(requests.requests || {})) if (r.confirmed && r.expires > now)
    result.set(r.slug, Math.min(result.get(r.slug) ?? Infinity, r.created));
  return result;
}
export function selectJob(jobs, requests, reserved = [], now = Date.now()) {
  const priority = requestedBooks(requests, now), excluded = new Set(reserved);
  return Object.values(jobs).filter(j => !excluded.has(j.slug) && !['complete','failed'].includes(j.status) && !(j.next > now))
    .sort((a,b) => Number(priority.has(b.slug)) - Number(priority.has(a.slug)) ||
      (priority.has(a.slug) ? priority.get(a.slug) - priority.get(b.slug) : (a.order - b.order)))[0];
}
export function recover(jobs) {
  for (const job of Object.values(jobs)) if (['generating','checking','publishing'].includes(job.status)) job.status = 'paused';
}
export function finishAttempt(job, code, now = Date.now()) {
  if (code === 75) { job.status = 'paused'; return; }
  if (code === 0) { job.status = 'complete'; job.completed = now; delete job.next; return; }
  job.failures = (job.failures || 0) + 1;
  job.status = job.failures >= 3 ? 'failed' : 'queued';
  job.next = now + Math.min(3600000, 300000 * 2 ** (job.failures - 1));
}
