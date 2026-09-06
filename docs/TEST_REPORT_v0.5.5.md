# Test report — Study Bible Creator v0.5.5

Date: 2026-09-06

## Aggregate suite
`npm run test:all` passed.

- 50 unit/regression/edge-case tests: 50 passed, 0 failed.
- Exact copied-sidecar integration smoke: passed.
- API functional smoke: passed.
- 5,000-verse performance smoke: passed all budgets.

Latest measured performance in this Linux container:
- parse: 73 ms
- source import: 964 ms
- target import: 1,188 ms
- browse: 13 ms
- stats: 15 ms
- vocabulary: 93 ms
- deterministic QA: 569 ms
- total: 2,925 ms
- active content items: 10,102
- RSS: 274 MB (247 MB delta)

Budgets are deliberately looser than this machine: 2.5 s parse, 6 s per import, 750 ms browse, 1 s stats, 2.5 s vocabulary, 7 s QA, 18 s total and 700 MB RSS.

## Fresh Matthew corpus verification
The authoritative fresh Matthew sources and corrected resources were re-imported and checked:
- English Scripture: 1,067 verses
- Tamil Scripture: 1,071 verses
- paired Scripture: 1,067
- target-only/versification records: Matthew 12:47; 17:21; 18:11; 23:14
- corrected cross-reference DOCX: 3,224 bilingual items
- corrected footnote DOCX: 294 bilingual items
- introductions/glossary/back-matter DOCX: 122 bilingual items
- study-notes/headings/chapter-intros DOCX: 3,470 bilingual items
- maps/charts: 11 DOCX resources parsed
- database items: 10,489
- protected items: 3,250
- pending authority conflicts: 268 (245 cross-reference; 23 footnote)
- deterministic QA: 53 open findings (22 high, 27 medium, 4 info; 0 critical)

## Remaining platform validation
Rust/Tauri cannot be compiled as a Windows NSIS installer in the Linux artifact environment used for this package. The GitHub `Desktop Installer Smoke Build` is therefore required before tagging v0.5.5. The workflow now installs and launches the real Windows NSIS package, so a recurrence of the user-reported startup failure should fail the workflow rather than be published.
