const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={projects:[],project:null,view:'overview',books:[],book:null,chapter:null,pairs:[],selectedPair:null,files:[],issues:[],severity:'',selectedIssue:null,conflicts:[],selectedConflict:null,authorityRules:[]};
const titles={overview:'Project overview',books:'Books & content',import:'Import center',conflicts:'Conflict review',qa:'QA review',language:'Language & style',publish:'Publish & export'};
const roleOptions=[['source_scripture','Source Scripture'],['target_scripture','Target Scripture'],['study_notes','Study notes / bilingual table'],['footnotes','Footnotes'],['cross_references','Cross-references'],['introductions','Introductions / back matter'],['maps_charts','Maps & charts'],['other','Other']];

async function api(url,opt={}){const r=await fetch(url,opt);let data;try{data=await r.json()}catch{data={error:await r.text()}}if(!r.ok)throw new Error(data.error||r.statusText);return data}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n){return Number(n||0).toLocaleString()}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2200)}
function showModal(id){$(id).classList.add('open')}
function closeModals(){$$('.modal-backdrop').forEach(x=>x.classList.remove('open'))}

function showView(name){state.view=name;$$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${name}`)?.classList.add('active');$$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#pageTitle').textContent=titles[name]||'Study Bible Creator';if(state.project)$('#breadcrumbs').textContent=`${state.project.name} · ${state.project.source_language_name||''} → ${state.project.target_language_name||''}`;else $('#breadcrumbs').textContent='Study Bible Creator';if(name==='overview')loadOverview();if(name==='books')loadBooksView();if(name==='conflicts')loadConflicts();if(name==='qa')loadIssues();if(name==='language')loadLanguage();if(name==='publish')loadPublish();}

async function loadProjects(preferId=null){
  state.projects=await api('/api/projects');
  const saved=localStorage.getItem('sbc.currentProject');
  const wanted=preferId||saved;
  state.project=state.projects.find(p=>p.id===wanted)||state.projects[0]||null;
  if(state.project){localStorage.setItem('sbc.currentProject',state.project.id);updateProjectChrome();}
  else{updateProjectChrome();showModal('#projectModal');}
  renderProjectList();
  await loadOverview();
}
function updateProjectChrome(){
  const p=state.project;
  $('#projectName').textContent=p?.name||'No project';
  $('#projectLang').textContent=p?`${p.source_language_name||p.source_language_code||''} → ${p.target_language_name||p.target_language_code||''}`:'Create or open a project';
  $('#projectGlyph').textContent=p?.target_language_name?.slice(0,2).toUpperCase()||'SB';
  $('#breadcrumbs').textContent=p?`${p.name} · ${p.source_language_name||''} → ${p.target_language_name||''}`:'Study Bible Creator';
  $('#languageGlyph').textContent=p?.target_language_name?.slice(0,1)||'文';
  $('#languageTitle').textContent=p?`${p.target_language_name||p.target_language_code} editorial profile`:'Target language';
  const lang=$('#languageCode');lang.innerHTML='<option value="">Auto / bilingual columns</option>'+(p?`<option value="${esc(p.source_language_code)}">${esc(p.source_language_name)} (${esc(p.source_language_code)})</option>${p.target_language_code?`<option value="${esc(p.target_language_code)}">${esc(p.target_language_name)} (${esc(p.target_language_code)})</option>`:''}`:'');
}
function renderProjectList(){
  $('#projectList').innerHTML=state.projects.length?state.projects.map(p=>`<button class="project-choice" data-id="${p.id}"><i>${esc((p.target_language_name||p.name).slice(0,2).toUpperCase())}</i><div><strong>${esc(p.name)}</strong><span>${esc(p.source_language_name||'')} → ${esc(p.target_language_name||'')} · ${fmt(p.item_count)} items</span></div><b>→</b></button>`).join(''):'<p class="empty-line">No projects yet.</p>';
  $$('#projectList .project-choice').forEach(b=>b.onclick=async()=>{state.project=state.projects.find(p=>p.id===b.dataset.id);localStorage.setItem('sbc.currentProject',state.project.id);updateProjectChrome();closeModals();await loadOverview();showView('overview')});
}

async function loadOverview(){
  if(!state.project){$('#emptyState').classList.remove('hidden');$('#overviewContent').classList.add('hidden');return}
  $('#emptyState').classList.add('hidden');$('#overviewContent').classList.remove('hidden');
  const s=await api(`/api/projects/${state.project.id}/stats`);
  const open=(s.issueCounts||[]).reduce((a,x)=>a+x.count,0);const high=(s.issueCounts||[]).filter(x=>['critical','high'].includes(x.severity)).reduce((a,x)=>a+x.count,0);
  $('#overviewTitle').textContent=`${state.project.name}`;
  $('#overviewCopy').textContent=`${s.books.length||0} book${s.books.length===1?'':'s'} in the local database. ${open?`${open} QA findings are open.`:'Run local QA after importing source and target content.'}`;
  $('#metricGrid').innerHTML=[['Content units',s.totals.items||0,'Stored in SQLite'],['Protected Scripture',s.totals.protected||0,'Human approval required'],['Books',s.books.length,'Incremental import supported'],['Open QA',open,high?`${high} critical/high priority`:'No critical/high findings'],['Import conflicts',s.conflicts||0,'Never silently overwritten']].map(([a,b,c])=>`<div class="metric"><span>${a}</span><strong>${fmt(b)}</strong><small>${c}</small></div>`).join('');
  $('#bookOverview').innerHTML=s.books.length?s.books.slice(0,8).map(b=>`<div class="resource-row"><span class="resource-icon">${esc(b.book_code)}</span><div><strong>${esc(b.book_name||b.book_code)}</strong><span>${fmt(b.item_count)} items · ${fmt(b.chapter_count)} chapters</span></div><b>Open</b></div>`).join(''):'<p class="empty-line">No books imported yet.</p>';
  $('#recentFiles').innerHTML=s.files.length?s.files.slice(0,8).map(f=>`<div class="activity"><span class="dot"></span><div><strong>${esc(f.original_filename)}</strong><p>${esc(f.resource_role)} · ${esc(f.format.toUpperCase())}${f.language_code?` · ${esc(f.language_code)}`:''}</p><time>${new Date(f.imported_at).toLocaleString()}</time></div></div>`).join(''):'<p class="empty-line">No imported files yet.</p>';
  $('#qaBadge').textContent=high||open;$('#qaBadge').classList.toggle('hidden',!open);$('#conflictBadge').textContent=s.conflicts||0;$('#conflictBadge').classList.toggle('hidden',!(s.conflicts||0));
  renderPublicationGate(s);
}

async function loadBooksView(){
  if(!state.project)return;
  state.books=await api(`/api/projects/${state.project.id}/books`);
  $('#bookSelect').innerHTML=state.books.length?state.books.map(b=>`<option value="${b.book_code}">${b.book_name||b.book_code} · ${fmt(b.item_count)}</option>`).join(''):'<option value="">No books</option>';
  if(!state.book||!state.books.some(b=>b.book_code===state.book))state.book=state.books[0]?.book_code||null;
  $('#bookSelect').value=state.book||'';
  if(state.book)await loadChapters();else{$('#chapterSelect').innerHTML='<option>No chapters</option>';$('#contentList').innerHTML='<p class="empty-line" style="padding:14px">Import a book to browse content.</p>';}
}
async function loadChapters(){
  if(!state.project||!state.book)return;
  const chapters=await api(`/api/projects/${state.project.id}/books/${encodeURIComponent(state.book)}/chapters`);
  if(!state.chapter||!chapters.some(c=>c.chapter===Number(state.chapter)))state.chapter=chapters[0]?.chapter??null;
  $('#chapterSelect').innerHTML=chapters.length?chapters.map(c=>`<option value="${c.chapter}">Chapter ${c.chapter} · ${fmt(c.item_count)} items</option>`).join(''):'<option value="">Book-level content</option>';
  if(state.chapter!=null)$('#chapterSelect').value=String(state.chapter);
  await loadPairs();
}
async function loadPairs(){
  if(!state.project||!state.book)return;
  const type=$('#typeSelect').value;const qs=new URLSearchParams({book:state.book,limit:'900'});if(state.chapter!=null)qs.set('chapter',state.chapter);if(type)qs.set('type',type);
  state.pairs=await api(`/api/projects/${state.project.id}/pairs?${qs}`);
  $('#contentCount').textContent=`${fmt(state.pairs.length)} units`;$('#contentNavTitle').textContent=`${state.book}${state.chapter?` ${state.chapter}`:''}`;$('#contentNavMeta').textContent=type||'All content types';
  $('#contentList').innerHTML=state.pairs.length?state.pairs.map((p,i)=>{const row=p.target||p.source||p.other?.[0]||{};const label=p.verse?`${p.chapter}:${p.verse}`:(row.current_text||p.contentType||'Content').slice(0,45);const prot=row.protection_level==='protected_scripture';return `<button class="content-item" data-i="${i}"><i class="${prot?'protected':''}">${prot?'◆':iconFor(p.contentType)}</i><div><strong>${esc(label)}</strong><span>${esc(labelType(p.contentType))}</span></div><em>${p.source&&p.target?'↔':p.target?'TA':p.source?'EN':'•'}</em></button>`}).join(''):'<p class="empty-line" style="padding:14px">No matching content.</p>';
  $$('#contentList .content-item').forEach(b=>b.onclick=()=>selectPair(Number(b.dataset.i),b));
  if(state.pairs.length)selectPair(0,$('#contentList .content-item'));else $('#editorPane').innerHTML='<div class="editor-empty"><div>▤</div><h3>No content to display</h3><p>Change the filters or import content.</p></div>';
}
function iconFor(type){return ({study_note:'N',footnote:'F',cross_reference:'R',section_heading:'H',introduction:'I',scripture:'◆',figure:'M'}[type]||'•')}
function labelType(type){return String(type||'content').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function selectPair(index,button){state.selectedPair=state.pairs[index];$$('#contentList .content-item').forEach(x=>x.classList.remove('active'));button?.classList.add('active');renderEditor(state.selectedPair)}
function renderEditor(p){
  const source=p.source,target=p.target,row=target||source||p.other?.[0]||{};const protectedRecord=row.protection_level==='protected_scripture';
  $('#editorPane').innerHTML=`<div class="editor-head"><div><span class="status-chip ${protectedRecord?'protected':''}">${protectedRecord?'◆ Protected Scripture':'Editorial content'}</span><h3>${esc(p.bookCode||'')} ${p.chapter||''}${p.verse?`:${esc(p.verse)}`:''} · ${esc(labelType(p.contentType))}</h3><p>${esc(p.semanticKey)}</p></div><button class="small-btn" data-jump="qa">Open QA</button></div>
    <div class="parallel-editor"><article><header><span class="lang-badge">EN</span><div><strong>${esc(state.project.source_language_name||'Source')}</strong><small>${source?esc(source.source_locator||'database'):'No paired source record'}</small></div></header><div class="text-block">${source?esc(source.current_text):'<span class="muted">No paired source content.</span>'}</div><footer>Source · Read-only</footer></article>
    <article><header><span class="lang-badge">${esc((state.project.target_language_name||'T').slice(0,1))}</span><div><strong>${esc(state.project.target_language_name||'Target')}</strong><small>${target?esc(target.source_locator||'database'):'No paired target record'}</small></div></header><div class="text-block target" dir="${state.project.text_direction||'ltr'}">${target?esc(target.current_text):'<span class="muted">No paired target content.</span>'}</div><footer>${protectedRecord?'◆ Human approval required for any future Scripture change':'Editorial review workflow'}</footer></article></div>
    ${(source?.raw_text||target?.raw_text)?`<details class="raw-box"><summary>Show original marker/raw representation</summary><pre>${esc(`SOURCE\n${source?.raw_text||'—'}\n\nTARGET\n${target?.raw_text||'—'}`)}</pre></details>`:''}`;
  $$('[data-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.jump));
}

function guessRole(name){const n=name.toLowerCase();if(/cross|reference/.test(n))return'cross_references';if(/foot/.test(n))return'footnotes';if(/intro|back matter|glossary/.test(n))return'introductions';if(/map|chart/.test(n))return'maps_charts';if(/study|sub-heading|subheading/.test(n))return'study_notes';if(/gsb/.test(n)&&/\.(?:sfm|usfm)$/.test(n))return'source_scripture';if(/irv|tam/.test(n)&&/\.(?:sfm|usfm)$/.test(n))return'target_scripture';return $('#resourceRole').value||'other'}
function addFiles(files){for(const file of files){if(state.files.some(x=>x.file.name===file.name&&x.file.size===file.size))continue;state.files.push({file,role:guessRole(file.name),status:'ready',preview:null})}renderQueue();}
function renderQueue(){
  $('#analyzeBtn').disabled=!state.files.length;$('#importBadge').textContent=state.files.length;$('#importBadge').classList.toggle('hidden',!state.files.length);
  $('#fileQueue').innerHTML=state.files.length?state.files.map((x,i)=>`<div class="file-row"><i>${esc(x.file.name.split('.').pop().toUpperCase())}</i><div><strong>${esc(x.file.name)}</strong><span>${(x.file.size/1024).toFixed(1)} KB · ${x.status}</span></div><select class="queue-role" data-i="${i}">${roleOptions.map(([v,l])=>`<option value="${v}" ${x.role===v?'selected':''}>${l}</option>`).join('')}</select></div>`).join(''):'<p class="empty-line">No files selected.</p>';
  $$('.queue-role').forEach(s=>s.onchange=()=>state.files[Number(s.dataset.i)].role=s.value);
}
async function analyzeFiles(){
  if(!state.project)return toast('Create or select a project first.');
  $('#analyzeBtn').disabled=true;$('#importPreview').innerHTML='';
  for(let i=0;i<state.files.length;i++){
    const x=state.files[i];x.status='analyzing';renderQueue();
    try{
      let lang=$('#languageCode').value||'';if(!lang&&x.role==='source_scripture')lang=state.project.source_language_code||'';if(!lang&&x.role==='target_scripture')lang=state.project.target_language_code||'';
      const r=await api('/api/import/preview',{method:'POST',headers:{'x-project-id':state.project.id,'x-file-name':encodeURIComponent(x.file.name),'x-language-code':lang,'x-resource-role':x.role,'x-format':'auto'},body:await x.file.arrayBuffer()});
      x.preview=r;x.status=r.exactDuplicate?'duplicate':'previewed';renderImportPreview(x,i);
    }catch(e){x.status='error';x.error=e.message;renderImportError(x,i)}renderQueue();
  }
  $('#analyzeBtn').disabled=false;toast('Import preflight complete');
}
function renderImportPreview(x,i){const r=x.preview;if(r.exactDuplicate){$('#importPreview').insertAdjacentHTML('beforeend',`<div class="panel preview-card"><div class="panel-head"><div><small>EXACT DUPLICATE</small><h3>${esc(x.file.name)}</h3></div><span class="status-chip success">No changes</span></div><div class="preview-ok">This exact file has already been imported for the same role/language. The database was not changed.</div></div>`);return}const s=r.parsedSummary,d=r.duplicateSummary;$('#importPreview').insertAdjacentHTML('beforeend',`<div class="panel preview-card" id="preview-${i}"><div class="panel-head"><div><small>IMPORT PREFLIGHT</small><h3>${esc(x.file.name)}</h3></div><span class="status-chip">${esc(r.format.toUpperCase())} · ${esc(x.role)}</span></div><div class="preview-summary"><div class="preview-stat"><small>Parsed items</small><strong>${fmt(s.items)}</strong></div><div class="preview-stat"><small>New</small><strong>${fmt(d.newItems)}</strong></div><div class="preview-stat"><small>Exact records</small><strong>${fmt(d.exactItems)}</strong></div><div class="preview-stat"><small>Conflicts</small><strong>${fmt(d.changedItems)}</strong></div></div><div class="${s.warnings?.length?'preview-warning':'preview-ok'}">${s.warnings?.length?`${s.warnings.length} parser warning(s). Review after import; original file remains untouched.`:'Structure parsed without parser warnings.'} ${s.bookCode?`Detected book: ${esc(s.bookCode)}.`:''} ${s.languageBreakdown?`Source rows: ${fmt(s.languageBreakdown.source)}, target rows: ${fmt(s.languageBreakdown.target)}.`:''}</div>${d.crossResourceOverlaps?`<div class="preview-warning"><strong>${fmt(d.crossResourceOverlaps)} cross-resource overlap(s)</strong> · ${fmt(d.recommendedIncoming)} incoming-authoritative · ${fmt(d.recommendedExisting)} keep-existing · ${fmt(d.manualReview)} manual review. No overwrite will occur during import.</div>`:''}<div class="preview-actions"><button class="primary-btn commit-btn" data-i="${i}">Commit to database</button></div></div>`);$(`#preview-${i} .commit-btn`).onclick=()=>commitPreview(i)}
function renderImportError(x,i){$('#importPreview').insertAdjacentHTML('beforeend',`<div class="error-card"><strong>${esc(x.file.name)}</strong><br>${esc(x.error)}</div>`)}
async function commitPreview(i){const x=state.files[i],r=x.preview;if(!r?.batchId)return;const btn=$(`#preview-${i} .commit-btn`);btn.disabled=true;btn.textContent='Committing…';try{const c=await api('/api/import/commit',{method:'POST',headers:{'content-type':'application/json','x-project-id':state.project.id},body:JSON.stringify({batchId:r.batchId,projectId:state.project.id})});x.status='committed';btn.textContent=`Imported ${fmt(c.inserted)} items`;btn.classList.remove('primary-btn');btn.classList.add('small-btn');toast(`${x.file.name} imported${c.changed?` · ${c.changed} conflict(s) queued`:''}`);await loadOverview();if(c.changed)$('#conflictBadge').classList.remove('hidden')}catch(e){btn.disabled=false;btn.textContent='Commit to database';toast(e.message)}renderQueue()}


async function loadConflicts(){
  if(!state.project)return;const status=$('#conflictStatus')?.value||'pending';
  state.conflicts=await api(`/api/projects/${state.project.id}/conflicts?status=${encodeURIComponent(status)}`);
  const a=await api(`/api/projects/${state.project.id}/authority-rules`);state.authorityRules=a.rules||[];renderConflicts();renderAuthorityRules();
}
function recLabel(r){return ({use_incoming:'Prefer incoming',keep_existing:'Keep existing',manual_review:'Manual review'}[r]||labelType(r))}
function renderConflicts(){
  const list=state.conflicts||[],pending=list.filter(x=>x.status==='pending'),protectedCount=pending.filter(x=>x.protection_level==='protected_scripture').length,incoming=pending.filter(x=>x.authority_recommendation==='use_incoming').length,manual=pending.filter(x=>x.authority_recommendation==='manual_review').length;
  $('#conflictCount').textContent=`${fmt(list.length)} conflict${list.length===1?'':'s'}`;
  $('#conflictSummary').innerHTML=[['Pending',pending.length,'Require a human decision'],['Protected Scripture',protectedCount,'Never auto-replaced'],['Prefer incoming',incoming,'Higher authority resource'],['Manual review',manual,'Equal/Scripture authority']].map(([a,b,c])=>`<div class="conflict-stat"><span>${a}</span><strong>${fmt(b)}</strong><small>${c}</small></div>`).join('');
  $('#conflictItems').innerHTML=list.length?list.map((c,i)=>`<button class="conflict-card ${c.protection_level==='protected_scripture'?'protected':''}" data-i="${i}"><i class="signal"></i><div><strong>${esc(c.book_code||'')} ${c.chapter||''}${c.verse?`:${esc(c.verse)}`:''} · ${esc(labelType(c.content_type))}</strong><p>${esc(c.incoming_filename||c.incoming_resource_role||'Incoming content')}</p><span>${esc(c.existing_resource_role||c.existing_role||'existing')} → ${esc(c.incoming_resource_role||'incoming')}</span></div><em>${esc(recLabel(c.authority_recommendation))}</em></button>`).join(''):'<div class="editor-empty"><div>✓</div><h3>No conflicts in this filter</h3><p>Imports that differ from canonical content will appear here instead of overwriting data.</p></div>';
  $$('#conflictItems .conflict-card').forEach(b=>b.onclick=()=>selectConflict(Number(b.dataset.i),b));if(list.length)selectConflict(0,$('#conflictItems .conflict-card'));else $('#conflictDetail').innerHTML='<div class="editor-empty"><div>✓</div><h3>No conflicts</h3><p>The selected status has no conflicts.</p></div>';
}
function selectConflict(i,b){state.selectedConflict=state.conflicts[i];$$('#conflictItems .conflict-card').forEach(x=>x.classList.remove('active'));b?.classList.add('active');renderConflictDetail(state.selectedConflict)}
function renderConflictDetail(c){
  const prot=c.protection_level==='protected_scripture';const pending=c.status==='pending';
  $('#conflictDetail').innerHTML=`<div class="conflict-head"><div><div class="eyebrow">${prot?'PROTECTED SCRIPTURE':'IMPORT CONFLICT'}</div><h3>${esc(c.book_code||'')} ${c.chapter||''}${c.verse?`:${esc(c.verse)}`:''} · ${esc(labelType(c.content_type))}</h3><p>Match: ${esc(c.match_key||c.semantic_key)} · ${esc(c.incoming_filename||'incoming import')}</p></div><span class="status-chip ${prot?'protected':''}">${prot?'◆ Human approval required':esc(labelType(c.status))}</span></div><div class="authority-callout ${esc(c.authority_recommendation)}"><div>⚖</div><div><b>${esc(recLabel(c.authority_recommendation))}</b><p>${esc(c.authority_reason||'Compare both versions before deciding.')}</p></div></div><div class="conflict-compare"><div class="conflict-pane"><header><small>Existing canonical</small><span>${esc(c.existing_resource_role||c.existing_role||'existing')}</span></header><pre>${esc(c.existing_text||'')}</pre></div><div class="conflict-pane"><header><small>Incoming revision</small><span>${esc(c.incoming_resource_role||'incoming')}</span></header><pre>${esc(c.incoming_text||'')}</pre></div></div>${pending?`<div class="resolution-box"><label>Editorial reason <textarea id="conflictReason" placeholder="Why are you keeping or changing this content?"></textarea></label>${prot?`<label class="protect-confirm"><input id="confirmProtected" type="checkbox"> I confirm that a human editor has reviewed this Scripture change against the authoritative text.</label>`:''}<label>Manual merged text (only used for Manual merge)<textarea id="mergedConflictText" placeholder="Paste or edit the final approved wording here."></textarea></label><div class="resolution-actions"><button class="small-btn" data-conflict-action="keep_existing">Keep existing</button><button class="small-btn" data-conflict-action="manual_merge">Use manual merge</button><button class="primary-btn" data-conflict-action="use_incoming">Use incoming</button></div></div>`:`<div class="authority-callout"><div>✓</div><div><b>Resolved</b><p>${esc(c.resolution_reason||'This conflict has been resolved.')}${c.resolved_by?` · ${esc(c.resolved_by)}`:''}</p></div></div>`}`;
  $$('#conflictDetail [data-conflict-action]').forEach(b=>b.onclick=()=>resolveConflict(c.id,b.dataset.conflictAction));
}
async function resolveConflict(id,action){
  const reason=$('#conflictReason')?.value?.trim()||'';const mergedText=$('#mergedConflictText')?.value||'';const confirmProtected=$('#confirmProtected')?.checked||false;
  if(action!=='keep_existing'&&!reason){toast('Enter an editorial reason before changing content');return}if(action==='manual_merge'&&!mergedText.trim()){toast('Enter the merged text');return}
  try{await api(`/api/projects/${state.project.id}/conflicts/${id}/resolve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,reason,mergedText,confirmProtected,actor:'Human editor'})});toast(`Conflict resolved: ${labelType(action)}`);await loadConflicts();await loadOverview();}
  catch(e){toast(e.message)}
}
function renderAuthorityRules(){
  const r=state.authorityRules||[];$('#authorityRules').innerHTML=r.length?r.map(x=>`<div class="authority-rule"><b>${fmt(x.priority)}</b><strong>${esc(labelType(x.content_type))}</strong><span>${esc(x.resource_role)} · ${esc(x.notes||'')}</span></div>`).join(''):'<p class="empty-line">No authority rules configured.</p>';
}

async function runQa(){if(!state.project)return;const b=$('#runQa');b.disabled=true;b.textContent='Running local checks…';try{const r=await api(`/api/projects/${state.project.id}/qa/run`,{method:'POST'});toast(`${fmt(r.open)} findings after local QA`);await loadIssues();await loadOverview()}catch(e){toast(e.message)}finally{b.disabled=false;b.textContent='Run local QA'}}
async function loadIssues(){if(!state.project)return;const qs=new URLSearchParams({status:'open',limit:'1000'});if(state.severity)qs.set('severity',state.severity);state.issues=await api(`/api/projects/${state.project.id}/qa/issues?${qs}`);renderIssues();}
function renderIssues(){
  const counts={critical:0,high:0,medium:0,low:0,info:0};for(const x of state.issues)counts[x.severity]=(counts[x.severity]||0)+1;
  $('#issueCount').textContent=`${fmt(state.issues.length)} issues`;$('#sevAll').textContent=state.issues.length;for(const s of Object.keys(counts))$(`#sev${s[0].toUpperCase()+s.slice(1)}`).textContent=counts[s];
  $('#issues').innerHTML=state.issues.length?state.issues.map((q,i)=>`<button class="qa-card" data-i="${i}"><span class="sev-badge ${q.severity}">${q.severity.toUpperCase()}</span><div><strong>${esc(labelType(q.category))}</strong><p>${esc(q.message)}</p><span>${q.book_code?`${esc(q.book_code)} ${q.chapter||''}${q.verse?`:${esc(q.verse)}`:''} · `:''}${esc(labelType(q.content_type||''))}</span></div></button>`).join(''):'<div class="editor-empty"><div>✓</div><h3>No open findings</h3><p>Run local QA after importing content.</p></div>';
  $$('#issues .qa-card').forEach(b=>b.onclick=()=>selectIssue(Number(b.dataset.i),b));if(state.issues.length)selectIssue(0,$('#issues .qa-card'));else $('#issueDetail').innerHTML='<div class="editor-empty"><div>✓</div><h3>No open findings</h3><p>The current filter has no issues.</p></div>';
}
function selectIssue(i,b){state.selectedIssue=state.issues[i];$$('#issues .qa-card').forEach(x=>x.classList.remove('active'));b?.classList.add('active');renderIssueDetail(state.selectedIssue)}
function renderIssueDetail(q){let evidence={};try{evidence=JSON.parse(q.evidence_json||'{}')}catch{}$('#issueDetail').innerHTML=`<div class="review-head"><div><span class="sev-badge ${q.severity}">${q.severity.toUpperCase()}</span><h3>${esc(labelType(q.category))}</h3><p>${esc(q.book_code||'')} ${q.chapter||''}${q.verse?`:${esc(q.verse)}`:''} · ${esc(q.engine)}</p></div><span class="status-chip">${Math.round((q.confidence||0)*100)}% confidence</span></div><div class="evidence-box"><header><strong>Finding</strong><span>${esc(q.content_type||'')}</span></header><div style="padding:12px;font-size:10px;line-height:1.55">${esc(q.message)}</div>${(q.paired_text||q.current_text)?`<div class="compare-line"><div><small>SOURCE / PAIRED</small><p>${esc(q.paired_text||'—')}</p></div><div><small>TARGET / CURRENT</small><p>${esc(q.current_text||'—')}</p></div></div>`:''}<pre class="evidence-json">${esc(JSON.stringify(evidence,null,2))}</pre></div><div class="decision-actions"><button class="small-btn" data-status="deferred">Defer</button><button class="small-btn" data-status="rejected">False positive</button><button class="primary-btn" data-status="resolved">Mark resolved</button></div>`;$$('#issueDetail [data-status]').forEach(b=>b.onclick=()=>setIssueStatus(q.id,b.dataset.status))}
async function setIssueStatus(id,status){await api(`/api/projects/${state.project.id}/qa/issues/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status})});toast(`Issue ${status}`);await loadIssues();await loadOverview()}

async function loadLanguage(){if(!state.project)return;const v=await api(`/api/projects/${state.project.id}/vocabulary?limit=100`);$('#vocabList').innerHTML=v.items.length?v.items.map(x=>`<div class="vocab-row"><span>${esc(x.word)}</span><b>${fmt(x.count)}</b></div>`).join(''):'<p class="empty-line">Import target-language content to build vocabulary observations.</p>';const r=await api(`/api/projects/${state.project.id}/rules`);const combined=[...r.rules.map(x=>({type:'rule',...x})),...r.glossary.map(x=>({type:'term',...x}))];$('#ruleList').innerHTML=combined.length?combined.slice(0,50).map(x=>`<div><span>${x.status==='approved'?'✓':'•'}</span><p><strong>${esc(x.type==='term'?(x.source_term?`${x.source_term} → ${x.target_term}`:x.target_term):`${x.key_text}${x.value_text?` → ${x.value_text}`:''}`)}</strong><small>${esc(x.type==='term'?'Glossary term':x.rule_type||'Editorial rule')}</small></p><em>${esc(x.status)}</em></div>`).join(''):'<p class="empty-line">No human-approved editorial rules yet. The language engine will grow from corpus evidence and editor decisions.</p>'}
function renderPublicationGate(stats){if(!stats)return;const open=(stats.issueCounts||[]).reduce((a,x)=>a+x.count,0),critical=(stats.issueCounts||[]).filter(x=>x.severity==='critical').reduce((a,x)=>a+x.count,0),conflicts=stats.conflicts||0;$('#publicationGate').innerHTML=[{ok:(stats.totals.items||0)>0,title:'Canonical database contains content',note:`${fmt(stats.totals.items)} content units stored`},{ok:conflicts===0,title:'No unresolved import conflicts',note:conflicts?`${fmt(conflicts)} conflict(s) require review`:'No pending conflicts'},{ok:critical===0,title:'No unresolved critical QA findings',note:critical?`${fmt(critical)} critical finding(s)`:'Critical gate clear'},{ok:open===0,title:'All QA findings reviewed',note:open?`${fmt(open)} open finding(s)`:'All current findings closed'}].map(x=>`<div class="gate-row ${x.ok?'pass':'warn'}"><span>${x.ok?'✓':'!'}</span><div><strong>${x.title}</strong><p>${x.note}</p></div><em>${x.ok?'Passed':'Review'}</em></div>`).join('')}
async function loadPublish(){if(!state.project)return;const s=await api(`/api/projects/${state.project.id}/stats`);renderPublicationGate(s)}
function downloadExport(format){if(!state.project)return;const qs=new URLSearchParams({format});if(state.book)qs.set('book',state.book);window.location.href=`/api/projects/${state.project.id}/export?${qs}`;toast(`${format.toUpperCase()} export started`)}

// Navigation and UI events
$$('.nav-item[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.jump));$('#quickImport').onclick=()=>showView('import');$('#refreshBtn').onclick=()=>showView(state.view);$('#projectSwitcher').onclick=()=>showModal('#switcherModal');$('#newProjectBtn').onclick=()=>showModal('#projectModal');$('#emptyCreate').onclick=()=>showModal('#projectModal');$('#switcherNew').onclick=()=>{closeModals();showModal('#projectModal')};$$('[data-close]').forEach(b=>b.onclick=closeModals);$$('.modal-backdrop').forEach(m=>m.onclick=e=>{if(e.target===m)closeModals()});
$('#projectForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{const p=await api('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});closeModals();e.currentTarget.reset();await loadProjects(p.id);toast('Project created')}catch(err){toast(err.message)}};
$('#bookSelect').onchange=async e=>{state.book=e.target.value;state.chapter=null;await loadChapters()};$('#chapterSelect').onchange=async e=>{state.chapter=e.target.value?Number(e.target.value):null;await loadPairs()};$('#typeSelect').onchange=loadPairs;$('#reloadContent').onclick=loadPairs;
const picker=$('#filePicker'),dz=$('#dropzone');$('#chooseFiles').onclick=()=>picker.click();picker.onchange=()=>addFiles([...picker.files]);['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>addFiles([...e.dataTransfer.files]));$('#clearQueue').onclick=()=>{state.files=[];$('#importPreview').innerHTML='';renderQueue()};$('#analyzeBtn').onclick=analyzeFiles;
$('#conflictStatus').onchange=loadConflicts;$('#reloadConflicts').onclick=loadConflicts;$('#runQa').onclick=runQa;$$('.filter').forEach(b=>b.onclick=async()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.severity=b.dataset.severity;await loadIssues()});$('#refreshVocab').onclick=loadLanguage;$$('#exportGrid [data-format]').forEach(b=>b.onclick=()=>downloadExport(b.dataset.format));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){e.preventDefault();showView('import')}});

renderQueue();loadProjects().catch(e=>{console.error(e);toast(e.message)});
