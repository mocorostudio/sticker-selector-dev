import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareTransparency} from '../integration-v1/crop-v9/transparency.mjs';
import {assertPreservedPixels} from '../integration-v1/crop-v9/pixel-preservation.mjs';
import {prepareCropBatch} from '../integration-v1/crop-v9/component-crops.mjs';
import {cleanTransparency,removeBackground} from '../integration-v1/crop-v9/core.mjs';
import {inspectTransparencyCheckpoint} from '../integration-v1/transparency-checkpoint.mjs';
const image=()=>({width:60,height:60,data:new Uint8ClampedArray(60*60*4)});
const region=(kind,regions)=>({kind,regions,reason:'Synthetic reviewed text / background fixture'});
test('unreviewed weak rims, isolated punctuation and overlapping art remain byte exact at every alpha',()=>{
 const im=image();for(let a=0;a<256;a++)im.data.set([240,220,a,a],a*4);
 for(let x=10;x<30;x++)im.data.set([255,255,255,255],(30*60+x)*4);
 im.data.set([255,255,255,4],(29*60+20)*4);
 const before=im.data.slice(),out=prepareTransparency(im);
 assert.deepEqual(out.data,before);assert.deepEqual(cleanTransparency(im).data,before);
 assert.equal(out.report.removed,0);assert.equal(out.report.preservation.changedPixels,0);assert.equal(out.report.status,'hold');assert.deepEqual(im.data,before);
 assert.throws(()=>removeBackground(im),/文字・白フチ/);
});
test('explicit foreground wins over overlapping reviewed background for every removal path',()=>{
 const im=image();for(let y=0;y<60;y++)for(let x=0;x<60;x++)im.data.set([240,240,240,(x+y)%2?4:60],(y*60+x)*4);
 im.data.set([80,40,20,18],(35*60+35)*4);
 const fg=region('protected-foreground-regions/v1',[[25,25,40,40]]),bg=region('reviewed-background-regions/v1',[[0,0,60,60]]);
 const out=prepareTransparency(im,{protectedForeground:fg,reviewedBackground:bg});
 assert.equal(out.data[3],0);assert.ok(out.report.removed>0);
 for(let y=25;y<40;y++)for(let x=25;x<40;x++){const p=(y*60+x)*4;assert.deepEqual(out.data.slice(p,p+4),im.data.slice(p,p+4));}
 assert.equal(assertPreservedPixels(im,out,{protectedForeground:fg,reviewedBackground:bg}).changedPixels,0);
 const changed={...out,data:out.data.slice()};changed.data[(35*60+35)*4+3]=0;
 assert.throws(()=>assertPreservedPixels(im,changed,{protectedForeground:fg,reviewedBackground:bg}),/保護画素/);
});
test('invalid and stale coordinate bounds fail before any image mutation',()=>{
 for(const regions of [[[0,0,61,1]],[[0,0,0,1]],[[0.5,0,1,1]],[[0,0,1]],[]]){
  const im=image(),before=im.data.slice();assert.throws(()=>prepareTransparency(im,{protectedForeground:region('protected-foreground-regions/v1',regions)}));assert.deepEqual(im.data,before);
 }
 assert.throws(()=>assertPreservedPixels(image(),{width:1,height:1,data:new Uint8Array(4)}),/寸法/);
});
test('cell extraction conserves tiny opaque dots, weak accents and overlap pixels exactly once',()=>{
 const im=image();for(let r=0;r<3;r++)for(let c=0;c<3;c++){
  for(let y=r*20+8;y<r*20+16;y++)for(let x=c*20+8;x<c*20+16;x++)im.data.set([100,40,20,255],(y*60+x)*4);
  im.data.set([255,255,255,4],((r*20+7)*60+c*20+10)*4);
  im.data.set([80,30,20,18],((r*20+3)*60+c*20+3)*4);
  im.data.set([80,30,20,255],((r*20+3)*60+c*20+5)*4);
 }
 const before=im.data.slice(),batch=prepareCropBatch(im),recovered=new Uint8ClampedArray(im.data.length),count=new Uint8Array(3600);
 for(const cell of batch.cells)for(let y=0;y<cell.pixels.height;y++)for(let x=0;x<cell.pixels.width;x++){
  const p=(y*cell.pixels.width+x)*4;if(!cell.pixels.data[p+3])continue;
  const k=(cell.bounds.y0+y)*60+cell.bounds.x0+x;count[k]++;recovered.set(cell.pixels.data.subarray(p,p+4),k*4);
 }
 assert.deepEqual(recovered,before);assert.ok(count.every(v=>v<=1));assert.deepEqual(im.data,before);assert.equal(batch.cells.length,9);
});
test('saved readback guard rejects alpha and color changes including low-alpha text',()=>{
 const im=image();im.data.set([240,230,220,4],(3*60+3)*4);
 const fg=region('protected-foreground-regions/v1',[[2,2,5,5]]);
 assert.equal(inspectTransparencyCheckpoint(im,{protectedForeground:fg,expectedPixels:im}).preservation.status,'verified');
 for(const channel of [0,3]){const changed={...im,data:im.data.slice()};changed.data[(3*60+3)*4+channel]++;assert.throws(()=>inspectTransparencyCheckpoint(changed,{expectedPixels:im,protectedForeground:fg}),/保護画素/);}
});
