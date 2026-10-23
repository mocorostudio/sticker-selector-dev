import test from 'node:test';
import assert from 'node:assert/strict';
import {gate,inspect,detect,visualChecks} from '../integration-v1/crop-v9/core.mjs';
import {prepareExport} from '../integration-v1/drive-export.mjs';
import {isLocalConfirmed} from '../integration-v1/crop-handoff.mjs';
import {prepareSubmission} from '../integration-v1/submission-core.mjs';
const record=()=>({imageId:'image-1',candidateId:'D01',phrase:'こんにちは',qa:{automatic:'pass',issues:[]},review:visualChecks.map(()=>true)});
const item=()=>({id:'crop:image-1',imageId:'image-1',name:'test.png',origin:'crop-local',touched:true,rating:'o',revision:'r1',comment:'',technicalPassed:true,crop:record(),selectionHistory:[{revision:'r1',rating:'o',comment:''}]});
const image=(width=370,height=320)=>({width,height,data:new Uint8ClampedArray(width*height*4)});
test('technical inspection rejects empty, opaque, wrong-size and insufficient-margin images',()=>{
 const empty=image();assert.equal(inspect(empty).automatic,'fail');
 const opaque=image();opaque.data.fill(255);assert.equal(inspect(opaque).automatic,'fail');
 assert.equal(inspect(image(10,10)).automatic,'fail');
 const valid=image();for(let y=80;y<240;y++)for(let x=100;x<270;x++)valid.data[(y*370+x)*4+3]=255;
 assert.equal(inspect(valid).automatic,'pass');assert.equal(inspect(valid,true).automatic,'fail');
});
test('transparent valley detection preserves disconnected cells',()=>{
 const im=image(90,90);for(const y of [10,40,70])for(const x of [10,40,70])for(let dy=0;dy<8;dy++)for(let dx=0;dx<8;dx++)im.data[((y+dy)*90+x+dx)*4+3]=255;
 const cells=detect(im,3,3);assert.equal(cells.length,9);assert.ok(cells.every(c=>c.parts.length===1&&!c.crossing));
});
test('candidate mapping and all visual checks are required for technical pass',()=>{
 assert.equal(gate(record()),'pass');assert.notEqual(gate({...record(),candidateId:''}),'pass');assert.notEqual(gate({...record(),phrase:''}),'pass');assert.notEqual(gate({...record(),review:[] }),'pass');
});
test('confirmation must match current rating and comment',()=>{
 assert.equal(isLocalConfirmed(item()),true);assert.equal(isLocalConfirmed({...item(),rating:'h'}),false);assert.equal(isLocalConfirmed({...item(),comment:'changed'}),false);
});
test('drafts and failed technical records cannot prepare adopted PNGs',async()=>{
 for(const r of [{...item(),technicalPassed:false},{...item(),crop:{...record(),review:[]}}])await assert.rejects(prepareExport([r],{get:()=>{throw Error('must not access image')}}),/技術検品/);
});
test('actual PNG pixels are rechecked even when metadata claims a pass',async()=>{
 await assert.rejects(prepareExport([item()],{get:async()=>new Blob([new Uint8Array(30)],{type:'image/png'}),decode:async()=>image()}),/再検品/);
});
test('application selection refuses PNGs without a technical pass record',()=>{
 const files=Array.from({length:8},(_,i)=>({id:'file'+i,name:'file.png',mimeType:'image/png',parents:['adopt'],size:'30',sha256Checksum:'hash'}));
 const draft={sets:[{id:'set',name:'セット',target:8}],assignments:Object.fromEntries(files.map(f=>[f.id,'set']))};
 assert.throws(()=>prepareSubmission(draft,files,{characterId:'character',id:'operation'}),/技術検品/);
 const plan=prepareSubmission(draft,files.map(f=>({...f,appProperties:{technicalStatus:'pass'}})),{characterId:'character',id:'operation'});assert.equal(plan.entries.length,8);
});
test('new workflow batch hides previous dogs without deleting their votes',async()=>{
 const {selectionView}=await import('../integration-v1/selection-view.mjs');
 const old={id:'crop:old',imageId:'old',rating:'h'},fresh={id:'crop:new',imageId:'new',rating:'o'};
 const items=[old,fresh],snapshot=structuredClone(items);
 assert.deepEqual(selectionView(items,{workflowLocal:true,shownIds:['crop:new']}),[fresh]);assert.deepEqual(items,snapshot);
 assert.equal(selectionView(items,{workflowLocal:true,shownIds:null}).length,2);
});
test('retry list excludes superseded failures so old attempts cannot restart indefinitely',async()=>{
 const {latestRecords}=await import('../integration-v1/crop-v9/review-flow.mjs');
 const attempts=[{imageId:'a',attempt:1,history:[]},{imageId:'b',attempt:2,history:[{previousImageId:'a'}]},{imageId:'c',attempt:3,history:[{previousImageId:'a'},{previousImageId:'b'}]}];
 assert.deepEqual(latestRecords(attempts).filter(r=>r.attempt<3),[]);
});
test('submission transport rechecks technical proof before the first write',async()=>{
 const {createSubmissionDrive}=await import('../integration-v1/submission-drive.mjs');
 const files=Array.from({length:8},(_,i)=>({id:'file'+i,name:'file.png',mimeType:'image/png',parents:['adopt'],size:'30',sha256Checksum:'hash',appProperties:{technicalStatus:'pass'}}));
 const draft={sets:[{id:'set',name:'セット',target:8}],assignments:Object.fromEntries(files.map(f=>[f.id,'set']))};
 const plan=prepareSubmission(draft,files,{characterId:'character',id:'operation'}),calls=[];
 const folder=(id,name,parents)=>({id,name,parents,mimeType:'application/vnd.google-apps.folder'});
 const transport=createSubmissionDrive({getToken:()=> 'fixture-token',readJournal:()=>null,writeJournal:()=>{},fetchImpl:async(url,opts)=>{
  calls.push(opts.method||'GET');const u=new URL(url);let data;
  if(u.pathname.endsWith('/character'))data=folder('character','キャラ',[]);
  else if(u.pathname.endsWith('/files'))data={files:[u.searchParams.get('q').includes('01_採用予定')?folder('adopt','01_採用予定',['character']):folder('apply','04_申請用',['character'])]};
  else if(u.pathname.endsWith('/file0'))data={...files[0],appProperties:{}};
  else throw Error('unexpected '+url);
  return new Response(JSON.stringify(data),{status:200});
 }});
 await assert.rejects(transport.move(plan),/更新・削除/);assert.ok(calls.every(m=>m==='GET'));
});
test('only sources from the latest persisted queue batch are transferred by default',async()=>{
 const {currentBatchSources}=await import('../integration-v1/crop-v9/review-flow.mjs');
 const queue=[{batchId:'old',sourceId:'dog'},{batchId:'new',sourceId:'pug1'},{batchId:'new',sourceId:'pug2'}];
 assert.deepEqual([...currentBatchSources(queue)],['pug1','pug2']);assert.equal(currentBatchSources([{sourceId:'legacy'}]),null);
});
