# Full audiobook requests by email

Readers choose M4B or MP3, receive a confirmation email, and explicitly confirm from its private page. Merely opening the email link does not trigger narration. Confirmed requests for the same catalog slug share one durable job. Completed library books reuse their downloads; other books are narrated into a separate private delivery directory. The existing public previews/manifests are not replaced by this process.

The recording worker uses the catalog voice choices and production narration fixes. Before delivery, all selected source chapters must be present, each audio file must decode, and chapter/full-download durations must match. Both M4B and MP3 must pass before `delivery.json` is written. This is structural verification, not human listening or a guarantee that every source interpretation/pronunciation is perfect. Completed PCM checkpoints are removed only after verification; source, final audio, manifest and chapter audit files remain.

## Activation

Disabled by default. Keep disabled until the verified sender and real delivery test pass. Set these through a root-owned environment file on the server, never Git:

```
BOOK_REQUESTS_ENABLED=1
PUBLIC_URL=https://audiobookproject.org
REQUEST_DIR=/var/lib/audiobook/requests
REQUEST_EMAIL_FROM=Audiobook Project <books@delivery.audiobookproject.org>
RESEND_API_KEY=<sending-only key for the verified sender domain>
```

Create REQUEST_DIR owned by the audiobook service user, mode 0700. Store Resend's sender-domain DNS records in Cloudflare, verify the domain, then use a sending-only key restricted to that domain. Activated on 2026-11-17 after DNS verification and real inbox tests. Sender: books@delivery.audiobookproject.org. The sending-only key is restricted to this domain and stored in /etc/audiobook-requests.env (root-owned, mode 0600), loaded by the systemd requests.conf override. No credential is stored in Git.

Run only one web-server process against REQUEST_DIR. The worker is part of that process and uses one lower-priority child process for full narration. systemd's default control-group shutdown terminates that child when the service stops. Interrupted jobs return to queued on startup and reuse valid narration checkpoints. Do not run an independent worker against the same store.

Required runtime: Node, existing npm dependencies/model cache, ffmpeg, `nice`, source-download network access, and at least 15 GB free at job start. No additional paid narration service is involved. Delivery audio initially lives on the server, separate from public R2 previews. Long-term migration of completed full recordings to R2 is a separate publication step; monitor disk usage as the full catalog grows.

## Delivery, retries and limits

Private request pages are noindex/no-store with a same-origin referrer policy (private links are never sent as referrers to other sites). They expose no recipient addresses. Confirmation expires after 48 hours. Confirmed pending requests expire after 90 days; fulfilled requests and recipient addresses expire 30 days after the delivery email is accepted by the provider. The private link lets a reader cancel and remove their request. Public-domain recordings may be reused by other readers.

One job per book; at most 20 queued/working jobs, 1,000 retained requests, five submissions per hashed network address daily, and three new requests per recipient daily. Unconfirmed addresses never start generation. A honeypot and same-origin POST checks add basic abuse controls. Email attempts are capped at 90 per rolling day with delivery prioritized over confirmations; review limits against the selected provider plan before larger traffic. These controls are not a substitute for dedicated bot protection at high volume.

Emails use persisted payloads and stable provider idempotency keys, with at most six exponential-backoff attempts. Automatic retry stops after 23 hours from the first attempt to avoid replaying a provider idempotency key outside its retention window. Failed mail stays visible in the private operational report; provider acceptance is not proof of inbox delivery. No provider webhook/bounce dashboard is integrated yet. Generation retries three times, then sends an honest failure notice rather than a download claim. Operators must review failures and mail delivery in Resend.

```
REQUEST_DIR=/var/lib/audiobook/requests node scripts/request-status.js
```

This prints counts and book job states, never recipient addresses or private links. Back up `requests.json` securely with short retention; it contains email addresses and bearer links. Do not publish it or put it in logs.

## Validation performed

- Unit and local HTTP tests: confirmation gating, duplicate jobs, existing-book reuse, format/email validation, throttling, durable email retry, generation failure, cancellation/expiry, same-origin protections, and truthful preview metadata.
- Local Chrome: form submission, format selection, success message, desktop layout, 390px mobile layout. Outbound mail was captured locally, not sent.
- Isolated server fixture: real Kokoro narration of two chapters, assembly of both formats, complete decode/duration/coverage verification. Test recording was never published as a library book.
- Live Resend activation: verified sender and public DNS; confirmation and ready emails reached the Gmail inbox for Christmas Carol (M4B) and Jekyll and Hyde (MP3). Both downloads completed and decoded fully without errors.
- Live Chrome caught and verified the fix for confirmation POSTs: same-origin referrer policy retains the Origin header while excluding private referrers from other sites. All 57 automated tests pass.
- A third request submitted through the live public form started full narration of The Prophet. Its confirmation arrived and the durable worker entered working state. Final generation/delivery is not yet verified.
