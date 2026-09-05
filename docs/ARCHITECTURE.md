# Study Bible Creator — V0.1 Architecture

## Product principle
Local-first, database-first, human-authoritative. Files are import/export containers; the project database is the source of truth.

## Production target
- Desktop shell: Tauri 2
- UI: React + TypeScript
- Core: Rust
- Local DB: SQLite
- AI: optional escalation layer only after deterministic QA

This v0.1 repository provides a dependency-free Node 22 reference implementation of the local core and UI so the data model/import behavior can be exercised immediately. The same interfaces are intended to be ported into the Tauri/Rust core.

## Import pipeline
File -> fingerprint -> parser -> semantic items -> duplicate comparison -> preview -> human commit -> SQLite.

## Scripture protection
`content_items.protection_level = protected_scripture` is assigned to verse text. Future write commands must reject automated edits to protected Scripture and require a human-approved revision path.

## Duplicate strategy
1. File SHA-256 detects byte-identical reimports.
2. Logical keys detect existing semantic records.
3. Content SHA-256 distinguishes exact duplicate content from changed records.
4. V0.1 never overwrites changed records during import; it preserves them for a future compare/merge workflow.

## Formats
V0.1 import: USFM/SFM, CSV, TSV, JSON, DOCX.
V0.1 export core: USFM/SFM, CSV, TSV, JSON. DOCX export is scheduled for the next milestone because it requires a carefully tested publishing schema rather than a lossy plain-text document.
