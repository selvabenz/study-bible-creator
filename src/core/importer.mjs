import fs from 'node:fs';
import path from 'node:path';
import { parseFile, detectFormat } from './parse-file.mjs';
import { sha256 } from './utils.mjs';

export function previewImport(store,{projectId,filePath,originalFilename=null,languageCode,resourceRole,format='auto'}) {
  const b=fs.readFileSync(filePath);
  const sha=sha256(b);
  const displayName=originalFilename||path.basename(filePath);
  const actual=detectFormat(displayName,format==='auto'?'auto':format);
  const exact=store.findFileByHash(projectId,sha,resourceRole,languageCode);
  if(exact) return {exactDuplicate:true,existingFile:exact,sha,byteSize:b.length,format:actual,filename:displayName};
  const project=store.getProject(projectId);
  if(!project) throw new Error('Project not found');
  // Parse using the requested/derived format while reading bytes from the temporary/local path.
  const parsed=parseFile(filePath,actual);
  let exactItems=0, changedItems=0, newItems=0;
  const languageBreakdown={source:0,target:0,auxiliary:0,unassigned:0};
  for(const item of parsed.items){
    const resolved=store.resolveItemLanguage(project,item,languageCode,resourceRole);
    const semanticKey=item.semanticKey||item.logicalKey;
    const key=store.scopedLogicalKey(resourceRole,resolved.languageCode,semanticKey);
    const ex=store.existingByLogicalKey(projectId,key);
    if(!ex)newItems++; else if(ex.content_hash===item.contentHash)exactItems++; else changedItems++;
    languageBreakdown[resolved.languageRole||'unassigned']=(languageBreakdown[resolved.languageRole||'unassigned']||0)+1;
  }
  const batchId=store.startBatch(projectId,{filename:displayName,newItems,exactItems,changedItems});
  return {
    batchId,exactDuplicate:false,sha,byteSize:b.length,format:actual,filename:displayName,languageCode,resourceRole,
    parsedSummary:{
      bookCode:parsed.bookCode??null,chapters:parsed.chapters??[],verses:parsed.verses??0,stats:parsed.stats,
      warnings:parsed.warnings,items:parsed.items.length,structuredTable:parsed.structuredTable??false,
      tableRows:parsed.tableRows??null,paragraphs:parsed.paragraphs??null,conversionStrategy:parsed.conversionStrategy??null,
      languageBreakdown
    },
    duplicateSummary:{newItems,exactItems,changedItems},parsed
  };
}
