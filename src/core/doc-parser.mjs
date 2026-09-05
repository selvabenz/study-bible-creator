import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDocx } from './docx-parser.mjs';

function existsExecutable(candidate) {
  if (!candidate) return false;
  if (candidate.includes(path.sep) || path.isAbsolute(candidate)) return fs.existsSync(candidate);
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(checker, [candidate], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findLibreOffice() {
  const explicit = process.env.SBC_LIBREOFFICE;
  const candidates = [
    explicit,
    process.platform === 'win32' ? 'soffice.com' : null,
    'soffice',
    'libreoffice',
    process.platform === 'darwin' ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : null,
    process.platform === 'win32' ? 'C:\\Program Files\\LibreOffice\\program\\soffice.com' : null,
    process.platform === 'win32' ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe' : null,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe' : null,
  ].filter(Boolean);

  return candidates.find(existsExecutable) ?? null;
}

function assertLegacyDoc(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(8);
    const read = fs.readSync(fd, header, 0, 8, 0);
    if (read < 8) throw new Error('Legacy DOC file is too small to be valid.');
    // Microsoft Compound File Binary Format signature: D0 CF 11 E0 A1 B1 1A E1
    const expected = Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
    if (!header.equals(expected)) {
      throw new Error('The file has a .doc extension but is not a recognized Microsoft Word binary DOC file.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Legacy .doc adapter.
 *
 * V0.2 uses a deterministic local conversion through LibreOffice when available,
 * then feeds the generated DOCX into the same semantic parser as native DOCX.
 * The original .doc file is never modified.
 *
 * This adapter is intentionally isolated so a smaller bundled native converter can
 * replace LibreOffice in the Tauri production line without changing importer APIs.
 */
export function parseDoc(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('DOC file not found');
  assertLegacyDoc(filePath);

  const soffice = findLibreOffice();
  if (!soffice) {
    throw new Error(
      'Legacy .doc recognized, but no local DOC converter is available. ' +
      'Install LibreOffice or set SBC_LIBREOFFICE to the soffice executable. ' +
      'DOCX, USFM/SFM, CSV, TSV and JSON imports remain available.'
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-doc-'));
  try {
    execFileSync(soffice, [
      '--headless',
      '--convert-to', 'docx',
      '--outdir', tempDir,
      filePath,
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });

    const expectedName = `${path.basename(filePath, path.extname(filePath))}.docx`;
    let converted = path.join(tempDir, expectedName);
    if (!fs.existsSync(converted)) {
      const alternatives = fs.readdirSync(tempDir).filter(f => f.toLowerCase().endsWith('.docx'));
      if (alternatives.length !== 1) {
        throw new Error('Legacy DOC conversion completed without producing a unique DOCX file.');
      }
      converted = path.join(tempDir, alternatives[0]);
    }

    const parsed = parseDocx(converted);
    return {
      ...parsed,
      format: 'doc',
      conversionStrategy: 'libreoffice-local',
      warnings: [
        ...(parsed.warnings ?? []),
        'Legacy DOC was converted locally to temporary DOCX for parsing; the original DOC file was not modified.'
      ],
    };
  } catch (error) {
    const message = error?.stderr?.toString?.().trim() || error?.message || String(error);
    throw new Error(`Unable to import legacy DOC file: ${message}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
