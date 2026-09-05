import { normalizeText, sha256 } from './utils.mjs';
export function parseJson(buffer) {
  const root=JSON.parse(buffer.toString('utf8'));
  const arr=Array.isArray(root)?root:(Array.isArray(root.items)?root.items:[root]);
  const items=arr.map((obj,idx)=>{
    const text=typeof obj==='string'?obj:(obj.currentText ?? obj.text ?? JSON.stringify(obj));
    const norm=normalizeText(text);
    return {bookCode:obj.bookCode??obj.book??null, chapter:Number(obj.chapter)||null, verse:obj.verse==null?null:String(obj.verse), contentType:obj.contentType??obj.type??'json_record', marker:obj.marker??null, category:obj.category??null, sequenceNo:idx, rawText:typeof obj==='string'?obj:JSON.stringify(obj), currentText:text, normalizedText:norm, contentHash:sha256(norm), logicalKey:obj.logicalKey??`JSON|${idx+1}`, protectionLevel:obj.protectionLevel??'normal', sourceLocator:`record:${idx+1}`, fields:obj};
  });
  return {format:'json', items, warnings:[], stats:{json_record:items.length}};
}
