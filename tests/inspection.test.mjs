import test from 'node:test';import assert from 'node:assert/strict';
import {automaticInspection,inspectionDecision,verifyInspection,visualChecks} from '../integration-v1/inspection-core.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
const item=()=>({imageId:'pmd',candidate:'PMD001',phrase:'おはよう',pose:'お座り',rating:'o',comment:'好き',crop:{crossing:false}}),png=new Blob([new Uint8Array(40)],{type:'image/png'});
test('automatic inspection never marks visual checks or changes selection; all visual checks are required',async()=>{
 const x=item(),before=structuredClone(x),a=await automaticInspection(x,png,async()=>validPixels());assert.equal(a.qa.automatic,'pass');assert.equal(a.decision,'review');assert.ok(a.checks.every(v=>v===false));assert.deepEqual(x,before);
 assert.throws(()=>inspectionDecision(a,'pass',Array(visualChecks.length).fill(false)),/すべて/);const done=inspectionDecision(a,'pass',Array(visualChecks.length).fill(true));assert.equal(done.decision,'pass');assert.equal(done.sha256,a.sha256);
 const bad=await automaticInspection(x,png,async()=>({width:370,height:320,data:new Uint8ClampedArray(370*320*4)}));assert.equal(bad.qa.automatic,'fail');assert.throws(()=>inspectionDecision(bad,'pass',Array(visualChecks.length).fill(true)),/すべて/);
});
test('unchanged bytes preserve visual inspection; recrop, phrase, pose or candidate changes invalidate it',async()=>{
 const x=item(),a=await automaticInspection(x,png,async()=>validPixels());x.inspectionAudit=inspectionDecision(a,'pass',Array(visualChecks.length).fill(true),'確認済み');assert.equal(await verifyInspection(x,png),true);assert.equal((await automaticInspection(x,png,async()=>validPixels())).decision,'pass');
 for(const field of ['imageId','candidate','phrase','pose']){const changed=structuredClone(x);changed[field]+='new';assert.equal(await verifyInspection(changed,png),false);const next=await automaticInspection(changed,png,async()=>validPixels());assert.equal(next.decision,'review');assert.ok(next.checks.every(v=>!v));}
 const bytes=new Blob([new Uint8Array(41)],{type:'image/png'});assert.equal(await verifyInspection(x,bytes),false);assert.equal((await automaticInspection(x,bytes,async()=>validPixels())).decision,'review');
});
