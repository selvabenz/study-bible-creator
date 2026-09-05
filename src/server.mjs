import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { Store } from './core/db.mjs';
import { previewImport } from './core/importer.mjs';
import { runLocalQa } from './core/qa-engine.mjs';
import { exportItems } from './core/exporter.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'data'),{recursive:true});
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const store=new Store(path.join(root,'data','study_bible.db'));
const previews=new Map();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
function send(res,status,body,type='application/json; charset=utf-8',headers={}){
  res.writeHead(status,{'content-type':type,...headers});
  if(Buffer.isBuffer(body)||body instanceof Uint8Array) res.end(body);
  else if(type.startsWith('application/json')) res.end(JSON.stringify(body));
  else res.end(body);
}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks);}
function jsonBody(buf){try{return JSON.parse(buf.toString('utf8')||'{}');}catch{throw new Error('Invalid JSON request body');}}
function qInt(url,key,fallback=null){const v=url.searchParams.get(key);if(v==null||v==='')return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback;}
function contentDisposition(name){return `attachment; filename="${String(name).replace(/["\r\n]/g,'_')}"`;}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/health') return send(res,200,{ok:true,version:'0.3.0',localFirst:true,aiEnabled:false});
    if(url.pathname==='/api/projects'&&req.method==='GET') return send(res,200,store.listProjects());
    if(url.pathname==='/api/projects'&&req.method==='POST') return send(res,201,store.createProject(jsonBody(await body(req))));

    const projectMatch=url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if(projectMatch&&req.method==='GET'){
      const p=store.getProject(projectMatch[1]);
      return p?send(res,200,p):send(res,404,{error:'Project not found'});
    }
    const statsMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/stats$/);
    if(statsMatch&&req.method==='GET') return send(res,200,store.projectStats(statsMatch[1]));
    const booksMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/books$/);
    if(booksMatch&&req.method==='GET') return send(res,200,store.bookSummary(booksMatch[1]));
    const chaptersMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/books\/([^/]+)\/chapters$/);
    if(chaptersMatch&&req.method==='GET') return send(res,200,store.chaptersForBook(chaptersMatch[1],decodeURIComponent(chaptersMatch[2])));
    const contentMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/content$/);
    if(contentMatch&&req.method==='GET') return send(res,200,store.listContent(contentMatch[1],{
      bookCode:url.searchParams.get('book')||null,chapter:qInt(url,'chapter'),contentType:url.searchParams.get('type')||null,languageRole:url.searchParams.get('role')||null,
      limit:qInt(url,'limit',300),offset:qInt(url,'offset',0)
    }));
    const pairMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/pairs$/);
    if(pairMatch&&req.method==='GET') return send(res,200,store.listPairs(pairMatch[1],{
      bookCode:url.searchParams.get('book')||null,chapter:qInt(url,'chapter'),contentType:url.searchParams.get('type')||null,limit:qInt(url,'limit',250)
    }));
    const conflictMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/conflicts$/);
    if(conflictMatch&&req.method==='GET') return send(res,200,store.listConflicts(conflictMatch[1],url.searchParams.get('status')||'pending'));
    const vocabMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/vocabulary$/);
    if(vocabMatch&&req.method==='GET'){
      const project=store.getProject(vocabMatch[1]); if(!project)return send(res,404,{error:'Project not found'});
      const lang=url.searchParams.get('language')||project.target_language_code;
      return send(res,200,{languageCode:lang,items:store.vocabulary(vocabMatch[1],lang,qInt(url,'limit',80))});
    }
    const rulesMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/rules$/);
    if(rulesMatch&&req.method==='GET') return send(res,200,{rules:store.listRules(rulesMatch[1]),glossary:store.listGlossary(rulesMatch[1])});

    const qaRunMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/qa\/run$/);
    if(qaRunMatch&&req.method==='POST') return send(res,200,runLocalQa(store,qaRunMatch[1]));
    const qaListMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/qa\/issues$/);
    if(qaListMatch&&req.method==='GET') return send(res,200,store.listIssues(qaListMatch[1],{status:url.searchParams.get('status')||'open',severity:url.searchParams.get('severity')||null,limit:qInt(url,'limit',500)}));
    const qaStatusMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/qa\/issues\/([^/]+)$/);
    if(qaStatusMatch&&req.method==='PATCH'){
      const data=jsonBody(await body(req)); return send(res,200,store.setIssueStatus(qaStatusMatch[1],qaStatusMatch[2],data.status));
    }

    const exportMatch=url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if(exportMatch&&req.method==='GET'){
      const format=(url.searchParams.get('format')||'json').toLowerCase();
      if(!['json','csv','tsv','usfm','sfm'].includes(format)) return send(res,400,{error:`Export ${format.toUpperCase()} is not implemented in v0.3 yet.`});
      const rows=store.exportRows(exportMatch[1],{bookCode:url.searchParams.get('book')||null,languageCode:url.searchParams.get('language')||null,resourceRole:url.searchParams.get('resourceRole')||null});
      const ext=format==='usfm'?'usfm':format;
      const temp=path.join(os.tmpdir(),`study-bible-export-${Date.now()}.${ext}`);
      exportItems(rows,format,temp); const data=fs.readFileSync(temp); fs.rmSync(temp,{force:true});
      const ct=format==='json'?'application/json; charset=utf-8':format==='csv'?'text/csv; charset=utf-8':format==='tsv'?'text/tab-separated-values; charset=utf-8':'text/plain; charset=utf-8';
      return send(res,200,data,ct,{'content-disposition':contentDisposition(`study-bible-export.${ext}`)});
    }

    if(url.pathname==='/api/import/preview'&&req.method==='POST'){
      const projectId=req.headers['x-project-id'];
      const filename=decodeURIComponent(req.headers['x-file-name']||'upload.bin');
      const lang=req.headers['x-language-code']||null;
      const role=req.headers['x-resource-role']||'other';
      const format=req.headers['x-format']||'auto';
      if(!projectId) return send(res,400,{error:'x-project-id required'});
      const b=await body(req);
      const temp=path.join(root,'tmp',`${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(filename)}`);
      fs.writeFileSync(temp,b);
      try {
        const preview=previewImport(store,{projectId,filePath:temp,originalFilename:filename,languageCode:lang,resourceRole:role,format});
        if(preview.parsed){ previews.set(preview.batchId,{...preview,temp}); const publicPreview={...preview}; delete publicPreview.parsed; return send(res,200,publicPreview); }
        try{fs.unlinkSync(temp)}catch{}
        return send(res,200,preview);
      } catch (error) {
        try{fs.unlinkSync(temp)}catch{}
        throw error;
      }
    }
    if(url.pathname==='/api/import/commit'&&req.method==='POST'){
      const data=jsonBody(await body(req));
      const p=previews.get(data.batchId);
      if(!p)return send(res,404,{error:'Preview expired'});
      const result=store.commitImport({batchId:p.batchId,projectId:req.headers['x-project-id']||data.projectId,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode:p.languageCode,resourceRole:p.resourceRole,sourcePath:null,parsed:p.parsed});
      previews.delete(data.batchId); try{fs.unlinkSync(p.temp)}catch{};
      return send(res,200,result);
    }

    if(url.pathname.startsWith('/api/')) return send(res,404,{error:'Not found'});
    const rel=url.pathname==='/'?'/index.html':url.pathname;
    const safe=path.normalize(rel).replace(/^\.\.(\/|\\|$)/,'');
    const file=path.join(root,'public',safe);
    if(!file.startsWith(path.join(root,'public'))) return send(res,403,'Forbidden','text/plain');
    if(fs.existsSync(file)&&fs.statSync(file).isFile()) return send(res,200,fs.readFileSync(file),mime[path.extname(file)]||'application/octet-stream');
    return send(res,404,'Not found','text/plain');
  }catch(e){console.error(e);send(res,500,{error:e.message});}
});

const PORT=process.env.PORT||4173;
server.listen(PORT,'127.0.0.1',()=>console.log(`Study Bible Creator v0.3.0: http://127.0.0.1:${PORT}`));
