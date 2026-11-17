# A Christmas Carol: first repair release

This is the first staged repair, not a resolution of all 100 audit findings.

## Changes

- Speech planning uses Kokoro's own phonemizer and untruncated tokenizer, with a conservative 510-token limit including boundary tokens. Over-budget passages are split at whitespace and retokenized. An unbreakable over-budget passage fails explicitly.
- Every generated waveform must be nonempty, finite, and nonsilent. Peaks are reduced before PCM16 conversion rather than hard-clipped.
- Inference is serialized in the worker; worker exits reject pending calls, and outstanding calls have a five-minute deadline.
- The library renderer streams PCM to disk. Each completed segment has text, token-plan, byte-count and SHA-256 metadata and can be reused after interruption only with a matching generation fingerprint and content hash.
- Public manifest writes use temporary files and atomic rename. Full regeneration still belongs in a separate staging directory; this is not a concurrent-publication lock.
- Semantic footnote markers are removed before exponent expansion, literal bracketed numbers are retained, hidden/deleted draft text is excluded, and missing EPUB spine assets fail explicitly. Unicode hard splits preserve surrogate pairs.
- Christmas Carol specifically expands “St. Paul’s Churchyard” to “Saint Paul’s Churchyard.” This is not a global expansion of ambiguous St.
- Uploaded covers are served with a sandboxed restrictive Content-Security-Policy, preventing active SVG execution on direct navigation.
- Isolated outer dialogue quotation marks are removed only from speech input, preserving words, punctuation and displayed source text. In controlled Heart samples, both Whisper base and small misheard the original “It is.” and “A golden one.”; the small model transcribed the unquoted variants correctly. Repeating the original input produced identical audio, so retries alone did not resolve these cases.
- Unknown library-generation slugs fail instead of silently doing no work.

The existing Roman-heading, honorific and duplicate-subtitle fixes are included in regenerated audio. All five source staves and their 28,555 words remain identical to the previously audited extraction before deliberate speech preparation.

## Voice

The existing voice is Heart. Identical dialogue samples were generated for Heart, George and Emma. The installed model's overall grades are A, C and B− respectively; these are model-author assessments, not book-specific listening scores. The existing voice is retained unless the user chooses a replacement. Automatic transcription checks intelligibility only, not artistic quality.

## Verification and publication

39 regression tests pass. The real-model number-heavy case that previously exceeded the tokenizer budget now produces eight segments, all at or below 437 tokens, with the input text preserved. A fresh Chrome test confirms the SVG attack marker no longer runs.

The complete book is being regenerated in a staging directory. `scripts/verify-carol-render.mjs` checks exact prepared-text coverage, segment token budgets, checkpoint hashes, duration accounting and full audio decoding. `scripts/audit-render-asr.mjs` independently transcribes segments to flag possible omissions; transcription errors themselves require review. These checks do not certify every word's pronunciation or replace a full human listen.

Publication must use new immutable asset paths, retain the previous manifest/files for rollback, and switch the live manifest only after every chapter and both download formats are verified. No other book should be regenerated or replaced in this release.
