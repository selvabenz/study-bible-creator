import path from 'node:path';
import fs from 'node:fs';
import { Store } from '../src/core/db.mjs';
import { previewImport } from '../src/core/importer.mjs';

const [sourcePath,targetPath,targetCode='ta',targetName='Target language'] = process.argv.slice(2);
if (!sourcePath || !targetPath) {
  console.error('Usage: node scripts/import-sfm-pair.mjs <source.sfm> <target.sfm> [targetCode] [targetName]');
  process.exit(2);
}
const dbPath=path.resolve('data','pair-demo.db');
try{fs.unlinkSync(dbPath)}catch{}
const store=new Store(dbPath);
const project=store.createProject({name:'Study Bible Import Test',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:targetCode,targetLanguageName:targetName});
for(const f of [{path:sourcePath,lang:'en',role:'source_scripture'},{path:targetPath,lang:targetCode,role:'target_scripture'}]){
  const p=previewImport(store,{projectId:project.id,filePath:f.path,languageCode:f.lang,resourceRole:f.role});
  console.log('\nPREVIEW',path.basename(f.path),p.parsedSummary,p.duplicateSummary);
  const c=store.commitImport({batchId:p.batchId,projectId:project.id,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode:f.lang,resourceRole:f.role,parsed:p.parsed});
  console.log('COMMIT',c);
}
console.log('\nPROJECT STATS',store.projectStats(project.id));
store.close();
