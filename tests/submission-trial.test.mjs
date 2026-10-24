import test from 'node:test';
import assert from 'node:assert/strict';
import {trialCandidates,prepareTrialSubmission,prepareSubmission,validateSubmission} from '../integration-v1/submission-core.mjs';
test('trial planning selects 40 from 41 votes without changing votes or producing a real move plan',()=>{
 const items=Array.from({length:43},(_,i)=>({id:'crop:image'+i,imageId:'image'+i,name:'image'+i+'.png',origin:'crop-local',touched:i<42,rating:i<41?'o':'x',technicalPassed:i<8})),before=structuredClone(items),files=trialCandidates(items);assert.equal(files.length,41);
 const draft={sets:[{id:'set',name:'試用',target:40}],assignments:Object.fromEntries(files.slice(0,40).map(f=>[f.id,'set']))};const plan=prepareTrialSubmission(draft,files,{characterId:'character',id:'plan'});assert.equal(plan.entries.length,40);assert.equal(plan.technicalApproval,false);assert.equal(plan.purpose,'selection-test-only');assert.throws(()=>validateSubmission(plan),/計画/);assert.throws(()=>prepareSubmission(draft,files,{characterId:'character',id:'real'}),/技術検品/);assert.deepEqual(items,before);
});
test('trial plan refuses wrong counts and unknown candidates',()=>{const files=trialCandidates([{id:'crop:i',imageId:'i',origin:'crop-local',touched:true,rating:'o'}]);const d={sets:[{id:'set',name:'試用',target:8}],assignments:{i:'set'}};assert.throws(()=>prepareTrialSubmission(d,files,{characterId:'character',id:'plan'}),/目標枚数/);});
