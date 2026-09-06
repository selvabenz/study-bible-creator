# Study Bible Creator v0.5.1

Local-first multilingual Study Bible publishing QA application.

## v0.5.1 — M2 Native Desktop Foundation
v0.5.1 adds a Tauri 2 desktop shell for Windows, macOS and Linux while preserving the proven SQLite/import/conflict/QA core.

### Desktop architecture
- Tauri 2 native shell
- HTML/CSS/JavaScript editorial workspace
- bundled Node 22 runtime sidecar prepared from the build host
- SQLite project database stored in the OS app-data directory
- local server bound only to `127.0.0.1`
- per-launch authenticated desktop session
- single-instance protection
- no cloud AI required

## Import formats
USFM/SFM, CSV, TSV, JSON, DOCX, and legacy DOC.

## Export formats
USFM/SFM, CSV, TSV, JSON, and DOCX bilingual editorial exchange.

## Development
Requires Node.js 22.5+ and Rust 1.77.2+ for the desktop shell.

```bash
npm test
npm run desktop:dev
```

Build native installer(s):

```bash
npm run desktop:build
```

Installed users do not need Node.js; the release bundle includes the Node sidecar runtime.

## Release
Normal pushes run CI. After CI and native installer smoke builds succeed, tag the version:

```bash
git tag v0.5.1
git push origin v0.5.1
```

See `docs/TEST_REPORT_v0.5.1.md`, `docs/RELEASE_NOTES_v0.5.1.md`, and `docs/COMMIT_v0.5.1.md`.
