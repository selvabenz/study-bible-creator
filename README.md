# Study Bible Creator v0.4.0

A local-first, multilingual Study Bible editorial database and publishing-QA application. Version 0.4.0 hardens import/export round-tripping, duplicate/conflict handling, authority rules, human revision safety, and deterministic QA before the Tauri desktop shell is introduced.

## Product principles
- **Database is the source of truth.** Imported files are provenance/input, not the live project database.
- **Local algorithms first.** AI is reserved for difficult linguistic/semantic work later.
- **Scripture is protected.** Software and AI may flag or suggest, but Scripture cannot be replaced without explicit human approval.
- **No silent overwrite.** Conflicting imports are persisted and resolved through an auditable human workflow.
- **Worldwide language architecture.** Unicode, LTR/RTL project metadata, language codes, and self-building editorial profiles are first-class.

## Supported import formats
- USFM / SFM
- CSV
- TSV
- JSON
- DOCX
- Legacy Microsoft Word DOC (safe local temporary conversion; original unchanged)

## Supported v0.4 exports
- USFM / SFM
- CSV
- TSV
- JSON
- DOCX bilingual editorial exchange

> Legacy `.DOC` is import-only by design. Its safe round-trip path is `DOC → canonical database → DOCX`; the product requirements do not call for generating the obsolete binary DOC format.

## Conflict & authority model
The database stores a canonical match identity independent of file names. Project authority rules make **recommendations**, not automatic editorial decisions.

Default examples:
- corrected standalone `footnotes` > footnotes embedded in Scripture files
- corrected standalone `cross_references` > cross-references embedded in Scripture files
- Scripture changes always require explicit human confirmation regardless of priority

The Conflict Review screen offers:
- Keep existing
- Use incoming
- Manual merge

Accepted changes create a `content_versions` history entry. Protected Scripture additionally requires a human confirmation checkbox and written reason.

## Deterministic QA v0.4
No AI is used. Current local checks include:
- zero-width Unicode
- NFC normalization
- Unicode replacement character
- invalid control characters
- malformed USFM marker spacing
- unbalanced `\\f … \\f*` / `\\x … \\x*`
- source/target number differences
- source/target inline marker-sequence differences in bilingual editorial resources
- empty target fields where source content exists
- invalid chapter anchors for the 66-book canon
- versification differences reported as informational review items
- same-role canonical duplicates

## Run locally
Requires Node.js 22.5+.

### Windows
Double-click `run-dev.cmd`, or:

```powershell
./run-dev.ps1
```

### macOS / Linux

```bash
./run-dev.sh
```

Then open `http://127.0.0.1:4173`.

## Tests

```bash
npm test
```

Real Matthew smoke tests (optional development corpus):

```bash
SBC_MAT_SOURCE=/path/41MATGSB.SFM \
SBC_MAT_TARGET=/path/41MATIRVTam.SFM \
SBC_MAT_CORRECTIONS_DIR=/path/mat_converted \
SBC_MAT_LEGACY_DOC_DIR=/path/mat_doc_original \
SBC_MAT_MAPS_DIR=/path/matthew_maps_charts_docx \
npm run qa:smoke
```

Full round-trip corpus test:

```bash
SBC_MAT_SOURCE=/path/41MATGSB.SFM \
SBC_MAT_TARGET=/path/41MATIRVTam.SFM \
SBC_MAT_CORRECTIONS_DIR=/path/mat_converted \
SBC_MAT_LEGACY_DOC_DIR=/path/mat_doc_original \
node scripts/roundtrip-matthew-v0.4.mjs
```

## GitHub versioning and releases
Normal pushes to `main` run cross-platform CI. **Formal releases are created from version tags.**

For v0.4.0:

```bash
git push origin main
git tag v0.4.0
git push origin v0.4.0
```

The tag triggers `.github/workflows/release.yml`, which:
1. verifies the Git tag equals the `package.json` version;
2. verifies a matching CHANGELOG section exists;
3. runs the regression suite;
4. generates release notes from CHANGELOG;
5. creates a GitHub Release;
6. attaches a versioned source ZIP and SHA-256 checksum;
7. **when `src-tauri/Cargo.toml` exists**, also builds/attaches desktop installers for Windows, macOS, and Linux.

### Executables today
v0.4.0 intentionally precedes the Tauri desktop-shell milestone. Therefore v0.4.0 tag releases source/development artifacts, not a Windows EXE yet. At Milestone M2, the same release pipeline will begin producing executable installers automatically.

## Documentation
- `docs/MILESTONES.md`
- `docs/TEST_REPORT_v0.4.0.md`
- `docs/COMMIT_v0.4.0.md`
- `docs/RELEASE_PROCESS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
