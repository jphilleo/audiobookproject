# Twenty additional narration-pipeline findings

2026-11-16. Read-only follow-up audit; these findings are not yet fixed.

## Evidence and scope

Items 1–17 are reproduced against current extraction/preparation functions using synthetic fixtures. PDF fixtures use text-item and bookmark objects, not end-to-end PDF files. Items 18–20 are code-path findings; item 18 also measures an oversized prepared title. None is a certification that the problem occurs in a published recording. No complete audio listening audit was performed.

The previous fixes for decimal splitting, initials, repeated subtitles, ellipses, and discretionary hyphens are excluded. This list covers additional overcorrection, content-loss, and generation-consistency failure modes.

Reproduce with `node scripts/probe-narration-audit.mjs OUTPUT_JSON`. The script records current defective behavior; it is intentionally not a regression test suite that claims the defects are fixed. The evidence file should be written outside the production library.

## Findings

### 1. Regnal-name rule mistakes a pronoun for a numeral

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/narration-text.js:25`.
- Fixture/trigger: The Henry I knew was kind.
- Observed: `"The Henry the first knew was kind."`
- Expected: The Henry I knew was kind.
- Proposed correction: Require stronger regnal context or explicit pronunciation overrides; preserve ambiguous name + I prose.

### 2. Small-caps cleanup changes acronyms

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/epub.js:391`.
- Fixture/trigger: <p>US troops arrived.</p>
- Observed: `"Us troops arrived."`
- Expected: US troops arrived.
- Proposed correction: Preserve known acronyms and inspect original markup before recasing an opening.

### 3. Roman-page filter removes ordinary words

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/epub.js:374`.
- Fixture/trigger: <p>civil</p><p>mix</p><p>He spoke.</p>
- Observed: `"He spoke."`
- Expected: civil / mix / He spoke.
- Proposed correction: Use page-number metadata and valid numeral grammar, not an unrestricted Roman-letter alphabet match.

### 4. All-caps ending removed as printer boilerplate

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:149`.
- Fixture/trigger: Story followed by THE KING IS DEAD AT LAST
- Observed: `"his is a sentence in the story. This is a sentence in the story. "`
- Expected: Preserve THE KING IS DEAD AT LAST
- Proposed correction: Remove printer material only with structural or explicit publisher evidence; preserve ordinary all-capital prose.

### 5. Short final chapter silently unselected

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:189`.
- Fixture/trigger: Two long chapters and a five-word Epilogue
- Observed: `[{"title": "Chapter 1", "selected": true}, {"title": "Chapter 2", "selected": true}, {"title": "Epilogue", "selected": false}]`
- Expected: Epilogue selected or explicitly reviewed
- Proposed correction: Include short named story sections or require review instead of silently excluding by word count.

### 6. Boilerplate keyword excludes narrative chapter

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:180`.
- Fixture/trigger: Story begins Copyright was the subject of their quarrel.
- Observed: `[{"title": "Chapter 1", "selected": false}]`
- Expected: Narrative chapter selected
- Proposed correction: Use structural metadata and narrower boilerplate detection; narrative mentions must not exclude chapters.

### 7. Superscript exponent silently removed

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:321`.
- Fixture/trigger: <p>The area is 10<sup>2</sup> square units.</p>
- Observed: `"The area is 10 square units."`
- Expected: Keep exponent meaning
- Proposed correction: Distinguish linked note references from mathematical superscripts; preserve exponent meaning.

### 8. Figure container discards narrative text

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:321`.
- Fixture/trigger: <figure><blockquote><p>I shall return at dawn.</p></blockquote></figure><p>He left.</p>
- Observed: `"He left."`
- Expected: Preserve the quotation
- Proposed correction: Inspect figure children and retain substantive quotations or narrative text.

### 9. Three-link table mistaken for contents

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:323`.
- Fixture/trigger: <table><tr><td><a href="#a">Alice</a> paid five pounds.</td><td><a href="#b">Bob</a> paid ten.</td><td><a href="#c">Clara</a> paid twenty.</td></tr></table>
- Observed: `""`
- Expected: Retain substantive table text
- Proposed correction: Recognize actual contents navigation instead of using a link-count threshold.

### 10. Mixed block/inline content loses direct text

- Priority: High — possible missing or altered content.
- Evidence: `src/epub.js:366`.
- Fixture/trigger: <div>Before.<p>Inside.</p>After.</div>
- Observed: `"Inside."`
- Expected: Before. Inside. After.
- Proposed correction: Traverse text nodes in document order as well as block elements, without duplicating child text.

### 11. PDF dehyphenation removes genuine compound hyphens

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/pdf.js:151`.
- Fixture/trigger: A well- at line end followed by known author.
- Observed: `"A wellknown author."`
- Expected: A well-known author.
- Proposed correction: Use conservative dehyphenation and flag unknown compounds instead of joining by default.

