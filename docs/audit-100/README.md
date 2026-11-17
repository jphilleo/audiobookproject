# 100 additional audiobook-project findings

Audited **b27fb18**, November 16, 2026. This is an audit, not a fixes release.

This follow-up broadens beyond pronunciation into extraction, generation, recovery, downloads, feeds, and playback. It does **not** assert 100 audible errors in A Christmas Carol or the published library. Findings are individually labeled as defects or risks/quality gaps, and separately labeled by verification method. A reproduced mechanism is not proof of frequency in real books. Existing fixes in the preceding 20-item audit are not counted again; newly exposed edge cases are described by their specific triggers.

No production data, recordings, or deployments were changed. Local browser tests used isolated synthetic books, copied short audio, and mocked failures. PDF column/bookmark probes use text-item objects; short/mixed/language probes generate actual PDFs. The mixed-PDF probe contains an empty page, not an OCR scan: it demonstrates absence of a warning, not measured missing scanned words. The token probe measures tokenizer truncation without generating/listening to the resulting waveform. Its native runtime aborted during teardown after recording the result. The SVG probe runs only a harmless same-origin DOM marker, not data theft.

**Verification:** 61 findings reproduced locally; 39 supported by code review but not reproduced at runtime. Some reproduced behaviors are explicitly classified as risks or quality gaps.

## Fix first

1. **Prevent silent omissions:** token-aware chunks (#26), missing EPUB resources (#8), mixed-PDF warnings (#18), hidden/alternate content (#1–6), and title/anchor data loss (#11, #13, #15, #25).
2. **Isolate uploaded SVG** (#58): direct navigation executes script on the application origin. Normal image embedding is not the same trigger.
3. **Protect audio and jobs:** atomic media/metadata publishing (#36, #41), export locking (#37), complete-selection checks (#39), reliable restart/cancellation (#43–45), and stream errors (#40).
4. **Correct playback state:** selection/download mismatch (#79), navigation races (#82), wrong-chapter resume (#86), and overlapping players (#94–95).
5. **Bound resource use:** inference, decompression, uploads, previews, and temporary storage (#29–35, #50–65).

Priority estimates reflect potential impact, not observed production incidence. Related findings sometimes share a component but have distinct triggers or required controls (for example preview cache retention, in-flight deduplication, and request admission).

## Findings

### 001. Semantic footnotes become exponents

**High · Defect · Reproduced locally**

- Evidence: An epub:type=noteref superscript 2 becomes “squared” before note removal.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Remove semantic note markers before interpreting mathematical superscripts.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 1).

### 002. Literal bracketed numbers are deleted

**High · Defect · Reproduced locally**

- Evidence: values[1] becomes values; a general footnote regex removes meaningful notation.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Remove references using markup and preserve ambiguous literal brackets.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 2).

### 003. Ruby annotations are read twice

**Medium · Defect · Reproduced locally**

- Evidence: Base text and ruby pronunciation concatenate into one spoken string.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Choose the pronunciation or base text explicitly; do not concatenate both.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 3).

### 004. Hidden draft text enters narration

**High · Defect · Reproduced locally**

- Evidence: A paragraph with the hidden attribute is retained.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Respect hidden content and define a conservative CSS visibility policy.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 4).

### 005. Tracked deletions and insertions are both read

**Medium · Defect · Reproduced locally**

- Evidence: del and ins produce Old version.New version.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Choose a documented revision policy and keep sentence boundaries.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 5).

### 006. Meaningful image alternative text disappears

**High · Defect · Reproduced locally**

- Evidence: The sign read an image with alt KEEP OUT becomes The sign read .
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Preserve meaningful alt text while excluding decorative images.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 6).

### 007. Nonlinear spine entries join the story

**Medium · Defect · Reproduced locally**

- Evidence: A linear=no answer key is appended to the selected chapter.
- Source: [src/epub.js:73](../../src/epub.js#L73)
- Suggested fix: Keep supplemental spine material separately selectable.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 7).

### 008. Missing required EPUB files are silently skipped

**High · Defect · Reproduced locally**

- Evidence: A missing second spine file produces a successful partial book.
- Source: [src/epub.js:73](../../src/epub.js#L73)
- Suggested fix: Fail with the missing section identified, or require explicit partial conversion.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 8).

