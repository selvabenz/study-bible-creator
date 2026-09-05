export const DEFAULT_AUTHORITY_RULES = [
  ['scripture','source_scripture',1000,'Authoritative source-language Scripture'],
  ['scripture','target_scripture',1000,'Authoritative target-language Scripture'],
  ['scripture_fragment','source_scripture',1000,'Authoritative source-language Scripture fragment'],
  ['scripture_fragment','target_scripture',1000,'Authoritative target-language Scripture fragment'],
  ['footnote','footnotes',900,'Corrected standalone footnote resource'],
  ['footnote','source_scripture',500,'Footnote embedded in source Scripture resource'],
  ['footnote','target_scripture',500,'Footnote embedded in target Scripture resource'],
  ['cross_reference','cross_references',900,'Corrected standalone cross-reference resource'],
  ['cross_reference','source_scripture',500,'Cross-reference embedded in source Scripture resource'],
  ['cross_reference','target_scripture',500,'Cross-reference embedded in target Scripture resource'],
  ['study_note','study_notes',900,'Corrected Study Bible note resource'],
  ['section_heading','study_notes',900,'Corrected Study Bible headings resource'],
  ['introduction','introductions',900,'Corrected introduction/back-matter resource'],
  ['introduction_heading','introductions',900,'Corrected introduction/back-matter resource'],
  ['introduction_title','introductions',900,'Corrected introduction/back-matter resource'],
  ['outline','introductions',900,'Corrected introduction/back-matter resource'],
  ['figure','maps_charts',900,'Corrected maps/charts resource'],
  ['docx_paragraph','maps_charts',900,'Corrected maps/charts resource']
];

export function authorityRecommendation({contentType, protectionLevel, existingRole, incomingRole, existingPriority=0, incomingPriority=0}){
  if(protectionLevel==='protected_scripture' || contentType==='scripture' || contentType==='scripture_fragment'){
    return {
      recommendation:'manual_review',
      reason:'Scripture changes always require explicit human review. Authority priority never auto-accepts a Scripture change.'
    };
  }
  if(incomingPriority>existingPriority) return {recommendation:'use_incoming',reason:`Incoming ${incomingRole} resource has higher configured authority (${incomingPriority} > ${existingPriority}). Human confirmation is still required.`};
  if(incomingPriority<existingPriority) return {recommendation:'keep_existing',reason:`Existing ${existingRole} resource has higher configured authority (${existingPriority} > ${incomingPriority}).`};
  return {recommendation:'manual_review',reason:'Existing and incoming resources have equal or unspecified authority. Compare the content manually.'};
}

export function shouldAuthorityCrossMatch(contentType,existingRole,incomingRole){
  const scriptureRoles=new Set(['source_scripture','target_scripture']);
  if(contentType==='footnote') return (incomingRole==='footnotes'&&scriptureRoles.has(existingRole)) || (existingRole==='footnotes'&&scriptureRoles.has(incomingRole));
  if(contentType==='cross_reference') return (incomingRole==='cross_references'&&scriptureRoles.has(existingRole)) || (existingRole==='cross_references'&&scriptureRoles.has(incomingRole));
  if(contentType==='section_heading') return (incomingRole==='study_notes'&&scriptureRoles.has(existingRole)) || (existingRole==='study_notes'&&scriptureRoles.has(incomingRole));
  // Scripture itself is compared within its own source/target role via logical identity; no broad cross-resource matching is allowed.
  return false;
}
