# Test Report — v0.5.2

## Result

- Automated tests: **40 passed / 0 failed**
- AI usage: **none**

## New runtime regression coverage

1. Windows release binary uses the GUI subsystem and does not intentionally open Windows Terminal.
2. A Tauri startup webview is created before launching the local engine.
3. Bundled server resource discovery is validated.
4. Local engine health is checked before the main UI navigation.
5. A persistent startup log and visible failure state exist.
6. Packaged application version is passed through to the local server health endpoint.

## Existing gates retained

- Scripture overwrite protection
- duplicate-file detection
- conflict persistence
- source/target semantic pairing
- Unicode QA
- marker QA
- DOC/DOCX support
- JSON/CSV/TSV/SFM/DOCX round-trip tests
- cross-platform pure Node ZIP handling
- release workflow asset filtering
- Tauri icons and sidecar packaging
