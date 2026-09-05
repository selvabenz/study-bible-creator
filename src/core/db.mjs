import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { id, now, safeJson } from './utils.mjs';
const __dirname=path.dirname(fileURLToPath(import.meta.url));

export class Store {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath),{recursive:true});
    this.db=new DatabaseSync(dbPath);
    this.db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
  }
  createProject(p) {
    const projectId=id('prj'), t=now();
    this.db.prepare(`INSERT INTO projects(id,name,source_language_code,source_language_name,target_language_code,target_language_name,target_script,text_direction,canon,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(projectId,p.name,p.sourceLanguageCode||'en',p.sourceLanguageName||'English',p.targetLanguageCode||null,p.targetLanguageName||null,p.targetScript||null,p.textDirection||'ltr',p.canon||'protestant-66',t,t);
    for (const l of [
      {code:p.sourceLanguageCode||'en',name:p.sourceLanguageName||'English',script:p.sourceScript||'Latin',direction:'ltr',role:'source'},
      ...(p.targetLanguageCode?[{code:p.targetLanguageCode,name:p.targetLanguageName||p.targetLanguageCode,script:p.targetScript||null,direction:p.textDirection||'ltr',role:'target'}]:[])
    ]) this.db.prepare(`INSERT OR IGNORE INTO languages(id,project_id,code,name,script,direction,role,created_at) VALUES(?,?,?,?,?,?,?,?)`).run(id('lang'),projectId,l.code,l.name,l.script,l.direction,l.role,t);
    return this.getProject(projectId);
  }
  getProject(idv){ return this.db.prepare('SELECT * FROM projects WHERE id=?').get(idv); }
  listProjects(){ return this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all(); }
  findFileByHash(projectId,sha,role,lang){ return this.db.prepare('SELECT * FROM import_files WHERE project_id=? AND sha256=? AND resource_role=? AND IFNULL(language_code,\'\')=IFNULL(?,\'\')').get(projectId,sha,role,lang||null); }
  existingByLogicalKey(projectId,key){ return this.db.prepare('SELECT id,content_hash,current_text,logical_key FROM content_items WHERE project_id=? AND logical_key=? LIMIT 1').get(projectId,key); }
  startBatch(projectId,summary={}){ const bid=id('batch'); this.db.prepare('INSERT INTO import_batches(id,project_id,created_at,status,summary_json) VALUES(?,?,?,?,?)').run(bid,projectId,now(),'preview',safeJson(summary)); return bid; }
  commitImport({batchId,projectId,filename,format,sha,byteSize,languageCode,resourceRole,sourcePath,parsed}) {
    const t=now(); const fileId=id('file');
    this.db.exec('BEGIN');
    try {
      this.db.prepare(`INSERT INTO import_files(id,batch_id,project_id,original_filename,format,sha256,byte_size,language_code,resource_role,imported_at,source_path) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(fileId,batchId,projectId,filename,format,sha,byteSize,languageCode||null,resourceRole,t,sourcePath||null);
      const codes=[...new Set(parsed.items.map(x=>x.bookCode).filter(Boolean))];
      for(const code of codes) this.db.prepare('INSERT OR IGNORE INTO books(id,project_id,book_code,created_at) VALUES(?,?,?,?)').run(id('book'),projectId,code,t);
      const resourceId=id('res'); this.db.prepare('INSERT INTO resources(id,project_id,language_code,role,book_code,title,source_import_file_id,created_at) VALUES(?,?,?,?,?,?,?,?)').run(resourceId,projectId,languageCode||null,resourceRole,codes.length===1?codes[0]:null,filename,fileId,t);
      const stmt=this.db.prepare(`INSERT INTO content_items(id,project_id,resource_id,book_code,chapter,verse,content_type,marker,category,sequence_no,logical_key,language_code,protection_level,current_text,raw_text,normalized_text,content_hash,source_file_id,source_locator,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      let inserted=0, skipped=0, changed=0;
      for(const item of parsed.items) {
        const scopedKey=`${resourceRole}|${languageCode||''}|${item.logicalKey}`;
        const existing=this.existingByLogicalKey(projectId,scopedKey);
        if(existing?.content_hash===item.contentHash){skipped++;continue;}
        if(existing){changed++; continue;} // v0.1 preserves existing; comparison UI will handle replacement in next milestone
        stmt.run(id('cnt'),projectId,resourceId,item.bookCode||null,item.chapter||null,item.verse||null,item.contentType,item.marker||null,item.category||null,item.sequenceNo||0,scopedKey,languageCode||null,item.protectionLevel||'normal',item.currentText||'',item.rawText||'',item.normalizedText||'',item.contentHash,fileId,item.sourceLocator||null,t,t); inserted++;
      }
      this.db.prepare('UPDATE import_batches SET status=\'committed\',committed_at=?,summary_json=? WHERE id=?').run(t,safeJson({inserted,skipped,changed}),batchId);
      this.db.exec('COMMIT');
      return {fileId,resourceId,inserted,skipped,changed,books:codes};
    } catch(e){ this.db.exec('ROLLBACK'); throw e; }
  }
  projectStats(projectId){
    const totals=this.db.prepare('SELECT COUNT(*) items, SUM(CASE WHEN protection_level=\'protected_scripture\' THEN 1 ELSE 0 END) protected FROM content_items WHERE project_id=?').get(projectId);
    const types=this.db.prepare('SELECT content_type,COUNT(*) count FROM content_items WHERE project_id=? GROUP BY content_type ORDER BY count DESC').all(projectId);
    const books=this.db.prepare('SELECT book_code FROM books WHERE project_id=? ORDER BY sort_order,book_code').all(projectId);
    const files=this.db.prepare('SELECT original_filename,format,language_code,resource_role,imported_at FROM import_files WHERE project_id=? ORDER BY imported_at DESC').all(projectId);
    return {totals,types,books,files};
  }
  close(){this.db.close();}
}
