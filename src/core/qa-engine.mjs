import { sha256 } from './utils.mjs';

const ENGINE='local-deterministic-v0.4';
const ZERO_WIDTH=/[\u200B\u200C\u200D\u2060\uFEFF]/u;
const REPLACEMENT=/\uFFFD/u;
const C0=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const MALFORMED_MARKER=/\\\s+[A-Za-z][A-Za-z0-9]*|\\[A-Za-z][A-Za-z0-9]*\s+\*/u;
const chapterCounts={GEN:50,EXO:40,LEV:27,NUM:36,DEU:34,JOS:24,JDG:21,RUT:4,'1SA':31,'2SA':24,'1KI':22,'2KI':25,'1CH':29,'2CH':36,EZR:10,NEH:13,EST:10,JOB:42,PSA:150,PRO:31,ECC:12,SNG:8,ISA:66,JER:52,LAM:5,EZK:48,DAN:12,HOS:14,JOL:3,AMO:9,OBA:1,JON:4,MIC:7,NAM:3,HAB:3,ZEP:3,HAG:2,ZEC:14,MAL:4,MAT:28,MRK:16,LUK:24,JHN:21,ACT:28,ROM:16,'1CO':16,'2CO':13,GAL:6,EPH:6,PHP:4,COL:4,'1TH':5,'2TH':3,'1TI':6,'2TI':4,TIT:3,PHM:1,HEB:13,JAS:5,'1PE':5,'2PE':3,'1JN':5,'2JN':1,'3JN':1,JUD:1,REV:22};

