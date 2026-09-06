import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tauri=path.join(root,'src-tauri');

function targetTriple(){
  if(process.platform==='win32') return process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  if(process.platform==='darwin') return process.arch==='arm64'?'aarch64-apple-darwin':'x86_64-apple-darwin';
  return process.arch==='arm64'?'aarch64-unknown-linux-gnu':'x86_64-unknown-linux-gnu';
}
async function freePort(){
  return await new Promise((resolve,reject)=>{
    const s=net.createServer(); s.unref(); s.on('error',reject); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
  });
}
async function waitForHealth(base,timeoutMs=10000){
  const started=performance.now(); let lastError='';
  while(performance.now()-started<timeoutMs){
    try{const r=await fetch(`${base}/api/health`,{signal:AbortSignal.timeout(1000)});if(r.ok){const j=await r.json();if(j.ok)return {health:j,ms:performance.now()-started};}}catch(e){lastError=e.message;}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`Sidecar health check timed out after ${timeoutMs} ms${lastError?`: ${lastError}`:''}`);
}
async function api(url,opt={}){
  const r=await fetch(url,opt); const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok)throw new Error(`${r.status} ${typeof data==='object'?(data.error||JSON.stringify(data)):data}`); return {r,data};
}

spawnSync(process.execPath,[path.join(root,'scripts','prepare-desktop.mjs')],{cwd:root,stdio:'inherit'});
const ext=process.platform==='win32'?'.exe':'';
const sidecar=path.join(tauri,'binaries',`sbc-engine-${targetTriple()}${ext}`);
const serverScript=path.join(tauri,'resources','app','src','server.mjs');
if(!fs.existsSync(sidecar))throw new Error(`Prepared sidecar missing: ${sidecar}`);
if(!fs.existsSync(serverScript))throw new Error(`Prepared server resource missing: ${serverScript}`);

const version=spawnSync(sidecar,['--version'],{encoding:'utf8',timeout:5000});
if(version.status!==0)throw new Error(`Prepared Node sidecar cannot execute: ${version.stderr||version.error||version.status}`);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-sidecar-smoke-'));
const port=await freePort(); const token='smoke-token'; const base=`http://127.0.0.1:${port}`;
const child=spawn(sidecar,[serverScript],{env:{...process.env,PORT:String(port),SBC_DESKTOP_DATA_DIR:tmp,SBC_DESKTOP_TOKEN:token,SBC_APP_VERSION:'smoke'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let stdout='',stderr=''; child.stdout.on('data',c=>stdout+=c); child.stderr.on('data',c=>stderr+=c);
let exit=null; child.on('exit',(code,signal)=>exit={code,signal});

try{
  const {health,ms}=await waitForHealth(base,10000);
  if(ms>5000)throw new Error(`Prepared sidecar exceeded startup performance budget: ${Math.round(ms)} ms > 5000 ms`);
  if(!health.desktop)throw new Error('Health endpoint did not report desktop mode');

  const auth=await fetch(`${base}/__desktop_auth?token=${token}`,{redirect:'manual'});
  if(auth.status!==302)throw new Error(`Desktop auth expected 302, got ${auth.status}`);
  const cookie=(auth.headers.get('set-cookie')||'').split(';')[0];
  if(!cookie.startsWith('sbc_session='))throw new Error('Desktop auth did not issue a session cookie');
  const headers={cookie,'content-type':'application/json'};
  const created=(await api(`${base}/api/projects`,{method:'POST',headers,body:JSON.stringify({name:'Runtime Smoke',sourceLanguageCode:'en',sourceLanguageName:'English',targetLanguageCode:'ta',targetLanguageName:'Tamil',targetScript:'Tamil'})})).data;
  if(!created?.id)throw new Error('Project creation failed');
  const projects=(await api(`${base}/api/projects`,{headers:{cookie}})).data;
  if(!projects.some(p=>p.id===created.id))throw new Error('Created project was not listed');

  const sfm='\\id MAT Runtime smoke\n\\c 1\n\\v 1 In the beginning 1.\n\\v 2 Second verse.\n';
  const preview=(await api(`${base}/api/import/preview`,{method:'POST',headers:{cookie,'x-project-id':created.id,'x-file-name':'41MAT.SFM','x-language-code':'en','x-resource-role':'source_scripture','content-type':'application/octet-stream'},body:Buffer.from(sfm)})).data;
  if(!preview.batchId||preview.parsedSummary?.verses!==2)throw new Error('USFM preview did not parse two verses');
  const committed=(await api(`${base}/api/import/commit`,{method:'POST',headers:{cookie,'content-type':'application/json','x-project-id':created.id},body:JSON.stringify({batchId:preview.batchId,projectId:created.id})})).data;
  if(!committed)throw new Error('Import commit failed');

  const stats=(await api(`${base}/api/projects/${created.id}/stats`,{headers:{cookie}})).data;
  if((stats?.totals?.items||0)<2)throw new Error('Project stats did not reflect committed content');
  const qa=(await api(`${base}/api/projects/${created.id}/qa/run`,{method:'POST',headers:{cookie}})).data;
  if(typeof qa.open!=='number')throw new Error('QA run did not return an open count');
  const exportRes=await fetch(`${base}/api/projects/${created.id}/export?format=json`,{headers:{cookie}});
  if(!exportRes.ok)throw new Error(`JSON export failed: ${exportRes.status}`);
  const exported=JSON.parse(await exportRes.text());
  if(!Array.isArray(exported?.items)||exported.items.length<2)throw new Error('JSON export did not contain canonical items');

  const unauth=await fetch(`${base}/api/projects`);
  if(unauth.status!==401)throw new Error(`Unauthenticated desktop API expected 401, got ${unauth.status}`);
  const malformed=await fetch(`${base}/api/projects`,{method:'POST',headers,body:'{'});
  if(malformed.status!==400)throw new Error(`Malformed JSON expected 400, got ${malformed.status}`);

  console.log(JSON.stringify({ok:true,platform:process.platform,arch:process.arch,node:version.stdout.trim(),startupMs:Math.round(ms),projectId:created.id,items:stats.totals.items,qaOpen:qa.open},null,2));
} catch(error){
  throw new Error(`${error.message}\nsidecar_exit=${JSON.stringify(exit)}\nstdout=${stdout.slice(-6000)}\nstderr=${stderr.slice(-6000)}`);
} finally {
  if(!child.killed)child.kill();
  await new Promise(r=>setTimeout(r,150));
  fs.rmSync(tmp,{recursive:true,force:true});
}
