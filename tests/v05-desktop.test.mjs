import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('v0.5 versions are aligned',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const tauri=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  const cargo=fs.readFileSync(path.join(root,'src-tauri','Cargo.toml'),'utf8');
  assert.equal(pkg.version,'0.5.0');
  assert.equal(tauri.version,'0.5.0');
  assert.match(cargo,/version = "0\.5\.0"/);
});

test('Tauri bundles Node as an external sidecar and app resources',()=>{
  const tauri=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  assert.deepEqual(tauri.bundle.externalBin,['binaries/node']);
  assert.ok(tauri.bundle.resources.includes('resources/app/**/*'));
});

test('desktop server is loopback-only and supports session auth',()=>{
  const server=fs.readFileSync(path.join(root,'src','server.mjs'),'utf8');
  assert.match(server,/server\.listen\(PORT,'127\.0\.0\.1'/);
  assert.match(server,/SBC_DESKTOP_TOKEN/);
  assert.match(server,/sbc_session=/);
});

test('single-instance plugin is initialized before shell plugin',()=>{
  const lib=fs.readFileSync(path.join(root,'src-tauri','src','lib.rs'),'utf8');
  const single=lib.indexOf('tauri_plugin_single_instance');
  const shell=lib.indexOf('tauri_plugin_shell::init');
  assert.ok(single>=0 && shell>single);
});

test('desktop prepare script copies Node runtime and app resources',()=>{
  const s=fs.readFileSync(path.join(root,'scripts','prepare-desktop.mjs'),'utf8');
  assert.match(s,/process\.execPath/);
  assert.match(s,/src-tauri/);
  assert.match(s,/resources/);
});
