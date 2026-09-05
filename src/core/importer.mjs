import fs from 'node:fs';
import path from 'node:path';
import { parseFile, detectFormat } from './parse-file.mjs';
import { sha256 } from './utils.mjs';
import { authorityRecommendation, shouldAuthorityCrossMatch } from './authority.mjs';

const authorityTypes=new Set(['scripture','scripture_fragment','footnote','cross_reference','study_note','section_heading','introduction','introduction_heading','introduction_title','outline','figure']);

export function previewImport(store,{projectId,filePath,originalFilename=null,languageCode,resourceRole,format='auto'}) {
  const b=fs.readFileSync(filePath); const sha=sha256(b); const displayName=originalFilename||path.basename(filePath); const actual=detectFormat(displayName,format==='auto'?'auto':format);
  const exact=store.findFileByHash(projectId,sha,resourceRole,languageCode);
  if(exact) return {exactDuplicate:true,existingFile:exact,sha,byteSize:b.length,format:actual,filename:displayName};
  const project=store.getProject(projectId); if(!project) throw new Error('Project not found');
  const parsed=parseFile(filePath,actual);
  let exactItems=0, changedItems=0, newItems=0, crossResourceOverlaps=0, recommendedIncoming=0, recommendedExisting=0, manualReview=0;
  const languageBreakdown={source:0,target:0,auxiliary:0,unassigned:0}; const conflictExamples=[];
  for(const item of parsed.items){
    const resolved=store.resolveItemLanguage(project,item,languageCode,resourceRole); const semanticKey=item.semanticKey||item.logicalKey; const matchKey=item.matchKey||semanticKey;
    const key=store.scopedLogicalKey(resourceRole,resolved.languageCode,semanticKey); let ex=store.existingByLogicalKey(projectId,key); let cross=false;
    if(!ex && authorityTypes.has(item.contentType)){const candidate=store.existingByMatchKey(projectId,resolved.languageCode,matchKey);if(candidate && candidate.resource_role!==resourceRole && shouldAuthorityCrossMatch(item.contentType,candidate.resource_role,resourceRole)){ex=candidate;cross=true;}}
    if(!ex)newItems++; else if(ex.content_hash===item.contentHash){exactItems++;if(cross)crossResourceOverlaps++;} else {
      changedItems++; if(cross)crossResourceOverlaps++;
      const oldP=store.authorityPriority(projectId,item.contentType,ex.resource_role||''); const newP=store.authorityPriority(projectId,item.contentType,resourceRole);
      const a=authorityRecommendation({contentType:item.contentType,protectionLevel:ex.protection_level,existingRole:ex.resource_role||'unknown',incomingRole:resourceRole,existingPriority:oldP,incomingPriority:newP});
      if(a.recommendation==='use_incoming')recommendedIncoming++;else if(a.recommendation==='keep_existing')recommendedExisting++;else manualReview++;
      if(conflictExamples.length<8)conflictExamples.push({matchKey,contentType:item.contentType,bookCode:item.bookCode,chapter:item.chapter,verse:item.verse,existingRole:ex.resource_role,incomingRole:resourceRole,recommendation:a.recommendation,reason:a.reason,protectedScripture:ex.protection_level==='protected_scripture'});
    }
    languageBreakdown[resolved.languageRole||'unassigned']=(languageBreakdown[resolved.languageRole||'unassigned']||0)+1;
  }
  const batchId=store.startBatch(projectId,{filename:displayName,newItems,exactItems,changedItems,crossResourceOverlaps});
  return {batchId,exactDuplicate:false,sha,byteSize:b.length,format:actual,filename:displayName,languageCode,resourceRole,
    parsedSummary:{bookCode:parsed.bookCode??null,chapters:parsed.chapters??[],verses:parsed.verses??0,stats:parsed.stats,warnings:parsed.warnings,items:parsed.items.length,structuredTable:parsed.structuredTable??false,tableRows:parsed.tableRows??null,paragraphs:parsed.paragraphs??null,conversionStrategy:parsed.conversionStrategy??null,canonicalSchema:parsed.canonicalSchema??false,languageBreakdown},
    duplicateSummary:{newItems,exactItems,changedItems,crossResourceOverlaps,recommendedIncoming,recommendedExisting,manualReview,conflictExamples},parsed};
}
