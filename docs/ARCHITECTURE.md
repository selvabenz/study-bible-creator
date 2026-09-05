# Study Bible Creator — Architecture (v0.4.0)

## Product principles
Study Bible Creator is **local-first, database-first, multilingual, deterministic-first and human-authoritative for Scripture**. Imported files are transport containers; SQLite is the working source of truth.

## Current development architecture
v0.4.0 is a dependency-light Node 22 reference application used to prove the canonical model, import/round-trip behavior, conflict safety and deterministic QA before the Tauri/Rust migration.

```text
Desktop/web development UI
        │
        ▼
Local application server
        │
        ├── Import preflight
        ├── Canonical parsers
        ├── Authority/conflict engine
        ├── Deterministic QA
        ├── Human resolution workflow
        └── Exporters
        │
        ▼
SQLite project database
```

## Production target (M2)
- Desktop shell: Tauri 2
- UI: React + TypeScript
- Core: Rust
- Local database: SQLite
- AI: optional escalation layer only after deterministic/local QA

The v0.4 interfaces and tests are the behavioral contract to preserve during the Rust/Tauri port.

## Import pipeline

```text
File(s)
  → format/signature detection
  → SHA-256 file fingerprint
  → parser
  → canonical semantic items
  → same-resource duplicate check
  → authority-aware cross-resource match
  → preview
  → human commit
  → SQLite
```

Supported import transports: USFM/SFM, CSV, TSV, JSON, DOCX and legacy DOC.

### Legacy DOC boundary
Legacy `.doc` is an input transport only. The current development adapter validates the OLE/Compound Binary signature, performs a local temporary LibreOffice conversion to DOCX, parses it through the same Word semantic importer, then removes the temporary conversion. The source DOC is never modified. This adapter is intentionally replaceable in the Tauri production build.

## Canonical identity
Each content item has two complementary identities:
- `semantic_key`: precise identity inside its resource/marker context;
- `match_key`: marker-independent identity used for safe source/target pairing and authority comparisons.

The importer never assumes English line order equals target-language line order.

## Authority and conflict model
Authority rules are project data, not hard-coded editing behavior. The default Matthew policy treats:
- fresh source/target Scripture resources as authoritative for Scripture;
- corrected standalone footnote/cross-reference resources as higher authority than ancillary copies embedded in the Scripture SFM;
- protected Scripture differences as manual review regardless of authority score.

A changed overlapping record produces an `import_conflict`. It does **not** overwrite existing content. Human actions are:
- keep existing;
- use incoming;
- manual merge.

All change actions require an editorial reason. Protected Scripture additionally requires explicit protected-content confirmation. Replaced text is written to version history before the active record changes.

## Scripture protection
`content_items.protection_level = protected_scripture` is an application-level authorization boundary. Deterministic QA and future AI may read, flag and suggest; they cannot silently update Scripture.

## Round-trip exchange
The canonical database can export/import:
- JSON (`sbc-0.4` canonical schema)
- CSV
- TSV
- USFM/SFM
- DOCX editorial exchange

DOCX uses explicit bilingual/source-target columns and preserves Unicode plus explicit line breaks. Legacy DOC remains import-only.

## Deterministic QA before AI
v0.4 includes local checks for:
- malformed USFM marker spacing;
- marker balance and selected source/target marker-sequence differences;
- Unicode NFC, zero-width, invalid control and replacement characters;
- chapter anchors;
- numeric/fraction mismatches;
- empty target content in paired editorial resources;
- duplicate semantic records;
- versification differences.

Conflict resolution and QA are separate: pending import conflicts block publication but are not duplicated as QA findings.

## Release architecture
A normal branch push runs CI. A version tag such as `v0.4.0` is the release boundary. The release workflow validates tag/package/changelog agreement, runs tests, generates release notes from the changelog, creates a source archive and checksums, and publishes a GitHub Release. Once `src-tauri/Cargo.toml` exists at M2, the same release workflow also builds and attaches Windows, macOS and Linux installers.
