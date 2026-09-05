import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {parseFile} from '../src/core/parse-file.mjs';import {exportItems} from '../src/core/exporter.mjs';
const source=process.env.SBC_MAT_SOURCE,target=process.env.SBC_MAT_TARGET,corr=process.env.SBC_MAT_CORRECTIONS_DIR,legacy=process.env.SBC_MAT_LEGACY_DOC_DIR;
if(!source||!target||!corr){console.log('SKIP: set SBC_MAT_SOURCE, SBC_MAT_TARGET and SBC_MAT_CORRECTIONS_DIR');process.exit(0)}
const d=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v04-rt-mat-'));const report={sfm:[],corrections:[],legacy:[]};
for(const f of [source,target]){const a=parseFile(f);const out=path.join(d,path.basename(f)+'.roundtrip.sfm');exportItems(a.items,'sfm',out);const b=parseFile(out);const ac=a.items.filter(x=>x.contentType==='scripture'),bc=b.items.filter(x=>x.contentType==='scripture');assert.equal(bc.length,ac.length);assert.deepEqual(bc.map(x=>x.currentText),ac.map(x=>x.currentText));report.sfm.push({file:path.basename(f),items:a.items.length,verses:ac.length,roundtripItems:b.items.length,roundtripVerses:bc.length});}
for(const name of fs.readdirSync(corr).filter(x=>x.endsWith('.docx')).sort()){
  const f=path.join(corr,name),a=parseFile(f),entry={file:name,items:a.items.length,formats:{}};
  for(const format of ['json','csv','tsv','docx']){const out=path.join(d,`${name}.${format}`);exportItems(a.items,format,out);const b=parseFile(out);assert.equal(b.items.length,a.items.length,`${name} ${format} item count`);const at=a.items.map(x=>[x.languageRole,x.currentText]);const bt=b.items.map(x=>[x.languageRole,x.currentText]);assert.deepEqual(bt,at,`${name} ${format} content parity`);entry.formats[format]={items:b.items.length,bytes:fs.statSync(out).size};}
  report.corrections.push(entry);
}
if(legacy&&fs.existsSync(legacy))for(const name of fs.readdirSync(legacy).filter(x=>x.endsWith('.doc')).sort()){const a=parseFile(path.join(legacy,name)),b=parseFile(path.join(corr,name+'x'));assert.deepEqual(a.items.map(x=>[x.semanticKey,x.languageRole,x.currentText]),b.items.map(x=>[x.semanticKey,x.languageRole,x.currentText]));report.legacy.push({file:name,items:a.items.length,parity:true});}
console.log(JSON.stringify(report,null,2));fs.rmSync(d,{recursive:true,force:true});
