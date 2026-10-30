import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExport,digest,sourceFileId} from '../integration-v1/drive-export.mjs';
test('draft votes save with review PNG copies and no technical promotion, and reject altered bytes',async()=>{
 const blob=new Blob([new Uint8Array(40)],{type:'image/png'});
 const item={id:'local',imageId:'PMD001',origin:'crop-local',touched:true,revision:'r',rating:'o',selectionHistory:[{revision:'r',rating:'o'}],crop:{draftSelection:true,pendingDrive:{archiveFileId:'archive',manifestFileId:'manifest',characterId:'character',sha256:await digest(blob)}}};
 const {validPixels}=await import('./candidate-export-fixture.mjs');const plan=await prepareExport([item],{get:async()=>blob,decode:async()=>validPixels()});
 assert.equal(plan.images.length,1);const manifest=JSON.parse(await plan.manifest.blob.text());assert.equal(manifest.results[0].rating,'o');assert.equal(manifest.results[0].technicalStatus,'review');assert.equal(sourceFileId(item),'archive');
 await assert.rejects(prepareExport([item],{get:async()=>new Blob(['changed'])}),/一致/);
});

const pixels=async()=> (await import('./candidate-export-fixture.mjs')).validPixels();
async function draftItem(blob,rating='o',number='01'){
 return {id:number,imageId:'draft_'+number,sequenceLabel:number,origin:'crop-local',touched:true,revision:'r',rating,selectionHistory:[{revision:'r',rating}],crop:{draftSelection:true,crossing:true,pendingDrive:{archiveFileId:'archive',manifestFileId:'manifest',characterId:'character',sha256:await digest(blob)}}};
}
test('80 draft ratings including 53 circles save warnings and resume without technical promotion',async()=>{
 const blob=new Blob([new Uint8Array(40)],{type:'image/png'}),im=await pixels();im.data[3]=255;
 const items=await Promise.all(Array.from({length:80},(_,i)=>draftItem(blob,i<53?'o':i<60?'h':'x',String(i+1).padStart(2,'0'))));
 const plan=await prepareExport(items,{get:async()=>blob,decode:async()=>im});
 assert.equal(plan.images.length,60);assert.deepEqual(plan.counts,{adopted:53,held:7,rejected:20,unrated:0});
 const results=JSON.parse(await plan.manifest.blob.text()).results;
 assert.equal(results.length,80);assert.ok(results.every(r=>r.technicalStatus==='review'&&r.confirmed));
 assert.ok(results[0].technicalWarnings.includes('背景端が不透明'));assert.ok(results[0].technicalWarnings.includes('安全余白10%未満'));assert.ok(results[0].technicalWarnings.includes('区画をまたぐ連結成分・欠けの可能性'));
 assert.ok(plan.images.every(e=>e.blob===blob&&e.technicalStatus==='review'));
 const {CandidateExportFixture}=await import('./candidate-export-fixture.mjs');
 const {createExportDrive}=await import('../integration-v1/drive-export.mjs');
 const fixture=new CandidateExportFixture(),journal=new Map(),drive=createExportDrive({getToken:()=> 'fixture',fetchImpl:fixture.fetch.bind(fixture),readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)});
 await drive.save(plan,{accountId:'account',characterId:'char'});const ids=[...fixture.files.keys()];
 await drive.save(plan,{accountId:'account',characterId:'char'});assert.deepEqual([...fixture.files.keys()],ids);
 const saved=[...fixture.files.values()].filter(f=>f.mimeType==='image/png');assert.equal(saved.length,60);assert.equal(saved.filter(f=>f.parents[0]==='adopt').length,53);assert.ok(saved.every(f=>f.appProperties.technicalStatus==='review'));
});
for(const kind of ['empty','wrong size','decode error'])test('draft saving still rejects '+kind,async()=>{
 const blob=new Blob([new Uint8Array(40)],{type:'image/png'}),item=await draftItem(blob);
 const decode=async()=>{if(kind==='decode error')throw Error('decode failed');const im=await pixels();if(kind==='empty')im.data.fill(0);else im.width=369;return im;};
 await assert.rejects(prepareExport([item],{get:async()=>blob,decode}),kind==='decode error'?/decode failed/:/01の仮選抜PNGのサイズ・描画/);
});
