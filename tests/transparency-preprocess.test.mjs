import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTransparency} from '../integration-v1/crop-v9/transparency.mjs';
import {automaticInspection} from '../integration-v1/inspection-core.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
const image=(alpha=0)=>{const data=new Uint8ClampedArray(40*40*4);for(let k=0;k<1600;k++)data.set([240,240,240,alpha],k*4);for(let y=12;y<28;y++)for(let x=12;x<28;x++)data.set([255,255,255,255],(y*40+x)*4);return {width:40,height:40,data};};
test('edge-connected neutral haze is removed while white body and nearby white antialiasing remain',()=>{
 const im=image(60);im.data.set([255,255,255,70],(11*40+20)*4);const before=im.data.slice(),r=prepareTransparency(im);
 assert.equal(r.data[3],0);assert.equal(r.data[(20*40+20)*4+3],255);assert.equal(r.data[(11*40+20)*4+3],70);assert.ok(r.report.hazeRemoved>0);assert.deepEqual(im.data,before);
});
test('opaque white background is retained and flagged instead of deleting white artwork',()=>{
 const im=image(255),r=prepareTransparency(im);assert.deepEqual(r.data,im.data);assert.equal(r.report.status,'hold');assert.equal(r.report.opaqueColorKeyApplied,false);
});
test('colored translucent decorations and clean transparent artwork are preserved',()=>{
 const im=image();im.data.set([240,30,80,60],(4*40+4)*4);im.data.set([255,255,255,100],(11*40+20)*4);
 const r=prepareTransparency(im);assert.deepEqual(r.data.slice((4*40+4)*4,(4*40+4)*4+4),im.data.slice((4*40+4)*4,(4*40+4)*4+4));assert.equal(r.data[(11*40+20)*4+3],100);
});
test('repeated preprocessing is stable and does not establish technical approval',()=>{
 const a=prepareTransparency(image(60)),b=prepareTransparency(a);assert.deepEqual(a.data,b.data);assert.equal(b.report.removed,0);assert.equal(a.technicalPassed,undefined);
});
test('an unresolved opaque background stays blocked by the inspection stage after normalization',async()=>{
 const report=prepareTransparency(image(255)).report;
 const item={imageId:'new-crop',candidate:'D1',phrase:'test',pose:'test',crop:{transparencyCleanup:report}};
 const audit=await automaticInspection(item,new Blob([new Uint8Array(30)],{type:'image/png'}),async()=>validPixels());
 assert.equal(audit.qa.automatic,'fail');assert.ok(audit.qa.issues.some(x=>x.includes('不透明な背景')));assert.notEqual(audit.decision,'pass');
});
