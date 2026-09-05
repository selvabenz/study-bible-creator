# Study Bible Creator v0.4.0 — Test Report

Date: 2026-09-05

## Automated regression gate

`npm test`

- Tests: **24**
- Passed: **24**
- Failed: **0**

Coverage includes format recognition, malformed legacy DOC handling, BOM/CRLF USFM, unclosed inline markers, duplicate files, changed imports, Scripture protection, source/target pairing, persistent conflicts, authority rules, protected resolution confirmation, version history, Unicode edge cases, marker balance, invalid chapter anchors, empty targets, marker sequence mismatches, and JSON/CSV/TSV/SFM/DOCX round-trip behavior.

## Full Matthew corpus smoke test

Authoritative Scripture:
- `41MATGSB.SFM`: 1,067 verse records
- `41MATIRVTam.SFM`: 1,071 verse records
- Paired Scripture: 1,067
- Target-only versification review: MAT 12:47, 17:21, 18:11, 23:14

Corrected DOCX resource parsing:
- Cross-references: 3,224 bilingual items (1,612 source + 1,612 target)
- Footnotes: 294 bilingual items (147 + 147)
- Introduction/back matter: 122 bilingual items (61 + 61)
- Study notes/headings/section introductions: 3,470 bilingual items (1,735 + 1,735)

Legacy DOC parity:
- Cross-references DOC vs DOCX: PASS (3,224 = 3,224)
- Footnotes DOC vs DOCX: PASS (294 = 294)
- Introduction/back matter DOC vs DOCX: PASS (122 = 122)
- Study material DOC vs DOCX: PASS (3,470 = 3,470)

Maps/charts:
- 11/11 DOCX resources parsed successfully.

Database after canonical import/conflict gating:
- 10,489 active stored content records
- 3,250 protected records
- 268 pending cross-resource conflicts
  - 245 corrected cross-reference differences: authority recommendation `use_incoming`
  - 23 corrected footnote differences: authority recommendation `use_incoming`
- No Scripture was overwritten by import.

## Local deterministic QA on the real Matthew corpus

Open findings: **53**

- Number mismatch: 3
- Inline USFM marker-sequence mismatch in bilingual editorial resources: 27
- Malformed USFM marker spacing: 19
- Versification difference: 4 (informational)

Severity:
- Critical: 0
- High: 22
- Medium: 27
- Info: 4

The 268 import conflicts are intentionally **not duplicated** as QA issues; they are handled by the dedicated Conflict Review workflow and independently block publication readiness until resolved.

## Full-scale round-trip verification

SFM:
- English Matthew: 1,591 parsed objects → export → 1,591 objects; 1,067 Scripture verses preserved exactly.
- Tamil Matthew: 2,056 parsed objects → export → 2,056 objects; 1,071 Scripture verses preserved exactly.

For **each of all four corrected Matthew DOCX resources**, export then re-import was verified for:
- JSON
- CSV
- TSV
- DOCX

Every format returned the same item count and source/target text sequence as the original parsed resource, including Tamil Unicode, punctuation, quotes, delimiters, and line breaks.

Legacy DOC semantic comparison also passed for all four original binary documents.

## DOCX visual QA

A generated bilingual DOCX exchange file containing English and Tamil, fractions, USFM markers, and an explicit target-language line break was rendered through LibreOffice and visually inspected. Landscape layout, table borders, Tamil glyph rendering, and line-break preservation passed the v0.4 exchange-document check.

## Release engineering checks

- `package.json` version: 0.4.0
- `/api/health` version: 0.4.0
- CHANGELOG 0.4.0 section present
- release tag/version validator included
- release notes generator included
- GitHub release workflow included
- cross-platform CI retained for Windows/macOS/Linux
- desktop installer job is conditionally activated once the Tauri shell exists
