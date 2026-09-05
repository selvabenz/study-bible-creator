import fs from 'node:fs';
import path from 'node:path';
import { parseFile, detectFormat } from './parse-file.mjs';
import { sha256 } from './utils.mjs';

export function previewImport(store,{projectId,filePath,languageCode,resourceRole,format='auto'}) {
  const b=fs.readFileSync(filePath); const sha=sha256(b); const actual=detectFormat(filePath,format);
  const exact=store.findFileByHash(projectId,sha,resourceRole,languageCode);
  if(exact) return {exactDuplicate:true,existingFile:exact,sha,byteSize:b.length,format:actual,filename:path.basename(filePath)};
  const parsed=parseFile(filePath,actual);
  let exactItems=0, changedItems=0, newItems=0;
  for(const item of parsed.items){
    const key=`${resourceRole}|${languageCode||''}|${item.logicalKey}`;
    const ex=store.existingByLogicalKey(projectId,key);
    if(!ex)newItems++; else if(ex.content_hash===item.contentHash)exactItems++; else changedItems++;
  }
  const batchId=store.startBatch(projectId,{filename:path.basename(filePath),newItems,exactItems,changedItems});
  return {batchId,exactDuplicate:false,sha,byteSize:b.length,format:actual,filename:path.basename(filePath),languageCode,resourceRole,parsedSummary:{bookCode:parsed.bookCode??null,chapters:parsed.chapters??[],verses:parsed.verses??0,stats:parsed.stats,warnings:parsed.warnings,items:parsed.items.length,structuredTable:parsed.structuredTable??false,tableRows:parsed.tableRows??null},duplicateSummary:{newItems,exactItems,changedItems},parsed};
}
