# v0.5.1 release publish repair

The native desktop builds succeeded on Windows, macOS and Linux, but the publish job failed because the release workflow uploaded the entire `src-tauri/target/release/bundle/**` tree. This included DMG tooling, Linux AppDir libraries, application resources and repeated filenames. `softprops/action-gh-release` then encountered release-asset naming/race conditions while updating metadata.

## Repair

- Native jobs now upload only distributable installers:
  - Windows: `bundle/nsis/*.exe`
  - macOS: `bundle/dmg/*.dmg`
  - Linux: `bundle/appimage/*.AppImage` and `bundle/deb/*.deb`
- Publish stages only `.exe`, `.dmg`, `.AppImage` and `.deb` into `final-assets/`.
- The workflow verifies that all four installer classes are present before publishing.
- Manual rebuilds of an existing tag clean stale release assets before uploading the clean set.
- Checksums cover only final installers, the source archive and `release-manifest.json`.
- The Desktop Installer Smoke Build now stores installer-only artifacts as well.

## Repairing the existing v0.5.1 release

Push this workflow repair to `main`. Do not move or recreate the `v0.5.1` tag. Then run:

`Actions -> Versioned Release -> Run workflow -> tag: v0.5.1`

The workflow definition from `main` will rebuild the tagged source, remove the stale release assets, and republish a clean v0.5.1 release.

Expected downloadable assets after success:

- `Study Bible Creator_0.5.1_x64-setup.exe`
- `Study Bible Creator_0.5.1_aarch64.dmg`
- `Study Bible Creator_0.5.1_amd64.AppImage`
- `Study Bible Creator_0.5.1_amd64.deb`
- `Study-Bible-Creator_v0.5.1_source.zip`
- `SHA256SUMS.txt`
- `release-manifest.json`
