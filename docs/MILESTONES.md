# Study Bible Creator — Milestone Roadmap

The product is **local-first, database-first, multilingual, deterministic-first, and human-authoritative for Scripture**.

## M0 — Product discovery and corpus mapping — COMPLETE
- Inspected real Matthew Scripture, study notes, headings, introductions, footnotes, cross-references, maps and charts.
- Identified content types, marker patterns, duplicate/overlap cases, Unicode issues and versification differences.
- Locked the safety rule: no automatic or AI Scripture modification.

**Exit gate:** real project corpus understood well enough to design the canonical model. **PASSED.**

## M1 — Import/database foundation & conflict hardening — COMPLETE IN v0.4.0
- SQLite is the source of truth.
- Project and language metadata.
- Import preview/commit workflow.
- Import USFM/SFM, CSV, TSV, JSON, DOCX and legacy DOC.
- Exact-file, same-resource and authority-aware cross-resource duplicate detection.
- Incremental book/resource import.
- Protected Scripture records.
- Provenance: source file, row/marker and import batch.
- Source/target semantic pairing for SFM and bilingual Word tables.
- Canonical `semantic_key` plus marker-independent `match_key` identities.
- Changed records persist as import conflicts and are never silently overwritten.
- Authority rules distinguish authoritative Scripture from corrected standalone Study Bible resources.
- Human conflict actions: keep existing, use incoming, manual merge.
- Protected Scripture changes require explicit human confirmation and reason.
- JSON/CSV/TSV/SFM/DOCX round-trip regression coverage.
- Legacy DOC semantic parity against converted DOCX verified on the real Matthew corpus.

**Exit gate:** every supplied Matthew input imports without silent data loss/overwrite and supported exchange formats round-trip without semantic/text loss. **PASSED for the current Matthew corpus and regression set.**

## M2 — Installable desktop shell — NEXT
- Tauri 2 desktop shell.
- React + TypeScript production UI.
- Rust local core around the proven v0.4 behavior.
- SQLite migrations in the desktop runtime.
- Windows installer (`.exe`/NSIS and/or `.msi`).
- macOS `.app` / `.dmg`.
- Linux AppImage + `.deb`.
- Auto-recovery and single-instance protection.
- GitHub Actions cross-platform release builds.
- Code-signing hooks prepared; signing credentials remain repository/user secrets, never committed.

**Exit gate:** one-click development build and versioned installable artifact on Windows, macOS and Linux; local project opens offline.

## M3 — Canonical Study Bible data model expansion
- Project → resources → books → chapters → verses/anchors → content units.
- Scripture, introductions, chapter/section intros, headings, study notes, footnotes, cross-references, parallel references, articles, facts, profiles, glossary, outlines, timelines, maps/charts and back matter.
- Source/target relationships.
- Explicit versification model and textual-variant handling.
- Media/resource asset registry.
- Stable IDs for digital publishing and future synchronization.

**Exit gate:** all current Matthew content types and resource relationships are represented without format-specific assumptions.

## M4 — Deterministic publishing QA engine expansion
- USFM marker integrity/balancing and marker-order checks.
- chapter/verse/reference validity.
- number/date/fraction mismatch checks.
- Unicode/NFC/zero-width/control-character/replacement-character checks.
- duplicate and repeated-content checks.
- missing/extra unit checks.
- asset filename/link validation.
- protected-token and do-not-translate checks.
- performance gates for whole-Bible projects.

**Exit gate:** deterministic QA is fast on all 66 books and has regression tests for every known edge case.

## M5 — Language/style intelligence builder
- Automatically observe imported language corpus.
- Build vocabulary, spelling variants, proper names and terminology candidates.
- Source-target terminology statistics.
- Human approval workflow for language rules.
- Three levels: language → publisher/organization → project.
- LTR/RTL and Unicode script support.

**Exit gate:** a newly imported target language can bootstrap a useful style profile without model retraining.

## M6 — Professional editorial review workspace
- Source/target side-by-side reading.
- Issues by severity/type/status.
- Accept/reject/edit/comment/assign.
- Batch decisions with safeguards.
- Immutable revision/audit history.
- Scripture approval gate.
- Keyboard-first navigation for high-volume work.

**Exit gate:** editors can complete a chapter without leaving the app.

## M7 — Selective agentic AI escalation
- AI used only after deterministic/local checks or when editorial analysis needs language/semantic reasoning.
- Language QA agent.
- Source-fidelity agent.
- Terminology/context tools.
- Independent verification agent for high-risk findings.
- Usage/cost controls and offline-safe behavior.

**Exit gate:** AI cannot write Scripture; false-positive rate is measured against gold-standard reviewed material.

## M8 — Maps, charts and media resources
- Import map/chart DOC/DOCX metadata and assets.
- Separate stable resource filename/id from translatable caption.
- Anchor resource to book/chapter/verse/range/content unit.
- Missing/broken asset detection.
- Preview images inside editor.

**Exit gate:** all Matthew maps/charts are represented and validated without filename corruption.

## M9 — Export and publishing outputs
- USFM/SFM.
- CSV.
- TSV.
- JSON canonical exchange.
- DOCX editorial export.
- Print-ready PDF prototype.
- Publishing validation report.

**Exit gate:** export regression suite shows no unintended content loss and publication preflight is reproducible.

## M10 — Print layout / Study Bible composition
- Templates for multi-column Scripture and notes.
- Headings, sidebars, maps, tables, footnotes and page-flow rules.
- Print preview and preflight.
- Evaluate Typst or alternative layout engine using real complex spreads.

**Exit gate:** representative Matthew print spread matches approved visual specification.

## M11 — Digital publication
- HTML/web output.
- EPUB 3.
- Mobile-app JSON/package.
- Stable content IDs and deep links.

**Exit gate:** one approved database can publish to print and digital without duplicated editorial work.

## M12 — Team sync and production hardening
- Optional PostgreSQL/cloud sync while retaining local-first SQLite.
- Roles/permissions, assignments and conflict-safe sync.
- Backup/restore, migration, crash recovery, signing, auto-update.
- Performance and security audits.

**Exit gate:** production release candidate suitable for multi-editor publisher use.

## Delivery gate for every iteration
No iteration is considered deliverable until:
1. automated regression tests pass;
2. new feature edge cases are added to permanent tests;
3. real Matthew smoke/round-trip tests pass where applicable;
4. no silent overwrite/data loss is observed;
5. protected Scripture mutation tests pass;
6. import/export compatibility and known limitations are documented;
7. a runnable development/build artifact is included;
8. version, changelog, release notes and GitHub-ready commit messages agree;
9. GitHub Actions configuration validates;
10. once M2 exists, version tags build platform installers automatically.

## M2 status — v0.5.0 Native Desktop Foundation
Implemented in source on 2026-09-06:
- Tauri 2 desktop shell
- bundled Node runtime sidecar preparation
- OS app-data SQLite storage
- loopback-only authenticated desktop session
- single-instance protection
- Windows/macOS/Linux installer build workflows
- v0.5.0 release/version checks

Exit gate still requiring GitHub native runners:
- successful NSIS Windows build
- successful macOS DMG build
- successful Linux AppImage/deb build
- install/launch smoke check from generated artifacts
