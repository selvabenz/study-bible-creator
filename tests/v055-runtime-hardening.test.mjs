import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('desktop startup captures sidecar stdout stderr errors and termination',()=>{
  const lib=read('src-tauri/src/lib.rs');
  for(const token of ['CommandEvent::Stdout','CommandEvent::Stderr','CommandEvent::Error','CommandEvent::Terminated','sidecar_stdout=','sidecar_stderr=','sidecar_terminated']) assert.match(lib,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(lib,/let _child_guard = child/);
});

test('desktop startup is non-blocking and tolerates slow first-run verification',()=>{
  const lib=read('src-tauri/src/lib.rs');
  assert.match(lib,/Duration::from_secs\(45\)/);
  assert.match(lib,/thread::spawn\(move \|\|/);
  assert.match(lib,/STARTUP_TARGET/);
  assert.match(lib,/startup_target_exceeded/);
  assert.doesNotMatch(lib,/for _ in 0\.\.100/);
});

test('startup UI can show live slow-start status and detailed failure',()=>{
  const html=read('public/startup.html');
  assert.match(html,/updateStartupStatus/);
  assert.match(html,/showStartupError/);
  assert.match(html,/startup\.log/);
  assert.doesNotMatch(html,/close and reopen the app/i);
});

test('SQLite is tuned for local desktop responsiveness with bounded waits',()=>{
  const db=read('src/core/db.mjs');
  for(const pragma of ['journal_mode = WAL','synchronous = NORMAL','busy_timeout = 5000','temp_store = MEMORY','cache_size = -20000']) assert.ok(db.includes(pragma),`missing ${pragma}`);
  for(const idx of ['idx_content_browse','idx_qa_review','idx_conflict_review']) assert.ok(db.includes(idx),`missing ${idx}`);
});

test('HTTP engine bounds request memory and treats malformed JSON as client error',()=>{
  const server=read('src/server.mjs');
  assert.match(server,/MAX_REQUEST_BYTES=128\*1024\*1024/);
  assert.match(server,/statusCode=413/);
  assert.match(server,/statusCode=400/);
  assert.match(server,/database_init_failed/);
  assert.match(server,/ready_ms=/);
});

test('package exposes unit sidecar performance and aggregate test commands',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:sidecar'],'node scripts/sidecar-smoke.mjs');
  assert.equal(pkg.scripts['test:performance'],'node scripts/performance-smoke.mjs');
  assert.equal(pkg.scripts['test:functional'],'node scripts/api-functional-smoke.mjs');
  assert.match(pkg.scripts['test:all'],/test:sidecar/);
  assert.match(pkg.scripts['test:all'],/test:functional/);
  assert.match(pkg.scripts['test:all'],/test:performance/);
});

test('desktop smoke workflow installs and launches the built Windows installer',()=>{
  const workflow=read('.github/workflows/desktop-release.yml');
  assert.match(workflow,/windows-installed-smoke\.ps1/);
  assert.match(workflow,/npm run test:all/);
  const smoke=read('scripts/windows-installed-smoke.ps1');
  assert.match(smoke,/\/S/);
  assert.match(smoke,/main_window_navigated=true/);
  assert.match(smoke,/60 seconds/);
});

test('versioned release performs sidecar runtime validation and uses dynamic release notes',()=>{
  const workflow=read('.github/workflows/release.yml');
  assert.match(workflow,/npm run test:sidecar/);
  assert.match(workflow,/windows-installed-smoke\.ps1/);
  assert.match(workflow,/release-notes\.mjs release-notes\.md/);
  assert.match(workflow,/body_path: release-notes\.md/);
  assert.doesNotMatch(workflow,/body_path: docs\/RELEASE_NOTES_v0\.5\.1\.md/);
});

test('desktop uses a uniquely owned sbc-engine sidecar everywhere',()=>{
  const conf=JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.deepEqual(conf.bundle.externalBin,['binaries/sbc-engine']);
  const capability=read('src-tauri/capabilities/default.json');
  const lib=read('src-tauri/src/lib.rs');
  const prep=read('scripts/prepare-desktop.mjs');
  assert.match(capability,/binaries\/sbc-engine/);
  assert.match(lib,/sidecar\("sbc-engine"\)/);
  assert.match(prep,/sbc-engine-/);
  assert.doesNotMatch(lib,/sidecar\("node"\)/);
});

test('Windows installer hooks clean only the app-owned sidecar and never generic node.exe',()=>{
  const hooks=read('src-tauri/windows/hooks.nsh');
  assert.match(hooks,/NSIS_HOOK_PREINSTALL/);
  assert.match(hooks,/NSIS_HOOK_PREUNINSTALL/);
  assert.match(hooks,/taskkill \/F \/IM sbc-engine\.exe/);
  assert.match(hooks,/Delete "\$INSTDIR\\sbc-engine\.exe"/);
  assert.doesNotMatch(hooks,/taskkill[^\n]*node\.exe/i);
  const conf=read('src-tauri/tauri.conf.json');
  assert.match(conf,/"installerHooks": "\.\/windows\/hooks\.nsh"/);
});
