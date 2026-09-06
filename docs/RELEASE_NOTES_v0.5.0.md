# Study Bible Creator v0.5.0 — Native Desktop Foundation

v0.5.0 introduces the Tauri 2 desktop shell for Windows, macOS, and Linux while preserving the local-first Study Bible database, import/conflict engine, Scripture protection, deterministic QA, and multi-format exports from v0.4.0.

Highlights:
- Tauri 2 native shell
- bundled Node runtime sidecar; installed users do not need Node.js
- SQLite stored in the OS application-data directory
- loopback-only authenticated local desktop session
- single-instance protection
- GitHub Actions native installer build/release pipeline
- no cloud AI dependency

Known release gaps:
- code signing/notarization is not configured yet
- legacy `.DOC` still depends on LibreOffice conversion
- native installers must pass the GitHub Actions matrix before v0.5.0 is considered fully released
