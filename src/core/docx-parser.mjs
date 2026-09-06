import fs from 'node:fs';
import path from 'node:path';
import { decodeXml, normalizeText, sha256 } from './utils.mjs';
import { readZipEntry } from './zip.mjs';

function textFromXml(xml) {
  const parts=[];
  const re=/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|(<w:tab\s*\/\s*>)|(<w:br\s*\/\s*>)/g;
  let m;
  while((m=re.exec(xml))) {
    if (m[1] != null) parts.push(decodeXml(m[1]));
    else if (m[2]) parts.push('\t');
    else if (m[3]) parts.push('\n');
  }
  return parts.join('').normalize('NFC').replace(/[\u200B\u200C\u200D\uFEFF]/g,'').replace(/[ \r]+/g,' ').replace(/ *\n */g,'\n').trim();
}


function cleanCell(value) {
  const s = String(value ?? '').normalize('NFC').replace(/[\u200B\u200C\u200D\uFEFF]/g,'').replace(/[ \r]+/g,' ').replace(/ *\n */g,'\n').trim();
  return /^(?:NA|N\/A)$/i.test(s) ? '' : s;
}

function inferBookCode(filePath, paragraphs) {
  const fromContent = paragraphs.find(p=>/^[A-Z0-9]{3}$/.test(p));
  if (fromContent) return fromContent;
  const base = path.basename(filePath).toUpperCase();
  const known = ['GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO','OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL','MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH','PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS','1PE','2PE','1JN','2JN','3JN','JUD','REV'];
  return known.find(code=>base.includes(code)) ?? null;
}

function classify(tag, sub) {
  const markers = `${tag} ${sub}`;
  if (/\\ef|\\esb|\\cat/.test(markers)) return 'study_note';
  if (/\\x(?:\s|\+|$)|\\xo|\\xt|\\xk|\\xq|\\x\*/.test(markers)) return 'cross_reference';
  if (/\\f(?:\s|\+|$)|\\fr|\\ft|\\fq|\\fk|\\fl|\\f\*/.test(markers)) return 'footnote';
  if (/\\s\d?\b|\\ms\d?\b/i.test(tag)) return 'section_heading';
  if (/\\c\b/.test(tag)) return 'chapter_marker';
  if (/\\v\b/.test(tag)) return 'scripture_fragment';
  if (/\\fig\b/.test(markers)) return 'figure';
  return 'docx_record';
}

export function parseDocx(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('DOCX file not found');
  let xml;
  try {
    xml=readZipEntry(filePath,'word/document.xml').toString('utf8');
  } catch (error) {
    throw new Error(`Unable to read DOCX word/document.xml: ${error?.message ?? error}`);
  }
  const rows=[];
  let rm;
  const rowRe=/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  while((rm=rowRe.exec(xml))) {
    const cells=[];
    let cm;
    const cellRe=/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    while((cm=cellRe.exec(rm[1]))) cells.push(textFromXml(cm[1]));
    if (cells.length) rows.push(cells);
  }
  const paragraphs=[];
  let pm;
  const pRe=/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  while((pm=pRe.exec(xml))) {
    const t=textFromXml(pm[1]);
    if(t) paragraphs.push(t);
  }

  const knownHeader = rows.findIndex(r=>r.some(c=>/^Tags$/i.test(c)) && r.some(c=>/^(English|Translation)$/i.test(c)));
  const inferredBookCode = inferBookCode(filePath, paragraphs);
  let items=[];
  const warnings=[];
  if (knownHeader>=0) {
    const header=rows[knownHeader];
    const idx = name => header.findIndex(h=>h.toLowerCase()===name.toLowerCase());
    const iNo=idx('No'), iSem=idx('Semantic Key'), iTags=idx('Tags'), iCh=idx('Ch'), iVs=idx('Vs'), iSub=idx('Sub-Tags'), iType=idx('Content Type'), iProtect=idx('Protection'), iEn=idx('English'), iTr=idx('Translation');
    const matchCounters=new Map();
    for (let r=knownHeader+1; r<rows.length; r++) {
      const row=rows[r];
      if(!row.some(Boolean)) continue;
      const tag=cleanCell(row[iTags]??'');
      const rawCh=cleanCell(row[iCh]??'');
      const ch=/^\d+$/.test(rawCh) ? Number(rawCh) : null;
      const rawVs=cleanCell(row[iVs]??'');
      const vs=rawVs || null;
      const sub=cleanCell(row[iSub]??'');
      const inferredType=classify(tag,sub);
      const type=cleanCell(iType>=0?row[iType]:'') || inferredType;
      const no=cleanCell(iNo>=0?row[iNo]:'') || String(r+1);
      const scope=`${inferredBookCode??'UNK'}|${ch??0}|${vs??''}|${type}`; const ordinal=matchCounters.get(scope)??0; matchCounters.set(scope,ordinal+1);
      const matchKey=`${scope}|${ordinal}`;
      const semanticKey=cleanCell(iSem>=0?row[iSem]:'') || `DOCX|${matchKey}`;
      for (const [languageRole,col] of [['source',iEn],['target',iTr]]) {
        if (col<0) continue;
        const raw=cleanCell(row[col]??'');
        // Marker-only rows are kept even when the visible text is empty so export/structure can be reconstructed.
        if (!raw && !tag && !sub) continue;
        const norm=normalizeText(raw);
        const protectionLevel = cleanCell(iProtect>=0?row[iProtect]:'') || (type==='scripture_fragment' ? 'protected_scripture' : 'normal');
        items.push({
          bookCode:inferredBookCode,
          chapter:ch,
          verse:vs==null?null:String(vs),
          contentType:type,
          marker:tag||null,
          category:sub||null,
          sequenceNo:items.length,
          rawText:raw,
          currentText:raw,
          normalizedText:norm,
          contentHash:sha256(norm),
          semanticKey, matchKey, parentSemanticKey:null,
          logicalKey:semanticKey,
          protectionLevel,
          sourceLocator:`table-row:${r+1}`,
          languageRole,
          tableRow:r+1,
          recordNo:no
        });
      }
    }
  } else {
    items=paragraphs.map((text,idx)=>({
      bookCode:inferredBookCode,
      chapter:null,
      verse:null,
      contentType:'docx_paragraph',
      marker:null,
      category:null,
      sequenceNo:idx,
      rawText:text,
      currentText:text,
      normalizedText:normalizeText(text),
      contentHash:sha256(normalizeText(text)),
      semanticKey:`DOCX-P|${inferredBookCode??'UNK'}|${idx+1}`,
      matchKey:`${inferredBookCode??'UNK'}|0||docx_paragraph|${idx}`, parentSemanticKey:null,
      logicalKey:`DOCX-P|${inferredBookCode??'UNK'}|${idx+1}`,
      protectionLevel:'normal',
      sourceLocator:`paragraph:${idx+1}`,
      languageRole:null
    }));
    warnings.push({type:'unstructured_docx',message:'No recognized Study Bible table header was found; imported as paragraphs.'});
  }
  const stats={};
  for(const i of items) stats[i.contentType]=(stats[i.contentType]||0)+1;
  return {format:'docx',bookCode:inferredBookCode,items,warnings,stats,tableRows:rows.length,paragraphs:paragraphs.length,structuredTable:knownHeader>=0};
}
