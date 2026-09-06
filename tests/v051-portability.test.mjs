import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createZip, readZipEntry, zipDirectory } from '../src/core/zip.mjs';

test('pure Node ZIP writer/reader round-trips Unicode content without shell tools',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-zip-'));
  try{
    const out=path.join(tmp,'x.docx');
    createZip([{name:'word/document.xml',data:Buffer.from('<w:t>தமிழ் English</w:t>','utf8')}],out);
    assert.equal(readZipEntry(out,'word/document.xml').toString('utf8'),'<w:t>தமிழ் English</w:t>');
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('zipDirectory creates nested DOCX-compatible ZIP paths without PowerShell or unzip',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-zipdir-'));
  try{
    const src=path.join(tmp,'src'); fs.mkdirSync(path.join(src,'word'),{recursive:true});
    fs.writeFileSync(path.join(src,'word','document.xml'),'hello','utf8');
    const out=path.join(tmp,'x.docx'); zipDirectory(src,out);
    assert.equal(readZipEntry(out,'word/document.xml').toString('utf8'),'hello');
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('DOCX core no longer invokes PowerShell zip/unzip helpers',()=>{
  const exporter=fs.readFileSync(new URL('../src/core/exporter.mjs',import.meta.url),'utf8');
  const parser=fs.readFileSync(new URL('../src/core/docx-parser.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(exporter,/Compress-Archive|powershell\.exe|execFileSync\(['"]zip/);
  assert.doesNotMatch(parser,/Expand-Archive|powershell\.exe|execFileSync\(['"]unzip/);
});
