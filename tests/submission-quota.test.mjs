import test from 'node:test';
import assert from 'node:assert/strict';
import {readSubmission,writeSubmission,availableRecovery,compactSubmissionSpace} from '../integration-v1/submission-store.mjs';
import {parseStoredJSON,readSelectionState} from '../integration-v1/selection-storage.mjs';
class LimitedStorage {
 map=new Map();limit=Infinity;writes=0;
 get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}
 getItem(k){return this.map.get(k)??null;}
 get size(){return [...this.map].reduce((n,[k,v])=>n+k.length+v.length,0);}
 setItem(k,v){v=String(v);if(this.size-(this.map.has(k)?k.length+this.map.get(k).length:0)+k.length+v.length>this.limit)throw new DOMException('The quota has been exceeded.','QuotaExceededError');this.writes++;this.map.set(k,v);}
 removeItem(){assert.fail('No record may be deleted');}
}
const key='submission-trial-draft:/integration-v1/workflow-group2.html:tanuki';
const draft=()=>({draft:{sets:[{id:'s',target:40}],assignments:Object.fromEntries(Array.from({length:40},(_,i)=>['image-'+i,'s'])),orders:{s:Array.from({length:40},(_,i)=>'image-'+(39-i))},artwork:{s:{mainId:'image-3',tabId:'image-4',crop:{x:.1,y:.1,width:.5,height:.5},strokes:[{radius:3,points:[[.2,.3],[.4,.5]]}]}},history:[{message:'以前の手作業',trial:1}]},operation:null});
const selection=char=>({items:Array.from({length:300},(_,i)=>({id:char+i,rating:i%2?'o':'x',touched:true,characterId:char,reason:'文字・本体・小物を保持、欠け・隣セル混入なし。'.repeat(12),crop:{reviewDisplay:true,filename:'DJT21_original.png',history:['以前の原画像を保持']}}))});
test('tab selection recovers full origin quota without losing 40 choices, order, edits, backups or other projects',()=>{
 const s=new LimitedStorage(),states=new Map();
 for(const char of ['tanuki','wombat','penguin']){const k='sticker-selector-v9:crop-workflow:/'+char;const value=selection(char);states.set(k,value);s.setItem(k,JSON.stringify(value));}
 const old=draft();s.setItem(key,JSON.stringify(old));s.setItem('sticker-selector-v9','legacy raw must stay unchanged');s.setItem('other-app','other app must stay unchanged');
 const original=new Map(s.map);s.limit=s.size+20;
 assert.throws(()=>s.setItem(key+':previous',JSON.stringify(old)),{name:'QuotaExceededError'});
 const next=structuredClone(old);next.draft.artwork.s.tabId='image-18';writeSubmission(s,key,next);
 assert.deepEqual(readSubmission(s,key),next);
 assert.deepEqual(readSubmission(s,key+':previous'),old);assert.deepEqual(readSubmission(s,key+':before-persistence-fix'),old);assert.deepEqual(availableRecovery(s,key),old);
 for(const [k,v] of states)assert.deepEqual(readSelectionState(s,k),v);
 for(const k of ['other-app','sticker-selector-v9'])assert.equal(s.getItem(k),original.get(k));
 assert.ok(s.size<s.limit/2);assert.equal(Object.keys(readSubmission(s,key).draft.assignments).length,40);
 const writes=s.writes;writeSubmission(s,key,structuredClone(next));assert.equal(s.writes,writes);
});
test('packed submission drafts and both recovery records remain readable on the next edit',()=>{
 const s=new LimitedStorage(),old=draft();old.draft.history=Array.from({length:2000},()=>({message:'メインとタブの編集履歴を全件保持する'.repeat(30)}));
 s.setItem(key,JSON.stringify(old));s.setItem(key+':before-persistence-fix',JSON.stringify(old));s.limit=s.size+100;
 compactSubmissionSpace(s);const next=structuredClone(old);next.draft.artwork.s.mainId='image-8';writeSubmission(s,key,next);
 assert.deepEqual(readSubmission(s,key),next);assert.deepEqual(availableRecovery(s,key),old);
 assert.equal(JSON.parse(s.getItem(key)).schema,'animal-stickers-selection-state/packed-v1');
});
test('unrecoverable capacity failure retains prior draft and gives actionable Japanese error',()=>{
 const s=new LimitedStorage(),old=draft();s.setItem(key,JSON.stringify(old));s.limit=s.size;
 const next=structuredClone(old);next.draft.artwork.s.tabId='image-19';
 assert.throws(()=>writeSubmission(s,key,next),/以前の選択・並び順・メイン・タブは残しています/);assert.deepEqual(readSubmission(s,key),old);
});
test('compaction skips corrupt, unrelated and visible-ID records and preserves every logical field',()=>{
 const s=new LimitedStorage();for(const [k,v] of [[key,'broken'],['product-workspace-draft:test',JSON.stringify(draft())],['sticker-selector-v9:crop-workflow:/x-visible-ids','["x"]'],['unknown','sensitive']])s.setItem(k,v);
 const before=[...s.map];assert.equal(compactSubmissionSpace(s),0);assert.deepEqual([...s.map],before);
 assert.deepEqual(parseStoredJSON(JSON.stringify(draft())),draft());
});
