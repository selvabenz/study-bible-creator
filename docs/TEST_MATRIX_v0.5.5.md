# v0.5.5 verification matrix

| Area | Verification |
|---|---|
| Duplicate safety | Exact-file duplicates; same bytes under another resource role; changed logical record conflict |
| Scripture protection | Source/target semantic pairing; protected Scripture cannot be replaced without explicit human confirmation |
| USFM/SFM parsing | BOM/CRLF; verse identity; inline footnotes/xrefs; unclosed inline markers; round-trip without duplicate auxiliary records |
| Word/DOCX portability | Pure-Node ZIP; Unicode; nested DOCX ZIP paths; no PowerShell zip/unzip dependency |
| Canonical exchange | JSON, CSV, TSV, SFM/USFM and DOCX export/import coverage |
| QA | Numbers; zero-width Unicode; malformed marker spacing; marker sequence; replacement/control chars; invalid anchors; versification differences |
| Authority/conflicts | Corrected standalone footnotes/xrefs preferred; human reason required for replacement; conflict resolution preserves revision history |
| Desktop security | Loopback-only server; per-launch session; unauthenticated API denied; wrong desktop token rejected |
| Runtime packaging | Exact copied `sbc-engine` executes; packaged server starts; health succeeds; resources are present |
| API functional surface | Project create/list/read; import preview/commit; duplicate; stats; books; chapters; content; pairs; vocabulary; rules; authority; QA run/list/status; exports; conflict list/resolve; malformed/unknown/expired requests |
| Windows installer | Real NSIS install + actual installed-app launch + startup log readiness gate |
| Performance | 5,000-verse source + target workload (~10,102 active DB items) under explicit parse/import/browse/stats/vocabulary/QA/total/RSS budgets |
| Real corpus | Fresh Matthew English/Tamil Scripture + corrected resource DOCX + maps/charts |

## Local v0.5.5 results
- Unit/regression: **50/50 passed**.
- Exact sidecar integration: **passed**, startup about **171 ms** in the Linux test container.
- API functional smoke: **passed**, startup about **163 ms** in the Linux test container.
- Synthetic performance: **2.925 s total** for ~10,102 active records; RSS ~274 MB. Budgets: 18 s total and 700 MB RSS.
- Real Matthew: 1,067 English verses; 1,071 Tamil verses; 1,067 pairs; target-only 12:47, 17:21, 18:11, 23:14; 10,489 DB items; 3,250 protected; 268 pending authority conflicts; 53 deterministic QA findings; 11 map/chart DOCX parsed.

These timings are local Linux-container measurements. The GitHub Windows installed-app smoke is the authoritative release gate for the Windows packaging/runtime path.
