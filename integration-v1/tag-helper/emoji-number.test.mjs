import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source=readFileSync(new URL('./bulk.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('./bulk.html',import.meta.url),'utf8');
const embedded=html.match(/<textarea id="code" readonly>(.*?)<\/textarea>/s)[1].replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replace(/^javascript:/,'');
new vm.Script(embedded);
const parseBody=source.match(/function parse\(\)\{([\s\S]*?)\nconst save=/)[1].trim().slice(0,-1);
const parse=(text)=>new Function('T','un',parseBody)({value:text},x=>[...new Set(x)]);
for(const n of ['1','01','001','040']) assert.equal(parse(n+',ありがとう')[0].n,Number(n));
for(const n of ['000','041','0001','main','1.0']) assert.throws(()=>parse(n+',ありがとう'));
assert.throws(()=>parse('01,ありがとう\n001,感謝'));
const readBody=source.match(/function read\(\)\{([\s\S]*?)\nfunction button/)[1].trim().slice(0,-1);
function readNumber(number){
 const checkbox={checked:true,disabled:false};
 const label={querySelector:s=>s.includes('checkbox')?checkbox:{textContent:'ありがとう'}};
 const d={querySelectorAll:s=>s.startsWith('button')?[{textContent:number}]:[label]};
 return new Function('check','d','vis',readBody)(()=>{},d,()=>true);
}
for(const n of ['01','001','040'])assert.equal(readNumber(n).n,Number(n));
for(const n of ['main','0001'])assert.throws(()=>readNumber(n));
assert.equal(readNumber('001').t[0],'ありがとう');
assert(source.includes("K='rui-bulk-tags-v1:'+S"));
assert(source.includes('sessionStorage.getItem(K)'));
assert(!embedded.includes('\\d{1,2}'));
assert.equal((embedded.match(/\\d\{1,3\}/g)||[]).length,2);
console.log('PASS: emoji/sticker numbers, invalid/duplicate input, selected tags, progress key, embedded bookmarklet syntax and parity');
