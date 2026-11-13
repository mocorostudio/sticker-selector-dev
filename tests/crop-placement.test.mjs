import test from 'node:test';
import assert from 'node:assert/strict';
import {placementPlan,placementQA,placementRecord,UPSCALE_ISSUE} from '../integration-v1/crop-v9/placement.mjs';
import {inspect,gate,decide,visualChecks} from '../integration-v1/crop-v9/core.mjs';
const image=(w,h,margin)=>{const p={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};for(let y=margin;y<h-margin;y++)for(let x=margin;x<w-margin;x++)p.data[(y*w+x)*4+3]=255;return p;};
test('source-sized landscape and portrait art use the available frame while offsets cannot clip content',()=>{
 for(const [w,h] of [[1000,800],[400,420],[418,365],[350,300],[388,371],[420,403]]){
  const plan=placementPlan(w,h);assert(plan.scale<=1);assert(!plan.upscaleRequired);
  assert(Math.min(plan.x,plan.y,370-plan.x-plan.drawWidth,320-plan.y-plan.drawHeight)>=10);
  assert(plan.drawWidth>=349||plan.drawHeight>=299);
  assert(Math.abs(plan.drawWidth/w-plan.drawHeight/h)<=1/w+1/h);
  for(const offset of [-999,999]){const p=placementPlan(w,h,{size:105,offsetX:offset,offsetY:offset});assert(p.x>=10&&p.y>=10&&p.x+p.drawWidth<=360&&p.y+p.drawHeight<=310);}
 }
});
test('small source is never enlarged or made formally eligible by a 370x320 canvas',()=>{
 const p=placementPlan(120,100);assert.equal(p.scale,1);assert.equal(p.drawWidth,120);assert.equal(p.drawHeight,100);assert.equal(p.upscaleRequired,true);
 const qa=placementQA(inspect(image(370,320,40)),p);assert(qa.issues.includes(UPSCALE_ISSUE));
 const r={placement:p,qa:{automatic:'pass',issues:[]},candidateId:'A',phrase:'hello',review:visualChecks.map(()=>true)};
 assert.equal(gate(r),'review');assert.throws(()=>decide(r,'pass'),/解像度不足/);
});
test('10px final margin passes, 9px and disconnected haze still stop; generation padding is a separate concern',()=>{
 assert.equal(inspect(image(370,320,10)).automatic,'pass');assert(inspect(image(370,320,9)).issues.includes('安全余白10px未満'));
 const p=image(370,320,40);p.data.set([120,50,40,60],(10*370+10)*4);assert.equal(inspect(p).automatic,'fail');
});
test('explicit placement creates a new unreviewed attempt without changing old pixels, votes or layout',()=>{
 const old={imageId:'old',candidateId:'A',phrase:'hello',rating:'o',comment:'keep',pixels:image(370,320,40),review:[true],layout:{size:100},decision:'pass',technicalStatus:'pass'},before=structuredClone(old),p=placementPlan(400,420);
 const next=placementRecord(old,image(370,320,10),p.settings,{imageId:'new',filename:'new.png',qa:{automatic:'pass',issues:[]},placement:p});
 assert.deepEqual(old,before);assert.equal(next.history[0].previousImageId,'old');assert.equal(next.comment,'keep');assert.deepEqual(next.review,[]);assert.notEqual(gate(next),'pass');assert.equal(next.placement.version,'source-fit-10px/v1');
});