const digitRanges=[[0x0660,0x0669],[0x06F0,0x06F9],[0x0966,0x096F],[0x09E6,0x09EF],[0x0A66,0x0A6F],[0x0AE6,0x0AEF],[0x0B66,0x0B6F],[0x0BE6,0x0BEF],[0x0C66,0x0C6F],[0x0CE6,0x0CEF],[0x0D66,0x0D6F],[0x0E50,0x0E59],[0x0ED0,0x0ED9],[0x0F20,0x0F29],[0x1040,0x1049]];
function asciiDigit(ch){const cp=ch.codePointAt(0);if(cp>=0x30&&cp<=0x39)return ch;for(const [a,b] of digitRanges)if(cp>=a&&cp<=b)return String(cp-a);return ch;}
function normalizeNumericText(text){let s=[...String(text??'')].map(asciiDigit).join('');return s.replace(/[‐‑‒–—−]/g,'-').replace(/\s*([:\/\-])\s*/g,'$1');}
function nums(text){return normalizeNumericText(text).match(/\d+\/\d+|\d+(?::\d+)?(?:-\d+(?::\d+)?)?|\d+(?:\.\d+)?/g)||[];}
function sameNumericMultiset(a,b){if(a.length!==b.length)return false;const aa=[...a].sort(),bb=[...b].sort();return aa.every((v,i)=>v===bb[i]);}
function fp(parts){return sha256(parts.map(x=>String(x??'')).join('|'));}
function markerSeq(text){return [...String(text??'').matchAll(/\\([A-Za-z][A-Za-z0-9]*)(\*)?/g)].map(m=>`${m[1].toLowerCase()}${m[2]?'*':''}`);}
function sameSeq(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
function starts(text,m){return (String(text).match(new RegExp(`\\\\${m}(?=\\s|\\+|$)`,'g'))||[]).length;}
function ends(text,m){return (String(text).match(new RegExp(`\\\\${m}\\*`,'g'))||[]).length;}

export function runLocalQa(store,projectId){
  store.clearEngineIssues(projectId,ENGINE); const project=store.getProject(projectId); if(!project) throw new Error('Project not found');
  let rows=[],offset=0;while(true){const more=store.listContent(projectId,{limit:1000,offset});rows.push(...more);if(more.length<1000)break;offset+=more.length;}
  let created=0; const add=issue=>{store.createIssue({...issue,projectId,engine:ENGINE});created++;};

  for(const item of rows){
    const raw=String(item.raw_text??item.current_text??''), text=String(item.current_text??'');
    if(ZERO_WIDTH.test(text)) add({contentItemId:item.id,fingerprint:fp([ENGINE,'zero_width',item.id]),category:'unicode_zero_width',severity:'medium',confidence:1,message:'Invisible zero-width Unicode character detected.',evidence:{sourceLocator:item.source_locator,characters:[...text].filter(ch=>ZERO_WIDTH.test(ch)).map(ch=>`U+${ch.codePointAt(0).toString(16).toUpperCase()}`)}});
    if(REPLACEMENT.test(text)) add({contentItemId:item.id,fingerprint:fp([ENGINE,'replacement',item.id]),category:'unicode_replacement_character',severity:'high',confidence:1,message:'Unicode replacement character (U+FFFD) detected; source text may have been decoded incorrectly.',evidence:{sourceLocator:item.source_locator}});
    if(C0.test(text)) add({contentItemId:item.id,fingerprint:fp([ENGINE,'control',item.id]),category:'invalid_control_character',severity:'high',confidence:1,message:'Unexpected control character detected in publishable text.',evidence:{sourceLocator:item.source_locator}});
    if(text && text.normalize('NFC')!==text) add({contentItemId:item.id,fingerprint:fp([ENGINE,'nfc',item.id]),category:'unicode_normalization',severity:'low',confidence:1,message:'Text is not in canonical NFC Unicode normalization.',evidence:{sourceLocator:item.source_locator}});
    if(MALFORMED_MARKER.test(raw)) add({contentItemId:item.id,fingerprint:fp([ENGINE,'marker_spacing',item.id]),category:'usfm_marker_spacing',severity:'high',confidence:0.99,message:'Malformed USFM marker spacing detected.',evidence:{sourceLocator:item.source_locator,rawText:raw}});
    for(const m of ['f','x']){const a=starts(raw,m),b=ends(raw,m);if(a!==b)add({contentItemId:item.id,fingerprint:fp([ENGINE,'marker_balance',m,item.id,a,b]),category:'usfm_marker_balance',severity:'high',confidence:1,message:`Unbalanced \\${m} … \\${m}* marker pair detected.`,evidence:{sourceLocator:item.source_locator,startCount:a,endCount:b,rawText:raw}});}
    const max=chapterCounts[item.book_code]; if(max && item.chapter!=null && (Number(item.chapter)<1||Number(item.chapter)>max)) add({contentItemId:item.id,fingerprint:fp([ENGINE,'chapter_range',item.id]),category:'invalid_chapter_anchor',severity:'critical',confidence:1,message:`Chapter ${item.chapter} is outside the supported range for ${item.book_code} (1–${max}).`,evidence:{bookCode:item.book_code,chapter:item.chapter,maxChapter:max}});
  }

  // Source/target fidelity checks pair by semantic key (same bilingual record or same Scripture identity).
  const groups=new Map();
  for(const item of rows){const k=item.semantic_key||item.logical_key;if(!groups.has(k))groups.set(k,{source:null,target:null,all:[]});const g=groups.get(k);g.all.push(item);if(item.language_role==='source')g.source=item;if(item.language_role==='target')g.target=item;}
  const translatable=new Set(['study_note','section_heading','footnote','cross_reference','introduction','introduction_heading','introduction_title','outline','major_section','parallel_reference']);
  for(const [key,g] of groups){
    if(g.source&&g.target){
      const a=nums(g.source.current_text),b=nums(g.target.current_text);if((a.length||b.length)&&!sameNumericMultiset(a,b))add({contentItemId:g.target.id,pairedContentItemId:g.source.id,fingerprint:fp([ENGINE,'numbers',key,a.join(','),b.join(',')]),category:'number_mismatch',severity:'high',confidence:0.98,message:'Source and target numeric sequences differ. Review whether the difference is intentional.',evidence:{sourceNumbers:a,targetNumbers:b,sourceText:g.source.current_text,targetText:g.target.current_text,protectedScripture:g.target.protection_level==='protected_scripture'}});
      if(translatable.has(g.source.content_type)&&String(g.source.current_text).trim()&&!String(g.target.current_text).trim()) add({contentItemId:g.target.id,pairedContentItemId:g.source.id,fingerprint:fp([ENGINE,'empty_target',key]),category:'empty_target_content',severity:'high',confidence:1,message:'Source content is present but the paired target field is empty.',evidence:{sourceText:g.source.current_text,sourceLocator:g.source.source_locator,targetLocator:g.target.source_locator}});
      if(g.source.content_type!=='scripture'&&g.target.content_type!=='scripture'&&g.source.resource_role===g.target.resource_role&&!['source_scripture','target_scripture'].includes(g.source.resource_role)){
        const sa=markerSeq(g.source.raw_text),sb=markerSeq(g.target.raw_text);if((sa.length||sb.length)&&!sameSeq(sa,sb))add({contentItemId:g.target.id,pairedContentItemId:g.source.id,fingerprint:fp([ENGINE,'marker_seq',key,sa.join(','),sb.join(',')]),category:'usfm_marker_sequence_mismatch',severity:'medium',confidence:0.98,message:'Source and target inline USFM marker sequences differ.',evidence:{sourceMarkers:sa,targetMarkers:sb,sourceRaw:g.source.raw_text,targetRaw:g.target.raw_text}});
      }
    }
    const only=g.source||g.target;if(only?.content_type==='scripture'&&!(g.source&&g.target))add({contentItemId:only.id,pairedContentItemId:null,fingerprint:fp([ENGINE,'versification',key,g.source?'source_only':'target_only']),category:'versification_difference',severity:'info',confidence:1,message:g.source?'Scripture verse exists in the source edition but no paired target verse was found.':'Scripture verse exists in the target edition but no paired source verse was found. Treat as a possible versification/textual-edition difference, not an automatic translation error.',evidence:{semanticKey:key,side:g.source?'source_only':'target_only',book:only.book_code,chapter:only.chapter,verse:only.verse}});
  }

  // Canonical duplicate identity is checked independently by match key + language.
  const matchGroups=new Map();for(const r of rows){const k=r.match_key||r.semantic_key||r.logical_key,lang=r.language_code||r.language_role||'',role=r.resource_role||'',mk=`${role}|${lang}|${k}`;if(!matchGroups.has(mk))matchGroups.set(mk,[]);matchGroups.get(mk).push(r);}
  for(const [mk,dups] of matchGroups)if(dups.length>1)add({contentItemId:dups[0].id,fingerprint:fp([ENGINE,'duplicate_match',mk,dups.map(x=>x.id).sort().join(',')]),category:'duplicate_canonical_record',severity:'high',confidence:1,message:'Multiple active database records share the same language and canonical match identity.',evidence:{matchIdentity:mk,recordIds:dups.map(x=>x.id),resourceRoles:dups.map(x=>x.resource_role)}});

  // Import conflicts are reviewed in the dedicated Conflict Center and gate publication independently; they are not duplicated as QA findings.

  const bySeverity={critical:0,high:0,medium:0,low:0,info:0},byCategory={};
  for(const q of store.db.prepare(`SELECT severity,COUNT(*) count FROM qa_issues WHERE project_id=? AND status='open' GROUP BY severity`).all(projectId))bySeverity[q.severity]=q.count;
  for(const q of store.db.prepare(`SELECT category,COUNT(*) count FROM qa_issues WHERE project_id=? AND status='open' GROUP BY category`).all(projectId))byCategory[q.category]=q.count;
  const open=Object.values(byCategory).reduce((a,b)=>a+b,0);return {engine:ENGINE,created,open,bySeverity,byCategory};
}
