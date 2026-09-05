import { sha256 } from './utils.mjs';

const ENGINE='local-deterministic-v0.3';
const ZERO_WIDTH=/[\u200B\u200C\u200D\u2060\uFEFF]/u;
const MALFORMED_MARKER=/\\\s+[A-Za-z][A-Za-z0-9]*|\\[A-Za-z][A-Za-z0-9]*\s+\*/u;

const digitRanges=[
  [0x0660,0x0669],[0x06F0,0x06F9],[0x0966,0x096F],[0x09E6,0x09EF],[0x0A66,0x0A6F],[0x0AE6,0x0AEF],
  [0x0B66,0x0B6F],[0x0BE6,0x0BEF],[0x0C66,0x0C6F],[0x0CE6,0x0CEF],[0x0D66,0x0D6F],[0x0E50,0x0E59],
  [0x0ED0,0x0ED9],[0x0F20,0x0F29],[0x1040,0x1049]
];
function asciiDigit(ch){
  const cp=ch.codePointAt(0);
  if(cp>=0x30&&cp<=0x39)return ch;
  for(const [a,b] of digitRanges)if(cp>=a&&cp<=b)return String(cp-a);
  return ch;
}
function normalizeNumericText(text){
  let s=[...String(text??'')].map(asciiDigit).join('');
  s=s.replace(/[‐‑‒–—−]/g,'-').replace(/\s*([:\/\-])\s*/g,'$1');
  return s;
}
function nums(text){
  const s=normalizeNumericText(text);
  // Fractions, references, ranges (including cross-chapter ranges), then plain numbers.
  return s.match(/\d+\/\d+|\d+(?::\d+)?(?:-\d+(?::\d+)?)?|\d+(?:\.\d+)?/g)||[];
}
function sameNumericMultiset(a,b){if(a.length!==b.length)return false;const aa=[...a].sort(),bb=[...b].sort();return aa.every((v,i)=>v===bb[i]);}
function fp(parts){return sha256(parts.map(x=>String(x??'')).join('|'));}

export function runLocalQa(store,projectId){
  store.clearEngineIssues(projectId,ENGINE);
  const project=store.getProject(projectId);
  if(!project) throw new Error('Project not found');
  const all=store.listContent(projectId,{limit:1000});
  // listContent is intentionally paged; fetch all deterministically in chunks.
  let rows=[...all]; let offset=rows.length;
  while(all.length===1000){
    const more=store.listContent(projectId,{limit:1000,offset});
    if(!more.length) break;
    rows.push(...more); offset+=more.length;
    if(more.length<1000) break;
  }
  let created=0;
  const add=issue=>{store.createIssue({...issue,projectId,engine:ENGINE});created++;};

  for(const item of rows){
    const raw=String(item.raw_text??item.current_text??'');
    const text=String(item.current_text??'');
    if(ZERO_WIDTH.test(text)) add({
      contentItemId:item.id, fingerprint:fp([ENGINE,'zero_width',item.id]), category:'unicode_zero_width',severity:'medium',confidence:1,
      message:'Invisible zero-width Unicode character detected.',
      evidence:{sourceLocator:item.source_locator,characters:[...text].filter(ch=>ZERO_WIDTH.test(ch)).map(ch=>`U+${ch.codePointAt(0).toString(16).toUpperCase()}`)}
    });
    if(text && text.normalize('NFC')!==text) add({
      contentItemId:item.id, fingerprint:fp([ENGINE,'nfc',item.id]), category:'unicode_normalization',severity:'low',confidence:1,
      message:'Text is not in canonical NFC Unicode normalization.',evidence:{sourceLocator:item.source_locator}
    });
    if(MALFORMED_MARKER.test(raw)) add({
      contentItemId:item.id,fingerprint:fp([ENGINE,'marker_spacing',item.id]),category:'usfm_marker_spacing',severity:'high',confidence:0.99,
      message:'Malformed USFM marker spacing detected.',evidence:{sourceLocator:item.source_locator,rawText:raw}
    });
  }

  // Compare source/target items that share the same semantic identity.
  const groups=new Map();
  for(const item of rows){
    const k=item.semantic_key||item.logical_key;
    if(!groups.has(k)) groups.set(k,{source:null,target:null});
    if(item.language_role==='source') groups.get(k).source=item;
    if(item.language_role==='target') groups.get(k).target=item;
  }
  for(const [key,g] of groups){
    if(g.source&&g.target){
      const a=nums(g.source.current_text), b=nums(g.target.current_text);
      if((a.length||b.length)&&!sameNumericMultiset(a,b)) add({
        contentItemId:g.target.id,pairedContentItemId:g.source.id,fingerprint:fp([ENGINE,'numbers',key,a.join(','),b.join(',')]),category:'number_mismatch',severity:g.target.protection_level==='protected_scripture'?'high':'high',confidence:0.98,
        message:'Source and target numeric sequences differ. Review whether the difference is intentional.',
        evidence:{sourceNumbers:a,targetNumbers:b,sourceText:g.source.current_text,targetText:g.target.current_text,protectedScripture:g.target.protection_level==='protected_scripture'}
      });
    }
  }

  // Scripture presence differences are reported as versification review items, not mistranslation errors.
  for(const [key,g] of groups){
    const only=g.source||g.target;
    if(!only||only.content_type!=='scripture'||(g.source&&g.target)) continue;
    add({
      contentItemId:(g.target||g.source).id,pairedContentItemId:null,fingerprint:fp([ENGINE,'versification',key,g.source?'source_only':'target_only']),category:'versification_difference',severity:'info',confidence:1,
      message:g.source?'Scripture verse exists in the source edition but no paired target verse was found.':'Scripture verse exists in the target edition but no paired source verse was found. Treat as a possible versification/textual-edition difference, not an automatic translation error.',
      evidence:{semanticKey:key,side:g.source?'source_only':'target_only',book:(g.target||g.source).book_code,chapter:(g.target||g.source).chapter,verse:(g.target||g.source).verse}
    });
  }

  const conflicts=store.listConflicts(projectId,'pending');
  for(const c of conflicts){
    add({contentItemId:c.existing_content_item_id,fingerprint:fp([ENGINE,'import_conflict',c.id]),category:'import_conflict',severity:c.protection_level==='protected_scripture'?'critical':'medium',confidence:1,
      message:'Incoming import contains different content for an existing logical record. No overwrite was performed.',
      evidence:{existingText:c.existing_text,incomingText:c.incoming_text,sourceLocator:c.source_locator,protectedScripture:c.protection_level==='protected_scripture'}
    });
  }

  const issues=store.listIssues(projectId,{status:'open',limit:1000});
  const bySeverity={critical:0,high:0,medium:0,low:0,info:0};
  const byCategory={};
  for(const q of issues){bySeverity[q.severity]=(bySeverity[q.severity]||0)+1;byCategory[q.category]=(byCategory[q.category]||0)+1;}
  return {engine:ENGINE,created,open:issues.length,bySeverity,byCategory};
}
