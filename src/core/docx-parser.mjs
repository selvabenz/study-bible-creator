import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { decodeXml, normalizeText, sha256 } from './utils.mjs';

function textFromXml(xml) {
  const parts=[];
  const re=/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/\s*>|<w:br\s*\/\s*>/g;
  let m; while((m=re.exec(xml))) {
    if (m[1] != null) parts.push(decodeXml(m[1]));
    else parts.push(' ');
  }
  return normalizeText(parts.join(''));
}

export function parseDocx(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('DOCX file not found');
  const xml=execFileSync('unzip',['-p',filePath,'word/document.xml'],{encoding:'utf8',maxBuffer:50*1024*1024});
  const rows=[]; let rm; const rowRe=/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  while((rm=rowRe.exec(xml))) {
    const cells=[]; let cm; const cellRe=/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    while((cm=cellRe.exec(rm[1]))) cells.push(textFromXml(cm[1]));
    if (cells.length) rows.push(cells);
  }
  const paragraphs=[]; let pm; const pRe=/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  while((pm=pRe.exec(xml))) { const t=textFromXml(pm[1]); if(t) paragraphs.push(t); }

  const knownHeader = rows.findIndex(r=>r.some(c=>/^Tags$/i.test(c)) && r.some(c=>/^(English|Translation)$/i.test(c)));
  let items=[];
  if (knownHeader>=0) {
    const header=rows[knownHeader];
    const idx = name => header.findIndex(h=>h.toLowerCase()===name.toLowerCase());
    const iTags=idx('Tags'), iCh=idx('Ch'), iVs=idx('Vs'), iSub=idx('Sub-Tags'), iEn=idx('English'), iTr=idx('Translation');
    for (let r=knownHeader+1; r<rows.length; r++) {
      const row=rows[r]; if(!row.some(Boolean)) continue;
      const tag=row[iTags]??''; const ch=Number(row[iCh])||null; const vs=(row[iVs]??'')||null; const sub=row[iSub]??'';
      const type = /\\s\d?|\\s1/i.test(tag)?'section_heading': /\\x/.test(tag)?'cross_reference': /\\f/.test(tag)?'footnote': /\\esb|\\cat/.test(tag)?'study_note':'docx_record';
      for (const [role,col] of [['source',iEn],['target',iTr]]) {
        if (col<0) continue; const text=row[col]??''; if(!text) continue;
        const norm=normalizeText(text);
        items.push({bookCode:'MAT',chapter:ch,verse:vs==null?null:String(vs),contentType:type,marker:tag||null,category:sub||null,sequenceNo:items.length,rawText:text,currentText:text,normalizedText:norm,contentHash:sha256(norm),logicalKey:`DOCX|${r+1}|${role}`,protectionLevel:'normal',sourceLocator:`table-row:${r+1}`,role});
      }
    }
  } else {
    items=paragraphs.map((text,idx)=>({bookCode:null,chapter:null,verse:null,contentType:'docx_paragraph',marker:null,category:null,sequenceNo:idx,rawText:text,currentText:text,normalizedText:normalizeText(text),contentHash:sha256(normalizeText(text)),logicalKey:`DOCX-P|${idx+1}`,protectionLevel:'normal',sourceLocator:`paragraph:${idx+1}`}));
  }
  const stats={}; for(const i of items) stats[i.contentType]=(stats[i.contentType]||0)+1;
  return {format:'docx',items,warnings:[],stats,tableRows:rows.length,paragraphs:paragraphs.length,structuredTable:knownHeader>=0};
}
