import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeTransparency} from '../integration-v1/final-transparency.mjs';
import {inspect} from '../integration-v1/crop-v9/core.mjs';
const encode=async im=>new Blob([JSON.stringify({width:im.width,height:im.height,data:[...im.data]})],{type:'image/png'});
const decode=async blob=>{const im=JSON.parse(await blob.text());im.data=new Uint8ClampedArray(im.data);return im;};
function fixture(){const im={width:370,height:320,data:new Uint8ClampedArray(370*320*4)};for(let y=90;y<230;y++)for(let x=100;x<270;x++)im.data.set([255,255,255,220],(y*370+x)*4);return im;}
test('explicitly reviewed final background cleanup preserves white art and source',async()=>{
 const source=fixture();for(let y=40;y<280;y++)for(let x=40;x<330;x++)if(source.data[(y*370+x)*4+3]===0)source.data.set([120,80,40,8],(y*370+x)*4);
 const original=await encode(source);assert.equal(inspect(source).automatic,'fail');
 await assert.rejects(finalizeTransparency(original,decode,encode),/判別できない|背景残留/);
 const out=await finalizeTransparency(original,decode,encode,{reviewedBackground:{kind:'reviewed-background-regions/v1',regions:[[40,40,330,280]],reason:'Synthetic confirmed film outside body and fringe'}}),im=await decode(out.blob);
 assert.ok(out.report.removed>43000);assert.equal(im.data[(89*370+110)*4+3],8);assert.equal(out.report.stage,'final-output');assert.equal(out.report.visualReviewRequired,true);
 assert.equal(im.data[(100*370+110)*4+3],220);assert.equal(im.data[(50*370+50)*4+3],0);assert.equal((await decode(original)).data[(50*370+50)*4+3],8);
 assert.equal(inspect(im).automatic,'pass');const again=await finalizeTransparency(out.blob,decode,encode);assert.equal(again.blob,out.blob);
});
test('final verification rejects an encoder that silently retains background residue',async()=>{
 const im=fixture();im.data.set([100,80,40,1],(50*370+50)*4);const blob=await encode(im);
 await assert.rejects(finalizeTransparency(blob,decode,async()=>blob,{reviewedBackground:{kind:'reviewed-background-regions/v1',regions:[[49,49,52,52]],reason:'Synthetic confirmed dot'}}),/最終PNGの透過再検査/);
});
test('opaque background remains blocked instead of erasing white character',async()=>{
 const im=fixture();for(let p=0;p<im.data.length;p+=4)im.data.set([255,255,255,255],p);
 await assert.rejects(finalizeTransparency(await encode(im),decode,encode),/不透明な背景/);
});
