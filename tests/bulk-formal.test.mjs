import test from 'node:test';import assert from 'node:assert/strict';
import {setup,blob,pixels} from './bulk-formal-fixture.mjs';
import {registerBulkFormal} from '../integration-v1/bulk-formal.mjs';
import {inspectionIdentity} from '../integration-v1/inspection-core.mjs';
async function fixture(n=9){const base=await setup();let items=Array.from({length:n},(_,i)=>{const x=structuredClone(base.items[i%9]);x.id='crop:img'+i;x.imageId='img'+i;x.name='img'+i+'.png';x.candidate='C'+i;x.phrase='文字'+i;x.pose='構図'+i;Object.assign(x.crop,{imageId:x.imageId,filename:x.name});x.inspectionAudit.imageId=x.imageId;x.inspectionAudit.identity=inspectionIdentity(x);return x;});const master=items.map(x=>({candidateId:x.candidate,phrase:x.phrase,pose:x.pose})),assignments=items.map((x,i)=>({imageId:x.imageId,candidateId:x.candidate,batchId:'B'+Math.floor(i/9),slot:i%9+1}));let reads=0,saves=0;const pending={masterForCharacter:async()=>{reads++;return {characterId:'char',master,modifiedTime:'2026-11-04',masterSheet:'候補',masterReference:'https://docs.google.com/spreadsheets/d/master/edit'}}},api={items:()=>items,replaceItems:x=>items=x,get:async()=>blob,decode:async()=>pixels,save:()=>{saves++}},job={schema:'animal-stickers-bulk-formal/v1',characterId:'char',assignments};return {api,pending,job,reads:()=>reads,saves:()=>saves};}
test('mixed 81-cell job recovers good cells and retains rejected/unknown records and votes',async()=>{
 const f=await fixture(81);f.job.registrationMode='approved-only';
 for(const [index,decision] of [[1,'fail'],[9,'review']])Object.assign(f.api.items()[index].inspectionAudit,{decision,comment:'fixture issue'});
 delete f.api.items()[80].inspectionAudit;
 const votes=f.api.items().map(x=>JSON.stringify([x.rating,x.comment,x.touched,x.edit,x.selectionHistory]));
 const result=await registerBulkFormal(f.api,f.pending,f.job);
 assert.equal(result.registered,78);assert.equal(result.updated,78);assert.equal(result.excluded.length,3);assert.equal(f.reads(),1);assert.equal(f.saves(),1);
 assert.equal(f.api.items().length,81);assert.deepEqual(f.api.items().map(x=>JSON.stringify([x.rating,x.comment,x.touched,x.edit,x.selectionHistory])),votes);
 assert.ok([1,9,80].every(i=>!f.api.items()[i].technicalPassed&&!f.api.items()[i].candidateManifest));
 assert.equal((await registerBulkFormal(f.api,f.pending,f.job)).updated,0);assert.equal(f.saves(),1);
 // Inspect one formerly unknown cell, then retry: only that cell is promoted.
 const audit=structuredClone(f.api.items()[79].inspectionAudit);audit.imageId='img80';audit.identity=inspectionIdentity(f.api.items()[80]);f.api.items()[80].inspectionAudit=audit;
 assert.equal((await registerBulkFormal(f.api,f.pending,f.job)).updated,1);
});
test('approved-only does not hide stale claimed passes or invalid pixels',async()=>{
 for(const mutate of [f=>f.api.items()[8].inspectionAudit.sha256='bad',f=>f.api.items()[8].inspectionAudit.checks[0]=false,f=>f.api.decode=async()=>({...pixels,data:new Uint8ClampedArray(pixels.data.length)})]){
  const f=await fixture();f.job.registrationMode='approved-only';mutate(f);const before=structuredClone(f.api.items());await assert.rejects(registerBulkFormal(f.api,f.pending,f.job));assert.deepEqual(f.api.items(),before);assert.equal(f.saves(),0);
 }
});
test('all blocked cells can save mapping and decisions without granting approval',async()=>{
 const f=await fixture();f.job.registrationMode='approved-only';
 f.job.visualReport={schema:'animal-stickers-visual-report/v1',reviewer:'fixture',entries:f.api.items().map(x=>({imageId:x.imageId,identity:inspectionIdentity(x),sha256:x.inspectionAudit.sha256,checks:Array(9).fill(false),decision:'review',comment:'pending detail',reviewedAt:x.inspectionAudit.reviewedAt}))};
 const result=await registerBulkFormal(f.api,f.pending,f.job);assert.equal(result.registered,0);assert.equal(result.excluded.length,9);assert.equal(f.saves(),1);assert.ok(f.api.items().every(x=>!x.technicalPassed&&x.inspectionAudit.decision==='review'));
});
test('mixed approved-only job rolls back on save failure and retains concurrent edits',async()=>{
 const f=await fixture();f.job.registrationMode='approved-only';f.api.items()[8].inspectionAudit.decision='review';const before=structuredClone(f.api.items());f.api.save=async()=>{throw Error('quota')};await assert.rejects(registerBulkFormal(f.api,f.pending,f.job),/quota/);assert.deepEqual(f.api.items(),before);
 const g=await fixture();g.job.registrationMode='approved-only';g.api.items()[8].inspectionAudit.decision='review';const get=g.api.get;let once=false;g.api.get=async id=>{if(!once){once=true;g.api.items()[0].comment='concurrent'}return get(id)};await assert.rejects(registerBulkFormal(g.api,g.pending,g.job),/変更/);assert.equal(g.api.items()[0].comment,'concurrent');assert.equal(g.saves(),0);
});
test('81 candidates: one live master read and one state save, original choices preserved; retry no save',async()=>{const f=await fixture(81),votes=f.api.items().map(x=>JSON.stringify([x.rating,x.comment,x.touched,x.edit,x.selectionHistory]));assert.deepEqual(await registerBulkFormal(f.api,f.pending,f.job),{registered:81,batches:9,updated:81});assert.equal(f.reads(),1);assert.equal(f.saves(),1);assert.deepEqual(f.api.items().map(x=>JSON.stringify([x.rating,x.comment,x.touched,x.edit,x.selectionHistory])),votes);assert.ok(f.api.items().every(x=>x.technicalPassed&&x.formalRegistrationHistory.length===1));assert.deepEqual(await registerBulkFormal(f.api,f.pending,f.job),{registered:81,batches:9,updated:0});assert.equal(f.saves(),1);});
for(const [name,mutate] of [['duplicate slot',f=>f.job.assignments[8].slot=1],['missing audit',f=>delete f.api.items()[8].inspectionAudit],['wrong character',f=>f.api.items()[8].characterId='other'],['missing PNG',f=>f.api.get=async id=>id==='crop:img8'?null:blob],['unchecked visual',f=>f.api.items()[8].inspectionAudit.checks[0]=false],['incomplete batch',f=>f.job.assignments.pop()]])test(name+' leaves original state untouched',async()=>{const f=await fixture();mutate(f);const before=structuredClone(f.api.items());await assert.rejects(registerBulkFormal(f.api,f.pending,f.job));assert.deepEqual(f.api.items(),before);assert.equal(f.saves(),0);});
test('single file explicit mapping and individual visual report register together',async()=>{const f=await fixture();f.job.visualReport={schema:'animal-stickers-visual-report/v1',reviewer:'synthetic fixture',entries:f.api.items().map(x=>({imageId:x.imageId,identity:inspectionIdentity(x),sha256:x.inspectionAudit.sha256,checks:x.inspectionAudit.checks,decision:'pass',comment:'fixture only',reviewedAt:x.inspectionAudit.reviewedAt}))};f.api.items().forEach(x=>{delete x.inspectionAudit;x.candidate='';x.phrase='';x.pose=''});await registerBulkFormal(f.api,f.pending,f.job);assert.equal(f.saves(),1);assert.ok(f.api.items().every(x=>x.technicalPassed));});
test('save failure restores original state',async()=>{const f=await fixture(),before=structuredClone(f.api.items());f.api.save=()=>{throw Error('quota')};await assert.rejects(registerBulkFormal(f.api,f.pending,f.job),/quota/);assert.deepEqual(f.api.items(),before);});
test('concurrent user edits are retained and stop bulk commit',async()=>{const f=await fixture(),decode=f.api.decode;let once=false;f.api.decode=async b=>{if(!once){once=true;f.api.items()[0].comment='new unsaved edit'}return decode(b)};await assert.rejects(registerBulkFormal(f.api,f.pending,f.job),/変更/);assert.equal(f.api.items()[0].comment,'new unsaved edit');assert.equal(f.saves(),0);assert.equal(f.api.items()[0].technicalPassed,undefined);});
