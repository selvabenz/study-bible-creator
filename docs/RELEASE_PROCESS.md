# Release process

## 1. Development push
A normal push to `main` or a pull request runs `.github/workflows/ci.yml` on **Windows, macOS and Linux**.

A push to `develop` additionally creates a downloadable development source snapshot artifact. It is not a formal release.

**A normal push to `main` does not create a release or change the version automatically.** This is deliberate so a broken or accidental push cannot become a publishing build.

## 2. Formal version release
Keep these three values synchronized:
- Git tag: `vX.Y.Z`
- `package.json`: `X.Y.Z`
- `CHANGELOG.md`: `## [X.Y.Z]`

For v0.4.0:

```bash
git push origin main
git tag v0.4.0
git push origin v0.4.0
```

The `v*` tag triggers `.github/workflows/release.yml`.

The workflow first refuses the release if tag, package version and changelog do not agree. It then runs the complete regression suite before publishing anything.

A previously created tag can also be repackaged manually from **GitHub → Actions → Versioned Release → Run workflow**, entering an existing tag such as `v0.4.0`.

## Automated outputs before Tauri (current v0.4 stage)
A valid release tag creates:
- GitHub Release named with the version tag;
- release notes generated from the matching `CHANGELOG.md` section;
- `study-bible-creator-vX.Y.Z-source.zip`;
- `SHA256SUMS.txt`.

v0.4.0 intentionally does **not** pretend to be a native desktop build. The easiest development launchers remain `run-dev.cmd`, `run-dev.ps1` and `run-dev.sh`.

## Automated outputs after Tauri M2
The same release job detects `src-tauri/Cargo.toml` and additionally runs desktop builds on:
- **Windows** — NSIS `.exe` and/or `.msi`, according to Tauri bundle configuration;
- **macOS** — `.app` / `.dmg`;
- **Linux** — AppImage and/or `.deb`.

Those platform artifacts are attached to the **same GitHub Release**. This means that after M2, each version tag can produce the release notes, checksums and installable applications automatically from one reproducible workflow.

## Versioning policy
Use semantic versions:
- `0.4.0` — feature milestone / hardening iteration;
- `0.4.1` — compatible bug-fix release;
- `0.5.0` — next feature milestone;
- `1.0.0` — first production-stable publishing release after production gates are satisfied.

For now, releases remain marked **prerelease** in GitHub Actions. We should remove `prerelease: true` only when the product reaches an agreed release-candidate/stable stage.
