# Release process — v0.5.0+

1. Push the source branch and let cross-platform CI pass.
2. Run **Desktop Installer Smoke Build** manually or through a PR touching desktop code.
3. Download and launch the generated platform artifact(s) for smoke verification.
4. Only after the native matrix passes, tag the release:

```bash
git tag v0.5.0
git push origin v0.5.0
```

The versioned release workflow checks package/Tauri/Cargo version agreement, executes regression tests, builds Windows/macOS/Linux packages, and creates a prerelease with source and checksums.

Signing/notarization is intentionally deferred; prerelease installers may therefore show OS trust warnings.
