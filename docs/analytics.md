# Website analytics

Self-hosted, aggregate-only analytics at `/admin/analytics`. HTTP Basic login uses `admin` and `ANALYTICS_PASSWORD` from the protected service environment. No account, third-party analytics subscription, tracking cookie, fingerprint, session replay, or reader identifier is used.

`ANALYTICS_DIR` enables collection. `PUBLIC_URL` restricts browser submissions to the site's origin. Store the directory outside the public tree and back up `counts.json`. The collector writes atomically every five seconds and on normal SIGTERM, so abrupt failure may lose the last five seconds. Designed for this site's single process; do not run multiple writers against one directory. Aggregate rows expire after 90 UTC days. Raw events are never persisted. Temporary per-IP throttling is cleared every minute and capped at 10,000 entries.

Dashboard: 7/30/90-day views, daily traffic, top pages, public books, action totals, source category, and mobile/desktop viewport group. Auth protects both dashboard and data; both use no-store and noindex. Rotate the password in the service environment and restart to revoke access.

## Definitions
- `page_view`: one document load, including persistent-player iframe navigation. No additional history hook, preventing duplicate counting. Private request URLs collapse to `/requests`.
- `chapter_play`: actual `playing` event, once until pause, chapter change, or end. Buffering resumes do not add a play. Attribution uses the playing book, not whichever page the listener has navigated to.
- `chapter_complete`: audio ended; seeking to the end can count. Not proof of listening to every second.
- `audio_error`: browser media error.
- `download_click`: click on public M4B/MP3 link. Not completed transfer.
- `podcast_open` / `podcast_copy`: app link clicked / successful copy; not external app playback.
- `request_accepted`: accepted request response (duplicates and anti-abuse honeypot submissions receive the same response); not unique readers or emails delivered.
- `request_confirmed`: successful transition from unconfirmed to confirmed, excluding repeat confirmations.
- `download_served`: ready request's download redirect or successful local file response, not a guaranteed completed transfer.
- `upload_complete` / `narration_started`: successful converter operations, without uploaded book names, text or IDs.

These are action counts, not unique visitors or person-level funnels. Client events can be blocked or forged, so do not use them for billing. Known bot user agents are filtered from browser collection; DNT and GPC suppress collection. No country, precise location, referrer URL, query, UTM, raw user agent, email, token, private upload metadata, or IP is stored in analytics. Server access logs remain separate.

The Stripe/credit work is a separate unfinished release. This release does not enable payment limits or report purchases.

## Verification
Run `npm test`. Analytics tests cover sensitive-field removal, route/event allowlists, retention/restart, authentication, origin checks, opt-out, cookie absence, and persistent-player book attribution. Check production `/api/analytics` returns 204 for valid events and the protected dashboard reflects them. No public data endpoint exists.
