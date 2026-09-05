import { normalizeText, sha256 } from './utils.mjs';

const markerTypes = new Map([
  ['id','book_id'], ['ide','metadata'], ['usfm','metadata'],
  ['h','header'], ['h1','header'], ['h2','header'], ['h3','header'],
  ['toc1','toc'], ['toc2','toc'], ['toc3','toc'],
  ['mt','book_title'], ['mt1','book_title'], ['mt2','book_title'],
  ['imt','introduction_title'], ['imt1','introduction_title'], ['imt2','introduction_title'],
  ['is','introduction_heading'], ['is1','introduction_heading'], ['is2','introduction_heading'],
  ['ip','introduction'], ['ipi','introduction'], ['im','introduction'], ['imi','introduction'],
  ['io','outline'], ['io1','outline'], ['io2','outline'], ['io3','outline'],
  ['ior','outline_reference'], ['ili','introduction_list'], ['ili1','introduction_list'], ['ili2','introduction_list'],
  ['c','chapter'], ['cl','chapter_label'], ['cp','chapter_label'],
  ['v','scripture'],
  ['s','section_heading'], ['s1','section_heading'], ['s2','section_heading'], ['s3','section_heading'], ['s4','section_heading'],
  ['ms','major_section'], ['ms1','major_section'], ['ms2','major_section'], ['mr','major_section'], ['r','parallel_reference'],
  ['p','paragraph'], ['m','paragraph'], ['mi','paragraph'], ['pi','paragraph'], ['pi1','paragraph'], ['pi2','paragraph'], ['pc','paragraph'], ['pr','paragraph'],
  ['q','poetry'], ['q1','poetry'], ['q2','poetry'], ['q3','poetry'], ['q4','poetry'], ['qr','poetry'], ['qc','poetry'],
  ['b','space'], ['nb','paragraph'],
  ['esb','study_block'], ['esbe','study_block_end'], ['cat','category'],
  ['fig','figure'],
]);

function parseMarkerLine(line) {
  const m = line.match(/^\\([^\s]+)(?:\s+(.*))?$/u);
  if (!m) return null;
  return { marker: m[1], rest: m[2] ?? '' };
}

function extractInline(text, startMarker, endMarker) {
  const out = [];
  const startRe = new RegExp(`\\\\${startMarker}(?=\\s)`, 'g');
  const end = `\\${endMarker}*`;
  let m;
  while ((m = startRe.exec(text))) {
    const s = m.index;
    const e = text.indexOf(end, startRe.lastIndex);
    if (e < 0) {
      out.push({ raw: text.slice(s), start: s, end: text.length, unclosed: true });
      break;
    }
    const endPos = e + end.length;
    out.push({ raw: text.slice(s, endPos), start: s, end: endPos, unclosed: false });
    startRe.lastIndex = endPos;
  }
  return out;
}

function stripInlineUsfm(text) {
  return normalizeText(String(text ?? '')
    .replace(/\\[a-z0-9]+\*?/giu, ' ')
    .replace(/\|[^\\]+(?=\\|$)/g, ' '));
}

function stripVisibleUsfm(text) {
  const visible = String(text ?? '')
    .replace(/\\f(?=\s)[\s\S]*?\\f\*/giu, ' ')
    .replace(/\\x(?=\s)[\s\S]*?\\x\*/giu, ' ')
    .replace(/\\f(?=\s)[\s\S]*$/giu, ' ')
    .replace(/\\x(?=\s)[\s\S]*$/giu, ' ');
  return stripInlineUsfm(visible);
}

