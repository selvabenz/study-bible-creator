# Study Bible Creator v0.5.1 Test Report

Date: 2026-09-06
Milestone: M2 native desktop build hardening

## Confirmed v0.5.0 GitHub failures reproduced from logs

1. Windows CI DOCX round-trip failed because the PowerShell `Compress-Archive` command did not receive the expected positional arguments on the GitHub Windows runner.
2. macOS Tauri compile failed in `tauri::generate_context!()` because `src-tauri/icons/icon.png` did not exist.

## Fixes in v0.5.1 candidate

- Replaced shell-based DOCX ZIP operations with a pure Node ZIP reader/writer using built-in zlib.
- Added a complete Tauri desktop icon set:
  - `src-tauri/icons/32x32.png`
  - `src-tauri/icons/128x128.png`
  - `src-tauri/icons/128x128@2x.png`
  - `src-tauri/icons/icon.png`
  - `src-tauri/icons/icon.ico`
  - `src-tauri/icons/icon.icns`
- Added explicit `bundle.icon` configuration in `tauri.conf.json`.
- Added regression validation for icon existence and file signatures.
- Release and desktop matrices use `fail-fast: false`.
- Versioned Release supports manual recovery through `workflow_dispatch`.

## Automated regression result

```text
33 tests
33 passed
0 failed
```

The suite covers import duplicate detection, Scripture protection, authority-aware conflicts, deterministic QA, JSON/CSV/TSV/SFM/DOCX round-trip behavior, Windows-safe DOCX ZIP handling, desktop configuration, sidecar/authentication configuration, and cross-platform icon assets.

## Native release gate

This environment does not provide Rust/Cargo, so the Tauri binary itself cannot be compiled here. v0.5.1 must be pushed to `main` and the **Desktop Installer Smoke Build** must complete on all three native GitHub runners before tagging:

- Windows / NSIS
- macOS / DMG
- Linux / AppImage + DEB

Do not publish/tag v0.5.1 until all three jobs pass.
