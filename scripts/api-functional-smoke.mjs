import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tauri=path.join(root,'src-tauri');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function targetTriple(){
  if(process.platform==='win32') return process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  if(process.platform==='darwin') return process.arch==='arm64'?'aarch64-apple-darwin':'x86_64-apple-darwin';
  return process.arch==='arm64'?'aarch64-unknown-linux-gnu':'x86_64-unknown-linux-gnu';
}
async function freePort(){return await new Promise((resolve,reject)=>{const s=net.createServer();s.unref();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function waitHealth(base,timeout=10000){const start=performance.now();while(performance.now()-start<timeout){try{const r=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1000)});if(r.ok&&((await r.json()).ok))return performance.now()-start;}catch{}await sleep(75);}throw new Error('functional smoke health timeout');}
async function request(url,{status=200,json=true,...opt}={}){const r=await fetch(url,opt);const b=Buffer.from(await r.arrayBuffer());if(r.status!==status)throw new Error(`${opt.method||'GET'} ${url} expected ${status}, got ${r.status}: ${b.toString('utf8').slice(0,1000)}`);if(!json)return {r,b};let data=null;try{data=JSON.parse(b.toString('utf8'))}catch{throw new Error(`Expected JSON from ${url}`)}return {r,data,b};}

spawnSync(process.execPath,[path.join(root,'scripts','prepare-desktop.mjs')],{cwd:root,stdio:'inherit'});
const ext=process.platform==='win32'?'.exe':'';
const sidecar=path.join(tauri,'binaries',`sbc-engine-${targetTriple()}${ext}`);
const serverScript=path.join(tauri,'resources','app','src','server.mjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-functional-smoke-'));
const port=await freePort(), token='functional-smoke-token', base=`http://127.0.0.1:${port}`;
const child=spawn(sidecar,[serverScript],{env:{...process.env,PORT:String(port),SBC_DESKTOP_DATA_DIR:tmp,SBC_DESKTOP_TOKEN:token,SBC_APP_VERSION:'functional-smoke'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);let exit=null;child.on('exit',(code,signal)=>exit={code,signal});

try{
  const startupMs=await waitHealth(base);
  await request(`${base}/__desktop_auth?token=wrong`,{status:403});
  await request(`${base}/api/projects`,{status:401});
  const auth=await fetch(`${base}/__desktop_auth?token=${token}`,{redirect:'manual'});if(auth.status!==302)throw new Error(`auth expected 302, got ${auth.status}`);
  const cookie=(auth.headers.get('set-cookie')||'').split(';')[0];if(!cookie.startsWith('sbc_session='))throw new Error('missing session cookie');
  const H={cookie}, J={cookie,'content-type':'application/json'};

  const created=(await request(`${base}/api/projects`,{status:201,method:'POST',headers:J,body:JSON.stringify({name:'Functional Smoke',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil',targetScript:'Tamil'})})).data;
  if(!created.id)throw new Error('project creation returned no id'); const id=created.id;
  const projects=(await request(`${base}/api/projects`,{headers:H})).data;if(!projects.some(p=>p.id===id))throw new Error('project not listed');
  await request(`${base}/api/projects/${id}`,{headers:H});
  await request(`${base}/api/projects/missing-project`,{headers:H,status:404});

  async function importSfm(name,lang,role,text){
    const preview=(await request(`${base}/api/import/preview`,{method:'POST',headers:{...H,'x-project-id':id,'x-file-name':name,'x-language-code':lang,'x-resource-role':role,'content-type':'application/octet-stream'},body:Buffer.from(text)})).data;
    if(preview.exactDuplicate)return {preview,commit:null};
    if(!preview.batchId)throw new Error(`preview missing batchId for ${name}`);
    const commit=(await request(`${base}/api/import/commit`,{method:'POST',headers:{...J,'x-project-id':id},body:JSON.stringify({batchId:preview.batchId,projectId:id})})).data;
    return {preview,commit};
  }
  const source='\\id MAT Functional source\n\\c 1\n\\v 1 In the beginning 1.\n\\v 2 Second verse.\n';
  const target='\\id MAT Functional target\n\\c 1\n\\v 1 தொடக்கத்தில் 1.\n\\v 2 இரண்டாவது வசனம்.\n';
  await importSfm('41MAT-source.SFM','en','source_scripture',source);
  await importSfm('41MAT-target.SFM','ta','target_scripture',target);
  const duplicate=await importSfm('41MAT-source.SFM','en','source_scripture',source);if(!duplicate.preview.exactDuplicate)throw new Error('exact duplicate was not detected');

  const stats=(await request(`${base}/api/projects/${id}/stats`,{headers:H})).data;if((stats?.totals?.items||0)<4)throw new Error('stats item count too small');
  const books=(await request(`${base}/api/projects/${id}/books`,{headers:H})).data;if(!books.some(b=>b.book_code==='MAT'))throw new Error('MAT not in books summary');
  const chapters=(await request(`${base}/api/projects/${id}/books/MAT/chapters`,{headers:H})).data;if(!chapters.some(c=>Number(c.chapter)===1))throw new Error('chapter 1 missing');
  const content=(await request(`${base}/api/projects/${id}/content?book=MAT&chapter=1&type=scripture&limit=50`,{headers:H})).data;if(content.length<4)throw new Error('content browse missing rows');
  const pairs=(await request(`${base}/api/projects/${id}/pairs?book=MAT&chapter=1&type=scripture&limit=50`,{headers:H})).data;if(pairs.filter(p=>p.source&&p.target).length!==2)throw new Error('source/target pairing failed');
  const vocab=(await request(`${base}/api/projects/${id}/vocabulary?language=ta&limit=20`,{headers:H})).data;if(!Array.isArray(vocab.items)||!vocab.items.length)throw new Error('vocabulary endpoint empty');
  const rules=(await request(`${base}/api/projects/${id}/rules`,{headers:H})).data;if(!Array.isArray(rules.rules)||!Array.isArray(rules.glossary))throw new Error('rules payload malformed');
  const authority=(await request(`${base}/api/projects/${id}/authority-rules`,{headers:H})).data;if(!Array.isArray(authority.rules))throw new Error('authority rules payload malformed');

  const qa=(await request(`${base}/api/projects/${id}/qa/run`,{method:'POST',headers:H})).data;if(typeof qa.open!=='number')throw new Error('QA result missing count');
  const issues=(await request(`${base}/api/projects/${id}/qa/issues?status=open&limit=50`,{headers:H})).data;
  if(issues.length){const updated=(await request(`${base}/api/projects/${id}/qa/issues/${issues[0].id}`,{method:'PATCH',headers:J,body:JSON.stringify({status:'deferred'})})).data;if(updated.status!=='deferred')throw new Error('issue status update failed');}

  for(const format of ['json','csv','tsv','sfm','docx']){
    const {r,b}=await request(`${base}/api/projects/${id}/export?format=${format}`,{headers:H,json:false});
    if(!b.length)throw new Error(`${format} export empty`);
    if(format==='json'){const j=JSON.parse(b.toString('utf8'));if(!Array.isArray(j.items))throw new Error('JSON canonical export malformed');}
    if(format==='docx'&&!(b[0]===0x50&&b[1]===0x4b))throw new Error('DOCX export is not a ZIP package');
    if(!r.headers.get('content-disposition'))throw new Error(`${format} export missing content disposition`);
  }
  await request(`${base}/api/projects/${id}/export?format=pdf`,{headers:H,status:400});

  const changed='\\id MAT Functional changed\n\\c 1\n\\v 1 Changed source 1.\n\\v 2 Second verse.\n';
  await importSfm('41MAT-source-changed.SFM','en','source_scripture',changed);
  const conflicts=(await request(`${base}/api/projects/${id}/conflicts?status=pending`,{headers:H})).data;if(!conflicts.length)throw new Error('changed import did not create conflict');
  const resolved=(await request(`${base}/api/projects/${id}/conflicts/${conflicts[0].id}/resolve`,{method:'POST',headers:J,body:JSON.stringify({action:'keep_existing',actor:'Functional smoke',reason:'Regression test'})})).data;if(resolved.status!=='keep_existing')throw new Error('conflict resolution failed');

  await request(`${base}/api/import/preview`,{method:'POST',headers:{...H,'x-file-name':'x.sfm'},body:'x',status:400});
  await request(`${base}/api/import/commit`,{method:'POST',headers:J,body:JSON.stringify({batchId:'missing'}),status:404});
  await request(`${base}/api/projects`,{method:'POST',headers:J,body:'{',status:400});
  await request(`${base}/api/not-a-route`,{headers:H,status:404});

  console.log(JSON.stringify({ok:true,platform:process.platform,startupMs:Math.round(startupMs),projectId:id,items:stats.totals.items,paired:2,qaIssues:issues.length,exports:['json','csv','tsv','sfm','docx'],conflictResolved:true},null,2));
}catch(error){throw new Error(`${error.message}\nsidecar_exit=${JSON.stringify(exit)}\nstdout=${stdout.slice(-8000)}\nstderr=${stderr.slice(-8000)}`);}finally{if(!child.killed)child.kill();await sleep(150);fs.rmSync(tmp,{recursive:true,force:true});}
