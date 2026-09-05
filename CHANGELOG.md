# Changelog

## 0.3.0 — 2026-09-05

### Added
- Real connected development UI based on the approved high-fidelity wireframe.
- Project switcher and project-creation workflow.
- Book/chapter/content browser with source/target side-by-side pairing.
- Stable semantic keys for source/target pairing across separate files.
- Bilingual Word-row language-role handling.
- Persistent changed-import conflict records.
- Local deterministic QA engine and QA review UI.
- Unicode digit normalization across major writing systems for numeric QA.
- Versification-difference classification.
- Target-language vocabulary observations from the local corpus.
- Database-backed JSON/CSV/TSV/USFM/SFM development export endpoints.
- Real Matthew corpus smoke-test script.

### Improved
- Numeric comparison now normalizes spaces around references, Unicode dash variants, ranges and native-script decimal digits, and compares numeric multisets so harmless sentence reordering is not flagged.
- Import API preserves the original uploaded filename rather than a temporary server filename.
- Source/target paired-content API now limits semantic groups rather than raw database rows.
- Existing content is never discarded when a changed import is detected; the incoming alternative is retained for later review.

### Tested
- 14/14 automated regression tests passing.
- End-to-end HTTP test: project create → source import → target import → pairing → local QA → JSON export → stats.
- Legacy DOC end-to-end import through the HTTP application path: 147 English + 147 Tamil footnotes.
- Full Matthew corpus smoke test: 10,757 stored content items and exact 1,067/1,071 source/target Scripture counts.
- All four supplied legacy DOC files semantically matched their corresponding converted DOCX files.
- 11 supplied Matthew map/chart DOCX files parse safely.

### Current limitation
- Map/chart DOCX files are safe to import but still use generic paragraph representation; the dedicated asset/resource model is M8.
- DOCX export and print/PDF composition are not yet implemented.
- The installed desktop EXE/DMG/AppImage begins in M2.

## 0.2.0 — 2026-09-05

### Added
- Legacy `.doc` recognition and local conversion adapter.
- Microsoft Compound Binary signature validation before DOC conversion.
- Cross-platform converter discovery including Windows/macOS/Linux LibreOffice paths.
- `.doc` in the import file picker.
- High-fidelity interactive UX wireframe covering six primary application areas.
- Full milestone roadmap and iteration delivery gates.
- GitHub CI matrix for Windows, macOS and Linux.
- Development snapshot packaging workflow.
- Future Tauri desktop-release workflow that safely remains dormant until M2.
- Windows CMD/PowerShell and Unix development launchers.
- Project-safe `.gitignore`.
- Expanded edge-case regression tests.

### Improved
- DOCX table classification now uses both `Tags` and `Sub-Tags`.
- Structured DOCX parser no longer hard-codes Matthew; it infers a three-character book code when present.
- Scripture fragments detected in structured Word content are marked protected.
- Inline USFM footnote/cross-reference payloads are no longer leaked into visible Scripture text.

### Tested
- 9 automated tests passing.
- Fresh English and Tamil Matthew SFM files parsed successfully.
- All four supplied legacy Matthew DOC files recognized, converted locally and parsed.
- DOC footnotes and cross-references recognized from Study Bible sub-tag structure.

### Known development limitation
- Legacy DOC import currently needs local LibreOffice/soffice. Production goal is a smaller bundled/native adapter so ordinary users do not need to install a separate office suite.

## 0.1.0
- Initial local-first database/import prototype.
