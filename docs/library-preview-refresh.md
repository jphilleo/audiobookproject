# First-chapter refresh, November 2026

The refresh covers 198 preview-only books. Christmas Carol already has a complete corrected Emma edition. Complete recordings are handled separately to avoid changing only one chapter's narrator or serving mismatched downloads.

Voice choices are quality-first defaults: Emma for British English and most English translations; Heart for North American authors. These replace the earlier broad George/Michael assignments. The choice is informed by available voice-quality metadata and the longer Christmas Carol comparison, not a claim that 198 independent listening comparisons establish an objectively best voice. Author gender is not a selection rule. `src/library-voices.json` records every preview choice for reproducible future generation.

Preparation uses the production EPUB parser, chapter chunking, and voice-aware speech preparation. Openings must match their catalogued titles; if an extraction fix moves an index, a unique exact title can relocate it. Grouped openings do not silently relocate. Sources remain unchanged. Tusculan Disputations' first source chapter (Book 1) now includes the complete nested content rather than just the old opening fragment.

The local MLX renderer uses the same prepared speech inputs. It phonemizes each complete input before inference and recursively splits at whitespace until both phoneme length and actual model-token counts fit the conservative limit. It calls inference directly without the library's truncating fallback. Split text must reconstruct the complete prepared input. Each generated chunk must be finite, nonempty, and nonsilent; excessive peaks are scaled before PCM conversion. Output is fully decoded before staging. These checks are not a substitute for human listening.

The renderer caps graphics memory and clears its cache after each segment. A failed pilot exposed unbounded cache growth; the resumed pilot passed after the fix. Completed temporary PCM is discarded only after final audio and audit records are verified. A disk-space guard prevents starting a chapter without adequate working room.

Publication uses immutable `previews/refresh-20261117/<slug>.m4a` objects. Every public file must match its local SHA-256 and size and return valid seek ranges before any manifest changes. Old audio is preserved. The origin publication script verifies that all 198 previous manifests still match the captured baseline, saves backups, then atomically replaces each manifest. Existing complete-book manifests are excluded.
