import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Store } from '../src/core/db.mjs';
import { previewImport } from '../src/core/importer.mjs';
import { parseFile } from '../src/core/parse-file.mjs';
import { runLocalQa } from '../src/core/qa-engine.mjs';

const source=process.env.SBC_MAT_SOURCE;
const target=process.env.SBC_MAT_TARGET;
const corr=process.env.SBC_MAT_CORRECTIONS_DIR;
const legacy=process.env.SBC_MAT_LEGACY_DOC_DIR;
const maps=process.env.SBC_MAT_MAPS_DIR;
if(!source||!target){console.log('SKIP: Set SBC_MAT_SOURCE and SBC_MAT_TARGET to run the real Matthew smoke test.');process.exit(0)}

const d=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-mat-v04-smoke-'));
const store=new Store(path.join(d,'smoke.db'));
const project=store.createProject({name:'Matthew Smoke',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil',targetScript:'Tamil'});
function importFile(file,languageCode,resourceRole){const p=previewImport(store,{projectId:project.id,filePath:file,languageCode,resourceRole});assert.equal(p.exactDuplicate,false);const c=store.commitImport({batchId:p.batchId,projectId:project.id,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode,resourceRole,parsed:p.parsed});return {p,c}}

const en=importFile(source,'en','source_scripture');
const ta=importFile(target,'ta','target_scripture');
assert.equal(en.p.parsedSummary.bookCode,'MAT');assert.equal(ta.p.parsedSummary.bookCode,'MAT');
assert.equal(en.p.parsedSummary.verses,1067);assert.equal(ta.p.parsedSummary.verses,1071);
const scripturePairs=store.listPairs(project.id,{bookCode:'MAT',contentType:'scripture',limit:2500});
assert.equal(scripturePairs.filter(x=>x.source&&x.target).length,1067);
assert.equal(scripturePairs.filter(x=>!x.source&&x.target).length,4);

const correctionReport=[];
if(corr&&fs.existsSync(corr)){
  const files=fs.readdirSync(corr).filter(x=>x.toLowerCase().endsWith('.docx')).sort();
  for(const name of files){
    const f=path.join(corr,name);const low=name.toLowerCase();const role=low.includes('cross')?'cross_references':low.includes('foot')?'footnotes':low.includes('intro')?'introductions':'study_notes';
    const r=importFile(f,null,role); correctionReport.push({name,items:r.p.parsedSummary.items,source:r.p.parsedSummary.languageBreakdown.source,target:r.p.parsedSummary.languageBreakdown.target});
    assert.ok(r.p.parsedSummary.languageBreakdown.source>0);assert.ok(r.p.parsedSummary.languageBreakdown.target>0);
  }
}

const legacyComparisons=[];
if(legacy&&corr&&fs.existsSync(legacy)&&fs.existsSync(corr)){
  for(const name of fs.readdirSync(legacy).filter(x=>x.toLowerCase().endsWith('.doc')).sort()){
    const doc=path.join(legacy,name),docx=path.join(corr,name+'x');if(!fs.existsSync(docx))continue;
    const a=parseFile(doc),b=parseFile(docx);legacyComparisons.push({name,docItems:a.items.length,docxItems:b.items.length});assert.equal(a.items.length,b.items.length);
    assert.deepEqual(a.items.map(x=>[x.semanticKey,x.languageRole,x.currentText]),b.items.map(x=>[x.semanticKey,x.languageRole,x.currentText]));
  }
}

let mapDocs=0;
if(maps&&fs.existsSync(maps)){
  for(const name of fs.readdirSync(maps).filter(x=>x.toLowerCase().endsWith('.docx'))){const p=parseFile(path.join(maps,name));assert.ok(p.items.length>0);mapDocs++;}
}

const qa=runLocalQa(store,project.id);
const issues=store.listIssues(project.id,{status:'open',limit:1000});
assert.equal(store.db.prepare(`SELECT COUNT(*) n FROM qa_issues WHERE project_id=? AND status='open' AND category='versification_difference'`).get(project.id).n,4);
const conflicts=store.listConflicts(project.id,'pending');
assert.ok(conflicts.length>0);
assert.ok(conflicts.some(x=>x.incoming_resource_role==='footnotes'&&x.authority_recommendation==='use_incoming'));
assert.ok(conflicts.some(x=>x.incoming_resource_role==='cross_references'&&x.authority_recommendation==='use_incoming'));
assert.equal(store.listContent(project.id,{bookCode:'MAT',contentType:'scripture',limit:1000}).some(x=>x.current_text===''),false);
const stats=store.projectStats(project.id);
const authoritySummary=store.db.prepare(`SELECT incoming_resource_role,authority_recommendation,COUNT(*) count FROM import_conflicts WHERE project_id=? AND status='pending' GROUP BY incoming_resource_role,authority_recommendation ORDER BY incoming_resource_role,authority_recommendation`).all(project.id);
const result={authoritySummary,pendingConflicts:conflicts.length,sourceVerses:en.p.parsedSummary.verses,targetVerses:ta.p.parsedSummary.verses,pairedScripture:scripturePairs.filter(x=>x.source&&x.target).length,targetOnlyScripture:scripturePairs.filter(x=>!x.source&&x.target).map(x=>`${x.bookCode} ${x.chapter}:${x.verse}`),corrections:correctionReport,legacyComparisons,mapDocs,dbItems:stats.totals.items,protected:stats.totals.protected,qa};
console.log(JSON.stringify(result,null,2));
store.close();fs.rmSync(d,{recursive:true,force:true});
