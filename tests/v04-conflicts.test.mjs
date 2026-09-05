import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { Store } from '../src/core/db.mjs';import { previewImport } from '../src/core/importer.mjs';
function setup(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v04-conf-'));const store=new Store(path.join(d,'x.db'));const project=store.createProject({name:'T',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil'});return{d,store,project};}
function imp(x,name,text,lang,role){const f=path.join(x.d,name);fs.writeFileSync(f,text);const p=previewImport(x.store,{projectId:x.project.id,filePath:f,languageCode:lang,resourceRole:role});const c=x.store.commitImport({batchId:p.batchId,projectId:x.project.id,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode:lang,resourceRole:role,parsed:p.parsed});return{p,c};}

test('authority rules prefer corrected standalone footnotes over footnotes embedded in Scripture',()=>{
  const x=setup();imp(x,'embedded.sfm','\\id MAT\n\\c 1\n\\v 1 Text \\f + \\fr 1:1 \\ft Embedded note\\f*\n','ta','target_scripture');
  const bid=x.store.startBatch(x.project.id,{});const parsed={items:[{bookCode:'MAT',chapter:1,verse:'1',contentType:'footnote',sequenceNo:0,semanticKey:'DOC|F1',matchKey:'MAT|1|1|footnote|0',languageRole:'target',currentText:'Corrected note',rawText:'Corrected note',normalizedText:'Corrected note',contentHash:'corrected-hash',protectionLevel:'normal'}]};
  x.store.commitImport({batchId:bid,projectId:x.project.id,filename:'corrected.docx',format:'docx',sha:'corrected-file',byteSize:20,languageCode:null,resourceRole:'footnotes',parsed});
  const c=x.store.listConflicts(x.project.id)[0];assert.equal(c.existing_resource_role,'target_scripture');assert.equal(c.incoming_resource_role,'footnotes');assert.equal(c.authority_recommendation,'use_incoming');
  x.store.close();
});

test('using incoming non-Scripture conflict records a version and requires a reason',()=>{
  const x=setup();const bid1=x.store.startBatch(x.project.id,{});const item=t=>({bookCode:'MAT',chapter:1,verse:'1',contentType:'footnote',sequenceNo:0,semanticKey:'F1',matchKey:'MAT|1|1|footnote|0',languageRole:'target',currentText:t,rawText:t,normalizedText:t,contentHash:t,protectionLevel:'normal'});
  x.store.commitImport({batchId:bid1,projectId:x.project.id,filename:'a.docx',format:'docx',sha:'a',byteSize:1,resourceRole:'footnotes',parsed:{items:[item('Old')]}});
  const bid2=x.store.startBatch(x.project.id,{});x.store.commitImport({batchId:bid2,projectId:x.project.id,filename:'b.docx',format:'docx',sha:'b',byteSize:1,resourceRole:'footnotes',parsed:{items:[item('New')]}});
  const c=x.store.listConflicts(x.project.id)[0];assert.throws(()=>x.store.resolveConflict(x.project.id,c.id,{action:'use_incoming'}),/reason/i);
  x.store.resolveConflict(x.project.id,c.id,{action:'use_incoming',actor:'Editor A',reason:'Professionally corrected footnote'});
  const row=x.store.listContent(x.project.id,{contentType:'footnote'})[0];assert.equal(row.current_text,'New');assert.equal(row.review_status,'needs_review');
  const versions=x.store.db.prepare('SELECT * FROM content_versions WHERE content_item_id=?').all(row.id);assert.equal(versions.length,1);assert.equal(versions[0].text,'Old');
  x.store.close();
});

test('protected Scripture can never be replaced without explicit human confirmation',()=>{
  const x=setup();imp(x,'a.sfm','\\id MAT\n\\c 1\n\\v 1 Old Scripture\n','ta','target_scripture');imp(x,'b.sfm','\\id MAT\n\\c 1\n\\v 1 New Scripture\n','ta','target_scripture');
  const c=x.store.listConflicts(x.project.id).find(c=>c.content_type==='scripture');assert.ok(c);assert.equal(c.authority_recommendation,'manual_review');
  assert.throws(()=>x.store.resolveConflict(x.project.id,c.id,{action:'use_incoming',actor:'Editor',reason:'Verified correction'}),/explicit human confirmation/i);
  x.store.resolveConflict(x.project.id,c.id,{action:'use_incoming',actor:'Editor',reason:'Verified against authoritative Tamil Scripture',confirmProtected:true});
  const row=x.store.listContent(x.project.id,{contentType:'scripture'})[0];assert.equal(row.current_text,'New Scripture');assert.equal(row.review_status,'needs_review');
  x.store.close();
});
