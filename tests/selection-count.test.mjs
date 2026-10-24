import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExport,exportSummary} from '../integration-v1/drive-export.mjs';
const decode=async()=>{const data=new Uint8ClampedArray(370*320*4);for(let y=60;y<260;y++)for(let x=70;x<300;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};};
test('72 saved votes and nine PNG copies are reported separately, including all 63 trial records',async()=>{
 const items=Array.from({length:72},(_,i)=>{const imageId='count_'+i,rating=i<8||i>=9&&i<42?'o':i===8||i>=42&&i<46?'h':'x';return {id:'crop:'+imageId,imageId,origin:'crop-local',rating,touched:true,revision:imageId,comment:'',technicalPassed:i<9,selectionHistory:[{revision:imageId,rating,comment:''}],crop:{candidateId:'D'+i,phrase:'テスト',qa:{automatic:'pass'},review:Array(9).fill(true),...(i>=9?{trialSelection:{explicitUser:true,purpose:'selection-test-only'}}:{})}};});
 const plan=await prepareExport(items,{get:async()=>new Blob([new Uint8Array(30)],{type:'image/png'}),decode});assert.deepEqual(plan.summary,{records:72,confirmed:72,trialRecords:63,pngCopies:9});assert.equal(plan.counts.adopted,41);assert.equal(plan.counts.held,5);assert.equal(plan.counts.rejected,26);assert.equal(plan.images.length,9);const text=exportSummary([plan]);assert.match(text,/選抜結果72件（◯41・△5・✕26）／PNG 9枚/);assert.match(text,/試用画像63件は選抜結果だけ/);
});
