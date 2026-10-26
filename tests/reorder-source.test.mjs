import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../integration-v1/reorder-finished.html',import.meta.url),'utf8');
test('finished sticker page retains original assets and reordered mapping',()=>{
 for(const expected of [
  "entries.map(e=>e.originalIndex)",
  "await dbPut('order:'+key,order)",
  "await dbGet('order:'+key)",
  "if(!restore){try{await dbPut(key,bytes);}",
  "snapshot.map((e,i)=>({name:String(i+1).padStart(2,'0')+'.png',blob:e.blob}))",
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
