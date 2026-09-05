# Study Bible Creator — Milestone Roadmap

The product is local-first, database-first, multilingual, deterministic-first, and human-authoritative for Scripture.

## M0 — Product discovery and corpus mapping — COMPLETE
- Inspect real Matthew Scripture, study notes, headings, introductions, footnotes, cross-references, maps and charts.
- Identify content types, marker patterns, duplicate/overlap cases, Unicode issues and versification differences.
- Lock core safety rule: no automatic or AI Scripture modification.

**Exit gate:** real project corpus understood well enough to design the canonical model.

## M1 — Import/database foundation — CORE IMPLEMENTED / HARDENING
- SQLite as source of truth.
- Project and language metadata.
- Import preview/commit workflow.
- Import USFM/SFM, CSV, TSV, JSON, DOCX and legacy DOC.
- Exact-file and record-level duplicate detection.
- Incremental book/resource import.
- Protected Scripture records.
- Provenance: source file, row/marker and import batch.
- Source/target semantic pairing for SFM and bilingual Word tables.
- Changed-record alternatives persisted as import conflicts rather than overwritten/discarded.

**Exit gate:** every Matthew input can be imported without silent data loss or overwrite.

## M2 — Installable desktop shell
- Tauri 2 shell with Rust core + React/TypeScript UI.
- Windows NSIS/MSI installer or EXE bundle.
- macOS DMG/app bundle.
- Linux AppImage + deb.
- Auto-recovery and single-instance protection.
- GitHub Actions cross-platform release builds.

**Exit gate:** one-click install/build on Windows, macOS and Linux; local project opens offline.

## M3 — Canonical Study Bible data model
- Project → resources → books → chapters → verses/anchors → content units.
- Scripture, introductions, chapter/section intros, headings, study notes, footnotes, cross-references, parallel references, articles, facts, profiles, glossary, outlines, timelines, maps/charts and back matter.
- Source/target relationships.
- Versification model and textual-variant handling.
- Resource/file asset registry.

**Exit gate:** round-trip test preserves semantic structure across supported formats.

## M4 — Deterministic publishing QA engine
- USFM marker integrity/balancing.
- chapter/verse/reference validity.
- number/date mismatch checks.
- Unicode/NFC/zero-width/control-character checks.
- duplicate and repeated-content checks.
- missing/extra unit checks.
- asset filename/link validation.
- protected-token and do-not-translate checks.

**Exit gate:** deterministic QA is fast on all 66 books and has regression tests for known edge cases.

## M5 — Language/style intelligence builder
- Automatically observe imported language corpus.
- Build vocabulary, spelling variants, proper names and terminology candidates.
- Source-target terminology statistics.
- Human approval workflow for language rules.
- Three levels: language → publisher/organization → project.
- LTR/RTL and Unicode script support.

**Exit gate:** new target language can bootstrap a style profile without model retraining.

## M6 — Professional editorial review workspace
- Source/target side-by-side reading.
- Issues by severity/type/status.
- Accept/reject/edit/comment/assign.
- batch decisions with safeguards.
- immutable revision/audit history.
- Scripture approval gate.
- keyboard-first navigation for high-volume work.

**Exit gate:** editors can complete a chapter without leaving the app.

## M7 — Selective agentic AI escalation
- AI used only after deterministic/local checks or when editorial analysis needs language/semantic reasoning.
- Language QA agent.
- Source-fidelity agent.
- Terminology/context tools.
- Independent verification agent for high-risk findings.
- usage/cost controls and offline-safe behavior.

**Exit gate:** AI cannot write Scripture; false-positive rate is measured against gold-standard reviewed material.

## M8 — Maps, charts and media resources
- Import map/chart DOC/DOCX metadata and assets.
- Separate stable resource filename/id from translatable caption.
- anchor resource to book/chapter/verse/range/content unit.
- missing/broken asset detection.
- preview images inside editor.

**Exit gate:** all Matthew maps/charts are represented and validated without filename corruption.

## M9 — Export and publishing outputs
- USFM/SFM.
- CSV.
- TSV.
- JSON canonical exchange.
- DOCX editorial export.
- print-ready PDF prototype.
- publishing validation report.

**Exit gate:** round-trip/export regression suite shows no unintended content loss.

## M10 — Print layout / Study Bible composition
- templates for multi-column Scripture and notes.
- headings, sidebars, maps, tables, footnotes and page-flow rules.
- print preview and preflight.
- evaluate Typst or alternative layout engine using real complex spreads.

**Exit gate:** representative Matthew print spread matches approved visual specification.

## M11 — Digital publication
- HTML/web output.
- EPUB 3.
- mobile-app JSON/package.
- stable content IDs and deep links.

**Exit gate:** one approved database can publish to print and digital without duplicated editorial work.

## M12 — Team sync and production hardening
- optional PostgreSQL/cloud sync while retaining local-first SQLite.
- roles/permissions, assignments and conflict-safe sync.
- backup/restore, migration, crash recovery, signing, auto-update.
- performance and security audits.

**Exit gate:** production release candidate suitable for multi-editor publisher use.

## Delivery gate for every iteration
No iteration is considered deliverable until:
1. automated tests pass;
2. new feature edge cases are added to regression tests;
3. real Matthew smoke tests pass where applicable;
4. no silent overwrite/data loss is observed;
5. protected Scripture mutation tests pass;
6. import/export compatibility is documented;
7. build/dev launcher is included;
8. changelog and GitHub-ready commit message are included.
