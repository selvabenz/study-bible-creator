# Study Bible Creator v0.2.0 — Test Report

Date: 2026-09-05

## Automated regression suite
Result: **9 / 9 passing**.

Covered cases:
1. exact duplicate file detection;
2. supported-format detection including upper-case legacy `.DOC`;
3. unsupported-format rejection;
4. malformed `.doc` binary rejection before conversion;
5. UTF-8 BOM and CRLF handling in USFM;
6. unclosed footnote warning;
7. unclosed cross-reference warning;
8. same bytes imported under a different resource role are not mistaken for an exact duplicate;
9. changed logical records become conflicts and do not silently overwrite stored content;
10. protected Scripture separation from footnotes and cross-references;
11. inline footnote/cross-reference payload does not leak into displayed Scripture text.

## Real Matthew SFM smoke tests

### 41MATGSB.SFM
- format: SFM
- book: MAT
- chapters: 28
- Scripture verse records: 1,067
- total parsed items: 1,591
- parser warnings: 0

### 41MATIRVTam.SFM
- format: SFM
- book: MAT
- chapters: 28
- Scripture verse records: 1,071
- footnotes: 178
- cross-references: 264
- parallel references: 106
- total parsed items: 2,056
- parser warnings: 0

The English/Tamil verse-count difference is preserved rather than automatically treated as an error.

## Legacy DOC integration tests
All four user-supplied Matthew `.doc` files were recognized as Microsoft Compound Binary Word files, converted locally to temporary DOCX, parsed, and the temporary conversion deleted.

| Legacy DOC | Parsed items | Main detected content |
|---|---:|---|
| MAT Cross-references-recorrected.doc | 3,224 | cross-reference |
| MAT Footnotes-corrected.doc | 294 | footnote |
| MAT Introductions ,ESV Study Bible, Glossary, Back Matter-corrected.doc | 118 | structured DOC records |
| MAT Study notes, sub-headings, chapter intros-correction.doc | 3,470 | chapter markers, headings, study notes, Scripture fragments, other structured rows |

## DOC vs DOCX parity check
Each supplied legacy DOC was compared with its converted DOCX equivalent.

Result for all four files:
- same item count: **PASS**
- same content hashes in sequence: **PASS**
- same semantic content classification: **PASS**
- same inferred book code: **PASS**

This verifies that the current local conversion adapter is not changing the parsed editorial content in the tested Matthew files.

## Development server smoke test
- server starts successfully;
- health endpoint returns version `0.2.0`;
- runtime creates missing `data/` and `tmp/` directories automatically;
- duplicate-preview and parser-error temporary uploads are cleaned up.

## Known limitation / not falsely marked as solved
Legacy DOC import in v0.2.0 currently requires LibreOffice/soffice to be present locally. Recognition is built in, and absence of a converter produces a clear error without damaging content. A lighter bundled/native DOC path is a production milestone.

## Release decision
Current v0.2.0 development snapshot: **PASS for development delivery**.

It is not yet a production desktop release. Windows/macOS/Linux installers begin with the Tauri desktop milestone.
