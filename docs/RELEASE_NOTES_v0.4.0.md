# Study Bible Creator v0.4.0 — Release Notes

## Import & Conflict Resolution hardening
v0.4.0 turns imports into a safer canonical workflow instead of treating files as interchangeable text dumps.

### Highlights
- Added canonical `match_key` identities for safe cross-resource comparisons.
- Added project authority rules for Scripture and corrected Study Bible resources.
- Added persistent, auditable import conflicts with side-by-side human resolution.
- Protected Scripture remains non-overwritable without explicit human confirmation and reason.
- Hardened JSON, CSV, TSV, SFM and DOCX round trips.
- Preserved semantic parity for the supplied legacy DOC files through the DOC adapter.
- Added DOCX editorial exchange with bilingual Unicode text and line-break preservation.
- Expanded deterministic QA for Unicode, USFM structure, chapter anchors, numbers/fractions, empty paired targets and versification differences.
- Added a visual Conflict Review workspace and authority-rule display.
- Added version-tag release automation with generated release notes, source archive and SHA-256 checksums.
- Prepared the same release workflow to attach Windows/macOS/Linux installers automatically once the Tauri desktop shell lands in M2.

### Real Matthew validation
Using the supplied authoritative English/Tamil Matthew Scripture and corrected Study Bible resources:
- 1,067 English Scripture verses;
- 1,071 Tamil Scripture verses;
- 1,067 paired verses;
- four expected target-only versification cases preserved as informational differences;
- all four legacy DOC files matched their DOCX semantic equivalents;
- all 11 map/chart DOCX files parsed;
- canonical JSON/CSV/TSV/DOCX exchanges round-tripped the four corrected bilingual resources without text/language-role loss;
- 24/24 automated regression tests passed.

### Release artifact note
v0.4.0 is still the pre-Tauri development core, so a `v0.4.0` GitHub release produces the versioned source archive, checksums and release notes. Native `.exe`/MSI, DMG and Linux installer artifacts begin with M2/Tauri.
