# Git commit plan — v0.5.0

Suggested commits:

- `feat(desktop): add Tauri 2 native shell and bundled Node sidecar`
- `feat(desktop): isolate SQLite data in OS app-data directory`
- `feat(security): authenticate loopback desktop API sessions`
- `feat(desktop): add single-instance protection`
- `ci(release): build native Windows macOS and Linux installers`
- `test(desktop): add M2 packaging and security regression tests`
- `docs(release): document v0.5.0 native desktop release gates`

Tag after CI succeeds:

```bash
git tag v0.5.0
git push origin v0.5.0
```
