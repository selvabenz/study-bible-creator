import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const CANONICAL_SCHEMA_VERSION='sbc-0.4';
export const CANONICAL_HEADERS=[
  'semanticKey','matchKey','parentSemanticKey','bookCode','chapter','verse','contentType','marker','category','sequenceNo',
  'languageCode','languageRole','protectionLevel','reviewStatus','currentText','rawText','sourceLocator','resourceRole'
];

function val(x,...keys){for(const k of keys)if(x?.[k]!==undefined&&x?.[k]!==null)return x[k];return null;}
export function canonicalRow(x){
  return {
    semanticKey:val(x,'semanticKey','semantic_key')??'', matchKey:val(x,'matchKey','match_key','semanticKey','semantic_key')??'', parentSemanticKey:val(x,'parentSemanticKey','parent_semantic_key')??'',
    bookCode:val(x,'bookCode','book_code')??'', chapter:val(x,'chapter')??'', verse:val(x,'verse')??'', contentType:val(x,'contentType','content_type')??'',
    marker:val(x,'marker')??'', category:val(x,'category')??'', sequenceNo:val(x,'sequenceNo','sequence_no')??0, languageCode:val(x,'languageCode','language_code')??'',
    languageRole:val(x,'languageRole','language_role')??'', protectionLevel:val(x,'protectionLevel','protection_level')??'normal', reviewStatus:val(x,'reviewStatus','review_status')??'unreviewed',
    currentText:val(x,'currentText','current_text')??'', rawText:val(x,'rawText','raw_text')??'', sourceLocator:val(x,'sourceLocator','source_locator')??'', resourceRole:val(x,'resourceRole','resource_role')??''
  };
}

function csvEscape(v,delim=','){ const s=String(v??''); return /["\r\n]/.test(s)||s.includes(delim)?`"${s.replace(/"/g,'""')}"`:s; }
function xmlEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function wText(v){
  const pieces=String(v??'').split(/\r?\n/);
  return pieces.map((p,i)=>`${i?'<w:br/>':''}<w:t xml:space="preserve">${xmlEsc(p)}</w:t>`).join('');
}
function markerDisplay(marker){const m=String(marker??'').trim();if(!m)return '';return m.startsWith('\\')?m:`\\${m}`;}

function zipDirectory(dir,outPath){
  fs.rmSync(outPath,{force:true});
  if(process.platform==='win32'){
    const ps=`Compress-Archive -Path (Join-Path $args[0] '*') -DestinationPath $args[1] -Force`;
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps,dir,outPath]);
  } else {
    execFileSync('zip',['-q','-r',outPath,'.'],{cwd:dir});
  }
}

function writeDocx(items,outPath){
  const rows=items.map(canonicalRow);
  const groups=new Map();
  for(const r of rows){
    const key=r.semanticKey||r.matchKey||`${r.bookCode}|${r.chapter}|${r.verse}|${r.contentType}|${r.sequenceNo}`;
    if(!groups.has(key))groups.set(key,{key,source:null,target:null,other:null,seq:Number(r.sequenceNo)||0});
    const g=groups.get(key); g.seq=Math.min(g.seq,Number(r.sequenceNo)||0);
    if(r.languageRole==='source')g.source=r; else if(r.languageRole==='target')g.target=r; else if(!g.other)g.other=r;
  }
  const tableRows=[['Semantic Key','No','Tags','Ch','Vs','Sub-Tags','Content Type','Protection','English','Translation']];
  let n=1;
  for(const g of [...groups.values()].sort((a,b)=>a.seq-b.seq)){
    const r=g.source||g.target||g.other||{};
    tableRows.push([g.key,String(n++),markerDisplay(r.marker),r.chapter??'',r.verse??'',r.category??'',r.contentType??'',r.protectionLevel??'normal',g.source?.currentText??'',g.target?.currentText??(g.other?.currentText??'')]);
  }
  const widths=[1800,500,700,500,500,900,1100,900,3300,3300];
  const tr=tableRows.map((cells,ri)=>`<w:tr>${cells.map((c,ci)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/></w:tcPr><w:p><w:r>${ri===0?'<w:rPr><w:b/></w:rPr>':''}${wText(c)}</w:r></w:p></w:tc>`).join('')}</w:tr>`).join('');
  const grid=`<w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr><w:tblW w:w="14000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B8C1CC"/><w:left w:val="single" w:sz="4" w:color="B8C1CC"/><w:bottom w:val="single" w:sz="4" w:color="B8C1CC"/><w:right w:val="single" w:sz="4" w:color="B8C1CC"/><w:insideH w:val="single" w:sz="2" w:color="DCE1E7"/><w:insideV w:val="single" w:sz="2" w:color="DCE1E7"/></w:tblBorders></w:tblPr>${grid}${tr}</w:tbl><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="540" w:right="540" w:bottom="540" w:left="540"/></w:sectPr></w:body></w:document>`;
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-docx-'));
  try{
    fs.mkdirSync(path.join(tmp,'_rels'),{recursive:true});fs.mkdirSync(path.join(tmp,'word','_rels'),{recursive:true});
    fs.writeFileSync(path.join(tmp,'[Content_Types].xml'),`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    fs.writeFileSync(path.join(tmp,'_rels','.rels'),`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    fs.writeFileSync(path.join(tmp,'word','document.xml'),document,'utf8');
    fs.writeFileSync(path.join(tmp,'word','_rels','document.xml.rels'),`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
    zipDirectory(tmp,outPath);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}

function writeUsfm(rows,outPath){
  const sorted=[...rows].sort((a,b)=>(Number(val(a,'sequenceNo','sequence_no'))||0)-(Number(val(b,'sequenceNo','sequence_no'))||0));
  const lines=[];
  for(const x of sorted){
    const loc=String(val(x,'sourceLocator','source_locator')??'');
    // Auxiliary records extracted from inline footnotes/xrefs are already present in their parent raw line.
    if(/:footnote$|:crossref$/.test(loc))continue;
    const raw=String(val(x,'rawText','raw_text')??'');
    const marker=String(val(x,'marker')??'').replace(/^\\/,'');
    const text=String(val(x,'currentText','current_text')??'');
    if(raw && /^\\/.test(raw.trim())) lines.push(raw);
    else if(marker) lines.push(`\\${marker}${text?` ${text}`:''}`);
    else if(text) lines.push(text);
  }
  fs.writeFileSync(outPath,lines.join('\n')+'\n','utf8');
}

export function exportItems(items,format,outPath){
  const f=String(format).toLowerCase();
  if(f==='json'){
    const rows=items.map(canonicalRow);
    fs.writeFileSync(outPath,JSON.stringify({schemaVersion:CANONICAL_SCHEMA_VERSION,exportedAt:new Date().toISOString(),items:rows},null,2),'utf8');
  } else if(f==='csv'||f==='tsv'){
    const d=f==='tsv'?'\t':',';const rows=items.map(canonicalRow);
    const lines=[CANONICAL_HEADERS.join(d),...rows.map(x=>CANONICAL_HEADERS.map(h=>csvEscape(x[h],d)).join(d))];
    fs.writeFileSync(outPath,lines.join('\n')+'\n','utf8');
  } else if(f==='usfm'||f==='sfm') writeUsfm(items,outPath);
  else if(f==='docx') writeDocx(items,outPath);
  else throw new Error(`Exporter not implemented for ${format}`);
  return outPath;
}
