import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSelectionState,readSelectionState,saveSelectionState} from '../integration-v1/selection-storage.mjs';
class LimitedStorage{
 constructor(limit=Infinity){this.map=new Map();this.limit=limit;}
 getItem(k){return this.map.get(k)??null;}
 setItem(k,v){if([...this.map].reduce((n,[a,b])=>n+(a===k?0:b.length),v.length)>this.limit)throw new DOMException('The quota has been exceeded.','QuotaExceededError');this.map.set(k,v);}
}
const item=i=>({id:'image-'+i,imageId:'image-'+i,candidate:'C'+i,characterId:i<841?'earlier':'current',rating:i%4?'o':'x',touched:true,revision:'revision-'+i,comment:'選んだ内容と未保存コメント '+i,pose:'顔・胸・鼻先・視線を同じ方向へ向け、水彩の顔と配色を維持する。'.repeat(8),crop:{inspection:{scope:'actual-source',checks:Array(12).fill(true)},pendingDrive:{sha256:'a'.repeat(64),fileId:'original-'+i},technicalReview:{status:'pass',reason:'文字・四肢・透過・余白を検品。'.repeat(12)},history:[{previousImageId:'previous-'+i}]} });
test('864 retained records plus the remaining 58 fit after the legacy save stopped at 23; no data loss',()=>{
 const state={items:Array.from({length:864},(_,i)=>item(i)),background:'black',draft:{order:['b','a'],main:'b',tab:'a',edit:{points:[[.2,.3]]}}};
 const storage=new LimitedStorage(),key='selection';storage.setItem('unrelated','keep');const old=JSON.stringify(state);storage.setItem(key,old);storage.limit=old.length+4;
 const more={...state,items:[...state.items,item(864)]};assert.throws(()=>storage.setItem(key,JSON.stringify(more)),/quota/);
 const expected={...state,items:[...state.items,...Array.from({length:58},(_,i)=>item(864+i))]};
 const saved=saveSelectionState(storage,key,expected);assert(saved.packed);assert(saved.characters<old.length*.65);assert.deepEqual(readSelectionState(storage,key),expected);assert.equal(storage.getItem('unrelated'),'keep');
 const again=readSelectionState(storage,key);again.items[850].rating='h';again.items[850].comment='丸付け中の新しいコメント';saveSelectionState(storage,key,again);assert.deepEqual(readSelectionState(storage,key),again);
});
test('small drafts remain ordinary JSON and legacy plain drafts read unchanged',()=>{const s=new LimitedStorage(),v={items:[{id:'a',comment:'◯△×　日本語😀'}]};saveSelectionState(s,'a',v);assert.deepEqual(JSON.parse(s.getItem('a')),v);assert.deepEqual(readSelectionState(s,'a'),v);});
test('quota fallback below the proactive threshold uses atomic replacement',()=>{const s=new LimitedStorage(),v={items:Array.from({length:60},(_,i)=>item(i))};s.setItem('a',JSON.stringify(v));s.limit=s.getItem('a').length;v.items.push(item(61));saveSelectionState(s,'a',v);assert.deepEqual(readSelectionState(s,'a'),v);});
test('all JSON field types and reserved-looking object fields survive packing',()=>{const s=new LimitedStorage(),v={items:Array.from({length:400},(_,i)=>item(i)),special:JSON.parse('{"__proto__":{"x":1},"constructor":"keep","list":[0,1,2,null,true,false,"",[0,1],{"schema":"x"}]}')};saveSelectionState(s,'x',v);assert.deepEqual(readSelectionState(s,'x'),v);});
test('a failed atomic write leaves the previous selection intact',()=>{const s=new LimitedStorage(),v={items:[item(1)]};s.setItem('a',JSON.stringify(v));const before=s.getItem('a');s.limit=1;assert.throws(()=>saveSelectionState(s,'a',{items:[item(1),item(2)]}),/quota/);assert.equal(s.getItem('a'),before);});
test('corrupt packed records throw without writing or deleting anything',()=>{const raw=JSON.stringify({schema:'animal-stickers-selection-state/packed-v1',strings:[],data:[0,99]});assert.throws(()=>parseSelectionState(raw),/不正/);});
