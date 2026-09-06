import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const release = fs.readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
const smoke = fs.readFileSync(new URL('../.github/workflows/desktop-release.yml', import.meta.url), 'utf8');

test('release workflow uploads only final installer extensions, never the entire Tauri bundle tree', () => {
  assert.doesNotMatch(release, /path:\s*src-tauri\/target\/release\/bundle\/\*\*/);
  assert.doesNotMatch(release, /files:\s*\|[\s\S]*release-assets\/\*\*/);
  for (const ext of ['*.exe', '*.dmg', '*.AppImage', '*.deb']) assert.match(release, new RegExp(ext.replace('.', '\\.').replace('*', '\\*')));
  assert.match(release, /final-assets\/\*/);
});

test('release workflow can clean stale assets and rebuild an existing tag', () => {
  assert.match(release, /workflow_dispatch:/);
  assert.match(release, /Remove stale assets from an existing release/);
  assert.match(release, /releases\/assets\/\$\{asset_id\}/);
});

test('desktop smoke workflow publishes only distributable installer files', () => {
  assert.doesNotMatch(smoke, /path:\s*src-tauri\/target\/release\/bundle\/\*\*/);
  assert.match(smoke, /bundle\/nsis\/\*\.exe/);
  assert.match(smoke, /bundle\/dmg\/\*\.dmg/);
  assert.match(smoke, /bundle\/appimage\/\*\.AppImage/);
  assert.match(smoke, /bundle\/deb\/\*\.deb/);
});
