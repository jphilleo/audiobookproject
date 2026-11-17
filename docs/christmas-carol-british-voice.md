# Christmas Carol: British voice edition

The user requested a British narrator after the corrected Heart edition. Emma (`bf_emma`) is selected after comparison with George (`bm_george`) on three identical 221–279-word passages: the opening narration, the nephew’s argument with Scrooge, and Tiny Tim’s family scene.

Both voices produced 22 transcription edits across 776 reference words (about 2.8%). This is an automated comparison, not a measured pronunciation-error rate: spelling, homophones, and the transcription window boundaries contribute errors. Neither voice showed a material passage omission in the independent window review. An earlier overlapping transcription pass dropped whole phrases during merging, so it was discarded and replaced with contiguous independent windows.

Emma averages about 180 words per minute; George about 161. Emma’s model-author overall grade is B− versus George’s C. With comparable intelligibility, a reasonable sustained pace, and the stronger model quality prior, Emma is selected. This does not claim that a model grade establishes artistic superiority or that a full human listening review has been completed.

The catalogue records Emma for future fresh Christmas Carol generations. Existing published files and manifests are retained until the complete new edition passes source coverage, token budget, decoding, and delivery checks. Other books are unchanged.

## Short affirmation check

The first-chapter review flagged isolated “I can.” as “I can’t” in both Whisper-base and Whisper-small, including the surrounding exchange. The same words without a terminal period transcribed as the affirmative in both models. Speech preparation now applies this narrowly to Emma and that complete isolated phrase; other voices, longer sentences, and displayed text are unchanged. Checkpoint migration verifies source text and audio hashes, regenerates changed speech inputs, and preserves verified unchanged audio under the updated generation fingerprint.

## Published edition

Published 2026-11-16 (America/Chicago) at `a-christmas-carol/emma-4348d8a/`. All five chapters, the M4B and MP3 use Emma; duration is 2 hours 37 minutes. Previous Heart assets and manifest are retained for rollback. Code at publication: `e10a3b1` (narration fix `74b4ee2`).

Validation: 908 chunks have exact prepared-source coverage, valid checkpoint hashes, and token counts below the model limit. All seven final audio files fully decoded. All seven R2 downloads matched local SHA-256 and length, with HTTP 206 range responses. All five live chapter streams advanced without media errors; next/previous, pause, and ±15/30-second seeking worked. Feed entries reference the new five files with correct enclosure lengths. The live Emma converter smoke test also passed EPUB extraction, synthesis, both downloads, decoding, and feed checks. All 41 regression tests passed on the server.

Whisper-base flagged 17 of 908 chunks for review. Context and Whisper-small checks resolved several short-fragment transcription errors. Remaining ambiguous recognitions include the word “Stave,” stylized laughter, and short British dialogue; “Walk-er” versus “Walker” is a transcription spelling difference. Automated review is not full human listening or a guarantee of perfect pronunciation.

Player follow-up: circular skip icons were redrawn and aligned. The speed menu now matches the player, supports keyboard navigation/Escape, and changes speed without interrupting playback while navigating the site. Desktop and 390px mobile layouts were inspected.
