import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tauri=path.join(root,'src-tauri');
const resources=path.join(tauri,'resources','app');
const binaries=path.join(tauri,'binaries');
fs.rmSync(resources,{recursive:true,force:true});
fs.mkdirSync(resources,{recursive:true});
fs.mkdirSync(binaries,{recursive:true});
for(const dir of ['src','public']) fs.cpSync(path.join(root,dir),path.join(resources,dir),{recursive:true});
fs.copyFileSync(path.join(root,'package.json'),path.join(resources,'package.json'));
const triple = process.platform==='win32' ? (process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc')
  : process.platform==='darwin' ? (process.arch==='arm64'?'aarch64-apple-darwin':'x86_64-apple-darwin')
  : process.arch==='arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
const ext=process.platform==='win32'?'.exe':'';
const dst=path.join(binaries,`node-${triple}${ext}`);
fs.copyFileSync(process.execPath,dst);
if(process.platform!=='win32') fs.chmodSync(dst,0o755);
console.log(`Prepared desktop resources and Node sidecar for ${triple}`);
