# Study Bible Creator v0.3.0

Local-first, database-first Study Bible publishing QA application under active development.

## Product principles
- **SQLite is the source of truth.** Imported files are source material, not the live project database.
- **Deterministic/local checks first.** AI is not used in v0.3 and will be added later only for difficult language/semantic cases.
- **Scripture is protected.** Automated processes may flag Scripture but cannot silently overwrite it.
- **Import is preview-first and duplicate-aware.** Exact files, exact records and changed logical records are distinguished before commit.
- **Worldwide language architecture.** Unicode, LTR/RTL metadata, language codes and self-building editorial profiles are first-class concepts.

## What is new in v0.3
- The high-fidelity UX is now the **real development application UI**, not only a standalone wireframe.
- Source and target content are paired using stable semantic keys.
- Bilingual DOC/DOCX tables correctly store English rows as source and Tamil rows as target.
- Changed imports are persisted as review conflicts instead of being discarded or overwriting existing content.
- A first deterministic publishing QA engine now runs locally.
- Numeric comparison normalizes Unicode digits, reference spacing, dash variants and reference ranges to reduce false positives.
- Matthew versification differences are classified as informational review items rather than automatic translation errors.
- Project browser, book/chapter content workspace, import preflight, QA review, language vocabulary and export screens are connected to the real SQLite database.

## Current import support
- USFM / SFM
- CSV
- TSV
- JSON
- DOCX
- Legacy Microsoft Word DOC

### Legacy DOC
The development adapter verifies the Microsoft Compound Binary signature and performs a **local temporary LibreOffice conversion to DOCX**, then uses the same semantic parser as native DOCX. The original DOC is never modified.

If LibreOffice is not present, DOC is still recognized and the app returns a clear converter-availability error rather than risking multilingual text corruption.

Optional override:

```text
SBC_LIBREOFFICE=/path/to/soffice
```

## Current local QA checks
- protected Scripture detection
- source/target numeric mismatch comparison
- Unicode zero-width characters
- NFC normalization
- malformed USFM marker spacing
- source/target Scripture presence differences / versification review
- pending changed-import conflicts

No AI is used by these checks.

## Real Matthew corpus test
The v0.3 smoke test verified the supplied project corpus:
- English `41MATGSB.SFM`: 1,067 Scripture verse records
- Tamil `41MATIRVTam.SFM`: 1,071 Scripture verse records
- 1,067 Scripture pairs linked
- 4 target-only verses classified as versification differences: Matthew 12:47; 17:21; 18:11; 23:14
- Cross-reference DOCX: 1,612 source + 1,612 target rows
- Footnote DOCX: 147 source + 147 target rows
- Introduction/back-matter DOCX: 61 source + 61 target rows
- Study-note/heading DOCX: 1,735 source + 1,735 target rows
- All 4 legacy DOC files matched their converted DOCX semantic content counts
- 11 supplied map/chart DOCX files parsed without crashing

See `docs/TEST_REPORT_v0.3.0.md`.

## Run in development mode
Requires Node.js 22.5+.

### Windows
Double-click:

```text
run-dev.cmd
```

or PowerShell:

```powershell
./run-dev.ps1
```

### macOS / Linux

```bash
./run-dev.sh
```

Open:

```text
http://127.0.0.1:4173
```

## Automated tests

```bash
npm test
```

## Optional real Matthew smoke test
The corpus files are intentionally **not included in the repository**. Set local paths:

```bash
SBC_MAT_SOURCE=/path/41MATGSB.SFM \
SBC_MAT_TARGET=/path/41MATIRVTam.SFM \
SBC_MAT_CORRECTIONS_DIR=/path/corrected-docx \
SBC_MAT_LEGACY_DOC_DIR=/path/original-doc \
SBC_MAT_MAPS_DIR=/path/maps-docx \
npm run qa:smoke
```

## Export status
Currently implemented:
- USFM/SFM development export
- CSV
- TSV
- JSON

Required later milestones:
- DOCX editorial export
- print-ready PDF
- EPUB/web/mobile publishing outputs

## GitHub / CI
- `.gitignore` protects databases, imported content, temporary conversions, secrets and build artifacts.
- CI runs deterministic tests on Windows, macOS and Linux.
- source snapshot packaging workflow is included.
- Tauri desktop release workflow is prepared for M2 and activates once `src-tauri/Cargo.toml` exists.

See `docs/GIT_WORKFLOW.md` and `.github/workflows/`.

## Roadmap
See `docs/MILESTONES.md`.

## Production desktop direction
M2 moves the proven local core into a **Tauri 2** shell with a Rust backend and React/TypeScript UI for Windows, macOS and Linux installers. v0.3 deliberately proves the data/import/QA behavior before that migration.
