# GitHub Commit Plan — v0.5.1

Recommended commit sequence:

```text
fix(docx): replace shell ZIP operations with pure Node archive handling
fix(desktop): add required Tauri cross-platform icon assets
fix(ci): run all desktop platform jobs independently
ci(release): allow manual rebuilds of existing version tags
test(desktop): cover Windows DOCX portability and native icon requirements
docs: add v0.5.1 release and test notes
```

Before tagging:

```text
npm ci --ignore-scripts
npm test
```

Then push `main` and run **Desktop Installer Smoke Build** manually. Only if Windows, macOS and Linux all pass:

```text
git tag v0.5.1
git push origin v0.5.1
```

Do not manually create the GitHub Release first. The `Versioned Release` workflow should create/upload it after successful native builds.
