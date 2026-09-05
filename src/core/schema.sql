PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_language_code TEXT,
  source_language_name TEXT,
  source_script TEXT,
  target_language_code TEXT,
  target_language_name TEXT,
  target_script TEXT,
  text_direction TEXT NOT NULL DEFAULT 'ltr' CHECK(text_direction IN ('ltr','rtl')),
  canon TEXT NOT NULL DEFAULT 'protestant-66',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  script TEXT,
  direction TEXT NOT NULL DEFAULT 'ltr' CHECK(direction IN ('ltr','rtl')),
  role TEXT NOT NULL CHECK(role IN ('source','target','auxiliary')),
  created_at TEXT NOT NULL,
  UNIQUE(project_id, code, role)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  committed_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('preview','committed','cancelled','failed')),
  summary_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS import_files (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  format TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  language_code TEXT,
  resource_role TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  source_path TEXT,
  UNIQUE(project_id, sha256, resource_role, language_code)
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  book_code TEXT NOT NULL,
  book_name TEXT,
  sort_order INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, book_code)
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language_code TEXT,
  role TEXT NOT NULL,
  book_code TEXT,
  title TEXT,
  authoritative_for TEXT,
  source_import_file_id TEXT REFERENCES import_files(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_id TEXT REFERENCES resources(id) ON DELETE CASCADE,
  book_code TEXT,
  chapter INTEGER,
  verse TEXT,
  content_type TEXT NOT NULL,
  marker TEXT,
  category TEXT,
  sequence_no INTEGER NOT NULL DEFAULT 0,
  parent_item_id TEXT REFERENCES content_items(id) ON DELETE CASCADE,
  semantic_key TEXT NOT NULL,
  match_key TEXT NOT NULL DEFAULT '',
  parent_semantic_key TEXT,
  logical_key TEXT NOT NULL,
  language_code TEXT,
  language_role TEXT CHECK(language_role IN ('source','target','auxiliary') OR language_role IS NULL),
  protection_level TEXT NOT NULL DEFAULT 'normal' CHECK(protection_level IN ('normal','protected_scripture')),
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN ('unreviewed','reviewed','approved','needs_review')),
  canonical_state TEXT NOT NULL DEFAULT 'active' CHECK(canonical_state IN ('active','superseded','alternate')),
  current_text TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  normalized_text TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  source_file_id TEXT REFERENCES import_files(id),
  source_locator TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_project_book_ref ON content_items(project_id, book_code, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_content_logical_key ON content_items(project_id, logical_key);
CREATE INDEX IF NOT EXISTS idx_content_semantic ON content_items(project_id, semantic_key, language_role, language_code);
CREATE INDEX IF NOT EXISTS idx_content_match ON content_items(project_id, match_key, language_code, canonical_state);
CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(project_id, content_type);

CREATE TABLE IF NOT EXISTS import_conflicts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  existing_content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  semantic_key TEXT NOT NULL,
  match_key TEXT NOT NULL DEFAULT '',
  language_code TEXT,
  language_role TEXT,
  existing_resource_role TEXT,
  incoming_resource_role TEXT,
  incoming_file_id TEXT REFERENCES import_files(id),
  incoming_resource_id TEXT REFERENCES resources(id),
  incoming_text TEXT NOT NULL,
  incoming_raw_text TEXT NOT NULL DEFAULT '',
  incoming_hash TEXT NOT NULL,
  incoming_marker TEXT,
  incoming_category TEXT,
  source_locator TEXT,
  authority_recommendation TEXT NOT NULL DEFAULT 'manual_review',
  authority_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','keep_existing','use_incoming','manual_merge','resolved')),
  resolution_reason TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_import_conflicts_project ON import_conflicts(project_id,status);

CREATE TABLE IF NOT EXISTS authority_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  resource_role TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(project_id,content_type,resource_role)
);

CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL,
  text TEXT NOT NULL,
  change_type TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(content_item_id, revision_no)
);

CREATE TABLE IF NOT EXISTS qa_issues (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_item_id TEXT REFERENCES content_items(id) ON DELETE CASCADE,
  paired_content_item_id TEXT REFERENCES content_items(id) ON DELETE CASCADE,
  fingerprint TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low','info')),
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','rejected','resolved','deferred')),
  engine TEXT NOT NULL,
  message TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  suggested_text TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_qa_project_status ON qa_issues(project_id,status,severity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_fingerprint ON qa_issues(project_id,fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS editorial_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('language','publisher','project')),
  rule_type TEXT NOT NULL,
  key_text TEXT NOT NULL,
  value_text TEXT,
  status TEXT NOT NULL DEFAULT 'observed' CHECK(status IN ('observed','suggested','approved','rejected','deprecated')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_language_code TEXT,
  target_language_code TEXT NOT NULL,
  source_term TEXT,
  target_term TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','approved','allowed','discouraged','rejected')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
