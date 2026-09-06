# Runtime hardening — v0.5.5

## Failure class addressed
An installed Windows build could show the startup UI while the bundled local engine failed to become ready. Compilation alone did not detect this because the old release pipeline never launched the installed application.

## Changes
- Startup readiness moved off the Tauri setup thread so the native window remains responsive.
- Startup timeout is 45 seconds, with a slow-start notice after 8 seconds and a 5-second performance target recorded in the log.
- Sidecar stdout, stderr, process errors and termination status are captured and persisted.
- The sidecar is uniquely named `sbc-engine` rather than `node`.
- Windows NSIS pre-install/pre-uninstall hooks stop only `sbc-engine.exe`; they never kill generic `node.exe` processes.
- Cached stale sidecar copies are removed before bundling.
- SQLite uses WAL, `synchronous=NORMAL`, a 5-second busy timeout, memory temp storage, a bounded page cache and targeted browse/review indexes.
- Local HTTP requests have a 128 MB safety ceiling, malformed JSON is a 400 response, and database/server startup errors are explicit.

## Installed-Windows release gate
The Windows GitHub runner now:
1. builds the NSIS `.exe`;
2. silently installs that exact installer;
3. finds and launches the installed Study Bible Creator executable;
4. watches `startup.log` for errors;
5. requires `main_window_navigated=true` within 60 seconds;
6. rejects the installer if the process exits or the engine reports an error.

This closes the previous gap where “installer built successfully” was treated as equivalent to “installed application starts successfully.”
