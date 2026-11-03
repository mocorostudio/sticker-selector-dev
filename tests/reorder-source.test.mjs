import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import JSZip from 'jszip';
import {storedZip} from '../integration-v1/submission-zip.mjs';
import {withPngDpi} from '../integration-v1/png-density.mjs';
const page=readFileSync(new URL('../integration-v1/reorder-finished.html',import.meta.url),'utf8');
test('finished sticker page retains original assets and reordered mapping',()=>{
 for(const expected of [
  "entries.map(e=>e.originalIndex)",
  "await dbPut('order:'+key,order)",
  "await dbGet('order:'+key)",
  "if(!restore){try{await dbPut(key,bytes);}",
  "snapshot.map((e,i)=>({name:imageName(i+1),blob:e.blob}))",
  "{name:'main.png',blob:art['main.png']}",
  "{name:'tab.png',blob:art['tab.png']}",
 ])assert.ok(page.includes(expected),expected);
});
test('finished sticker page saves only to verified application folder and checks download',()=>{
 for(const expected of ["meta.name==='04_申請用'","found.files?.length!==1","reused:true","await digest(downloaded)!==sha","await digest(got)!==sha","'04_申請用'"]){assert.ok(page.includes(expected),expected);}
 assert.ok(!page.includes("a.download=filename"),'download-only flow must not return');
});
test('inspection and progress remain explicit',()=>{
 for(const expected of ['最終チェック','目視検品は別','①／④','②／④','③／④','④／④','saveButton(true)','saveButton(false)'])assert.ok(page.includes(expected),expected);
});

test('reorder ZIP supports complete sticker and emoji kits with directory metadata',()=>{
 for(const expected of [
  'if(count<41||count>200)',
  "name.endsWith('/')",
  "name.startsWith('__MACOSX/')",
  "name==='.DS_Store'",
  "name.endsWith('/.DS_Store')",
  'if(result.size!==expected)',
  'expected=emoji?41:42',
  "if(!image)throw Error(name+'がありません。')",
  "(?:00[1-9]|0[1-3][0-9]|040)",
 ])assert.ok(page.includes(expected),expected);
});

// Execute the page's real ZIP reader, rather than duplicate its validation rules.
const extractSource=page.slice(page.indexOf('async function extract(blob)'),page.indexOf('async function verify('));
const extract=runInNewContext(`const u16=(v,o)=>v.getUint16(o,true),u32=(v,o)=>v.getUint32(o,true);${extractSource};extract`,{Blob,TextDecoder,Uint8Array,DataView,Response,DecompressionStream});
const png=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64')],{type:'image/png'});
for(const emoji of [false,true]){
 const kind=emoji?'emoji':'sticker';
 async function kit(){
  const snapshot=await Promise.all(Array.from({length:40},async(_,i)=>({blob:await withPngDpi(png,72+i)})));
  snapshot.reverse();
  const art={'main.png':png,'tab.png':png};
  const mapping=page.slice(page.indexOf('const list=snapshot.map('),page.indexOf('for(const entry of list)'));
  const list=runInNewContext(`const archiveMode=${JSON.stringify(kind)};${page.match(/const imageName=.*?;/)[0]}${mapping};list`,{snapshot,art});
  return {list,snapshot};
 }
 test(`${kind} page export preserves all 40 reordered PNG bytes and artwork`,async()=>{
  const {list,snapshot}=await kit(),archive=await storedZip(list,{includeArtwork:true,emoji});
  const got=await extract(archive);assert.equal(got.size,emoji?41:42);
  for(let i=0;i<40;i++)assert.deepEqual(Buffer.from(await got.get(String(i+1).padStart(emoji?3:2,'0')+'.png').arrayBuffer()),Buffer.from(await snapshot[i].blob.arrayBuffer()));
  assert.equal(got.has('main.png'),!emoji);assert.ok(got.has('tab.png'));
 });
 test(`${kind} reader tolerates directory and macOS metadata`,async()=>{
  const {list}=await kit(),zip=new JSZip();for(const e of list)zip.file(e.name,await e.blob.arrayBuffer());
  zip.folder('__MACOSX');zip.file('__MACOSX/._01.png','ignored');zip.file('.DS_Store','ignored');
  assert.equal((await extract(new Blob([await zip.generateAsync({type:'uint8array',compression:'STORE'})]))).size,emoji?41:42);
 });
 test(`${kind} reader refuses a missing image even with directory metadata`,async()=>{
  const {list}=await kit(),zip=new JSZip();for(const e of list.slice(1))zip.file(e.name,await e.blob.arrayBuffer());zip.folder('__MACOSX');zip.file('.DS_Store','ignored');
  await assert.rejects(extract(new Blob([await zip.generateAsync({type:'uint8array',compression:'STORE'})])),/必要です/);
 });
}
