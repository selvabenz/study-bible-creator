import fs from 'node:fs';
import path from 'node:path';
import { parseUsfm } from './usfm-parser.mjs';
import { parseDelimited } from './delimited-parser.mjs';
import { parseJson } from './json-parser.mjs';
import { parseDocx } from './docx-parser.mjs';

export function detectFormat(filename, requested='auto') {
  if (requested && requested!=='auto') return requested.toLowerCase();
  const ext=path.extname(filename).toLowerCase();
  if (ext==='.usfm') return 'usfm'; if (ext==='.sfm') return 'sfm'; if (ext==='.csv') return 'csv'; if (ext==='.tsv') return 'tsv'; if (ext==='.json') return 'json'; if (ext==='.docx') return 'docx';
  throw new Error(`Unsupported format: ${ext || 'unknown'}`);
}

export function parseFile(filePath, requested='auto') {
  const format=detectFormat(filePath,requested);
  if (format==='docx') return parseDocx(filePath);
  const b=fs.readFileSync(filePath);
  if (format==='usfm'||format==='sfm') return {...parseUsfm(b),format};
  if (format==='csv') return parseDelimited(b,',');
  if (format==='tsv') return parseDelimited(b,'\t');
  if (format==='json') return parseJson(b);
  throw new Error(`Unsupported format: ${format}`);
}
