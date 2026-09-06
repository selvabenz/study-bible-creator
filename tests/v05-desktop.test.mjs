import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('package, Tauri, and Cargo versions are aligned',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const tauri=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  const cargo=fs.readFileSync(path.join(root,'src-tauri','Cargo.toml'),'utf8');
  const cargoVersion=cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  assert.ok(cargoVersion,'Cargo.toml package version was not found');
  assert.equal(tauri.version,pkg.version);
  assert.equal(cargoVersion,pkg.version);
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

test('desktop icon set exists for Windows macOS and Linux packaging',()=>{
  const tauri=JSON.parse(fs.readFileSync(path.join(root,'src-tauri','tauri.conf.json'),'utf8'));
  const required=['icons/32x32.png','icons/128x128.png','icons/128x128@2x.png','icons/icon.png','icons/icon.icns','icons/icon.ico'];
  assert.deepEqual(tauri.bundle.icon,required);
  for(const relative of required){
    const full=path.join(root,'src-tauri',relative);
    assert.ok(fs.existsSync(full),`missing Tauri icon asset: ${relative}`);
    assert.ok(fs.statSync(full).size>100,`empty/invalid icon asset: ${relative}`);
  }
  const png=fs.readFileSync(path.join(root,'src-tauri','icons','icon.png'));
  assert.deepEqual([...png.subarray(0,8)],[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const ico=fs.readFileSync(path.join(root,'src-tauri','icons','icon.ico'));
  assert.equal(ico.readUInt16LE(0),0);
  assert.equal(ico.readUInt16LE(2),1);
  const icns=fs.readFileSync(path.join(root,'src-tauri','icons','icon.icns'));
  assert.equal(icns.subarray(0,4).toString('ascii'),'icns');
});
