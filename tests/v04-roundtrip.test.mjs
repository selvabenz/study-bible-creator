import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportItems } from '../src/core/exporter.mjs';
import { parseFile } from '../src/core/parse-file.mjs';
import { parseUsfm } from '../src/core/usfm-parser.mjs';
import { parseDocx } from '../src/core/docx-parser.mjs';

function dir(){return fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v04-rt-'));}
const baseItems=[
  {semantic_key:'MAT|1|1|study_note|0',match_key:'MAT|1|1|study_note|0',book_code:'MAT',chapter:1,verse:'1',content_type:'study_note',marker:'ef',category:'\\cat 3\\cat*',sequence_no:1,language_code:'en',language_role:'source',protection_level:'normal',review_status:'unreviewed',current_text:'English, note "quoted"\nsecond line 1/16',raw_text:'English, note "quoted"\nsecond line 1/16',source_locator:'row:2',resource_role:'study_notes'},
  {semantic_key:'MAT|1|1|study_note|0',match_key:'MAT|1|1|study_note|0',book_code:'MAT',chapter:1,verse:'1',content_type:'study_note',marker:'ef',category:'\\cat 3\\cat*',sequence_no:2,language_code:'ta',language_role:'target',protection_level:'normal',review_status:'unreviewed',current_text:'தமிழ், குறிப்பு "மேற்கோள்"\nஇரண்டாம் வரி 1/16',raw_text:'தமிழ், குறிப்பு "மேற்கோள்"\nஇரண்டாம் வரி 1/16',source_locator:'row:2',resource_role:'study_notes'}
];

for(const format of ['json','csv','tsv']) test(`${format.toUpperCase()} canonical export re-import preserves multilingual text and semantic identity`,()=>{
  const d=dir(),f=path.join(d,`x.${format}`);exportItems(baseItems,format,f);const p=parseFile(f);
  assert.equal(p.items.length,2);assert.equal(p.items[0].semanticKey,'MAT|1|1|study_note|0');
  assert.equal(p.items.find(x=>x.languageRole==='target').currentText,'தமிழ், குறிப்பு "மேற்கோள்"\nஇரண்டாம் வரி 1/16');
  assert.equal(p.items.find(x=>x.languageRole==='source').currentText,'English, note "quoted"\nsecond line 1/16');
});

test('SFM semantic round-trip does not duplicate extracted inline footnotes or cross-references',()=>{
  const d=dir(),f=path.join(d,'in.sfm'),out=path.join(d,'out.sfm');const src='\\id MAT Test\n\\c 1\n\\p\n\\v 1 Text \\f + \\fr 1:1 \\ft Note\\f* \\x + \\xo 1:1 \\xt Gen 1:1\\x*\n';fs.writeFileSync(f,src);
  const p=parseUsfm(fs.readFileSync(f));exportItems(p.items,'sfm',out);const text=fs.readFileSync(out,'utf8');
  assert.equal((text.match(/\\f \+/g)||[]).length,1);assert.equal((text.match(/\\x \+/g)||[]).length,1);
  const p2=parseUsfm(fs.readFileSync(out));assert.equal(p2.items.filter(x=>x.contentType==='scripture').length,1);assert.equal(p2.items.filter(x=>x.contentType==='footnote').length,1);assert.equal(p2.items.filter(x=>x.contentType==='cross_reference').length,1);
  assert.equal(p2.items.find(x=>x.contentType==='scripture').currentText,'Text');
});

test('DOCX export re-import preserves bilingual Study Bible rows and Unicode',()=>{
  const d=dir(),f=path.join(d,'roundtrip.docx');exportItems(baseItems,'docx',f);assert.ok(fs.statSync(f).size>500);
  const p=parseDocx(f);assert.equal(p.structuredTable,true);assert.equal(p.items.length,2);
  assert.equal(p.items.find(x=>x.languageRole==='source').currentText,baseItems[0].current_text);
  assert.equal(p.items.find(x=>x.languageRole==='target').currentText,baseItems[1].current_text);
  assert.equal(p.items[0].semanticKey,'MAT|1|1|study_note|0');
});