export function parseUsfm(buffer, options={}) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  let bookCode = options.bookCode ?? null;
  let chapter = null;
  let currentVerse = null;
  let sequence = 0;
  const items = [];
  const warnings = [];
  const semanticCounters = new Map();

  function nextOrdinal(scope) {
    const n = semanticCounters.get(scope) ?? 0;
    semanticCounters.set(scope, n + 1);
    return n;
  }

  function semanticKeyFor(contentType, marker, verse, category) {
    const b = bookCode ?? 'UNK';
    const c = chapter ?? 0;
    const v = verse == null ? '' : String(verse);
    if (contentType === 'scripture') return `${b}|${c}|${v}|scripture`;
    if (contentType === 'chapter') return `${b}|${c}|chapter`;
    if (contentType === 'book_id') return `${b}|book_id`;
    const scope = `${b}|${c}|${v}|${contentType}|${marker ?? ''}|${category ?? ''}`;
    return `${scope}|${nextOrdinal(scope)}`;
  }

  function add({contentType, marker, verse=currentVerse, rawText='', textValue='', parentSemanticKey=null, sourceLocator=null, category=null}) {
    const normalized = normalizeText(textValue);
    const semanticKey = semanticKeyFor(contentType, marker, verse, category);
    const item = {
      bookCode, chapter, verse: verse == null ? null : String(verse),
      contentType, marker: marker ?? null, category,
      sequenceNo: sequence++, parentSemanticKey,
      rawText, currentText: textValue, normalizedText: normalized,
      contentHash: sha256(normalized),
      semanticKey,
      logicalKey: semanticKey,
      protectionLevel: contentType === 'scripture' ? 'protected_scripture' : 'normal',
      sourceLocator: sourceLocator ?? `line:${sequence}`
    };
    items.push(item);
    return item;
  }

  for (let i=0;i<lines.length;i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    const parsed = parseMarkerLine(rawLine.trim());
    if (!parsed) {
      add({contentType:'continuation', marker:null, rawText:rawLine, textValue:rawLine, sourceLocator:`line:${i+1}`});
      continue;
    }
    const {marker, rest} = parsed;
    const baseMarker = marker.replace(/\*$/,'');
    if (baseMarker === 'id') {
      const [code, ...tail] = rest.trim().split(/\s+/);
      if (code) bookCode = code.toUpperCase();
      add({contentType:'book_id', marker:baseMarker, rawText:rawLine, textValue:tail.join(' '), verse:null, sourceLocator:`line:${i+1}`});
      continue;
    }
    if (baseMarker === 'c') {
      const n = parseInt(rest.trim(),10);
      chapter = Number.isFinite(n) ? n : chapter;
      currentVerse = null;
      add({contentType:'chapter', marker:baseMarker, rawText:rawLine, textValue:rest, verse:null, sourceLocator:`line:${i+1}`});
      continue;
    }
    if (baseMarker === 'v') {
      const vm = rest.match(/^(\S+)\s*(.*)$/u);
      const verseNo = vm?.[1] ?? '';
      const body = vm?.[2] ?? '';
      currentVerse = verseNo;
      const parent = add({contentType:'scripture', marker:baseMarker, rawText:rawLine, textValue:stripVisibleUsfm(body), verse:verseNo, sourceLocator:`line:${i+1}`});
      for (const f of extractInline(body,'f','f')) {
        add({contentType:'footnote', marker:'f', rawText:f.raw, textValue:stripInlineUsfm(f.raw), verse:verseNo, parentSemanticKey:parent.semanticKey, sourceLocator:`line:${i+1}:footnote`});
        if (f.unclosed) warnings.push({type:'unclosed_footnote', line:i+1, verse:verseNo});
      }
      for (const x of extractInline(body,'x','x')) {
        add({contentType:'cross_reference', marker:'x', rawText:x.raw, textValue:stripInlineUsfm(x.raw), verse:verseNo, parentSemanticKey:parent.semanticKey, sourceLocator:`line:${i+1}:crossref`});
        if (x.unclosed) warnings.push({type:'unclosed_cross_reference', line:i+1, verse:verseNo});
      }
      continue;
    }
    const type = markerTypes.get(baseMarker) ?? 'other';
    const parent = add({contentType:type, marker:baseMarker, rawText:rawLine, textValue:stripVisibleUsfm(rest), sourceLocator:`line:${i+1}`});
    for (const f of extractInline(rest,'f','f')) {
      add({contentType:'footnote', marker:'f', rawText:f.raw, textValue:stripInlineUsfm(f.raw), parentSemanticKey:parent.semanticKey, sourceLocator:`line:${i+1}:footnote`});
      if (f.unclosed) warnings.push({type:'unclosed_footnote', line:i+1, verse:currentVerse});
    }
    for (const x of extractInline(rest,'x','x')) {
      add({contentType:'cross_reference', marker:'x', rawText:x.raw, textValue:stripInlineUsfm(x.raw), parentSemanticKey:parent.semanticKey, sourceLocator:`line:${i+1}:crossref`});
      if (x.unclosed) warnings.push({type:'unclosed_cross_reference', line:i+1, verse:currentVerse});
    }
  }

  const chapters = [...new Set(items.filter(x=>x.chapter != null).map(x=>x.chapter))].sort((a,b)=>a-b);
  const verses = items.filter(x=>x.contentType==='scripture').length;
  const stats = {};
  for (const item of items) stats[item.contentType] = (stats[item.contentType]||0)+1;
  return { format:'usfm', bookCode, chapters, verses, items, warnings, stats };
}
