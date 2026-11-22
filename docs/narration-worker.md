# Continuous library narration

`audiobook-narration.service` runs one worker separately from the web process. It
uses two of the four CPUs, at most 3 GB RAM, low CPU/I/O priority and no swap.
The service restarts after failure or reboot. `flock` prevents duplicate workers.

The website is the only writer of requests.json. The worker is the only writer
of narration/state.json. Confirmed, unexpired reader requests rank ahead of the
catalog, oldest request first. Multiple readers share one recording. Publication
is required before the web process sends delivery emails.

Every 10 seconds the worker checks requests, interactive converter jobs, free
memory, memory pressure, disk and local website response time. It yields after
the current durable speech chunk when necessary. Checking/encoding children stay
inside the resource limits. Repeated failures back off, then quarantine after
three failures. Pauses and restarts do not count as failures.

`narrate-queued.js` is the scheduler entry point, matching the audio operations
of `narrate-library.js` with cooperative yields added. Keep both implementations
in sync when changing narration. The original fingerprint stays unchanged for
these scheduling-only changes, preserving the existing Mac batch checkpoints.

The deployment-specific reservations.json contains the Mac's assigned slugs.
Reservations do not silently expire: a disconnected Mac must not cause a second
recording of a book in flight. The Mac bridge retrieves only slug priorities,
reprioritizes its two workers and transfers finished recordings into an atomic
incoming directory. The server independently decodes and verifies all files.
Release a reservation manually only after stopping its Mac job.

Publication copies verified audio into a versioned directory and atomically
switches the manifest. Existing pages remain intact until this succeeds. Source,
audit and verification records remain. Disposable PCM and duplicated working
audio are removed after validation/publication. New recordings initially use origin storage. When /etc/audiobook-storage.env
provides scoped R2 credentials, idle capacity uploads them to R2, verifies every
remote checksum and range playback, then removes the origin audio. Old origin
URLs redirect to the verified cloud object. Upload failure leaves local files
intact and retries after five minutes. No desktop OAuth credential is copied.
The worker stops below 20 GB free. Required storage settings: R2_ACCESS_KEY_ID,
R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET; mode 0600, root owned. Only the
worker loads these credentials, not the website.

Inspect: systemctl status audiobook-narration; narration/state.json (no email
addresses); narration/<slug>.log. Stop: systemctl stop audiobook-narration.
Failed jobs need operator review before resetting status=queued and failures=0
while the worker is stopped. Website remains independent.
