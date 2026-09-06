# Study Bible Creator v0.5.5

Local-first multilingual Study Bible publishing QA application. v0.5.5 is the M2 desktop runtime-hardening release that must pass before M3 / v0.6.0 begins.

## Desktop architecture
- Tauri 2 native shell for Windows, macOS and Linux
- HTML/CSS/JavaScript editorial workspace
- bundled Node 22 runtime under the app-owned `sbc-engine` sidecar name
- SQLite project database in the OS app-data directory
- loopback-only local server (`127.0.0.1`) with per-launch desktop session authentication
- single-instance protection
- no cloud AI required
- Scripture remains protected from silent replacement

## Import and export
Import: USFM/SFM, CSV, TSV, JSON, DOCX, and legacy DOC (through the isolated local conversion adapter).

Export: USFM/SFM, CSV, TSV, JSON, and DOCX bilingual editorial exchange.

## Verification
Run the complete local verification suite:

```bash
npm run test:all
```

It runs:
- 50 unit/regression/edge-case tests
- exact packaged-sidecar startup + import/QA/export smoke
- local HTTP/API functional smoke across the current application surface
- 5,000-verse (~10,102 active records) performance workload with explicit time and memory budgets

Run the authoritative Matthew corpus smoke when the fresh source paths are available:

```bash
SBC_MAT_SOURCE=/path/41MATGSB.SFM \
SBC_MAT_TARGET=/path/41MATIRVTam.SFM \
SBC_MAT_CORRECTIONS_DIR=/path/corrected-docx \
SBC_MAT_MAPS_DIR=/path/maps-docx \
npm run qa:smoke
```

## Desktop build verification
`Desktop Installer Smoke Build` now does more than compile. On Windows it builds the NSIS installer, installs that actual `.exe` silently, launches the installed application, and fails unless the local engine becomes ready and the main workspace is navigated successfully.

The first v0.5.5 installation should be done after closing and uninstalling the earlier pre-v0.5.5 build once. Older builds used a generic bundled `node.exe`; v0.5.5 and later use the uniquely owned `sbc-engine.exe`, which can be upgraded safely without touching unrelated Node processes.

## Development
Requires Node.js 22.5+ and Rust/Tauri tooling for native desktop builds.

```bash
npm run test:all
npm run desktop:dev
```

Build native installers:

```bash
npm run desktop:build
```

Installed users do not need Node.js separately.

## Release
1. Push v0.5.5 source to `main`.
2. Run **Actions → Desktop Installer Smoke Build** and require all platform jobs to pass.
3. Only then create and push the matching `v0.5.5` tag.

```bash
git tag v0.5.5
git push origin v0.5.5
```

The tag triggers the automated Versioned Release workflow.

See `docs/TEST_REPORT_v0.5.5.md`, `docs/TEST_MATRIX_v0.5.5.md`, `docs/RUNTIME_HARDENING_v0.5.5.md`, and `docs/RELEASE_NOTES_v0.5.5.md`.
