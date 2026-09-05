# Canonical data model

The database represents content independently from the file it arrived in.

Core entities:
- Project
- Language
- Import batch / imported file
- Book
- Resource (source Scripture, target Scripture, study notes, footnotes, cross references, introductions, maps/charts, etc.)
- Content item
- Content version
- QA issue
- Editorial rule
- Glossary term

Content items carry book/chapter/verse anchors, marker/category information, language, original raw text, normalized text, provenance, content hash, and protection level.

Planned additional entities: media assets, content relationships, versification mappings, review assignments, publication profiles, layout metadata, and sync/audit identity.
