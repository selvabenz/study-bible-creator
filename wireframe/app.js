const views={overview:'Project overview',books:'Books & content',import:'Import center',qa:'QA review',language:'Language & style',publish:'Publish & export'};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function showView(name){$$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${name}`)?.classList.add('active');$$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#pageTitle').textContent=views[name]||'Study Bible Creator';window.scrollTo({top:0,behavior:'smooth'});}
$$('.nav-item[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$('[data-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.jump));
$('#newImport').onclick=()=>showView('import');
const modal=$('#searchModal');$('#quickSearch').onclick=()=>modal.classList.add('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('open');if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();modal.classList.add('open')}});
const picker=$('#filePicker');$('#chooseFiles').onclick=()=>picker.click();
picker.onchange=()=>{if(picker.files.length)toast(`${picker.files.length} file${picker.files.length>1?'s':''} selected`)};
const dz=$('#dropzone');['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>toast(`${e.dataTransfer.files.length} file${e.dataTransfer.files.length>1?'s':''} ready for analysis`));
$('#analyzeBtn').onclick=()=>{$('#importPreview').classList.remove('hidden');$('#importPreview').scrollIntoView({behavior:'smooth',block:'start'});toast('Import preflight completed')};
$$('.qa-card').forEach(c=>c.onclick=()=>{$$('.qa-card').forEach(x=>x.classList.remove('active'));c.classList.add('active')});
$$('.filter').forEach(c=>c.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));c.classList.add('active')});
$$('.content-item').forEach(c=>c.onclick=()=>{$$('.content-item').forEach(x=>x.classList.remove('active'));c.classList.add('active')});
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.classList.remove('show'),1800)}
