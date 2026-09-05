import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const tag=process.env.RELEASE_TAG||process.env.GITHUB_REF_NAME||process.argv[2]||`v${pkg.version}`;
if(tag!==`v${pkg.version}`){console.error(`Release tag ${tag} does not match package version v${pkg.version}`);process.exit(1);}
const changelog=fs.readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
if(!changelog.includes(`## [${pkg.version}]`)&&!changelog.includes(`## ${pkg.version}`)){console.error(`CHANGELOG.md has no ${pkg.version} section`);process.exit(1);}
console.log(`Release metadata OK: ${tag}`);
