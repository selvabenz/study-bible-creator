# Study Bible Creator v0.5.5 — Desktop runtime hardening

This release addresses the installed-Windows startup failure where the Tauri window appeared but the bundled local database/publishing engine never became ready.

The previous build did not preserve enough sidecar diagnostics to prove the exact machine-specific failure from the screenshot alone. v0.5.5 therefore fixes the structural weak points rather than hiding the failure behind a longer timeout: the local engine is now app-owned (`sbc-engine`), its stdout/stderr/error/termination events are captured, startup is non-blocking, first-run startup has a bounded 45-second readiness window, and failures are written to `startup.log` and shown to the user.

SQLite is tuned for a local editorial workload with WAL, bounded busy waits and targeted indexes. CI now runs unit/edge cases, exact sidecar integration, broad API functional coverage, and a 5,000-verse performance workload. Most importantly, the Windows installer smoke build now installs and launches the actual NSIS `.exe` and rejects the artifact unless the installed application reaches the main workspace.

No automatic Scripture-edit permission was added. Protected Scripture still requires explicit human confirmation and an editorial reason before replacement.
