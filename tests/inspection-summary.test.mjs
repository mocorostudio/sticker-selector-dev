import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionSummary} from '../integration-v1/inspection-summary.mjs';
import {automaticInspection,inspectionDecision,visualChecks} from '../integration-v1/inspection-core.mjs';
import {savedEvaluation,restoreEvaluation} from '../integration-v1/reselection.mjs';
import {validPixels} from './candidate-export-fixture.mjs';

const blob=new Blob([new Uint8Array(40)],{type:'image/png'});
const item=()=>({id:'crop:img',imageId:'img',candidate:'ID001',phrase:'ありがとう',pose:'お辞儀',origin:'crop-local',crop:{crossing:false},rating:'h',touched:true,comment:'採用の好み',revision:'local-vote',selectionHistory:[]});
test('technical ×/△ and reasons are independent of preference, and stale records are visibly unconfirmed',async()=>{
 for(const decision of ['fail','review']){
  const i=item(),a=await automaticInspection(i,blob,async()=>validPixels());
  i.inspectionAudit=inspectionDecision(a,decision,[],decision==='fail'?'耳が1本欠けています':'文字の一部が薄い');
  const before=JSON.stringify(i),s=await inspectionSummary(i,blob);assert.equal(s.status,decision);assert.equal(s.reasons[0],i.inspectionAudit.comment);assert.equal(JSON.stringify(i),before);
  for(const key of ['candidate','phrase','pose','imageId']){const changed=structuredClone(i);changed[key]+='changed';assert.equal((await inspectionSummary(changed,blob)).status,'unknown');}
  assert.equal((await inspectionSummary(i,new Blob([new Uint8Array(41)]))).status,'unknown');
 }
 assert.equal((await inspectionSummary(item(),blob)).status,'unknown');
});
test('a numeric warning alone is △, explicit failure requires a reason and stays × on rescanning',async()=>{
 const i=item(),im=validPixels();im.data[3]=255;
 const a=await automaticInspection(i,blob,async()=>im);i.inspectionAudit=a;
 assert.equal((await inspectionSummary(i,blob)).status,'review');
 assert.throws(()=>inspectionDecision(a,'review',[],''),/理由/);assert.throws(()=>inspectionDecision(a,'fail',[],'   '),/理由/);
 i.inspectionAudit=inspectionDecision(a,'fail',[],'頭が増えています');
 const rescanned=await automaticInspection(i,blob,async()=>im);assert.equal(rescanned.decision,'fail');assert.equal(rescanned.comment,'頭が増えています');
});
test('only a complete verified inspection is labelled pass',async()=>{
 const i=item(),a=await automaticInspection(i,blob,async()=>validPixels());i.inspectionAudit=a;
 assert.equal((await inspectionSummary(i,blob)).status,'unknown');
 i.inspectionAudit=inspectionDecision(a,'pass',Array(visualChecks.length).fill(true));assert.equal((await inspectionSummary(i,blob)).status,'pass');
 i.inspectionAudit.checks=[];assert.equal((await inspectionSummary(i,blob)).status,'unknown');
});
test('Drive record restores inspection separately from local votes and keeps newer local reasons',async()=>{
 const i=item(),a=await automaticInspection(i,blob,async()=>validPixels(),'2026-10-30T00:00:00Z');
 const audit=inspectionDecision(a,'review',[],'線が薄い','2026-10-30T01:00:00Z');
 const record={imageId:i.imageId,candidateId:i.candidate,phrase:i.phrase,pose:i.pose,crossing:false,pendingDrive:{sha256:a.sha256}};
 const row={imageId:i.imageId,candidateId:i.candidate,phrase:i.phrase,sourceProof:{sha256:a.sha256,characterId:'char'},inspectionAudit:audit,inspectionHistory:[audit],confirmed:true,rating:'x',revision:'remote-vote',comment:'remote preference'};
 const doc={schema:'animal-stickers-selection-export/v1',results:[row]},evaluation=savedEvaluation(doc,record,'char');
 assert.equal(restoreEvaluation(i,evaluation),false);assert.equal(i.rating,'h');assert.equal(i.comment,'採用の好み');assert.equal(i.inspectionAudit.comment,'線が薄い');
 i.inspectionAudit={...audit,comment:'新しい検品理由',reviewedAt:'2026-10-30T02:00:00Z'};restoreEvaluation(i,evaluation);assert.equal(i.inspectionAudit.comment,'新しい検品理由');
 const fresh=item();fresh.touched=false;restoreEvaluation(fresh,evaluation);assert.equal(fresh.rating,'x');assert.equal(fresh.inspectionAudit.comment,'線が薄い');
 const unvoted=savedEvaluation({...doc,results:[{...row,confirmed:false}]},record,'char');const stillUnvoted=item();stillUnvoted.touched=false;restoreEvaluation(stillUnvoted,unvoted);assert.equal(stillUnvoted.touched,false);assert.equal(stillUnvoted.inspectionAudit.comment,'線が薄い');
 const stale=savedEvaluation({...doc,results:[{...row,inspectionAudit:{...audit,sha256:'changed'}}]},record,'char');assert.equal(stale.inspectionAudit,undefined);
});