### 12. PDF positioned words joined without separator

- Priority: High — possible missing or altered content.
- Evidence: `src/pdf.js:64`.
- Fixture/trigger: PDF items Hello at x0 and world at x80
- Observed: `[{"text": "Helloworld.", "x": 0, "y": 100, "h": 10, "para": false}]`
- Expected: Hello world.
- Proposed correction: Use text-item positions/widths to infer word separation while retaining intentionally split glyph runs.

### 13. PDF bookmark strips short body opening

- Priority: High — possible missing or altered content.
- Evidence: `src/pdf.js:143`.
- Fixture/trigger: Bookmark points to First sentence. with no printed heading
- Observed: `"Then the story continues."`
- Expected: First sentence. retained
- Proposed correction: Compare the line to the actual bookmark/heading, not merely its length.

### 14. Numeric bookmark destination zero ignored

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/pdf.js:107`.
- Fixture/trigger: Bookmarks on zero-based pages 0 and 2
- Observed: `null`
- Expected: Both bookmark starts retained
- Proposed correction: Check null/undefined explicitly; page zero is valid.

### 15. Same-page PDF bookmarks collapsed

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/pdf.js:114`.
- Fixture/trigger: Three sections on pages 1,1,2
- Observed: `[{"page": 1, "line": 0, "title": "A", "skipHeading": true}, {"page": 2, "line": 0, "title": "C", "skipHeading": true}]`
- Expected: A, B, C retained with destination position
- Proposed correction: Use bookmark coordinates to preserve multiple sections on a single page.

### 16. Repeated meaningful PDF edge text removed

- Priority: High — possible missing or altered content.
- Evidence: `src/pdf.js:83`.
- Fixture/trigger: Four pages whose two lines read Never again.
- Observed: `[[], [], [], []]`
- Expected: Repeated content retained unless identified as header/footer
- Proposed correction: Use layout/location evidence and count distinct pages; repeated content alone is insufficient.

### 17. CRLF paragraph boundaries collapse

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/tts.js:57`.
- Fixture/trigger: First paragraph.\r\n\r\nSecond paragraph.
- Observed: `[{"text": "First paragraph. Second paragraph.", "paragraphEnd": true}]`
- Expected: Two paragraphEnd markers
- Proposed correction: Normalize CRLF/CR line endings before paragraph splitting and duplicate-heading detection.

### 18. Long chapter titles bypass chunk limit

- Priority: Medium — incorrect interpretation, boundaries, or generation risk.
- Evidence: `src/library.js:207; scripts/narrate-library.js:89`.
- Fixture/trigger: A 600-character heading is prepared and passed directly to synthesize
- Observed: `{"preparedLength": 600, "bodyChunkLengths": [381, 219]}`
- Expected: Title segmented before model call; note body chunks also reach 381
- Proposed correction: Segment titles through the same guarded path as body text; enforce the limit on all model inputs.

### 19. Voice and speed can change during a chapter

- Priority: High — possible missing or altered content.
- Evidence: `src/library.js:154,219`.
- Fixture/trigger: startNarration assigns book.voice/book.speed while narrateChapter reads them on every chunk
- Observed: `"Code-path finding: working chapter is not restarted or locked; final metadata records only latest setting"`
- Expected: Snapshot settings for each job or reject changes while working
- Proposed correction: Capture immutable voice/speed settings per narration job or block changes until the current job stops.

### 20. Old chapter assets reused after source/rule changes

- Priority: High — possible missing or altered content.
- Evidence: `scripts/narrate-library.js:85`.
- Fixture/trigger: Existing chapter .m4a and .ms files
- Observed: `"Code-path finding: reuse condition checks file existence only, not source/rule/model version"`
- Expected: Reuse only when generation fingerprint matches
- Proposed correction: Fingerprint source text, selected chapters, preparation version, voice, model and speed before reusing audio.

## Suggested repair order

1. Prevent silent omissions (items 4–10, 12–13, 16), with both positive and negative fixtures so real footnotes, contents pages and running headers stay excluded.
2. Make generation settings immutable and invalidate stale assets (19–20) before regenerating books.
3. Correct text interpretation and chapter boundaries (1–3, 11, 14–15, 17–18).
4. Exercise representative EPUBs and PDFs end to end, then generate short listening comparisons. Replace full recordings only after checking content coverage and listening quality.

The complete source corpus was not rescanned for these exact structural patterns; the previous 129-source scan did not establish their incidence. In particular, the prior letters/digits preservation check started after parsing and normalization, so it could not detect text already lost by these earlier stages.
