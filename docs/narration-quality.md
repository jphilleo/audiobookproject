# Narration quality: A Christmas Carol pilot

Audit date: 2026-11-16. Voice: af_heart. Scope: all five parsed chapters and local chapter files, with short generated comparisons. This is a source/pipeline and file-integrity audit, not a complete listening certification.

## Findings

- Roman numerals: explicitly expand heading numerals before synthesis (Stave IV → Stave four). Preserve lowercase prose and ambiguous first-person I in body text. Regression coverage protects both.
- Personal titles: the old chunker produced nine chunks ending with a personal-title abbreviation across chapters I–III (1, 2, 6). Expand Mr., Mrs., and Dr. before capitalized names before chunking. All five chapters now have zero such abbreviation-ending chunks. This is a confirmed segmentation defect; the short honorific sample alone does not reproduce every original chunk boundary.
- Repeated subtitles: all five parsed chapters begin with their subtitle as a standalone paragraph. The generator also announces the full title. Remove the first paragraph only when it exactly matches the title or its subtitle, in both library generation paths.
- Ambiguous abbreviations: “St. Paul’s Churchyard” is a candidate for an explicit book-specific “Saint Paul’s Churchyard” reading. A comparison is supplied; no universal St. replacement is enabled.
- All five existing local AAC chapter files fully decode without reported errors. This establishes file integrity, not correct pronunciation or completeness of spoken words.
- The short honorific generation contains one raw sample at or beyond full scale in each variant. Review clips are scaled for headroom. Audit the production PCM/normalization path before treating this as an audible defect or changing all recordings.

## Listening samples

Run `node scripts/audit-christmas-carol.mjs OUTPUT_DIRECTORY` to generate four before/after pairs plus a JSON record of scripts, durations, and raw clipping counts. These use the same voice and speed, with original versus prepared text. They are fresh controlled renders, not excerpts from the published recordings. Separate existing-chapter extracts are included in the local review bundle.

Listen for: numeral reading; repeated heading; title/name continuity; Saint pronunciation. Do not infer that identical-duration clips differ audibly. Obtain listening approval before bulk replacement.

## Process for every book

1. Preserve original source and maintain a separate spoken script. Record source hash, voice/model, preparation version, chapter/chunk identifiers, and any explicit pronunciation overrides in a generation manifest.
2. Before generation, flag numerals, abbreviations, initials, dates, currency, unusual names, footnotes, and retained headings. Apply deterministic rules only where meaning is clear. Review ambiguous changes in context; AI may propose candidates, but must not freely rewrite the book.
3. Maintain a small regression collection of exact source passages and expected spoken text. Add every confirmed recurring issue to it. Include negative examples to catch overcorrection.
4. Generate review clips for risk cases before spending time on a full book. Check chapter openings, names, dialogue, and transitions between generation chunks.
5. After generation, decode every file; check durations, clipping, unexpected silence, missing chunks, and chapter order. Speech-to-text comparison can flag omissions/repetitions, but is not a reliable pronunciation judge and has not been run in this pilot.
6. Listen to flagged passages plus a random sample across chapters. Track confirmed defects separately from unreviewed candidates. Release only after review; retain previous assets for rollback.
7. When replacing audio, rebuild complete M4B/MP3 and duration metadata, then verify website seeking, chapter transitions, downloads, and podcast feeds against the same version.

Implemented in this pilot: conservative text rules, duplicate-heading handling in both library paths, regression tests, repeatable sample generation. The broader manifest, automated risk queue, ASR comparison, and release checks above are follow-up work, not completed features.