### 009. Encoded cover filenames fail to resolve

**Medium · Defect · Reproduced locally**

- Evidence: cover%20image.png does not find cover image.png in the archive.
- Source: [src/epub.js:248](../../src/epub.js#L248)
- Suggested fix: Apply the same URI decoding to every EPUB resource lookup.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 9).

### 010. Encoded navigation filenames lose chapter names

**Medium · Defect · Reproduced locally**

- Evidence: nav%20page.xhtml is ignored despite the file existing with a space.
- Source: [src/epub.js:203](../../src/epub.js#L203)
- Suggested fix: Decode the navigation resource path before ZIP lookup.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 10).

### 011. Fragment-only navigation links lose section boundaries

**High · Defect · Reproduced locally**

- Evidence: Links #one and #two in the navigation/spine document collapse into one section.
- Source: [src/epub.js:203](../../src/epub.js#L203)
- Suggested fix: Resolve an empty path to the current document, not its directory.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 11).

### 012. Invalid Roman headings are interpreted as numbers

**Medium · Defect · Reproduced locally**

- Evidence: IIX becomes Chapter 10; CIVIL becomes Chapter 153.
- Source: [src/epub.js:286](../../src/epub.js#L286)
- Suggested fix: Validate Roman numeral grammar and require heading context before conversion.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 12).

### 013. Title cleanup discards meaningful prefixes

**High · Defect · Reproduced locally**

- Evidence: Thoughts on Chapter IV becomes Chapter 4.
- Source: [src/epub.js:286](../../src/epub.js#L286)
- Suggested fix: Anchor chapter-title recognition and preserve surrounding words.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 13).

### 014. Short multi-chapter documents stay one chapter

**Medium · Defect · Reproduced locally**

- Evidence: Three short h1 chapter sections without a TOC remain one section.
- Source: [src/epub.js:27](../../src/epub.js#L27)
- Suggested fix: Recognize consistent chapter headings independently of the 12,000-word threshold.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 14).

### 015. Two inline TOC anchors assign text to the last chapter

**High · Defect · Reproduced locally**

- Evidence: First and Second inside one paragraph are both assigned to entry Two.
- Source: [src/epub.js:343](../../src/epub.js#L343)
- Suggested fix: Split at anchor positions, including within a text block.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 15).

### 016. Poetry line breaks lose their pacing

**Low · Risk / quality gap · Reproduced locally**

- Evidence: br-separated lines become a single space-separated sentence.
- Source: [src/epub.js:411](../../src/epub.js#L411)
- Suggested fix: Preserve verse line boundaries and apply a separate pause policy; listening evaluation remains needed.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 16).

### 017. Short selectable PDFs are mislabeled as scans

**Medium · Defect · Reproduced locally**

- Evidence: A three-word text PDF is rejected as having no selectable text.
- Source: [src/pdf.js:10](../../src/pdf.js#L10)
- Suggested fix: Separate empty extraction from a short but valid document.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 17).

### 018. Mixed text/scanned PDFs omit pages without warning

**High · Risk / quality gap · Reproduced locally**

- Evidence: A three-page text/empty/text fixture succeeds with no extraction warning.
- Source: [src/pdf.js:10](../../src/pdf.js#L10)
- Suggested fix: Report pages with no extracted text and request OCR/review when appropriate; blank pages alone are not errors.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 18).

### 019. PDF language metadata is ignored

**Medium · Defect · Reproduced locally**

- Evidence: A PDF whose catalog Lang is fr returns language en.
- Source: [src/pdf.js:10](../../src/pdf.js#L10)
- Suggested fix: Read document language and avoid falsely labeling unsupported languages English.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 19).

