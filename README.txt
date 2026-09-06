Study Bible Creator v0.5.3 test/version fix

Replace these files in the repository:
  tests/v05-desktop.test.mjs
  tests/v052-runtime.test.mjs
  src/server.mjs

Why:
- v05-desktop.test.mjs in v0.5.2 hard-coded version 0.5.2, so a correct 0.5.3 version bump made CI fail 39/40.
- The replacement test validates that package.json, Cargo.toml and tauri.conf.json agree with each other, without hard-coding a particular release number.
- server.mjs no longer falls back to a hard-coded 0.5.2; it reads package.json for the fallback app version.
- v052-runtime.test.mjs adds a regression assertion for the dynamic package version fallback.

Validated locally after setting package.json, package-lock.json, Cargo.toml and tauri.conf.json to 0.5.3:
40 tests / 40 passed / 0 failed.
