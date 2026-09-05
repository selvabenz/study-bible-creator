import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectFormat, parseFile } from '../src/core/parse-file.mjs';
import { parseUsfm } from '../src/core/usfm-parser.mjs';
import { Store } from '../src/core/db.mjs';
import { previewImport } from '../src/core/importer.mjs';

function tempDir(){ return fs.mkdtempSync(path.join(os.tmpdir(),'sbc-edge-')); }

test('format detection recognizes all supported extensions including legacy DOC',()=>{
  const cases={
    'a.usfm':'usfm','a.SFM':'sfm','a.csv':'csv','a.TSV':'tsv','a.json':'json','a.docx':'docx','a.DOC':'doc'
  };
  for(const [name,expected] of Object.entries(cases)) assert.equal(detectFormat(name),expected);
  assert.throws(()=>detectFormat('a.pdf'),/Unsupported format/);
});

test('legacy DOC extension is recognized but malformed binary content is rejected safely',()=>{
  const d=tempDir(); const f=path.join(d,'bad.doc');
  fs.writeFileSync(f,'not a Word binary document');
  assert.throws(()=>parseFile(f),/not a recognized Microsoft Word binary DOC file|too small/);
});

test('USFM parser accepts UTF-8 BOM and CRLF without losing book/chapter/verse identity',()=>{
  const p=parseUsfm(Buffer.from('\uFEFF\\id MAT Test\r\n\\c 1\r\n\\v 1 Text\r\n','utf8'));
  assert.equal(p.bookCode,'MAT');
  assert.deepEqual(p.chapters,[1]);
  assert.equal(p.verses,1);
  assert.equal(p.items.find(x=>x.contentType==='scripture').currentText,'Text');
});

test('unclosed inline footnote and cross-reference produce warnings instead of silent loss',()=>{
  const p=parseUsfm(Buffer.from('\\id MAT\n\\c 1\n\\v 1 Text \\f + \\ft note\n\\v 2 Text \\x + \\xt Gen 1:1\n'));
  assert.equal(p.warnings.filter(x=>x.type==='unclosed_footnote').length,1);
  assert.equal(p.warnings.filter(x=>x.type==='unclosed_cross_reference').length,1);
  assert.equal(p.items.filter(x=>x.contentType==='scripture').every(x=>x.protectionLevel==='protected_scripture'),true);
});

test('same bytes in a different resource role are not treated as an exact duplicate file',()=>{
  const d=tempDir(); const store=new Store(path.join(d,'x.db'));
  const prj=store.createProject({name:'Test',targetLanguageCode:'ta',targetLanguageName:'Tamil'});
  const f=path.join(d,'MAT.sfm'); fs.writeFileSync(f,'\\id MAT\n\\c 1\n\\v 1 Test');
  const a=previewImport(store,{projectId:prj.id,filePath:f,languageCode:'ta',resourceRole:'target_scripture'});
  store.commitImport({batchId:a.batchId,projectId:prj.id,filename:a.filename,format:a.format,sha:a.sha,byteSize:a.byteSize,languageCode:'ta',resourceRole:'target_scripture',parsed:a.parsed});
  const b=previewImport(store,{projectId:prj.id,filePath:f,languageCode:'ta',resourceRole:'study_notes'});
  assert.equal(b.exactDuplicate,false);
  store.close();
});

test('changed logical records are reported as conflicts and do not silently overwrite existing content',()=>{
  const d=tempDir(); const store=new Store(path.join(d,'x.db'));
  const prj=store.createProject({name:'Test',targetLanguageCode:'ta',targetLanguageName:'Tamil'});
  const f=path.join(d,'MAT.sfm');
  fs.writeFileSync(f,'\\id MAT\n\\c 1\n\\v 1 Original');
  const a=previewImport(store,{projectId:prj.id,filePath:f,languageCode:'ta',resourceRole:'target_scripture'});
  store.commitImport({batchId:a.batchId,projectId:prj.id,filename:a.filename,format:a.format,sha:a.sha,byteSize:a.byteSize,languageCode:'ta',resourceRole:'target_scripture',parsed:a.parsed});
  const before=store.db.prepare("SELECT current_text FROM content_items WHERE project_id=? AND content_type='scripture'").get(prj.id).current_text;
  fs.writeFileSync(f,'\\id MAT\n\\c 1\n\\v 1 Changed');
  const b=previewImport(store,{projectId:prj.id,filePath:f,languageCode:'ta',resourceRole:'target_scripture'});
  assert.equal(b.exactDuplicate,false);
  assert.ok(b.duplicateSummary.changedItems>=1);
  const c=store.commitImport({batchId:b.batchId,projectId:prj.id,filename:b.filename,format:b.format,sha:b.sha,byteSize:b.byteSize,languageCode:'ta',resourceRole:'target_scripture',parsed:b.parsed});
  assert.ok(c.changed>=1);
  const after=store.db.prepare("SELECT current_text FROM content_items WHERE project_id=? AND content_type='scripture'").get(prj.id).current_text;
  assert.equal(before,'Original');
  assert.equal(after,'Original');
  store.close();
});
