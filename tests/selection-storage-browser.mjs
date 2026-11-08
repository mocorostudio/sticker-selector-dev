import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {startServer} from './server.mjs';
const service=await startServer();
try{for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(service.url+'/integration-v1/selection-storage.mjs');
  const result=await page.evaluate(async()=>{
   const {saveSelectionState,readSelectionState}=await import('/integration-v1/selection-storage.mjs');
   const key='isolated-selection-quota';
   const make=i=>({id:'image'+i,rating:i%3?'o':'x',touched:true,comment:'保持するコメント'+i,revision:'v'+i,crop:{phrase:'確認対象のセリフ',pose:'元キャラの顔・配色・模様と水彩の輪郭を保ち、顔と体を右向きにする。'.repeat(8),technicalReview:{status:'pass',reason:'透過と文字と四肢と余白を検品済み。'.repeat(8)}}});
   const state={items:Array.from({length:864},(_,i)=>make(i)),background:'black',draft:{order:['b','a'],main:'b',tab:'a',strokes:[{points:[[.2,.3]]}]}};
   const initial=JSON.stringify(state),budget=initial.length+10;localStorage.setItem(key,initial);localStorage.setItem('unrelated-draft','keep');
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&v.length>budget)throw new DOMException('The quota has been exceeded.','QuotaExceededError');return original.call(this,k,v);};
   let failed=false;try{localStorage.setItem(key,JSON.stringify({...state,items:[...state.items,make(864)]}));}catch(e){failed=e.name==='QuotaExceededError';}
   state.items.push(...Array.from({length:58},(_,i)=>make(i+864)));const stats=saveSelectionState(localStorage,key,state),restored=readSelectionState(localStorage,key);
   return {failed,packed:stats.packed,ratio:stats.characters/stats.originalCharacters,count:restored.items.length,exact:JSON.stringify(restored)===JSON.stringify(state),unrelated:localStorage.getItem('unrelated-draft')};
  });assert.equal(result.failed,true);assert.equal(result.packed,true);assert.equal(result.count,922);assert.equal(result.exact,true);assert.equal(result.unrelated,'keep');assert(result.ratio<.65);
  await page.reload();assert.equal(await page.evaluate(async()=>{const {readSelectionState}=await import('/integration-v1/selection-storage.mjs');return readSelectionState(localStorage,'isolated-selection-quota').items.length;}),922);
  console.log(name+': quota reproduced at next image; full 922 records, votes, comments, order and main/tab edits survive save + reload');
 }finally{await browser.close();}
}}finally{await new Promise(r=>service.server.close(r));}
