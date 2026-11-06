import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAllSelected,assignImage,trialCandidates,prepareTrialSubmission,prepareSubmission} from '../integration-v1/submission-core.mjs';
import {productFiles,productDraft,additionalCircles,recordProductSave,retainedProductItems} from '../integration-v1/product-selection.mjs';
import {writeSubmission,readSubmission,submissionKey} from '../integration-v1/submission-store.mjs';
import {orderedFiles} from '../integration-v1/submission-order.mjs';

const files=Array.from({length:243},(_,i)=>({id:'image'+i,localItemId:'local'+i,trial:true,name:'image'+i+'.png'}));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};

test('legacy 81-candidate single-product seeding and exclusions survive reload unchanged',()=>{
 const base={sets:[{id:'one',name:'商品1',target:40}],assignments:{}};
 let d=defaultAllSelected(base,files.slice(0,81));assert.equal(Object.keys(d.assignments).length,81);
 for(const f of files.slice(40,81))d=assignImage(d,f.id,'one');
 assert.equal(Object.keys(defaultAllSelected(d,files.slice(0,81)).assignments).length,40);
 assert.equal(productDraft(d,'one'),d);assert.equal(productFiles(d,files.slice(0,81),'one','unused').length,41);
 const s=storage(),k=submissionKey('/integration-v1/workflow.html','char');writeSubmission(s,k,{draft:d,operation:null});
 assert.deepEqual(readSubmission(s,k).draft,d);assert.deepEqual(base.assignments,{});
});

test('three 81-candidate batches do not silently refill product1 or change older artwork/order',()=>{
 const d={sets:[{id:'one',name:'商品1',target:40},{id:'two',name:'商品2',target:40},{id:'three',name:'商品3',target:40}],assignments:Object.fromEntries(files.slice(0,40).map(f=>[f.id,'one'])),orders:{one:files.slice(0,40).reverse().map(f=>f.id)},artwork:{one:{mainId:'image0',tabId:'image1',strokes:[{radius:4,points:[[.5,.5]]}]}}},before=structuredClone(d);
 let next=defaultAllSelected(d,files);assert.deepEqual(next.assignments,d.assignments);assert.equal(productFiles(next,files,'three','unused').length,203);
 next=assignImage(next,'image0','three');assert.equal(next.assignments.image0,'three');assert.deepEqual(next.artwork,before.artwork);assert.deepEqual(next.orders,before.orders);
 assert.equal(orderedFiles(next,files,'one').length,39);assert.equal(productFiles(next,files,'three','current').length,1);
 next=assignImage(next,'image0','one');assert.deepEqual(next.assignments,d.assignments);assert.deepEqual(d,before);
});

test('save only the active complete product while other drafts are incomplete; immutable snapshot retains earlier editions',()=>{
 const d={sets:[{id:'one',name:'商品1',target:8},{id:'two',name:'商品2',target:40}],assignments:{...Object.fromEntries(files.slice(0,8).map(f=>[f.id,'one'])),image8:'two'},artwork:{one:{mainId:'image0',tabId:'image1'},two:{mainId:'image8'}},orders:{one:files.slice(0,8).reverse().map(f=>f.id)}},before=structuredClone(d);
 const scoped=productDraft(d,'one'),plan=prepareTrialSubmission(scoped,files,{characterId:'char',id:'plan'});
 assert.equal(plan.entries.length,8);assert.equal(plan.entries[0].fileId,'image7');assert.deepEqual(d,before);
 assert.throws(()=>prepareSubmission(scoped,files,{characterId:'char',id:'real'}),/技術検品/);
 let saved=recordProductSave(d,plan,{archives:[{id:'zip1'}]},scoped);
 const s=storage(),key=submissionKey('/integration-v1/workflow.html','char');writeSubmission(s,key,{draft:saved,operation:null});saved=readSubmission(s,key).draft;
 const changed=assignImage(saved,'image0','two');assert.equal(changed.productSaves[0].snapshot.assignments.image0,'one');assert.equal(changed.assignments.image0,'two');
 const retried=recordProductSave(changed,plan,{archives:[{id:'zip1'}]},scoped);assert.equal(retried.productSaves.length,1);
});

test('explicit stored-circle import excludes other characters/ratings and duplicate candidate attempts without promoting technical status',()=>{
 const items=[{id:'local',imageId:'old',candidate:'c2',characterId:'char',origin:'crop-local',touched:true,rating:'o',technicalPassed:false},...['h','x'].map((rating,i)=>({id:'x'+i,imageId:'x'+i,characterId:'char',origin:'crop-local',touched:true,rating})),{id:'foreign',imageId:'foreign',characterId:'other',origin:'crop-local',touched:true,rating:'o'},{id:'duplicate',imageId:'duplicate',candidate:'c1',characterId:'char',origin:'crop-local',touched:true,rating:'o'}],before=structuredClone(items);
 const added=additionalCircles(items,[{id:'current',candidateId:'c1'}],'char');assert.deepEqual(added.map(x=>x.imageId),['old']);assert.equal(trialCandidates(added)[0].technicalStatus,'review');assert.deepEqual(items,before);
});

test('a new visible attempt does not duplicate or replace the older version assigned to another product',()=>{
 const old={imageId:'old',candidate:'c1',characterId:'char'},latest={imageId:'new',candidate:'c1',characterId:'char'},other={imageId:'other',candidate:'c2',characterId:'char'},d={assignments:{old:'one'},retainedCandidateIds:['old','other']};
 assert.deepEqual(retainedProductItems([latest],[old,latest,other],d,'char').map(x=>x.imageId),['old','other']);
 assert.equal(d.assignments.old,'one');
});
