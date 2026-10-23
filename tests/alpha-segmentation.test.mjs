import test from 'node:test';
import assert from 'node:assert/strict';
import {detect,cropPixels,cleanTransparency,trim,crossesBounds} from '../integration-v1/crop-v9/core.mjs';
const grid=(alpha)=>{const im={width:300,height:300,data:new Uint8ClampedArray(300*300*4)};for(let k=0;k<90000;k++)im.data[k*4+3]=alpha;for(const y of [20,120,220])for(const x of [20,120,220])for(let yy=y;yy<y+60;yy++)for(let xx=x;xx<x+60;xx++)im.data[(yy*300+xx)*4+3]=255;return im;};
test('almost transparent bridges do not move cuts or join neighboring stickers',()=>{
 const im=grid(1),before=im.data.slice(),cells=detect(im,3,3);
 assert.equal(cells.length,9);assert.ok(cells.every(c=>!c.crossing&&c.parts.length===1));
 for(const c of cells){const trimmed=trim(cleanTransparency(cropPixels(im,c.bounds)));assert.equal(trimmed.width,60);assert.equal(trimmed.height,60);assert.equal(crossesBounds(im,c.bounds),false);}
 assert.deepEqual(im.data,before);
});
test('visible bridges remain blocked; clearing alpha noise never approves a real overlap',()=>{
 const im=grid(9);assert.ok(detect(im,3,3).every(c=>c.crossing));
});
