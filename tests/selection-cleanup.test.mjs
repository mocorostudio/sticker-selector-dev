import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveOtherCharacters} from '../integration-v1/selection-cleanup.mjs';
import {saveSelectionState,readSelectionState} from '../integration-v1/selection-storage.mjs';
test('full 1063 image index shrinks while current votes, reasons and legacy items survive',async()=>{
 const other=Array.from({length:1012},(_,i)=>({id:'old'+i,characterId:'old',touched:true,rating:'h',comment:'旧選択',crop:{technicalReview:{status:'hold',reason:'履歴保持'}}}));
 const current=Array.from({length:51},(_,i)=>({id:'new'+i,characterId:'penguin',touched:i===0,rating:'o',comment:'現在の未保存操作',crop:{technicalReview:{status:'pass',reason:'確認済み'}}}));
 const state={items:[...other,...current],background:'black',artwork:{mainId:'new0'}};
 let savedArchive,stored=JSON.stringify(state),events=[];
 const store={getItem:()=>stored,setItem:(k,v)=>{if(v.length>JSON.stringify({ ...state,items:current}).length+100)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});stored=v;}};
 const r=await archiveOtherCharacters(state,'penguin',{archive:async a=>{events.push('archive');savedArchive=structuredClone(a);},save:next=>{events.push('save');saveSelectionState(store,'key',next);}});
 assert.equal(r.count,1012);assert.deepEqual(r.state.items,current);assert.deepEqual(readSelectionState(store,'key'),r.state);assert.deepEqual(savedArchive.state,state);assert.deepEqual(events,['archive','save']);assert.equal(state.items.length,1063);
 const legacy={id:'unknown',touched:true};const second=await archiveOtherCharacters({items:[legacy,...current]},'penguin',{archive:()=>assert.fail(),save:()=>assert.fail()});assert.equal(second.count,0);
});
test('archive or save failure never changes live state',async()=>{
 const state={items:[{id:'old',characterId:'other'},{id:'keep',characterId:'penguin',touched:true,comment:'keep'}]},before=structuredClone(state);
 for(const stage of ['archive','save']){await assert.rejects(archiveOtherCharacters(state,'penguin',{archive:async()=>{if(stage==='archive')throw Error('quota');},save:async()=>{throw Error('quota');}}));assert.deepEqual(state,before);}
});
