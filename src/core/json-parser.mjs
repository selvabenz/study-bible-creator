import { normalizeText, sha256 } from './utils.mjs';
const pick=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null)return o[k];return null;};
export function parseJson(buffer) {
  const root=JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/,''));
  const arr=Array.isArray(root)?root:(Array.isArray(root.items)?root.items:[root]);
  const items=arr.map((obj,idx)=>{
    if(typeof obj==='string'){const norm=normalizeText(obj);return {bookCode:null,chapter:null,verse:null,contentType:'json_record',marker:null,category:null,sequenceNo:idx,rawText:obj,currentText:obj,normalizedText:norm,contentHash:sha256(norm),semanticKey:`JSON|${idx+1}`,matchKey:`JSON|${idx+1}`,logicalKey:`JSON|${idx+1}`,protectionLevel:'normal',sourceLocator:`record:${idx+1}`};}
    const text=String(pick(obj,'currentText','current_text','text')??''); const norm=normalizeText(text);
    const sem=String(pick(obj,'semanticKey','semantic_key','logicalKey','logical_key')??`JSON|${idx+1}`);
    return {bookCode:pick(obj,'bookCode','book_code','book')??null,chapter:Number(pick(obj,'chapter'))||null,verse:pick(obj,'verse')==null?null:String(pick(obj,'verse')),contentType:pick(obj,'contentType','content_type','type')??'json_record',marker:pick(obj,'marker')??null,category:pick(obj,'category')??null,sequenceNo:Number(pick(obj,'sequenceNo','sequence_no'))||idx,
      rawText:String(pick(obj,'rawText','raw_text')??JSON.stringify(obj)),currentText:text,normalizedText:norm,contentHash:sha256(norm),semanticKey:sem,matchKey:String(pick(obj,'matchKey','match_key')??sem),parentSemanticKey:pick(obj,'parentSemanticKey','parent_semantic_key')??null,logicalKey:sem,protectionLevel:pick(obj,'protectionLevel','protection_level')??'normal',sourceLocator:pick(obj,'sourceLocator','source_locator')??`record:${idx+1}`,languageRole:pick(obj,'languageRole','language_role')??null,languageCode:pick(obj,'languageCode','language_code')??null,resourceRole:pick(obj,'resourceRole','resource_role')??null,fields:obj};
  });
  return {format:'json',schemaVersion:root?.schemaVersion??null,items,warnings:[],stats:{json_record:items.length}};
}
