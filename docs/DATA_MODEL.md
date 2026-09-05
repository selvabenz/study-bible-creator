# Canonical data model — v0.4.0

The database represents Study Bible content independently from the file it arrived in.

## Core entities
- **Project** — project name, source/target languages and settings.
- **Language** — language/script metadata suitable for Unicode, LTR and RTL projects.
- **Import batch / imported file** — original filename, transport format, SHA-256 fingerprint and import provenance.
- **Resource** — source Scripture, target Scripture, study notes, footnotes, cross-references, introductions, maps/charts, etc.
- **Content item** — canonical editorial unit.
- **Content version** — immutable previous-text snapshot before an approved content change.
- **Import conflict** — retained incoming alternative plus authority recommendation and resolution audit.
- **Authority rule** — project-configurable precedence by content type/resource role.
- **QA issue** — deterministic/future-AI finding, severity, status and evidence.
- **Editorial rule / glossary term** — approved language/style knowledge.

## Content item fields
Important fields include:
- book/chapter/verse anchor;
- content type;
- USFM marker/category;
- sequence;
- language and language role;
- `semantic_key` — precise identity;
- `match_key` — stable marker-independent comparison identity;
- `parent_semantic_key` — relationship to an enclosing/parent item;
- `canonical_state` — active/superseded/alternate;
- current text;
- original/raw text;
- source locator/provenance;
- content SHA-256;
- review status;
- protection level, including `protected_scripture`.

## Conflict record
A conflict preserves both sides and enough provenance to audit the decision:
- existing content item/resource;
- incoming file/resource/role;
- match key;
- incoming current/raw text;
- incoming marker/category;
- authority recommendation and reason;
- resolution action/reason/editor/time.

The incoming content is not lost even when the editor chooses to keep the existing content.

## Authority policy
Authority is content-type aware. A higher score can recommend an incoming corrected Study Bible resource over an embedded ancillary copy, but authority never bypasses Scripture protection or human confirmation.

## Planned expansion
- media asset registry and captions;
- explicit content relationships and reference targets;
- versification mappings/textual variants;
- review assignments and collaboration identity;
- publication profiles/layout metadata;
- sync/audit identity for optional team/cloud mode.
