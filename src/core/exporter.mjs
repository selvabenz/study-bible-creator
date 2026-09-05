import fs from 'node:fs';

function csvEscape(v,delim=','){ const s=String(v??''); return /["\r\n]/.test(s)||s.includes(delim)?`"${s.replace(/"/g,'""')}"`:s; }
export function exportItems(items,format,outPath){
  if(format==='json') fs.writeFileSync(outPath,JSON.stringify({items},null,2),'utf8');
  else if(format==='csv'||format==='tsv'){
    const d=format==='tsv'?'\t':','; const headers=['bookCode','chapter','verse','contentType','marker','category','languageCode','currentText'];
    const lines=[headers.join(d),...items.map(x=>headers.map(h=>csvEscape(x[h],d)).join(d))]; fs.writeFileSync(outPath,lines.join('\n'),'utf8');
  } else if(format==='usfm'||format==='sfm') {
    const lines=items.sort((a,b)=>a.sequence_no-b.sequence_no).map(x=>x.raw_text||((x.marker?`\\${x.marker} `:'')+(x.current_text||''))); fs.writeFileSync(outPath,lines.join('\n'),'utf8');
  } else throw new Error(`Exporter not implemented for ${format}`);
  return outPath;
}
