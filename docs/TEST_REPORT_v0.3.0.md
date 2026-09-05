# Study Bible Creator v0.3.0 — Test Report

Date: 2026-09-05

## Delivery result
**PASS for v0.3 development iteration.**

This is a development build, not yet the M2 installable Tauri desktop release.

## Automated regression suite
Command:

```bash
npm test
```

Result:

```text
14 tests
14 passed
0 failed
```

Coverage includes:
- all supported file-extension detection including DOC
- malformed legacy DOC rejection
- UTF-8 BOM and CRLF USFM handling
- unclosed footnote/cross-reference warnings
- exact-file duplicate detection
- same bytes in a different resource role not treated as the same logical import
- changed-record conflict behavior
- protected Scripture parsing
- inline footnote isolation from visible Scripture
- source/target semantic pairing
- bilingual Word language assignment
- Scripture no-overwrite protection
- numeric mismatch QA
- versification review classification
- zero-width Unicode detection
- malformed USFM marker-spacing detection

## Real Matthew smoke test
Inputs used locally:
- `41MATGSB.SFM`
- `41MATIRVTam.SFM`
- four supplied corrected Matthew DOCX files
- four supplied original legacy DOC files
- eleven supplied Matthew map/chart DOCX files

Results:

| Check | Result |
|---|---:|
| English Scripture verse records | 1,067 |
| Tamil Scripture verse records | 1,071 |
| Paired Scripture records | 1,067 |
| Target-only Scripture / versification review | 4 |
| Cross-reference rows | 1,612 source + 1,612 target |
| Footnote rows | 147 source + 147 target |
| Introduction/back-matter rows | 61 source + 61 target |
| Study-note/heading rows | 1,735 source + 1,735 target |
| Legacy DOC ↔ DOCX semantic count comparisons | 4/4 pass |
| Map/chart DOCX files parsed safely | 11/11 |
| Total stored items in full smoke database | 10,757 |

Target-only Scripture records were correctly identified as:
- Matthew 12:47
- Matthew 17:21
- Matthew 18:11
- Matthew 23:14

They are classified as `versification_difference` informational findings rather than translation additions.

## Deterministic QA result on full Matthew smoke database
After improving numeric normalization to remove false positives from harmless reference formatting/reordering:

| Category | Open findings |
|---|---:|
| Number mismatch | 3 |
| Malformed USFM marker spacing | 19 |
| Versification difference | 4 |
| **Total** | **26** |

The numeric detector intentionally retained the high-value differences, including the previously identified Matthew 10:29 `1/16` vs `1/64` footnote case.

## HTTP end-to-end test
Verified through the actual development server:

```text
health → PASS
create project → PASS
import English SFM → PASS
import Tamil SFM → PASS
chapter 1 Scripture pairing → 25/25 paired
run local QA → PASS
JSON export → 3,647 items
project stats → PASS
original filenames preserved → PASS
```

## Legacy DOC HTTP end-to-end test
`MAT Footnotes-corrected.doc`:

```text
format: DOC
conversion: libreoffice-local
parsed: 294 rows
source: 147 (en)
target: 147 (ta)
commit: PASS
```

## Safety checks
- No import path silently overwrites changed Scripture.
- Changed logical records are persisted into `import_conflicts`.
- Scripture content retains `protected_scripture` protection.
- Original DOC files are never modified by conversion.
- Uploaded files are analyzed before commit.
- AI is disabled in v0.3.

## Known limitations accepted for this iteration
- Dedicated map/chart asset registry and caption/filename separation is M8.
- DOC currently depends on local LibreOffice/soffice in development.
- DOCX export is not implemented yet.
- Print/PDF layout is not implemented yet.
- Desktop installer packaging begins in M2.
