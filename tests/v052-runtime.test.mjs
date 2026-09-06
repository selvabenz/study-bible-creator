import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Windows release binary uses GUI subsystem instead of opening Windows Terminal',()=>{
  const main=read('src-tauri/src/main.rs');
  assert.match(main,/windows_subsystem\s*=\s*"windows"/);
});

test('desktop creates a native startup window before launching local sidecar',()=>{
  const lib=read('src-tauri/src/lib.rs');
  assert.match(lib,/WebviewUrl::App\("startup\.html"\.into\(\)\)/);
  assert.match(lib,/find_server_script/);
  assert.match(lib,/server_is_healthy/);
  assert.match(lib,/window\.navigate\(url\)/);
});

test('desktop startup has a user-visible fallback and persistent startup log',()=>{
  const lib=read('src-tauri/src/lib.rs');
  const startup=read('public/startup.html');
  assert.match(lib,/startup\.log/);
  assert.match(lib,/mark_startup_failure/);
  assert.match(startup,/showStartupError/);
  assert.match(startup,/Starting local engine/);
});

test('desktop passes package version to the local server health endpoint',()=>{
  const lib=read('src-tauri/src/lib.rs');
  const server=read('src/server.mjs');
  assert.match(lib,/SBC_APP_VERSION/);
  assert.match(server,/const APP_VERSION=process\.env\.SBC_APP_VERSION/);
  assert.match(server,/version:APP_VERSION/);
});
