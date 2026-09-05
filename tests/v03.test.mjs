import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/core/db.mjs';
import { previewImport } from '../src/core/importer.mjs';
import { runLocalQa } from '../src/core/qa-engine.mjs';

function setup(){
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v03-'));
  const store=new Store(path.join(d,'test.db'));
  const project=store.createProject({name:'Tamil Study Bible',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil',targetScript:'Tamil'});
  return {d,store,project};
}
function importSfm(ctx,name,text,languageCode,resourceRole){
  const f=path.join(ctx.d,name);fs.writeFileSync(f,text,'utf8');
  const p=previewImport(ctx.store,{projectId:ctx.project.id,filePath:f,languageCode,resourceRole});
  const c=ctx.store.commitImport({batchId:p.batchId,projectId:ctx.project.id,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode,resourceRole,parsed:p.parsed});
  return {preview:p,commit:c};
}

test('source and target Scripture pair by semantic key across separate resource roles',()=>{
  const x=setup();
  importSfm(x,'source.sfm','\\id MAT\n\\c 1\n\\v 1 Source text\n','en','source_scripture');
  importSfm(x,'target.sfm','\\id MAT\n\\c 1\n\\v 1 இலக்கு உரை\n','ta','target_scripture');
  const pairs=x.store.listPairs(x.project.id,{bookCode:'MAT',chapter:1,contentType:'scripture'});
  assert.equal(pairs.length,1);
  assert.equal(pairs[0].source.current_text,'Source text');
  assert.equal(pairs[0].target.current_text,'இலக்கு உரை');
  assert.equal(pairs[0].target.protection_level,'protected_scripture');
  x.store.close();
});

test('bilingual parsed rows resolve source and target languages independently',()=>{
  const x=setup();
  const bid=x.store.startBatch(x.project.id,{});
  const parsed={items:[
    {bookCode:'MAT',chapter:1,verse:'1',contentType:'study_note',sequenceNo:0,semanticKey:'DOCX|MAT|1|1|study_note|1',logicalKey:'same',languageRole:'source',currentText:'English note',rawText:'English note',normalizedText:'English note',contentHash:'hash-en',protectionLevel:'normal'},
    {bookCode:'MAT',chapter:1,verse:'1',contentType:'study_note',sequenceNo:1,semanticKey:'DOCX|MAT|1|1|study_note|1',logicalKey:'same',languageRole:'target',currentText:'தமிழ் குறிப்பு',rawText:'தமிழ் குறிப்பு',normalizedText:'தமிழ் குறிப்பு',contentHash:'hash-ta',protectionLevel:'normal'}
  ]};
  x.store.commitImport({batchId:bid,projectId:x.project.id,filename:'notes.docx',format:'docx',sha:'sha-bilingual',byteSize:10,languageCode:null,resourceRole:'study_notes',parsed});
  const rows=x.store.listContent(x.project.id,{bookCode:'MAT',chapter:1,contentType:'study_note'});
  assert.equal(rows.length,2);
  assert.equal(rows.find(r=>r.language_role==='source').language_code,'en');
  assert.equal(rows.find(r=>r.language_role==='target').language_code,'ta');
  x.store.close();
});

test('changed imports are persisted as review conflicts and never overwrite Scripture',()=>{
  const x=setup();
  importSfm(x,'target.sfm','\\id MAT\n\\c 1\n\\v 1 Original\n','ta','target_scripture');
  const f=path.join(x.d,'target2.sfm');fs.writeFileSync(f,'\\id MAT\n\\c 1\n\\v 1 Changed\n');
  const p=previewImport(x.store,{projectId:x.project.id,filePath:f,languageCode:'ta',resourceRole:'target_scripture'});
  assert.ok(p.duplicateSummary.changedItems>=1);
  x.store.commitImport({batchId:p.batchId,projectId:x.project.id,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode:'ta',resourceRole:'target_scripture',parsed:p.parsed});
  const scripture=x.store.listContent(x.project.id,{bookCode:'MAT',chapter:1,contentType:'scripture'});
  assert.equal(scripture.length,1);
  assert.equal(scripture[0].current_text,'Original');
  const conflicts=x.store.listConflicts(x.project.id);
  assert.equal(conflicts.length,1);
  assert.equal(conflicts[0].incoming_text,'Changed');
  assert.equal(conflicts[0].protection_level,'protected_scripture');
  x.store.close();
});

test('local QA detects numeric mismatch and reports target-only Scripture as versification info',()=>{
  const x=setup();
  importSfm(x,'source.sfm','\\id MAT\n\\c 1\n\\v 1 Value 1/16\n','en','source_scripture');
  importSfm(x,'target.sfm','\\id MAT\n\\c 1\n\\v 1 மதிப்பு 1/64\n\\v 2 கூடுதல் வசனம்\n','ta','target_scripture');
  const result=runLocalQa(x.store,x.project.id);
  assert.ok(result.byCategory.number_mismatch>=1);
  assert.ok(result.byCategory.versification_difference>=1);
  const issues=x.store.listIssues(x.project.id,{status:'open'});
  assert.equal(issues.find(i=>i.category==='versification_difference').severity,'info');
  x.store.close();
});

test('local QA detects zero-width Unicode and malformed marker spacing',()=>{
  const x=setup();
  const bid=x.store.startBatch(x.project.id,{});
  const parsed={items:[{bookCode:'MAT',chapter:1,verse:'1',contentType:'study_note',sequenceNo:0,semanticKey:'Z1',currentText:'தமிழ்\u200B உரை',rawText:'\\ fq * தமிழ்\u200B உரை',normalizedText:'தமிழ்\u200B உரை',contentHash:'z',protectionLevel:'normal',languageRole:'target'}]};
  x.store.commitImport({batchId:bid,projectId:x.project.id,filename:'bad.docx',format:'docx',sha:'z-sha',byteSize:1,languageCode:null,resourceRole:'study_notes',parsed});
  const result=runLocalQa(x.store,x.project.id);
  assert.ok(result.byCategory.unicode_zero_width>=1);
  assert.ok(result.byCategory.usfm_marker_spacing>=1);
  x.store.close();
});
