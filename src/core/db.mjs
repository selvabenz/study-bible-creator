import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { id, now, safeJson, sha256 } from './utils.mjs';
import { DEFAULT_AUTHORITY_RULES, authorityRecommendation, shouldAuthorityCrossMatch } from './authority.mjs';
const __dirname=path.dirname(fileURLToPath(import.meta.url));

function placeholders(n){ return Array.from({length:n},()=>'?').join(','); }

export class Store {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath),{recursive:true});
    this.db=new DatabaseSync(dbPath);
    this.db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
    this.#migrate();
  }

  #columns(table){ return new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name)); }
  #addColumn(table,name,sql){ if(!this.#columns(table).has(name)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${sql}`); }
  #migrate(){
    this.#addColumn('projects','source_script','TEXT');
    this.#addColumn('content_items','semantic_key',"TEXT NOT NULL DEFAULT ''");
    this.#addColumn('content_items','match_key',"TEXT NOT NULL DEFAULT ''");
    this.#addColumn('content_items','parent_semantic_key','TEXT');
    this.#addColumn('content_items','language_role','TEXT');
    this.#addColumn('content_items','review_status',"TEXT NOT NULL DEFAULT 'unreviewed'");
    this.#addColumn('content_items','canonical_state',"TEXT NOT NULL DEFAULT 'active'");
    this.#addColumn('qa_issues','paired_content_item_id','TEXT');
    this.#addColumn('qa_issues','fingerprint','TEXT');
    this.db.exec(`CREATE TABLE IF NOT EXISTS authority_rules (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,content_type TEXT NOT NULL,resource_role TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 0,notes TEXT,created_at TEXT NOT NULL,UNIQUE(project_id,content_type,resource_role))`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS import_conflicts (id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,project_id TEXT NOT NULL,existing_content_item_id TEXT NOT NULL,semantic_key TEXT NOT NULL,match_key TEXT NOT NULL DEFAULT '',language_code TEXT,language_role TEXT,existing_resource_role TEXT,incoming_resource_role TEXT,incoming_file_id TEXT,incoming_resource_id TEXT,incoming_text TEXT NOT NULL,incoming_raw_text TEXT NOT NULL DEFAULT '',incoming_hash TEXT NOT NULL,incoming_marker TEXT,incoming_category TEXT,source_locator TEXT,authority_recommendation TEXT NOT NULL DEFAULT 'manual_review',authority_reason TEXT,status TEXT NOT NULL DEFAULT 'pending',resolution_reason TEXT,resolved_by TEXT,created_at TEXT NOT NULL,resolved_at TEXT)`);
    for(const [name,sql] of [['match_key',"TEXT NOT NULL DEFAULT ''"],['existing_resource_role','TEXT'],['incoming_resource_role','TEXT'],['incoming_file_id','TEXT'],['incoming_resource_id','TEXT'],['incoming_marker','TEXT'],['incoming_category','TEXT'],['authority_recommendation',"TEXT NOT NULL DEFAULT 'manual_review'"],['authority_reason','TEXT'],['resolution_reason','TEXT'],['resolved_by','TEXT']]) this.#addColumn('import_conflicts',name,sql);
    this.db.exec(`UPDATE content_items SET semantic_key=logical_key WHERE IFNULL(semantic_key,'')=''`);
    this.db.exec(`UPDATE content_items SET match_key=semantic_key WHERE IFNULL(match_key,'')=''`);
    try{ this.db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_fingerprint ON qa_issues(project_id,fingerprint) WHERE fingerprint IS NOT NULL`); }catch{}
    try{ this.db.exec(`CREATE INDEX IF NOT EXISTS idx_content_match ON content_items(project_id,match_key,language_code,canonical_state)`); }catch{}
    for(const p of this.db.prepare('SELECT id FROM projects').all()) this.#seedAuthority(p.id);
  }

  #seedAuthority(projectId){
    const stmt=this.db.prepare('INSERT OR IGNORE INTO authority_rules(id,project_id,content_type,resource_role,priority,notes,created_at) VALUES(?,?,?,?,?,?,?)');
    const t=now(); for(const [contentType,role,priority,notes] of DEFAULT_AUTHORITY_RULES) stmt.run(id('auth'),projectId,contentType,role,priority,notes,t);
  }

  createProject(p) {
    const projectId=id('prj'), t=now();
    this.db.prepare(`INSERT INTO projects(id,name,source_language_code,source_language_name,source_script,target_language_code,target_language_name,target_script,text_direction,canon,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(projectId,p.name,p.sourceLanguageCode||'en',p.sourceLanguageName||'English',p.sourceScript||'Latin',p.targetLanguageCode||null,p.targetLanguageName||null,p.targetScript||null,p.textDirection||'ltr',p.canon||'protestant-66',t,t);
    for (const l of [
      {code:p.sourceLanguageCode||'en',name:p.sourceLanguageName||'English',script:p.sourceScript||'Latin',direction:'ltr',role:'source'},
      ...(p.targetLanguageCode?[{code:p.targetLanguageCode,name:p.targetLanguageName||p.targetLanguageCode,script:p.targetScript||null,direction:p.textDirection||'ltr',role:'target'}]:[])
    ]) this.db.prepare(`INSERT OR IGNORE INTO languages(id,project_id,code,name,script,direction,role,created_at) VALUES(?,?,?,?,?,?,?,?)`).run(id('lang'),projectId,l.code,l.name,l.script,l.direction,l.role,t);
    this.#seedAuthority(projectId);
    return this.getProject(projectId);
  }

  getProject(idv){ return this.db.prepare('SELECT * FROM projects WHERE id=?').get(idv); }
  listProjects(){
    return this.db.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM books b WHERE b.project_id=p.id) book_count,
      (SELECT COUNT(*) FROM content_items c WHERE c.project_id=p.id) item_count
      FROM projects p ORDER BY created_at DESC`).all();
  }
  findFileByHash(projectId,sha,role,lang){ return this.db.prepare('SELECT * FROM import_files WHERE project_id=? AND sha256=? AND resource_role=? AND IFNULL(language_code,\'\')=IFNULL(?,\'\')').get(projectId,sha,role,lang||null); }
  existingByLogicalKey(projectId,key){ return this.db.prepare(`SELECT c.id,c.content_hash,c.current_text,c.raw_text,c.logical_key,c.semantic_key,c.match_key,c.language_code,c.language_role,c.protection_level,c.resource_id,c.source_file_id,r.role resource_role,r.title resource_title FROM content_items c LEFT JOIN resources r ON r.id=c.resource_id WHERE c.project_id=? AND c.logical_key=? AND c.canonical_state='active' LIMIT 1`).get(projectId,key); }
  existingByMatchKey(projectId,languageCode,matchKey){ return this.db.prepare(`SELECT c.id,c.content_hash,c.current_text,c.raw_text,c.logical_key,c.semantic_key,c.match_key,c.language_code,c.language_role,c.protection_level,c.resource_id,c.source_file_id,c.content_type,c.marker,c.category,r.role resource_role,r.title resource_title FROM content_items c LEFT JOIN resources r ON r.id=c.resource_id WHERE c.project_id=? AND IFNULL(c.language_code,'')=IFNULL(?,'') AND c.match_key=? AND c.canonical_state='active' ORDER BY c.created_at DESC LIMIT 1`).get(projectId,languageCode||null,matchKey); }
  authorityPriority(projectId,contentType,resourceRole){ return this.db.prepare('SELECT priority FROM authority_rules WHERE project_id=? AND content_type=? AND resource_role=?').get(projectId,contentType,resourceRole)?.priority??0; }
  listAuthorityRules(projectId){ return this.db.prepare('SELECT * FROM authority_rules WHERE project_id=? ORDER BY content_type,priority DESC,resource_role').all(projectId); }
  startBatch(projectId,summary={}){ const bid=id('batch'); this.db.prepare('INSERT INTO import_batches(id,project_id,created_at,status,summary_json) VALUES(?,?,?,?,?)').run(bid,projectId,now(),'preview',safeJson(summary)); return bid; }

  resolveItemLanguage(project,item,languageCode,resourceRole){
    let languageRole=item.languageRole ?? null;
    if(!languageRole){
      if(/^source(?:_|$)/.test(resourceRole)) languageRole='source';
      else if(/^target(?:_|$)/.test(resourceRole)) languageRole='target';
      else if(languageCode && languageCode===project.source_language_code) languageRole='source';
      else if(languageCode && languageCode===project.target_language_code) languageRole='target';
    }
    let code=languageCode||null;
    if(item.languageRole==='source') code=project.source_language_code||code;
    if(item.languageRole==='target') code=project.target_language_code||code;
    if(!code && languageRole==='source') code=project.source_language_code;
    if(!code && languageRole==='target') code=project.target_language_code;
    return {languageCode:code||null,languageRole};
  }

  scopedLogicalKey(resourceRole, languageCode, semanticKey){ return `${resourceRole}|${languageCode||''}|${semanticKey}`; }

  commitImport({batchId,projectId,filename,format,sha,byteSize,languageCode,resourceRole,sourcePath,parsed}) {
    const t=now(); const fileId=id('file'); const project=this.getProject(projectId);
    if(!project) throw new Error('Project not found');
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`INSERT INTO import_files(id,batch_id,project_id,original_filename,format,sha256,byte_size,language_code,resource_role,imported_at,source_path) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(fileId,batchId,projectId,filename,format,sha,byteSize,languageCode||null,resourceRole,t,sourcePath||null);
      const codes=[...new Set(parsed.items.map(x=>x.bookCode).filter(Boolean))];
      for(const code of codes) this.db.prepare('INSERT OR IGNORE INTO books(id,project_id,book_code,created_at) VALUES(?,?,?,?)').run(id('book'),projectId,code,t);
      const resourceId=id('res'); const mixedLanguage=parsed.items.some(x=>x.languageRole==='source')&&parsed.items.some(x=>x.languageRole==='target');
      this.db.prepare('INSERT INTO resources(id,project_id,language_code,role,book_code,title,source_import_file_id,created_at) VALUES(?,?,?,?,?,?,?,?)').run(resourceId,projectId,mixedLanguage?null:(languageCode||null),resourceRole,codes.length===1?codes[0]:null,filename,fileId,t);
      const stmt=this.db.prepare(`INSERT INTO content_items(id,project_id,resource_id,book_code,chapter,verse,content_type,marker,category,sequence_no,semantic_key,match_key,parent_semantic_key,logical_key,language_code,language_role,protection_level,review_status,canonical_state,current_text,raw_text,normalized_text,content_hash,source_file_id,source_locator,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const conflictStmt=this.db.prepare(`INSERT INTO import_conflicts(id,batch_id,project_id,existing_content_item_id,semantic_key,match_key,language_code,language_role,existing_resource_role,incoming_resource_role,incoming_file_id,incoming_resource_id,incoming_text,incoming_raw_text,incoming_hash,incoming_marker,incoming_category,source_locator,authority_recommendation,authority_reason,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      let inserted=0, skipped=0, changed=0, overlaps=0;
      for(const item of parsed.items) {
        const resolved=this.resolveItemLanguage(project,item,languageCode,resourceRole); const semanticKey=item.semanticKey||item.logicalKey; const matchKey=item.matchKey||semanticKey;
        const scopedKey=this.scopedLogicalKey(resourceRole,resolved.languageCode,semanticKey);
        let existing=this.existingByLogicalKey(projectId,scopedKey); let crossRole=false;
        if(!existing && matchKey && ['scripture','scripture_fragment','footnote','cross_reference','study_note','section_heading','introduction','introduction_heading','introduction_title','outline','figure'].includes(item.contentType)){
          const candidate=this.existingByMatchKey(projectId,resolved.languageCode,matchKey); if(candidate && candidate.resource_role!==resourceRole && shouldAuthorityCrossMatch(item.contentType,candidate.resource_role,resourceRole)){existing=candidate;crossRole=true;}
        }
        if(existing?.content_hash===item.contentHash){skipped++; if(crossRole)overlaps++; continue;}
        if(existing){
          changed++; if(crossRole)overlaps++;
          const oldP=this.authorityPriority(projectId,item.contentType,existing.resource_role||''); const newP=this.authorityPriority(projectId,item.contentType,resourceRole);
          const a=authorityRecommendation({contentType:item.contentType,protectionLevel:existing.protection_level,existingRole:existing.resource_role||'unknown',incomingRole:resourceRole,existingPriority:oldP,incomingPriority:newP});
          conflictStmt.run(id('conf'),batchId,projectId,existing.id,semanticKey,matchKey,resolved.languageCode,resolved.languageRole,existing.resource_role||null,resourceRole,fileId,resourceId,item.currentText||'',item.rawText||'',item.contentHash,item.marker||null,item.category||null,item.sourceLocator||null,a.recommendation,a.reason,'pending',t); continue;
        }
        stmt.run(id('cnt'),projectId,resourceId,item.bookCode||null,item.chapter||null,item.verse||null,item.contentType,item.marker||null,item.category||null,item.sequenceNo||0,semanticKey,matchKey,item.parentSemanticKey||null,scopedKey,resolved.languageCode,resolved.languageRole,item.protectionLevel||'normal','unreviewed','active',item.currentText||'',item.rawText||'',item.normalizedText||'',item.contentHash,fileId,item.sourceLocator||null,t,t); inserted++;
      }
      this.db.prepare('UPDATE import_batches SET status=\'committed\',committed_at=?,summary_json=? WHERE id=?').run(t,safeJson({inserted,skipped,changed,overlaps}),batchId);
      this.db.exec('COMMIT'); return {fileId,resourceId,inserted,skipped,changed,overlaps,books:codes};
    } catch(e){ this.db.exec('ROLLBACK'); throw e; }
  }

  projectStats(projectId){
    const totals=this.db.prepare(`SELECT COUNT(*) items,
      SUM(CASE WHEN protection_level='protected_scripture' THEN 1 ELSE 0 END) protected,
      SUM(CASE WHEN review_status='approved' THEN 1 ELSE 0 END) approved
      FROM content_items WHERE project_id=?`).get(projectId);
    const types=this.db.prepare('SELECT content_type,COUNT(*) count FROM content_items WHERE project_id=? GROUP BY content_type ORDER BY count DESC').all(projectId);
    const books=this.db.prepare(`SELECT b.book_code,b.book_name,
      (SELECT COUNT(*) FROM content_items c WHERE c.project_id=b.project_id AND c.book_code=b.book_code) item_count,
      (SELECT COUNT(DISTINCT chapter) FROM content_items c WHERE c.project_id=b.project_id AND c.book_code=b.book_code AND chapter IS NOT NULL) chapter_count
      FROM books b WHERE b.project_id=? ORDER BY IFNULL(sort_order,999),book_code`).all(projectId);
    const files=this.db.prepare('SELECT id,original_filename,format,language_code,resource_role,imported_at FROM import_files WHERE project_id=? ORDER BY imported_at DESC').all(projectId);
    const issueCounts=this.db.prepare(`SELECT severity,COUNT(*) count FROM qa_issues WHERE project_id=? AND status='open' GROUP BY severity`).all(projectId);
    const conflicts=this.db.prepare(`SELECT COUNT(*) count FROM import_conflicts WHERE project_id=? AND status='pending'`).get(projectId)?.count??0;
    return {totals,types,books,files,issueCounts,conflicts};
  }

  bookSummary(projectId){
    return this.db.prepare(`SELECT b.book_code,b.book_name,
      COUNT(c.id) item_count,
      COUNT(DISTINCT CASE WHEN c.chapter IS NOT NULL THEN c.chapter END) chapter_count,
      SUM(CASE WHEN c.protection_level='protected_scripture' THEN 1 ELSE 0 END) scripture_count
      FROM books b LEFT JOIN content_items c ON c.project_id=b.project_id AND c.book_code=b.book_code
      WHERE b.project_id=? GROUP BY b.id ORDER BY IFNULL(b.sort_order,999),b.book_code`).all(projectId);
  }

  chaptersForBook(projectId,bookCode){
    return this.db.prepare(`SELECT chapter,COUNT(*) item_count,
      SUM(CASE WHEN protection_level='protected_scripture' THEN 1 ELSE 0 END) scripture_count
      FROM content_items WHERE project_id=? AND book_code=? AND chapter IS NOT NULL
      GROUP BY chapter ORDER BY chapter`).all(projectId,bookCode);
  }

  listContent(projectId,{bookCode=null,chapter=null,contentType=null,languageRole=null,limit=300,offset=0}={}){
    const where=['project_id=?']; const args=[projectId];
    if(bookCode){where.push('book_code=?');args.push(bookCode);}
    if(chapter!=null){where.push('chapter=?');args.push(Number(chapter));}
    if(contentType){where.push('content_type=?');args.push(contentType);}
    if(languageRole){where.push('language_role=?');args.push(languageRole);}
    const sql=`SELECT c.id,c.resource_id,c.book_code,c.chapter,c.verse,c.content_type,c.marker,c.category,c.sequence_no,c.semantic_key,c.match_key,c.parent_semantic_key,c.logical_key,c.language_code,c.language_role,c.protection_level,c.review_status,c.canonical_state,c.current_text,c.raw_text,c.source_locator,c.created_at,c.updated_at,r.role resource_role,r.title resource_title
      FROM content_items c LEFT JOIN resources r ON r.id=c.resource_id WHERE ${where.map(x=>'c.'+x).join(' AND ')} ORDER BY c.book_code,c.chapter,c.sequence_no LIMIT ? OFFSET ?`;
    return this.db.prepare(sql).all(...args,Math.min(Number(limit)||300,1000),Number(offset)||0);
  }

  listPairs(projectId,{bookCode=null,chapter=null,contentType=null,limit=250}={}){
    const where=[`project_id=?`]; const args=[projectId];
    if(bookCode){where.push('book_code=?');args.push(bookCode);}
    if(chapter!=null){where.push('chapter=?');args.push(Number(chapter));}
    if(contentType){where.push('content_type=?');args.push(contentType);}
    const pairLimit=Math.min(Number(limit)||250,2500);
    const keys=this.db.prepare(`SELECT semantic_key,MIN(sequence_no) seq FROM content_items WHERE ${where.join(' AND ')} GROUP BY semantic_key ORDER BY MIN(chapter),seq LIMIT ?`).all(...args,pairLimit).map(x=>x.semantic_key);
    if(!keys.length) return [];
    const rows=this.db.prepare(`SELECT id,book_code,chapter,verse,content_type,marker,category,sequence_no,semantic_key,language_code,language_role,protection_level,review_status,current_text,raw_text,source_locator
      FROM content_items WHERE project_id=? AND semantic_key IN (${placeholders(keys.length)}) ORDER BY book_code,chapter,sequence_no`).all(projectId,...keys);
    const groups=new Map(keys.map(k=>[k,null]));
    for(const row of rows){
      const k=row.semantic_key||row.logical_key;
      if(!groups.has(k)) continue;
      if(!groups.get(k)) groups.set(k,{semanticKey:k,bookCode:row.book_code,chapter:row.chapter,verse:row.verse,contentType:row.content_type,marker:row.marker,category:row.category,source:null,target:null,other:[]});
      const g=groups.get(k);
      if(row.language_role==='source') g.source=row;
      else if(row.language_role==='target') g.target=row;
      else g.other.push(row);
    }
    return keys.map(k=>groups.get(k)).filter(Boolean);
  }

  listConflicts(projectId,status='pending'){
    const where=['c.project_id=?'];const args=[projectId]; if(status&&status!=='all'){where.push('c.status=?');args.push(status);}
    return this.db.prepare(`SELECT c.*,e.current_text existing_text,e.raw_text existing_raw_text,e.protection_level,e.book_code,e.chapter,e.verse,e.content_type,e.marker existing_marker,e.category existing_category,e.review_status,
      er.role existing_role,er.title existing_resource,ifr.original_filename incoming_filename
      FROM import_conflicts c JOIN content_items e ON e.id=c.existing_content_item_id LEFT JOIN resources er ON er.id=e.resource_id LEFT JOIN import_files ifr ON ifr.id=c.incoming_file_id
      WHERE ${where.join(' AND ')} ORDER BY CASE c.authority_recommendation WHEN 'use_incoming' THEN 1 WHEN 'manual_review' THEN 2 ELSE 3 END,c.created_at DESC`).all(...args);
  }

  resolveConflict(projectId,conflictId,{action,actor='Human editor',reason='',mergedText=null,confirmProtected=false}={}){
    const allowed=new Set(['keep_existing','use_incoming','manual_merge']); if(!allowed.has(action)) throw new Error('Invalid conflict resolution action');
    const c=this.db.prepare(`SELECT c.*,e.current_text existing_text,e.raw_text existing_raw_text,e.content_hash existing_hash,e.protection_level,e.review_status FROM import_conflicts c JOIN content_items e ON e.id=c.existing_content_item_id WHERE c.id=? AND c.project_id=?`).get(conflictId,projectId);
    if(!c) throw new Error('Conflict not found'); if(c.status!=='pending') throw new Error('Conflict is already resolved');
    if(c.protection_level==='protected_scripture' && action!=='keep_existing' && !confirmProtected) throw new Error('Protected Scripture requires explicit human confirmation');
    if((action==='use_incoming'||action==='manual_merge') && !String(reason||'').trim()) throw new Error('A human reason is required when changing existing content');
    const t=now(); this.db.exec('BEGIN');
    try{
      if(action==='use_incoming'||action==='manual_merge'){
        const next=this.db.prepare('SELECT IFNULL(MAX(revision_no),0)+1 n FROM content_versions WHERE content_item_id=?').get(c.existing_content_item_id).n;
        this.db.prepare('INSERT INTO content_versions(id,content_item_id,revision_no,text,change_type,changed_by,reason,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id('ver'),c.existing_content_item_id,next,c.existing_text,action,actor,reason,t);
        const text=action==='manual_merge'?String(mergedText??''):c.incoming_text; if(action==='manual_merge'&&!text.trim())throw new Error('Merged text is required');
        this.db.prepare(`UPDATE content_items SET current_text=?,raw_text=?,normalized_text=?,content_hash=?,review_status='needs_review',resource_id=COALESCE(?,resource_id),source_file_id=COALESCE(?,source_file_id),source_locator=COALESCE(?,source_locator),updated_at=? WHERE id=?`)
          .run(text,action==='manual_merge'?text:c.incoming_raw_text,text.normalize('NFC').trim(),sha256(text.normalize('NFC').trim()),c.incoming_resource_id,c.incoming_file_id,c.source_locator,t,c.existing_content_item_id);
      }
      this.db.prepare(`UPDATE import_conflicts SET status=?,resolution_reason=?,resolved_by=?,resolved_at=? WHERE id=? AND project_id=?`).run(action,reason||null,actor,t,conflictId,projectId);
      this.db.exec('COMMIT'); return this.db.prepare('SELECT * FROM import_conflicts WHERE id=?').get(conflictId);
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }

  listIssues(projectId,{status='open',severity=null,limit=500}={}){
    const where=['q.project_id=?'];const args=[projectId];
    if(status&&status!=='all'){where.push('q.status=?');args.push(status);}
    if(severity){where.push('q.severity=?');args.push(severity);}
    return this.db.prepare(`SELECT q.*,c.book_code,c.chapter,c.verse,c.content_type,c.current_text,p.current_text paired_text
      FROM qa_issues q LEFT JOIN content_items c ON c.id=q.content_item_id LEFT JOIN content_items p ON p.id=q.paired_content_item_id
      WHERE ${where.join(' AND ')} ORDER BY CASE q.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,q.created_at DESC LIMIT ?`).all(...args,Math.min(Number(limit)||500,1000));
  }

  clearEngineIssues(projectId,engine){ this.db.prepare(`DELETE FROM qa_issues WHERE project_id=? AND engine=? AND status='open'`).run(projectId,engine); }
  createIssue(issue){
    const qid=id('qa'),t=now();
    this.db.prepare(`INSERT OR IGNORE INTO qa_issues(id,project_id,content_item_id,paired_content_item_id,fingerprint,category,severity,confidence,status,engine,message,evidence_json,suggested_text,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(qid,issue.projectId,issue.contentItemId||null,issue.pairedContentItemId||null,issue.fingerprint||null,issue.category,issue.severity,issue.confidence??null,'open',issue.engine,issue.message,safeJson(issue.evidence||{}),issue.suggestedText||null,t);
    return qid;
  }
  setIssueStatus(projectId,issueId,status){
    const allowed=new Set(['open','accepted','rejected','resolved','deferred']); if(!allowed.has(status)) throw new Error('Invalid issue status');
    this.db.prepare(`UPDATE qa_issues SET status=?,resolved_at=? WHERE id=? AND project_id=?`).run(status,status==='open'?null:now(),issueId,projectId);
    return this.db.prepare('SELECT * FROM qa_issues WHERE id=? AND project_id=?').get(issueId,projectId);
  }

  vocabulary(projectId,languageCode,limit=80){
    const rows=this.db.prepare(`SELECT current_text FROM content_items WHERE project_id=? AND language_code=? AND current_text<>''`).all(projectId,languageCode);
    const counts=new Map();
    for(const r of rows){
      const words=r.current_text.normalize('NFC').replace(/\\[A-Za-z0-9]+\*?/g,' ').match(/[\p{L}\p{M}]+/gu)||[];
      for(const w of words){ const key=w; counts.set(key,(counts.get(key)||0)+1); }
    }
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,Math.min(limit,500)).map(([word,count])=>({word,count}));
  }

  listRules(projectId){ return this.db.prepare(`SELECT * FROM editorial_rules WHERE project_id=? ORDER BY status='approved' DESC,evidence_count DESC,created_at DESC LIMIT 500`).all(projectId); }
  listGlossary(projectId){ return this.db.prepare(`SELECT * FROM glossary_terms WHERE project_id=? ORDER BY status='approved' DESC,evidence_count DESC,source_term,target_term LIMIT 500`).all(projectId); }

  exportRows(projectId,{bookCode=null,languageCode=null,resourceRole=null}={}){
    const where=['c.project_id=?',"c.canonical_state='active'"];const args=[projectId];
    if(bookCode){where.push('c.book_code=?');args.push(bookCode);}
    if(languageCode){where.push('c.language_code=?');args.push(languageCode);}
    if(resourceRole){where.push('r.role=?');args.push(resourceRole);}
    return this.db.prepare(`SELECT c.*,r.role resource_role,r.title resource_title FROM content_items c LEFT JOIN resources r ON r.id=c.resource_id WHERE ${where.join(' AND ')} ORDER BY c.book_code,c.chapter,c.sequence_no`).all(...args);
  }

  close(){this.db.close();}
}
