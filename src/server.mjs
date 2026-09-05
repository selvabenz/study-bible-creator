import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './core/db.mjs';
import { previewImport } from './core/importer.mjs';
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const root=path.resolve(__dirname,'..');
const store=new Store(path.join(root,'data','study_bible.db')); const previews=new Map();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'content-type':type});res.end(type.startsWith('application/json')?JSON.stringify(body):body)}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks)}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/health') return send(res,200,{ok:true,version:'0.1.0'});
    if(url.pathname==='/api/projects'&&req.method==='GET') return send(res,200,store.listProjects());
    if(url.pathname==='/api/projects'&&req.method==='POST') {const data=JSON.parse((await body(req)).toString('utf8')); return send(res,201,store.createProject(data));}
    const sm=url.pathname.match(/^\/api\/projects\/([^/]+)\/stats$/); if(sm&&req.method==='GET') return send(res,200,store.projectStats(sm[1]));
    if(url.pathname==='/api/import/preview'&&req.method==='POST'){
      const projectId=req.headers['x-project-id']; const filename=decodeURIComponent(req.headers['x-file-name']||'upload.bin'); const lang=req.headers['x-language-code']||null; const role=req.headers['x-resource-role']||'other'; const format=req.headers['x-format']||'auto';
      if(!projectId) return send(res,400,{error:'x-project-id required'});
      const b=await body(req); const temp=path.join(root,'tmp',`${Date.now()}-${path.basename(filename)}`); fs.writeFileSync(temp,b);
      const preview=previewImport(store,{projectId,filePath:temp,languageCode:lang,resourceRole:role,format});
      if(preview.parsed){ previews.set(preview.batchId,{...preview,temp}); const publicPreview={...preview}; delete publicPreview.parsed; return send(res,200,publicPreview); }
      return send(res,200,preview);
    }
    if(url.pathname==='/api/import/commit'&&req.method==='POST'){
      const data=JSON.parse((await body(req)).toString('utf8')); const p=previews.get(data.batchId); if(!p)return send(res,404,{error:'Preview expired'});
      const result=store.commitImport({batchId:p.batchId,projectId:req.headers['x-project-id']||data.projectId,filename:p.filename,format:p.format,sha:p.sha,byteSize:p.byteSize,languageCode:p.languageCode,resourceRole:p.resourceRole,sourcePath:null,parsed:p.parsed}); previews.delete(data.batchId); try{fs.unlinkSync(p.temp)}catch{}; return send(res,200,result);
    }
    if(url.pathname.startsWith('/api/')) return send(res,404,{error:'Not found'});
    let rel=url.pathname==='/'?'/index.html':url.pathname; const file=path.join(root,'public',path.normalize(rel).replace(/^\.\.(\/|\\|$)/,''));
    if(!file.startsWith(path.join(root,'public'))) return send(res,403,'Forbidden','text/plain');
    if(fs.existsSync(file)&&fs.statSync(file).isFile()) return send(res,200,fs.readFileSync(file),mime[path.extname(file)]||'application/octet-stream');
    return send(res,404,'Not found','text/plain');
  }catch(e){console.error(e);send(res,500,{error:e.message});}
});
const PORT=process.env.PORT||4173; server.listen(PORT,'127.0.0.1',()=>console.log(`Study Bible Creator v0.1.0: http://127.0.0.1:${PORT}`));
