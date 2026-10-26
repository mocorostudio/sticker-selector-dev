import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationHandoff,handoffPrompt} from '../integration-v1/line-handoff.mjs';
function fixture(){return {bundle:{applicationKit:true,characterId:'char',archives:[{name:'review.zip',sha:'a'.repeat(64),count:8,mapping:Array.from({length:8},(_,i)=>({filename:String(i+1).padStart(2,'0')+'.png',imageId:'img'+i,sha256:'b'.repeat(64),technicalStatus:'review'})),artwork:['main.png','tab.png'].map(filename=>({filename,sha256:'c'.repeat(64),technicalStatus:'review'}))}]},receipt:{folderId:'application',archives:[{name:'review.zip',count:8,id:'zip-id'}]}};}
test('handoff retains exact archive, order and review status without changing selection',()=>{
 const {bundle,receipt}=fixture(),before=structuredClone(bundle),record=applicationHandoff(bundle,receipt);
 assert.equal(record.archives[0].fileId,'zip-id');assert.equal(record.archives[0].ordered[7].imageId,'img7');assert.equal(record.technicalApproval,false);assert.equal(record.lineStatus,'not-started');assert.equal(record.finalSubmissionRequiresApproval,true);assert.deepEqual(bundle,before);
 assert.match(handoffPrompt(record),/審査リクエスト.*実行せず/);
});
test('handoff rejects missing receipts, changed count, order, hashes and missing artwork',()=>{
 for(const mutate of [f=>f.receipt.archives=[],f=>f.receipt.archives[0].count=16,f=>f.bundle.archives[0].mapping.reverse(),f=>f.bundle.archives[0].sha='wrong',f=>f.bundle.archives[0].artwork.pop(),f=>f.bundle.applicationKit=false]){const f=fixture();mutate(f);assert.throws(()=>applicationHandoff(f.bundle,f.receipt));}
});