### 020. PDF cleanup is skipped on parser errors

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: task.destroy runs only on the success path; short-document and page errors bypass it.
- Source: [src/pdf.js:10](../../src/pdf.js#L10)
- Suggested fix: Destroy the loading task in finally. Resource exhaustion has not been load-tested.

### 021. Multi-column PDFs interleave unrelated sentences

**High · Defect · Reproduced locally**

- Evidence: Row-ordered items produce Left one Right one, then Left two Right two.
- Source: [src/pdf.js:53](../../src/pdf.js#L53)
- Suggested fix: Group columns/reading regions before joining text, and flag ambiguous layouts.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 21).

### 022. Nested PDF chapters disappear under multiple parts

**Medium · Defect · Reproduced locally**

- Evidence: Two outline parts with child chapters return only the two part entries.
- Source: [src/pdf.js:105](../../src/pdf.js#L105)
- Suggested fix: Traverse the outline and choose the appropriate chapter level.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 22).

### 023. FitR bookmark coordinates are ignored

**Medium · Defect · Reproduced locally**

- Evidence: Distinct FitR rectangles on the same page are rejected as the same position.
- Source: [src/pdf.js:105](../../src/pdf.js#L105)
- Suggested fix: Read FitR top coordinates and account for destination geometry.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 23).

### 024. PDF margin detection ignores page-origin offsets

**High · Defect · Reproduced locally**

- Evidence: On a view starting at y=100, body text at y=790 is marked as margin.
- Source: [src/pdf.js:53](../../src/pdf.js#L53)
- Suggested fix: Normalize coordinates against the view origin before margin classification.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 24).

### 025. Digit-only title differences trigger title-page exclusion

**High · Defect · Reproduced locally**

- Evidence: A short Book 2 section in Book 1 is unselected because title comparison drops digits.
- Source: [src/epub.js:144](../../src/epub.js#L144)
- Suggested fix: Preserve numerals in title-page matching and require stronger front-matter evidence.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 25).

### 026. Character limits still permit model token truncation

**High · Defect · Reproduced locally**

- Evidence: 329 characters of repeated numbers yield 1,505 tokens, but the model receives 512.
- Source: [src/tts.js:55](../../src/tts.js#L55)
- Suggested fix: Chunk after phonemization/tokenization with an explicit no-truncation assertion.
- Recorded probe: [audit100-token-limit.json](audit100-token-limit.json) (case 26).

### 027. Hard splits can break Unicode characters

**Medium · Defect · Reproduced locally**

- Evidence: A supplementary character across the 380-code-unit boundary becomes two lone surrogates.
- Source: [src/tts.js:55](../../src/tts.js#L55)
- Suggested fix: Split on Unicode code-point or grapheme boundaries.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 27).

### 028. Invalid waveform samples are silently converted

**Medium · Risk / quality gap · Reproduced locally**

- Evidence: NaN becomes zero; infinities saturate. No invalid-sample error is raised.
- Source: [src/audio.js:7](../../src/audio.js#L7)
- Suggested fix: Reject or explicitly repair non-finite audio with diagnostics before encoding.
- Recorded probe: [audit100-extraction.json](audit100-extraction.json) (case 28).

### 029. Worker exits can strand pending requests

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The client handles worker error and message but not exit.
- Source: [src/tts.js:13](../../src/tts.js#L13)
- Suggested fix: Reject outstanding calls on every worker exit and recreate a healthy worker.

### 030. Inference has no deadline or recovery path

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Pending worker calls have no timeout; a stalled generation can hold the single queue.
- Source: [src/tts.js:13](../../src/tts.js#L13)
- Suggested fix: Add bounded inference deadlines, cancellation, and worker restart.

### 031. A failed first voice lookup stays failed

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: voicesPromise permanently caches a rejected promise.
- Source: [src/tts.js:39](../../src/tts.js#L39)
- Suggested fix: Clear the cached promise on rejection and permit retry.

### 032. Model calls can overlap without an admission limit

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The async worker message listener can run multiple generate calls concurrently.
- Source: [src/tts-worker.js:9](../../src/tts-worker.js#L9)
- Suggested fix: Serialize or explicitly bound inference concurrency; overload has not been stress-tested.

### 033. Empty synthesized audio can be accepted as a chapter

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: No output-length validation occurs before silence is appended and the chapter becomes done.
- Source: [src/tts-worker.js:9](../../src/tts-worker.js#L9)
- Suggested fix: Validate nonempty finite audio per chunk and flag implausible durations.

### 034. Encoder subprocesses have no timeout

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The ffmpeg promise waits indefinitely for close.
- Source: [src/audio.js:35](../../src/audio.js#L35)
- Suggested fix: Apply timeouts, terminate child processes, and expose retryable errors.

### 035. Library narration buffers a whole chapter twice

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The CLI retains every PCM chunk, then Buffer.concat allocates the full chapter again.
- Source: [scripts/narrate-library.js:93](../../scripts/narrate-library.js#L93)
- Suggested fix: Stream PCM to disk with backpressure and a memory budget.

### 036. Converter regeneration writes over the served chapter

**High · Defect · Code review; not runtime-reproduced**

- Evidence: encodeChapter writes the final M4A path directly while the audio route serves any existing file.
- Source: [src/audio.js:45](../../src/audio.js#L45)
- Suggested fix: Encode to a temporary file and atomically replace only after validation.

### 037. Concurrent exports share temporary and output filenames

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: M4B/MP3 builders use the same concat.txt and chapters.ffmeta in a book directory.
- Source: [src/audio.js:53](../../src/audio.js#L53)
- Suggested fix: Use a per-book export lock, immutable inputs, and unique temporary files.

### 038. WebP covers break M4B downloads

**High · Defect · Reproduced locally**

- Evidence: Actual buildAudiobook fails because WebP cannot be stream-copied into the MP4 container.
- Source: [src/audio.js:53](../../src/audio.js#L53)
- Suggested fix: Transcode supported cover inputs to a compatible still format before muxing.
- Recorded probe: [audit100-cover.json](audit100-cover.json) (case 38).

### 039. Whole-book export accepts an incomplete selection

**High · Defect · Reproduced locally**

- Evidence: An export succeeds with three selected chapters but only two done.
- Source: [src/library.js:254](../../src/library.js#L254)
- Suggested fix: Distinguish partial exports explicitly or require all selected chapters to be ready.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 39).

### 040. PCM stream failures lack an error handler

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The write stream has no error listener; write/drain/end promises only resolve.
- Source: [src/library.js:211](../../src/library.js#L211)
- Suggested fix: Handle stream errors and reject the job without crashing or hanging the server.

### 041. Book metadata writes are non-atomic

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: book.json is overwritten directly; a partial write is silently skipped during load.
- Source: [src/library.js:47](../../src/library.js#L47)
- Suggested fix: Write a temporary snapshot and rename atomically; surface corrupt-book recovery.

### 042. Done status does not verify that audio exists

**High · Defect · Reproduced locally**

- Evidence: A chapter remains done after its audio file disappears; reload trusts metadata.
- Source: [src/library.js:49](../../src/library.js#L49)
- Suggested fix: Reconcile completed status with valid assets during load and before download.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 42).

### 043. Restart abandons queued work

**High · Defect · Reproduced locally**

- Evidence: loadLibrary converts every non-done status to idle and reconstructs no queue.
- Source: [src/library.js:49](../../src/library.js#L49)
- Suggested fix: Persist jobs and restore safe pending work after restart.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 43).

### 044. Late cancellation can still finish the chapter

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Cancellation is checked before each chunk, not after the last inference or before publishing the encoded file.
- Source: [src/library.js:211](../../src/library.js#L211)
- Suggested fix: Check cancellation before encoding and before committing output.

### 045. Deleting a working book races with the queue

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: deleteBook removes the directory immediately; runQueue later saves outside its chapter catch, and its promise is not awaited.
- Source: [src/library.js:278](../../src/library.js#L278)
- Suggested fix: Wait for cancellation to settle or tombstone the book and guard all final writes.

### 046. Concurrent starts can exceed the active-book limit

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The count is checked before asynchronous fingerprint reads; other books can reserve work during that gap.
- Source: [src/library.js:145](../../src/library.js#L145)
- Suggested fix: Reserve capacity atomically and recheck after asynchronous preparation.

### 047. Invalid chapter indexes are accepted

**Medium · Defect · Reproduced locally**

- Evidence: Indexes 999 and 1.5 succeed and leave every real chapter unselected.
- Source: [src/library.js:145](../../src/library.js#L145)
- Suggested fix: Validate unique integer indexes against the book before changing any state.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 47).

### 048. Narration speed is not bounded or validated

**Medium · Defect · Reproduced locally**

- Evidence: A speed of -2 is accepted into book settings; the route only coerces Number(speed).
- Source: [src/library.js:145](../../src/library.js#L145)
- Suggested fix: Reject non-finite and out-of-range speeds before queueing.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 48).

### 049. Unknown voices are accepted into jobs

**Medium · Defect · Reproduced locally**

- Evidence: A nonexistent voice is accepted into book settings without membership validation.
- Source: [src/library.js:145](../../src/library.js#L145)
- Suggested fix: Validate the voice against available model voices before changing settings.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 49).

### 050. Disk-space checks fail open

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Unexpected statfs errors are swallowed by checkSpace.
- Source: [src/library.js:33](../../src/library.js#L33)
- Suggested fix: Treat an unavailable capacity check as a retryable operational failure.

### 051. Accepted jobs can consume the remaining disk

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Space is checked before work, with no reservation or checks while PCM/export files grow.
- Source: [src/library.js:33](../../src/library.js#L33)
- Suggested fix: Reserve estimated storage and monitor capacity during generation and export.

### 052. Failed or cancelled generation leaves PCM files

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: PCM deletion happens only after successful encoding.
- Source: [src/library.js:211](../../src/library.js#L211)
- Suggested fix: Remove temporary audio in finally, with a deliberate checkpoint policy.

### 053. Partial upload writes can leave untracked directories

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Directories and text files are written before registration; failure can leave paths outside the books map and normal cleanup.
- Source: [src/library.js:68](../../src/library.js#L68)
- Suggested fix: Roll back failed uploads and periodically reconcile orphan directories.

### 054. Completed chunks cannot be resumed after interruption

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Only chapter-level completion is persisted; partially generated chunks have no checkpoint.
- Source: [src/library.js:211](../../src/library.js#L211)
- Suggested fix: Checkpoint verified chunks with source/settings fingerprints.

### 055. Missing cached exports are not rebuilt

**High · Defect · Reproduced locally**

- Evidence: A matching built key returns audiobook.m4b even when that file does not exist.
- Source: [src/library.js:254](../../src/library.js#L254)
- Suggested fix: Check asset existence/integrity before trusting the cached export key.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 55).

### 056. Cancelled regeneration can leave old audio reachable

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Old M4A remains while metadata moves to idle/error; the audio route checks only file existence.
- Source: [src/library.js:211](../../src/library.js#L211)
- Suggested fix: Keep published and working revisions separate and serve the declared revision.

### 057. Private metadata and text lack explicit no-store headers

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Owner-protected book/text routes send responses without the policy used by voice recommendations.
- Source: [server.js:78](../../server.js#L78)
- Suggested fix: Set private, no-store consistently. Shared-cache exposure was not demonstrated.

### 058. Uploaded SVG covers execute same-origin script

**High · Defect · Reproduced locally**

- Evidence: Directly opening the fixture cover runs its onload script; the route serves raw uploaded SVG.
- Source: [server.js:138](../../server.js#L138)
- Suggested fix: Sanitize or rasterize SVG, or isolate it on a separate origin with restrictive response policy.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 58).

### 059. EPUB decompression has no expanded-size budget

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The 50MB upload limit does not cap ZIP expansion, entry count, or total extracted text.
- Source: [src/epub.js:33](../../src/epub.js#L33)
- Suggested fix: Enforce decompressed-byte, entry, and text budgets before full extraction.

### 060. PDF processing has no page/work budget

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: parsePdf reads every page with no document-level deadline or page cap.
- Source: [src/pdf.js:10](../../src/pdf.js#L10)
- Suggested fix: Bound document complexity and move expensive extraction into cancellable workers.

### 061. Concurrent uploads have no aggregate memory limit

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Multer memoryStorage buffers each request; only per-file size is limited.
- Source: [server.js:76](../../server.js#L76)
- Suggested fix: Stream uploads and enforce concurrent request/global byte admission limits.

### 062. EPUB parsing performs large synchronous work on the server thread

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: XML/HTML parsing occurs in the request process after archive reads.
- Source: [src/epub.js:33](../../src/epub.js#L33)
- Suggested fix: Move parsing to a bounded worker pool and measure event-loop delay on large fixtures.

### 063. Voice-preview audio cache grows without a bound

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Each distinct voice/text pair stores a WAV buffer forever in a Map.
- Source: [server.js:95](../../server.js#L95)
- Suggested fix: Use a byte-bounded LRU with expiry.

### 064. Identical simultaneous previews duplicate inference

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The cache entry is added after await synthesize, with no shared pending promise.
- Source: [server.js:95](../../server.js#L95)
- Suggested fix: Deduplicate in-flight preview requests and clear failures for retry.

### 065. Preview requests bypass narration admission limits

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The preview endpoint invokes synthesis without the job-owner limit or a rate limiter.
- Source: [server.js:95](../../server.js#L95)
- Suggested fix: Apply per-owner/global inference admission and fair scheduling to previews too.

### 066. Startup model failure is not caught

**High · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: loadTts().then has no rejection handler at server startup.
- Source: [server.js:184](../../server.js#L184)
- Suggested fix: Handle load failure, report readiness accurately, and retry or exit deliberately.

### 067. Private feeds include deselected chapters

**Medium · Defect · Code review; not runtime-reproduced**

- Evidence: The feed filters done status only, rather than selected and done.
- Source: [server.js:159](../../server.js#L159)
- Suggested fix: Define the feed selection contract and honor the saved selection.

### 068. Private episode identity omits the audio revision

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: GUID uses book/index/voice but not speed or fingerprint; corrected audio reuses the same URL.
- Source: [server.js:159](../../server.js#L159)
- Suggested fix: Define stable episode identity plus explicit revision/update behavior and versioned enclosure URLs.

### 069. Public episode identities depend on list position

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Inserting a chapter changes the meaning of slug-number GUIDs.
- Source: [src/library-pages.js:190](../../src/library-pages.js#L190)
- Suggested fix: Assign durable chapter IDs independent of array position.

### 070. Remote-only feed audio has no enclosure length

**Medium · Risk / quality gap · Reproduced locally**

- Evidence: fileSize checks local disk only; the generated remote-only fixture omits length.
- Source: [src/library-pages.js:190](../../src/library-pages.js#L190)
- Suggested fix: Persist byte counts in the manifest and use them for feeds; actual podcast-client failure is not claimed.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 70).

### 071. Feed dates change if builtAt is absent

**Low · Risk / quality gap · Reproduced locally**

- Evidence: Two renders one second apart produce different pubDates.
- Source: [src/library-pages.js:190](../../src/library-pages.js#L190)
- Suggested fix: Require a stable publication timestamp in validated manifests.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 71).

### 072. R2 audio URLs do not use content revisions

**Medium · Risk / quality gap · Reproduced locally**

- Evidence: Hash versioning applies only to explicit origin storage; R2 keys remain unchanged after replacement.
- Source: [src/library-pages.js:13](../../src/library-pages.js#L13)
- Suggested fix: Publish immutable versioned R2 keys or a verified cache-purge/version strategy.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 72).

### 073. Converter audio cache key omits the fingerprint

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The player URL uses voice and duration; a same-duration correction keeps the same URL.
- Source: [public/app.js:510](../../public/app.js#L510)
- Suggested fix: Include the actual generation fingerprint in media URLs.

### 074. Malformed ready manifests reach page rendering

**High · Defect · Reproduced locally**

- Evidence: ready=true is accepted without a chapter/download schema; missing chapters throws in bookVars.
- Source: [src/catalog.js:96](../../src/catalog.js#L96)
- Suggested fix: Validate manifests before publication and retain the last valid version.
- Recorded probe: [audit100-backend.json](audit100-backend.json) (case 74).

### 075. Non-atomic public manifest writes can temporarily unpublish a book

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The generator overwrites JSON while publishedBooks skips parse failures.
- Source: [scripts/narrate-library.js:78](../../scripts/narrate-library.js#L78)
- Suggested fix: Publish manifest snapshots atomically and retain the previous valid manifest on read errors.

### 076. First cover-thumbnail generation blocks requests

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: smallCover invokes spawnSync ffmpeg during page rendering.
- Source: [src/catalog.js:123](../../src/catalog.js#L123)
- Suggested fix: Generate thumbnails in the publication pipeline or a background job.

### 077. Thumbnail failures are retried on every request

**Medium · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: Missing or unsupported covers cause repeated synchronous conversion attempts without a failure cache.
- Source: [src/catalog.js:123](../../src/catalog.js#L123)
- Suggested fix: Record failures/backoff and return a safe placeholder.

### 078. Misspelled generation targets exit successfully

**Low · Defect · Code review; not runtime-reproduced**

- Evidence: An unknown slug matches no books and the CLI exits zero without an error.
- Source: [scripts/narrate-library.js:134](../../scripts/narrate-library.js#L134)
- Suggested fix: Reject unknown requested slugs and summarize selected work before starting.

### 079. Checkbox changes do not change the download selection

**High · Defect · Reproduced locally**

- Evidence: Unchecking a chapter leaves two checked in the UI, three selected on the server, and Download still available.
- Source: [public/app.js:305](../../public/app.js#L305)
- Suggested fix: Persist selection separately and build downloads from that saved selection.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 79).

### 080. The converter offers old audio as current

**Medium · Risk / quality gap · Reproduced locally**

- Evidence: A fixture with obsolete fingerprints still offers Download because UI freshness ignores fingerprints.
- Source: [public/app.js:188](../../public/app.js#L188)
- Suggested fix: Expose a server-computed current/stale state and use it consistently.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 80).

### 081. Reopening a non-default-speed book suggests unnecessary recreation

**Medium · Defect · Reproduced locally**

- Evidence: A speed-2 completed book renders Recreate because client speed stays at its initial value.
- Source: [public/app.js:145](../../public/app.js#L145)
- Suggested fix: Restore saved book speed before evaluating completion.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 81).

### 082. Slow navigation can display the wrong uploaded book

**High · Defect · Reproduced locally**

- Evidence: A delayed response for A overwrites B after the URL has changed to B.
- Source: [public/app.js:145](../../public/app.js#L145)
- Suggested fix: Cancel stale requests or guard responses with a navigation token.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 82).

### 083. One failed poll permanently stops job updates

**Medium · Defect · Reproduced locally**

- Evidence: After one successful queued response and one 500, no more polls occur.
- Source: [public/app.js:175](../../public/app.js#L175)
- Suggested fix: Retry transient failures with backoff and preserve the last known job state.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 83).

### 084. A failed book-list load has no visible error

**Medium · Defect · Reproduced locally**

- Evidence: A mocked /api/books 500 yields an unhandled rejection and no visible upload error.
- Source: [public/app.js:87](../../public/app.js#L87)
- Suggested fix: Catch list-load failures and show a retry action.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 84).

### 085. Failed cancellation has no visible error

**Medium · Defect · Reproduced locally**

- Evidence: A mocked cancel 500 yields an unhandled rejection without a book error.
- Source: [public/app.js:483](../../public/app.js#L483)
- Suggested fix: Catch cancellation failures and leave an honest retryable state.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 85).

### 086. A stale metadata listener seeks the next chapter incorrectly

**High · Defect · Reproduced locally**

- Evidence: Switching from delayed chapter A with a saved 10s position to B applies A's seek to B.
- Source: [public/app.js:501](../../public/app.js#L501)
- Suggested fix: Bind seek restoration to the current source/load generation and remove obsolete listeners.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 86).

### 087. Converter audio failure has no usable recovery message

**Medium · Defect · Reproduced locally**

- Evidence: A chapter 404 rejects play but leaves the visible book-error region hidden.
- Source: [public/app.js:501](../../public/app.js#L501)
- Suggested fix: Handle both media errors and play rejection, with retry and source diagnostics.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 87).

### 088. Corrupt saved position throws a playback exception

**Medium · Defect · Reproduced locally**

- Evidence: A saved time of bad is passed to currentTime as a non-finite value.
- Source: [public/app.js:501](../../public/app.js#L501)
- Suggested fix: Validate and clamp persisted indexes/times, discarding invalid state.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 88).

### 089. Autoplay ignores unchecked chapters

**Medium · Defect · Reproduced locally**

- Evidence: After chapter 1 ends, unchecked chapter 2 is selected because step filters only done.
- Source: [public/app.js:527](../../public/app.js#L527)
- Suggested fix: Use the listener's selected playlist for previous/next and auto-advance.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 89).

### 090. Completed converter books keep a resume position at the end

**Low · Risk / quality gap · Reproduced locally**

- Evidence: Ending the final chapter leaves the stored index and full duration.
- Source: [public/app.js:527](../../public/app.js#L527)
- Suggested fix: Record completion separately and offer a clean restart.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 90).

### 091. Late library media errors leave the error message hidden

**Medium · Defect · Reproduced locally**

- Evidence: Dispatching a media error after play does not reveal the playback-error region.
- Source: [public/library.js:127](../../public/library.js#L127)
- Suggested fix: Listen for audio error/stalled events and restore usable controls.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 91).

### 092. Current chapter click cannot pause inside persistent navigation

**Medium · Defect · Reproduced locally**

- Evidence: An embedded chapter click delegates to parent play and leaves already-playing audio running.
- Source: [public/persistent-player.js:25](../../public/persistent-player.js#L25)
- Suggested fix: Make the current chapter action toggle play/pause consistently.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 92).

### 093. Landing pages throw when the URL has no hash

**Low · Defect · Reproduced locally**

- Evidence: openFromHash produces false then calls false.matches; Chrome reports el?.matches is not a function.
- Source: [public/samples.js:102](../../public/samples.js#L102)
- Suggested fix: Use null for no target or guard that the target is an Element.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 84).

### 094. An embedded book preview can play over the persistent audiobook

**High · Defect · Reproduced locally**

- Evidence: The fixture shows parentPaused=false and childPlaying=true after starting a preview.
- Source: [public/persistent-player.js:81](../../public/persistent-player.js#L81)
- Suggested fix: Route previews through the shared player or explicitly arbitrate parent/child audio.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 94).

### 095. Detached voice samples bypass persistent playback coordination

**Medium · Defect · Reproduced locally**

- Evidence: A new Audio voice sample plays while the parent audiobook continues; it never reaches the document play listener.
- Source: [public/persistent-player.js:81](../../public/persistent-player.js#L81)
- Suggested fix: Use one explicit audio coordinator for detached samples and the persistent player.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 95).

### 096. Converter navigation inside the frame leaves the address bar stale

**Medium · Defect · Reproduced locally**

- Evidence: The iframe opens #/book/id while the top URL remains the homepage.
- Source: [public/persistent-player.js:48](../../public/persistent-player.js#L48)
- Suggested fix: Synchronize route changes and browser history across the persistent shell.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 96).

### 097. Replaying a finished homepage sample starts at the last chapter

**Low · Risk / quality gap · Code review; not runtime-reproduced**

- Evidence: The replay path calls play on the retained last source and never resets its chapter index.
- Source: [public/samples.js:75](../../public/samples.js#L75)
- Suggested fix: Define Replay book to reset to the first chapter after full completion.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 97).

### 098. A transient sample-timing failure is cached for the page lifetime

**Low · Risk / quality gap · Reproduced locally**

- Evidence: A failed timings request is replaced by an empty object and never retried.
- Source: [public/samples.js:18](../../public/samples.js#L18)
- Suggested fix: Retry transient failures and cache only successful timing data.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 98).

### 099. Converter chapter buttons announce Play while playing

**Low · Defect · Reproduced locally**

- Evidence: The playing chapter retains aria-label Play Chapter 1.
- Source: [public/app.js:351](../../public/app.js#L351)
- Suggested fix: Update accessible labels with the actual toggle action.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 99).

### 100. A cancelled seek gesture freezes progress updates

**Medium · Defect · Reproduced locally**

- Evidence: pointerdown then pointercancel leaves seeking=true and the slider stops following audio.
- Source: [public/app.js:565](../../public/app.js#L565)
- Suggested fix: Reset seeking on pointercancel, lost capture, and blur as well as pointerup.
- Recorded probe: [audit100-browser.json](audit100-browser.json) (case 100).

## Reproduction limitations

The browser case originally numbered 93 tested an empty aria-current hypothesis and returned true, disproving that hypothesis. It is **not** reported as a defect. Finding 93 instead records the separately reproduced no-hash exception from browser cases 84, 95, 96, and 98. Browser case 97 timed out on a hidden sample control; that finding is code-review-only. Keep negative probes in the evidence instead of interpreting their failures as application bugs.

Input validation cases 48–49 use nonexistent chapter indexes so that invalid settings can be tested without launching invalid inference. They prove acceptance, not a measured model crash. Case 42 simulates asset loss after loading; reload trust is established from the loadLibrary code. Case 72 records an unversioned generated URL; no production R2 cache behavior was tested. Destructive overload, disk-full, worker-kill, or live-account security tests were not run.

See `scripts/audit-100/README.md` for isolated reproduction. These are observation probes, not assertions that the issues have been fixed.
