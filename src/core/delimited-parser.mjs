import { normalizeText, sha256 } from './utils.mjs';
import { CANONICAL_HEADERS } from './exporter.mjs';

function parseRows(text, delim) {
  const rows=[]; let row=[]; let cell=''; let q=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') { if (q && text[i+1]==='"') { cell+='"'; i++; } else q=!q; }
    else if (c===delim && !q) { row.push(cell); cell=''; }
    else if ((c==='\n' || c==='\r') && !q) { if (c==='\r' && text[i+1]==='\n') i++; row.push(cell); cell=''; if (row.some(v=>v!=='')) rows.push(row); row=[]; }
    else cell+=c;
  }
  row.push(cell); if (row.some(v=>v!=='')) rows.push(row);
  if(q) throw new Error('Unclosed quoted field in delimited file');
  return rows;
}
const pick=(o,...keys)=>{for(const k of keys)if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];return null;};

export function parseDelimited(buffer, delim=',') {
  const rows=parseRows(buffer.toString('utf8').replace(/^\uFEFF/,''), delim);
  const header=(rows.shift()||[]).map(x=>normalizeText(x));
  if(!header.length) return {format:delim==='\t'?'tsv':'csv',header,items:[],warnings:[{type:'empty_file'}],stats:{table_row:0}};
  const canonical=CANONICAL_HEADERS.every(h=>header.includes(h));
  const items=rows.map((r,idx)=>{
    const obj={}; header.forEach((h,i)=>obj[h||`column_${i+1}`]=r[i]??'');
    if(canonical){
      const text=String(obj.currentText??'');const norm=normalizeText(text);const sem=String(obj.semanticKey||obj.matchKey||`ROW|${idx+1}`);const match=String(obj.matchKey||sem);
      return {bookCode:obj.bookCode||null,chapter:/^-?\d+$/.test(obj.chapter)?Number(obj.chapter):null,verse:obj.verse||null,contentType:obj.contentType||'table_row',marker:obj.marker||null,category:obj.category||null,sequenceNo:Number(obj.sequenceNo)||idx,
        rawText:obj.rawText||text,currentText:text,normalizedText:norm,contentHash:sha256(norm),semanticKey:sem,matchKey:match,parentSemanticKey:obj.parentSemanticKey||null,logicalKey:sem,protectionLevel:obj.protectionLevel||'normal',sourceLocator:obj.sourceLocator||`row:${idx+2}`,languageRole:obj.languageRole||null,languageCode:obj.languageCode||null,resourceRole:obj.resourceRole||null,fields:obj};
    }
    const text=pick(obj,'currentText','current_text','Translation','English','text') ?? r.join(delim); const norm=normalizeText(text);
    const book=pick(obj,'bookCode','book_code','Book','book','BOOK');const chapter=pick(obj,'chapter','Ch');const verse=pick(obj,'verse','Vs');const ctype=pick(obj,'contentType','content_type')||'table_row';
    const sem=pick(obj,'semanticKey','semantic_key','logicalKey','logical_key')||`ROW|${idx+1}`;
    return {bookCode:book||null,chapter:/^-?\d+$/.test(String(chapter??''))?Number(chapter):null,verse:verse==null?null:String(verse),contentType:ctype,marker:pick(obj,'marker','Tags')||null,category:pick(obj,'category','Sub-Tags')||null,sequenceNo:Number(pick(obj,'sequenceNo','sequence_no'))||idx,
      rawText:pick(obj,'rawText','raw_text')||r.join(delim),currentText:String(text),normalizedText:norm,contentHash:sha256(norm),semanticKey:sem,matchKey:pick(obj,'matchKey','match_key')||sem,parentSemanticKey:pick(obj,'parentSemanticKey','parent_semantic_key')||null,logicalKey:sem,protectionLevel:pick(obj,'protectionLevel','protection_level')||'normal',sourceLocator:pick(obj,'sourceLocator','source_locator')||`row:${idx+2}`,languageRole:pick(obj,'languageRole','language_role')||null,languageCode:pick(obj,'languageCode','language_code')||null,fields:obj};
  });
  return {format:delim==='\t'?'tsv':'csv', header, items, warnings:[], stats:{table_row:items.length},canonicalSchema:canonical};
}
