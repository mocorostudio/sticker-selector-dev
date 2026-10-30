import test from 'node:test';
import assert from 'node:assert/strict';
import {draftArchivePixelsEligible,prepareSelectionZip} from '../integration-v1/submission-zip.mjs';
import {inspect} from '../integration-v1/crop-v9/core.mjs';
import {digest} from '../integration-v1/drive-export.mjs';
function pixels(margin=25){const p={width:370,height:320,data:new Uint8ClampedArray(370*320*4)};for(let y=margin;y<320-margin;y++)for(let x=margin;x<370-margin;x++)p.data[(y*370+x)*4+3]=255;return p;}
test('review ZIP margin uses final pixels, without clearing other inspection failures',()=>{
 const p=pixels();assert.equal(inspect(p).automatic,'fail');assert(draftArchivePixelsEligible(p,inspect(p)));
 for(const margin of [0,9]){const p=pixels(margin);assert(!draftArchivePixelsEligible(p,inspect(p)));}
 const empty=pixels();empty.data.fill(0);assert(!draftArchivePixelsEligible(empty,inspect(empty)));
 assert(!draftArchivePixelsEligible(p,inspect(p),true));
 assert(!draftArchivePixelsEligible(p,{issues:['背景端が不透明']}));
});
test('draft ZIP keeps review status and warnings, preserving original choices',async()=>{
 const blob=new Blob([new Uint8Array(24)],{type:'image/png'}),sha=await digest(blob),p=pixels();
 const items=Array.from({length:8},(_,i)=>({id:'crop:'+i,imageId:'image'+i,characterId:'character',origin:'crop-local',touched:true,rating:'o',crop:{draftSelection:true,decision:'review',crossing:false,pendingDrive:{characterId:'character',archiveFileId:'archive',manifestFileId:'manifest',sha256:sha}}}));
 const plan={schema:'animal-stickers-submission-trial/v1',technicalApproval:false,purpose:'selection-test-only',characterId:'character',sets:[{id:'set',name:'test',target:8}],entries:items.map(x=>({fileId:x.imageId,imageId:x.imageId,localItemId:x.id,setId:'set'}))},before=JSON.stringify(items);
 const api={items,get:async()=>blob,decode:async()=>p},result=await prepareSelectionZip(plan,api);
 assert(result.archives[0].mapping.every(x=>x.technicalStatus==='review'&&x.technicalWarnings.includes('安全余白10%未満')));
 assert.equal(JSON.parse(await result.manifest.blob.text()).technicalApproval,false);assert.equal(JSON.stringify(items),before);
 for(const mutate of [i=>i.crop.pendingDrive.sha256='0'.repeat(64),i=>i.inspectionAudit={decision:'fail'},i=>i.crop.crossing=true]){const next=structuredClone(items);mutate(next[0]);await assert.rejects(prepareSelectionZip(plan,{...api,items:next}),/技術検品/);}
});
