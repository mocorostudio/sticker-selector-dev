import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExport,digest,sourceFileId} from '../integration-v1/drive-export.mjs';
test('draft votes save without technical promotion or PNG copies, and reject altered bytes',async()=>{
 const blob=new Blob(['verified draft bytes'],{type:'image/png'});
 const item={id:'local',imageId:'PMD001',origin:'crop-local',touched:true,revision:'r',rating:'o',selectionHistory:[{revision:'r',rating:'o'}],crop:{draftSelection:true,pendingDrive:{archiveFileId:'archive',manifestFileId:'manifest',characterId:'character',sha256:await digest(blob)}}};
 const plan=await prepareExport([item],{get:async()=>blob});
 assert.equal(plan.images.length,0);const manifest=JSON.parse(await plan.manifest.blob.text());assert.equal(manifest.results[0].rating,'o');assert.equal(manifest.results[0].technicalStatus,'review');assert.equal(sourceFileId(item),'archive');
 await assert.rejects(prepareExport([item],{get:async()=>new Blob(['changed'])}),/一致/);
});
