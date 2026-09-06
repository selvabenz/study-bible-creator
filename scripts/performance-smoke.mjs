import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseUsfm } from '../src/core/usfm-parser.mjs';
import { Store } from '../src/core/db.mjs';
import { runLocalQa } from '../src/core/qa-engine.mjs';

const budgets={parseMs:2500,importEachMs:6000,browseMs:750,statsMs:1000,vocabMs:2500,qaMs:7000,totalMs:18000,rssMb:700};
const totalStarted=performance.now();
const rssStart=process.memoryUsage().rss;
function timed(name,fn){const s=performance.now();const value=fn();return {value,ms:performance.now()-s,name};}
function assertBudget(name,actual,budget){if(actual>budget)throw new Error(`${name} performance budget exceeded: ${Math.round(actual)} ms > ${budget} ms`);}

const lines=['\\id PSA Performance fixture'];
for(let c=1;c<=50;c++){lines.push(`\\c ${c}`);for(let v=1;v<=100;v++)lines.push(`\\v ${v} Performance verse ${c}:${v} with repeated words for vocabulary and publishing checks.`);}
const buffer=Buffer.from(lines.join('\n')+'\n');
const parsedTimed=timed('parse',()=>parseUsfm(buffer));
if(parsedTimed.value.verses!==5000)throw new Error(`Expected 5000 verses, got ${parsedTimed.value.verses}`);
assertBudget('USFM parse',parsedTimed.ms,budgets.parseMs);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-perf-'));
const store=new Store(path.join(tmp,'study_bible.db'));
try{
  const project=store.createProject({name:'Performance',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil',targetScript:'Tamil'});
  const importOne=(role,languageCode)=>{
    const batchId=store.startBatch(project.id,{fixture:true,role});
    return store.commitImport({batchId,projectId:project.id,filename:`${role}.SFM`,format:'sfm',sha:`fixture-${role}`,byteSize:buffer.length,languageCode,resourceRole:role,sourcePath:null,parsed:parsedTimed.value});
  };
  const sourceTimed=timed('sourceImport',()=>importOne('source_scripture','en'));
  assertBudget('Source import',sourceTimed.ms,budgets.importEachMs);
  const targetTimed=timed('targetImport',()=>importOne('target_scripture','ta'));
  assertBudget('Target import',targetTimed.ms,budgets.importEachMs);

  const browseTimed=timed('browse',()=>store.listPairs(project.id,{bookCode:'PSA',chapter:25,contentType:'scripture',limit:250}));
  if(browseTimed.value.length!==100)throw new Error(`Expected 100 paired verses in chapter 25, got ${browseTimed.value.length}`);
  assertBudget('Chapter browse',browseTimed.ms,budgets.browseMs);

  const statsTimed=timed('stats',()=>store.projectStats(project.id));
  if((statsTimed.value.totals.items||0)<10000)throw new Error('Stats did not count imported source/target content');
  assertBudget('Project stats',statsTimed.ms,budgets.statsMs);

  const vocabTimed=timed('vocabulary',()=>store.vocabulary(project.id,'ta',100));
  if(!vocabTimed.value.length)throw new Error('Vocabulary calculation returned no data');
  assertBudget('Vocabulary calculation',vocabTimed.ms,budgets.vocabMs);

  const qaTimed=timed('qa',()=>runLocalQa(store,project.id));
  assertBudget('Deterministic QA',qaTimed.ms,budgets.qaMs);

  const totalMs=performance.now()-totalStarted; assertBudget('Total performance smoke',totalMs,budgets.totalMs);
  const rssMb=(process.memoryUsage().rss-rssStart)/1024/1024;
  if(process.memoryUsage().rss/1024/1024>budgets.rssMb)throw new Error(`RSS exceeded safety budget: ${Math.round(process.memoryUsage().rss/1024/1024)} MB > ${budgets.rssMb} MB`);
  console.log(JSON.stringify({ok:true,fixture:{verses:5000,activeItems:statsTimed.value.totals.items},ms:{parse:Math.round(parsedTimed.ms),sourceImport:Math.round(sourceTimed.ms),targetImport:Math.round(targetTimed.ms),browse:Math.round(browseTimed.ms),stats:Math.round(statsTimed.ms),vocabulary:Math.round(vocabTimed.ms),qa:Math.round(qaTimed.ms),total:Math.round(totalMs)},memory:{rssDeltaMb:Math.round(rssMb),rssMb:Math.round(process.memoryUsage().rss/1024/1024)},budgets},null,2));
} finally {store.close();fs.rmSync(tmp,{recursive:true,force:true});}
