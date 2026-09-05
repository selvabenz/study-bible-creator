import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUsfm} from '../src/core/usfm-parser.mjs';

test('USFM parser separates protected scripture, footnotes and cross references',()=>{
  const b=Buffer.from('\\id MAT Test\n\\c 1\n\\p\n\\v 1 Text \\f + \\fr 1:1 \\ft note\\f* more \\x + \\xo 1:1 \\xt Gen 1:1\\x*\n');
  const p=parseUsfm(b);
  assert.equal(p.bookCode,'MAT');
  assert.equal(p.verses,1);
  assert.equal(p.items.filter(x=>x.contentType==='scripture')[0].protectionLevel,'protected_scripture');
  assert.equal(p.items.filter(x=>x.contentType==='footnote').length,1);
  assert.equal(p.items.filter(x=>x.contentType==='cross_reference').length,1);
});

test('inline note content is removed from visible scripture text but stored separately',()=>{
  const p=parseUsfm(Buffer.from('\\id MAT\n\\c 1\n\\v 1 Before \\f + \\ft note\\f* after\n'));
  const s=p.items.find(x=>x.contentType==='scripture');
  const f=p.items.find(x=>x.contentType==='footnote');
  assert.ok(s.currentText.includes('Before'));
  assert.ok(s.currentText.includes('after'));
  assert.ok(!s.currentText.includes('note'));
  assert.ok(f.currentText.includes('note'));
});
