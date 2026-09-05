import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const changelog=fs.readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
const escaped=pkg.version.replace(/\./g,'\\.');
const re=new RegExp(`## \\[?${escaped}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[?\\d+\\.|$)`);
const m=changelog.match(re);const body=m?m[1].trim():`Study Bible Creator v${pkg.version}`;
const out=process.argv[2]||'release-notes.md';fs.writeFileSync(out,`# Study Bible Creator v${pkg.version}\n\n${body}\n`);console.log(out);
