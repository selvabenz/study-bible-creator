import { normalizeText, sha256 } from './utils.mjs';

function parseRows(text, delim) {
  const rows=[]; let row=[]; let cell=''; let q=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') {
      if (q && text[i+1]==='"') { cell+='"'; i++; }
      else q=!q;
    } else if (c===delim && !q) { row.push(cell); cell=''; }
    else if ((c==='\n' || c==='\r') && !q) {
      if (c==='\r' && text[i+1]==='\n') i++;
      row.push(cell); cell='';
      if (row.some(v=>v!=='')) rows.push(row);
      row=[];
    } else cell+=c;
  }
  row.push(cell); if (row.some(v=>v!=='')) rows.push(row);
  return rows;
}

export function parseDelimited(buffer, delim=',') {
  const rows=parseRows(buffer.toString('utf8').replace(/^\uFEFF/,''), delim);
  const header=(rows.shift()||[]).map(x=>normalizeText(x));
  const items=rows.map((r,idx)=>{
    const obj={}; header.forEach((h,i)=>obj[h||`column_${i+1}`]=r[i]??'');
    const text=r.join(delim); const norm=normalizeText(text);
    return {bookCode:obj.Book||obj.book||obj.BOOK||null, chapter:Number(obj.Ch||obj.chapter)||null, verse:String(obj.Vs||obj.verse||'')||null,
      contentType:'table_row', marker:obj.Tags||obj.marker||null, category:obj['Sub-Tags']||obj.category||null, sequenceNo:idx,
      rawText:text, currentText:text, normalizedText:norm, contentHash:sha256(norm), logicalKey:`ROW|${idx+1}`, protectionLevel:'normal', sourceLocator:`row:${idx+2}`, fields:obj};
  });
  return {format:delim==='\t'?'tsv':'csv', header, items, warnings:[], stats:{table_row:items.length}};
}
