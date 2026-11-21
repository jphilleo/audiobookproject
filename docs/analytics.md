# Website analytics

Self-hosted dashboard at `/admin/analytics`, protected with HTTP Basic (`admin` and `ANALYTICS_PASSWORD`). `ANALYTICS_DIR` enables collection; `PUBLIC_URL` limits browser submissions to the site origin. Dashboard and data responses are private, no-store and noindex.

## Daily visitor estimates — no popup

No analytics cookie, localStorage identifier, session replay, or third-party service is created. Existing analytics cookies are removed. Unexpired prior declines are honored through a read-only preference check; DNT/GPC suppress browser collection.

The server derives a daily pseudonymous hash from the normal request IP and User-Agent using a random daily key. Raw inputs are not persisted in analytics. The key survives same-day restarts, rotates at UTC midnight (checked on identification and every five-second flush), and replaces the previous key. Client-provided visitor identifiers are ignored. Stored daily identities have stage flags only, never page/book histories or email/payment associations. Normal server access logs are separate.

Today shows estimated unique visitors, listeners, and download clickers. Longer ranges sum daily unique estimates (visitor-days), not deduplicated monthly people. Only identities with a same-day page view enter denominators. Listen rate = listener-days / visitor-days. Download-click rate = download-click visitor-days / visitor-days. Listener download-click rate = same-day intersection / listener-days. Actions need not occur in sequence. Zero denominators display an em dash. Shared IPs with identical browsers can merge visitors; changing networks can split them. Blockers and privacy signals reduce coverage.

Download conversion measures clicks, not successful file transfers. Private download-served events are aggregate-only, with no joining of request tokens to daily identities. Historical opted-in hashes and salt are discarded during migration; only legacy aggregate stage totals survive and are not mixed into new conversion rates.

## Storage and operations

Store the analytics directory outside the public tree. Atomic writes occur every five seconds and on normal SIGTERM; abrupt failure can lose the last five seconds. Only one process may write to the directory. Data expires after 90 UTC days. Do not archive daily secrets in historical backups; aggregate `counts.json` can be backed up separately. Per-IP throttling is memory-only, capped at 10,000 entries, and cleared every minute. No raw events, raw IPs, User-Agents, emails, tokens, query strings, uploaded titles or referrer URLs are retained in analytics. Coarse source/device groups and allowlisted public pages/books are retained in separate aggregate counts.

## Definitions
- `page_view`: one document load, including persistent-player iframe navigation. No additional history hook, preventing duplicate counting. Private request URLs collapse to `/requests`.
- `chapter_play`: actual `playing` event, once until pause, chapter change, or end. Buffering resumes do not add a play. Attribution uses the playing book, not whichever page the listener has navigated to.
- `chapter_complete`: audio ended; seeking to the end can count. Not proof of listening to every second.
- `audio_error`: browser media error.
- `download_click`: click on a public M4B/MP3 link or same-origin private download link. Not completed transfer.
- `podcast_open` / `podcast_copy`: app link clicked / successful copy; not external app playback.
- `request_accepted`: accepted request response (duplicates and anti-abuse honeypot submissions receive the same response); not unique readers or emails delivered.
- `request_confirmed`: successful transition from unconfirmed to confirmed, excluding repeat confirmations.
- `download_served`: ready request's download redirect or successful local file response, not a guaranteed completed transfer.
- `upload_complete` / `narration_started`: successful converter operations, without uploaded book names, text or IDs.

## Verification

Run `npm test`. Coverage includes sensitive-field removal, route/event allowlists, retention, daily key rotation, same-day restart stability, conversion denominators, migration, authentication, origin checks, privacy signals, absence of tracking cookies/popups, and private download click sanitization. Client events can be forged and must not be used for billing. Stripe/credit work remains a separate release; this release does not enable payment limits or report purchases.
