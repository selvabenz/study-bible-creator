# Study Bible Creator v0.5.0 — Test Report

## Scope
M2 native desktop foundation plus all prior deterministic import, conflict, Scripture-protection, QA, and round-trip regression tests.

## Local result
The JavaScript regression suite is executed with `npm test`. Native Tauri compilation is intentionally a GitHub Actions gate because Rust/Cargo is not available in the current build environment.

## Desktop-specific checks
- package/Tauri/Cargo version alignment
- bundled Node external sidecar configuration
- local app resources included in bundle
- loopback-only server binding
- per-launch desktop session authentication
- single-instance plugin ordering
- desktop preparation script copies the host Node runtime under the Tauri target-triple naming convention

## Native release gate
A release is not considered fully passed until Windows, macOS, and Linux GitHub Actions jobs compile the native Tauri bundles successfully.
