# v0.5.1 manual release verification fix

The manual recovery workflow now reads and prints all three application versions explicitly before comparing them:

- Git tag
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

The previous verifier used fixed-spacing `grep` checks and surfaced only a generic step exit code. The new verifier parses the actual values, tolerates harmless whitespace/formatting differences, and emits a precise GitHub Actions error naming the mismatching source if a real version mismatch exists.

This change affects release automation only; application code and v0.5.1 runtime behavior are unchanged.
