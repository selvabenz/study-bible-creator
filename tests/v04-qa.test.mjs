import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import { Store } from '../src/core/db.mjs';import { runLocalQa } from '../src/core/qa-engine.mjs';
function setup(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v04-qa-'));const store=new Store(path.join(d,'x.db'));const project=store.createProject({name:'T',sourceLanguageCode:'en',targetLanguageCode:'ta',targetLanguageName:'Tamil'});return{store,project};}
function add(x,items){const bid=x.store.startBatch(x.project.id,{});x.store.commitImport({batchId:bid,projectId:x.project.id,filename:`${Math.random()}.docx`,format:'docx',sha:`${Math.random()}`,byteSize:1,resourceRole:'study_notes',parsed:{items}});}
const item=(sem,role,text,raw=text,extras={})=>({bookCode:'MAT',chapter:1,verse:'1',contentType:'study_note',sequenceNo:0,semanticKey:sem,matchKey:sem,languageRole:role,currentText:text,rawText:raw,normalizedText:text,contentHash:`${sem}-${role}-${text}`,protectionLevel:'normal',...extras});

test('v0.4 QA detects replacement/control characters, marker balance and invalid chapter anchors',()=>{
  const x=setup();add(x,[item('A','target','bad\uFFFD\u0001','\\f + note',{chapter:29})]);const r=runLocalQa(x.store,x.project.id);
  assert.ok(r.byCategory.unicode_replacement_character>=1);assert.ok(r.byCategory.invalid_control_character>=1);assert.ok(r.byCategory.usfm_marker_balance>=1);assert.ok(r.byCategory.invalid_chapter_anchor>=1);x.store.close();
});

test('v0.4 QA detects empty target and inline marker sequence mismatch without changing content',()=>{
  const x=setup();add(x,[item('N','source','Source','\\fq word\\fq*'),item('N','target','','\\fq word')]);const before=x.store.listContent(x.project.id,{contentType:'study_note'}).map(x=>x.current_text);const r=runLocalQa(x.store,x.project.id);const after=x.store.listContent(x.project.id,{contentType:'study_note'}).map(x=>x.current_text);
  assert.ok(r.byCategory.empty_target_content>=1);assert.ok(r.byCategory.usfm_marker_sequence_mismatch>=1);assert.deepEqual(after,before);x.store.close();
});
