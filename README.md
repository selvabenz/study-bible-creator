# Study Bible Creator v0.1.0

First working local-first prototype of the Study Bible publishing QA application.

## What works now
- Project creation with source/target language metadata
- SQLite database as source of truth
- Import preview before commit
- Import USFM/SFM, CSV, TSV, JSON and DOCX
- Exact-file SHA-256 duplicate detection
- Record-level duplicate/change detection
- Add new books/resources to an existing project
- USFM/SFM semantic parsing of chapters, verses, headings, introductions, poetry, footnotes and cross-references
- Scripture marked `protected_scripture`
- Local web UI with no external packages
- Export core for USFM/SFM, CSV, TSV and JSON

## Run
Requires Node.js 22.5+.

```bash
npm start
```
Then open http://127.0.0.1:4173

No `npm install` is required for this prototype.

## Test
```bash
npm test
```

## Paired SFM smoke test

```bash
npm run import:pair -- path/to/source.sfm path/to/target.sfm ta Tamil
```

## Production desktop direction
This reference core will be migrated to Rust and embedded in a Tauri 2 desktop shell. The database and semantic import rules are intentionally designed independently of the temporary development host.
