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

test('tightly isolated opaque artwork uses the transparent original source for background detection',()=>{
 const component={width:10,height:10,data:new Uint8ClampedArray(10*10*4).fill(255)};
 const r=prepareTransparency(component,{backgroundReference:image()});assert.equal(r.report.status,'checked');assert.deepEqual(r.data,component.data);
 assert.equal(prepareTransparency(component,{backgroundReference:image(255)}).report.status,'hold');
});

test('weak watercolor edge is protected while distant weak noise is removed',()=>{
 const im=image();im.data.set([240,120,40,4],(11*40+20)*4);im.data.set([240,120,40,4],(2*40+2)*4);
 const r=prepareTransparency(im);assert.equal(r.data[(11*40+20)*4+3],4);assert.equal(r.data[(2*40+2)*4+3],0);
});
test('detached colored film and enclosed haze are retained and flagged with coordinates',()=>{
 const im=image();for(let y=2;y<6;y++)for(let x=2;x<6;x++)im.data.set([120,40,80,60],(y*40+x)*4);
 const r=prepareTransparency(im);assert.equal(r.report.status,'hold');assert.deepEqual(r.report.residualComponents[0].bounds,[2,2,6,6]);assert.equal(r.report.alphaHistogram[60],16);assert.equal(r.data[(2*40+2)*4+3],60);
});

test('a watercolor leaf connected through translucent pixels is not mislabelled as detached residue',()=>{
 const im=image();for(let k=0;k<1600;k++)if(!im.data[k*4+3])im.data.fill(0,k*4,k*4+4);for(let x=5;x<13;x++)im.data.set([100,160,40,90],(20*40+x)*4);
 for(let x=4;x<10;x++)im.data.set([100,160,40,90],((x+10)*40+x)*4);
 const r=prepareTransparency(im);assert.deepEqual(r.data,im.data);assert.deepEqual(r.report.residualComponents,[]);assert.equal(r.report.status,'checked');assert.equal(r.report.visualReviewRequired,true);
});
test('tiny weak detached speckles are removed, with exact coordinates recorded and nearby rim protected',()=>{
 const im=image();im.data.set([120,70,40,18],(4*40+4)*4);im.data.set([120,70,40,18],(11*40+20)*4);
 const before=im.data.slice(),r=prepareTransparency(im);assert.equal(r.data[(4*40+4)*4+3],0);assert.equal(r.data[(11*40+20)*4+3],18);assert.equal(r.report.weakIslandRemoved,1);assert.deepEqual(r.report.removedIslands[0].bounds,[4,4,5,5]);assert.equal(r.report.alphaHistogram[18],1);assert.deepEqual(im.data,before);
 assert.deepEqual(prepareTransparency(r).data,r.data);
});
test('a broad colored wash connected to the body remains blocked and intact',()=>{
 const im=image();for(let y=0;y<12;y++)for(let x=0;x<40;x++)im.data.set([120,70,40,60],(y*40+x)*4);
 const r=prepareTransparency(im);assert.ok(r.report.issues.some(x=>x.includes('広い半透明領域')));assert.equal(r.report.status,'hold');assert.equal(r.data[3],60);
});
test('larger detached faint patches remain blocked instead of being cleared by an alpha cutoff',()=>{
 const im=image();for(let y=0;y<6;y++)for(let x=0;x<6;x++)im.data.set([120,70,40,18],(y*40+x)*4);
 const r=prepareTransparency(im);assert.equal(r.report.status,'hold');assert.equal(r.report.weakIslandRemoved,0);assert.equal(r.data[3],18);
});
