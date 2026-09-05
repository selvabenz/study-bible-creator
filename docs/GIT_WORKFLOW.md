# Git / GitHub workflow

Use Conventional Commits so every iteration is pushable and release notes can be automated.

## Branches
- `main`: releasable milestones only.
- `develop`: integration branch.
- `feature/<short-name>`: feature work.
- `fix/<short-name>`: corrections.

## Commit format
`type(scope): short imperative description`

Common types: `feat`, `fix`, `test`, `docs`, `refactor`, `build`, `ci`, `chore`.

## Recommended commits for v0.2.0
1. `feat(import): recognize legacy DOC files with local conversion adapter`
2. `fix(docx): classify Study Bible rows from tags and sub-tags`
3. `test(import): cover format detection and malformed legacy DOC edge cases`
4. `feat(ux): add high-fidelity interactive desktop wireframe`
5. `ci: add cross-platform tests and development package workflow`
6. `build: add Windows PowerShell CMD and Unix development launchers`
7. `chore(git): add project-safe gitignore rules`
8. `docs: add full product milestone and release-quality gates`

## Release tags
- development snapshots: `v0.2.0`
- desktop prereleases after M2: `desktop-v0.3.0-alpha.1`

## Pull request gate
A PR cannot merge to `main` unless CI passes on Windows, macOS and Linux.
