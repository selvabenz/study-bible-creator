# Study Bible Creator v0.5.1

Desktop build/release hardening patch for M2.

## Fixed
- Windows DOCX round-trip CI failure caused by PowerShell `Compress-Archive` argument handling.
- Replaced platform shell ZIP dependencies in DOCX import/export with a pure Node ZIP implementation using built-in `zlib`.
- DOCX import/export no longer depends on PowerShell, `zip`, or `unzip` for OOXML archive access.
- Release matrix now uses `fail-fast: false` so Windows, macOS, and Linux all report their build result even when another platform fails.
- Versioned Release can now be re-run manually for an existing tag through `workflow_dispatch`.
- Release checkout/version validation uses the selected release tag consistently.
- Native bundle artifact upload fails explicitly if no installer files were produced.
- Added a complete cross-platform Tauri application icon set and explicit `bundle.icon` configuration.
- Fixed the confirmed macOS compile error where `tauri::generate_context!()` could not open `src-tauri/icons/icon.png`.

## Safety
Scripture protection, conflict resolution, local QA, and authority rules are unchanged by this patch.

## Remaining M2 gate
The confirmed Windows CI and macOS missing-icon compile failures are fixed and covered by regression tests. Native installer release remains gated on a fresh Windows/macOS/Linux smoke build. Do not tag v0.5.1 until all three GitHub native jobs complete successfully.
