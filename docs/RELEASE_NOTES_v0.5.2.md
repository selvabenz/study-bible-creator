# Study Bible Creator v0.5.2

## Windows runtime startup hotfix

This patch fixes the first real-machine acceptance issue found after v0.5.1 installers were produced successfully.

### Fixed
- Windows release executable no longer launches as a console/Windows Terminal application.
- A native Tauri startup window is created immediately before the local Node/SQLite engine starts.
- Packaged local server resources are discovered through multiple safe candidate paths.
- The desktop shell waits for a real `/api/health` response before navigating to the workspace.
- Startup failures stay inside the application UI and are recorded in `startup.log` in the application data directory.
- Desktop API health reports the packaged application version.

### Safety
- Scripture protection, local-only database behavior, import conflict handling, and release asset filtering are unchanged.
- No AI is introduced in this patch.

### Test gate
- 40/40 automated tests pass in the source package.
- Native Windows/macOS/Linux compilation remains a GitHub Actions release gate.
