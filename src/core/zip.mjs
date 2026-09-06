import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = date.getDate() & 0x1f;
  const month = (date.getMonth() + 1) & 0x0f;
  const d = (((year - 1980) & 0x7f) << 9) | (month << 5) | day;
  return { time, date: d };
}

function u16(n){const b=Buffer.allocUnsafe(2);b.writeUInt16LE(n>>>0);return b;}
function u32(n){const b=Buffer.allocUnsafe(4);b.writeUInt32LE(n>>>0);return b;}

export function createZip(entries, outPath) {
  const locals=[];
  const centrals=[];
  let offset=0;
  for (const entry of entries) {
    const name = String(entry.name).replace(/\\/g,'/').replace(/^\/+/, '');
    if (!name || name.includes('../')) throw new Error(`Unsafe ZIP entry name: ${entry.name}`);
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '');
    const compressed = deflateRawSync(data, { level: 6 });
    const method = compressed.length < data.length ? 8 : 0;
    const payload = method === 8 ? compressed : data;
    const crc = crc32(data);
    const dt = dosDateTime(entry.mtime ?? new Date());
    const flags = 0x0800; // UTF-8 names
    const local = Buffer.concat([
      u32(0x04034b50),u16(20),u16(flags),u16(method),u16(dt.time),u16(dt.date),u32(crc),u32(payload.length),u32(data.length),u16(nameBuf.length),u16(0),nameBuf,payload
    ]);
    locals.push(local);
    const central = Buffer.concat([
      u32(0x02014b50),u16(20),u16(20),u16(flags),u16(method),u16(dt.time),u16(dt.date),u32(crc),u32(payload.length),u32(data.length),u16(nameBuf.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nameBuf
    ]);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n,b)=>n+b.length,0);
  const eocd = Buffer.concat([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralSize),u32(offset),u16(0)]);
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,Buffer.concat([...locals,...centrals,eocd]));
}

export function zipDirectory(dir, outPath) {
  const entries=[];
  const walk=(base,rel='')=>{
    for(const ent of fs.readdirSync(base,{withFileTypes:true})){
      const abs=path.join(base,ent.name); const next=rel?`${rel}/${ent.name}`:ent.name;
      if(ent.isDirectory()) walk(abs,next);
      else if(ent.isFile()) entries.push({name:next,data:fs.readFileSync(abs),mtime:fs.statSync(abs).mtime});
    }
  };
  walk(dir);
  createZip(entries,outPath);
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) return i;
  throw new Error('Invalid ZIP: EOCD not found');
}

export function readZipEntry(filePath, entryName) {
  const buf=fs.readFileSync(filePath);
  const eocd=findEocd(buf);
  const count=buf.readUInt16LE(eocd+10);
  let p=buf.readUInt32LE(eocd+16);
  const wanted=String(entryName).replace(/\\/g,'/');
  for(let i=0;i<count;i++){
    if(buf.readUInt32LE(p)!==0x02014b50) throw new Error('Invalid ZIP central directory');
    const method=buf.readUInt16LE(p+10);
    const crc=buf.readUInt32LE(p+16);
    const compSize=buf.readUInt32LE(p+20);
    const uncompSize=buf.readUInt32LE(p+24);
    const nameLen=buf.readUInt16LE(p+28), extraLen=buf.readUInt16LE(p+30), commentLen=buf.readUInt16LE(p+32);
    const localOffset=buf.readUInt32LE(p+42);
    const name=buf.subarray(p+46,p+46+nameLen).toString('utf8');
    if(name===wanted){
      if(buf.readUInt32LE(localOffset)!==0x04034b50) throw new Error('Invalid ZIP local header');
      const localNameLen=buf.readUInt16LE(localOffset+26), localExtraLen=buf.readUInt16LE(localOffset+28);
      const start=localOffset+30+localNameLen+localExtraLen;
      const payload=buf.subarray(start,start+compSize);
      let data;
      if(method===0) data=Buffer.from(payload);
      else if(method===8) data=inflateRawSync(payload);
      else throw new Error(`Unsupported ZIP compression method ${method}`);
      if(data.length!==uncompSize) throw new Error(`ZIP size mismatch for ${wanted}`);
      if(crc32(data)!==crc) throw new Error(`ZIP CRC mismatch for ${wanted}`);
      return data;
    }
    p += 46+nameLen+extraLen+commentLen;
  }
  const err=new Error(`ZIP entry not found: ${wanted}`); err.code='ENOENT'; throw err;
}
