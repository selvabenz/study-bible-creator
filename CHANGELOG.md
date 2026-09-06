## [0.5.4] - 2026-09-06

### Fixed
- Corrected release metadata so the `v0.5.4` Git tag matches package, Cargo, and Tauri application versions.
- Retains the release-agnostic version alignment regression test and packaged Windows startup fixes.

## [0.5.3] - 2026-09-06

### Fixed
- Made desktop version-alignment tests release-agnostic instead of hard-coding v0.5.2.
- Made the local server derive its fallback version from package.json.
- Preserved Windows GUI-subsystem startup fixes and native runtime diagnostics from v0.5.2.

# Changelog

## 0.5.2 — Windows runtime startup hotfix

- Fixed the Windows release executable opening in Windows Terminal instead of behaving as a GUI application.
- Added the Windows GUI subsystem attribute to the Tauri entry point.
- Added an always-visible native startup window before the local Node/SQLite sidecar launches.
- Added robust packaged-resource discovery for the local server entrypoint.
- Added local-engine health verification before navigating the webview to the application.
- Added a persistent `startup.log` in the application data directory and a user-visible startup failure screen.
- Desktop health/version reporting now follows the packaged application version.
- Added regression coverage for the release-mode Windows runtime bootstrap.

## [0.5.1] - 2026-09-06

### Fixed
- Replaced PowerShell/zip/unzip DOCX archive operations with pure Node ZIP read/write logic.
- Fixed Windows DOCX round-trip CI failure.
- Release matrix now reports every desktop platform independently with `fail-fast: false`.
- Added manual versioned-release recovery for an existing tag.
- Added the complete Tauri desktop icon set (`icon.png`, Windows ICO, macOS ICNS, and Linux PNG sizes) required by native builds.
- Fixed the macOS Tauri compile failure caused by the missing `src-tauri/icons/icon.png`.

## 0.5.0 - 2026-09-06

### Added
- Tauri 2 native desktop shell for Windows, macOS and Linux.
- Bundled Node runtime sidecar preparation so installed users do not need Node.js.
- Per-launch authenticated loopback desktop session and local app-data database path.
- Single-instance desktop protection.
- Cross-platform installer build/release workflow and desktop release-gap checks.

### Changed
- Application version advanced to 0.5.0.
- Local server now supports desktop data isolation and authenticated desktop API sessions.


All notable development changes to Study Bible Creator are recorded here.

## [0.4.0] - 2026-09-05

### Import & conflict resolution hardening
- Added canonical `match_key` identities for safe cross-resource overlap detection without flattening resource provenance.
- Added project authority rules that prefer corrected standalone footnote and cross-reference resources over ancillary copies embedded in Scripture resources.
- Added strict cross-resource match boundaries to prevent unrelated introduction/headings from being mistaken for duplicates.
- Import preflight now reports exact matches, changed records, cross-resource overlaps, authority recommendations, and manual-review cases.
- Import conflicts persist the complete incoming text, raw content, source file, resource role, marker/category metadata, recommendation, and reason.
- Added human conflict resolution actions: keep existing, use incoming, and manual merge.
- Protected Scripture replacement requires explicit human confirmation and a written editorial reason.
- Every accepted/merged change records the previous text in `content_versions`; no silent overwrite is permitted.

### Round-trip import/export
- Canonical JSON export now includes a schema version and stable camelCase exchange fields.
- CSV and TSV export/import preserve semantic identity, language role, source locator, Unicode, quotations, delimiters, and embedded line breaks.
- SFM/USFM export suppresses duplicate auxiliary records extracted from inline footnotes/cross-references and preserves semantic verse content.
- Added DOCX bilingual editorial exchange export with source/target columns, markers, anchors, content type, protection metadata, and semantic keys.
- DOCX re-import preserves Tamil Unicode and explicit line breaks.
- Legacy `.DOC` remains a safe import format using local temporary conversion; original files are never modified. Semantic parity is tested against DOCX.

### Local deterministic QA
- Upgraded engine to `local-deterministic-v0.4`.
- Added Unicode replacement-character and invalid control-character detection.
- Added USFM footnote/cross-reference balance checks.
- Added invalid book/chapter anchor checks for the 66-book Protestant canon.
- Added empty paired target-content detection.
- Added source/target inline-marker sequence comparison for bilingual editorial resources.
- Reduced false positives by excluding edition-specific Scripture resource marker differences and cross-resource alternatives from inappropriate duplicate checks.
- Import conflicts are now reviewed in the dedicated Conflict Center instead of being duplicated as QA findings.

### UX
- Added a dedicated **Conflict review** workspace with side-by-side existing/incoming content.
- Added authority recommendations and provenance to the conflict comparison screen.
- Added protected-Scripture confirmation UI, editorial reason capture, and manual-merge entry.
- Added project authority-rule visibility.
- Enabled DOCX export from Publish & Export.

### Release engineering
- Added `release.yml` for version-tagged GitHub Releases.
- `v*` tags validate `package.json` version against the Git tag and require a matching changelog section.
- Release notes are generated from this changelog.
- Versioned source ZIP and SHA-256 checksums are attached automatically.
- Once the Tauri shell is present, the same versioned release workflow automatically builds and attaches Windows, macOS, and Linux desktop installers.
- Development snapshots remain separate from formal releases.

### Verification
- 24/24 automated regression and edge-case tests pass.
- Full Matthew English and Tamil SFM semantic round-trip passes with 1,067 and 1,071 verses respectively.
- All four corrected Matthew DOCX resources pass JSON, CSV, TSV, and DOCX semantic round-trip tests at full data scale.
- All four legacy Matthew DOC files match their DOCX equivalents semantically.
- 11/11 Matthew map/chart DOCX files parse successfully.
- DOCX visual rendering was inspected with Tamil text and preserved line breaks.

## [0.3.0] - 2026-09-05

- Connected the real local SQLite database to the development UI.
- Added source/target semantic pairing, persistent import conflicts, deterministic QA, project content browsing, language vocabulary observations, and canonical export foundations.
- Tested with authoritative Matthew English/Tamil Scripture and the correction corpus.

## [0.2.0] - 2026-09-05

- Added legacy DOC recognition through a local conversion adapter.
- Added the high-fidelity interactive UX wireframe, cross-platform CI, development launchers, milestones, and Git workflow documentation.

## [0.1.0] - 2026-09-05

- Initial local-first Study Bible Creator prototype with SQLite, basic import/export, protected Scripture, duplicate detection, and project creation.

### Release pipeline repair (2026-09-06)
- Restrict GitHub Release assets to the final Windows `.exe`, macOS `.dmg`, Linux `.AppImage` and `.deb` installers.
- Stop uploading Tauri bundle internals, Linux AppDir libraries, scripts and duplicate resource files as release assets.
- Clean stale assets when rebuilding an existing release tag through `workflow_dispatch`.
- Generate checksums only for distributable installers, source archive and release manifest.
- Keep native build matrices `fail-fast: false` and smoke artifacts installer-only.
