import test from 'node:test';import assert from 'node:assert/strict';
import {inspectTransparencyCheckpoint,verifySavedTransparency} from '../integration-v1/transparency-checkpoint.mjs';
import {automaticInspection,inspectionDecision} from '../integration-v1/inspection-core.mjs';
import {validPixels,candidateItems} from './candidate-export-fixture.mjs';
import {pngFixture} from './submission-png-fixture.mjs';
import {prepareTrialSubmission} from '../integration-v1/submission-core.mjs';
import {prepareSelectionZip} from '../integration-v1/submission-zip.mjs';
test('saved-file checkpoint blocks removable dots and ambiguous residue before selection without mutating pixels',()=>{
 for(const alpha of [4,18,60]){const pixels=validPixels();pixels.data.set([120,50,40,alpha],(10*370+10)*4);const before=pixels.data.slice(),r=inspectTransparencyCheckpoint(pixels,{sha256:'a'.repeat(64)});assert.equal(r.status,'needs-repair');assert.ok(r.issues.length);assert.equal(r.technicalApproval,false);assert.deepEqual(pixels.data,before);}
 const clear=inspectTransparencyCheckpoint(validPixels(),{sha256:'a'.repeat(64)});assert.equal(clear.status,'verified');assert.equal(clear.visualReviewRequired,true);assert.equal(clear.technicalApproval,false);
});
test('automatic technical inspection cannot approve a PNG which still needs cleanup',async()=>{
 const pixels=validPixels();pixels.data.set([120,50,40,60],(10*370+10)*4);
 const audit=await automaticInspection({imageId:'test',crop:{}},pngFixture(),async()=>pixels);
 assert.equal(audit.qa.automatic,'fail');assert.equal(audit.transparencyCheckpoint.status,'needs-repair');assert.throws(()=>inspectionDecision(audit,'pass',Array(9).fill(true)),/自動検査/);
});
test('checkpoint binds actual saved bytes, checks readback, and rejects changed images',async()=>{
 const blob=pngFixture(),proof=await verifySavedTransparency(blob,async()=>validPixels());assert.match(proof.sha256,/^[a-f0-9]{64}$/);
 await assert.rejects(verifySavedTransparency(pngFixture(370,320,{color:121}),async()=>validPixels(),{expectedSha:proof.sha256}),/PNGが変わっています/);
 const dirty=validPixels();dirty.data.set([120,50,40,18],(10*370+10)*4);await assert.rejects(verifySavedTransparency(blob,async()=>dirty),/選抜前/);
});
test('new checkpointed sources reach ZIP without late cleanup; altered evidence never falls back to legacy repair',async()=>{
 const blob=pngFixture(),proof=await verifySavedTransparency(blob,async()=>validPixels()),items=candidateItems().filter(x=>x.rating==='o').slice(0,8);for(const x of items){x.characterId='char';x.crop.transparencyCheckpoint=proof;}
 const files=items.map(x=>({id:x.imageId,localItemId:x.id,trial:true})),draft={sets:[{id:'s',name:'test',target:8}],assignments:Object.fromEntries(files.map(x=>[x.id,'s']))},plan=prepareTrialSubmission(draft,files,{characterId:'char',id:'test'}),before=structuredClone(items);
 const result=await prepareSelectionZip(plan,{items,get:async()=>blob,decode:async()=>validPixels(),encodePNG:()=>assert.fail('ZIP must not repair checkpointed images')});
 assert.ok(result.archives[0].mapping.every(x=>x.transparencyCleanup.verificationOnly===true));assert.deepEqual(items,before);
 items[0].crop.transparencyCheckpoint={...proof,sha256:'0'.repeat(64)};await assert.rejects(prepareSelectionZip(plan,{items,get:async()=>blob,decode:async()=>validPixels()}),/検査後にPNGが変わっています/);
});
