import test from 'node:test';import assert from 'node:assert/strict';
import JSZip from 'jszip';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {prepareChatHandoff} from '../integration-v1/chat-handoff.mjs';
import {reviewedBundle,reviewedBundleFromDrive,importReviewedCrops} from '../integration-v1/reviewed-bundle.mjs';
import {importCrops,confirmLocal} from '../integration-v1/crop-handoff.mjs';
import {inspectionSummary} from '../integration-v1/inspection-summary.mjs';
import {prepareExport,groupCharacters,createExportDrive} from '../integration-v1/drive-export.mjs';
import {createPendingDrive} from '../integration-v1/drive-pending.mjs';
import {CandidateExportFixture} from './candidate-export-fixture.mjs';
import {savedEvaluation} from '../integration-v1/reselection.mjs';
import {pngHash} from '../integration-v1/inspection-core.mjs';
import {setup,blob,pixels} from './bulk-formal-fixture.mjs';
async function fixture(n=81){
 const base=await setup(),sha=await pngHash(blob);
 const master=Array.from({length:n},(_,i)=>({candidateId:'C'+i,phrase:'合成'+i,pose:'四角'}));
 const entries=master.map((m,i)=>({record:{...structuredClone(base.records[i%9]),...m,imageId:'image'+i,filename:'image'+i+'.png',attemptId:'T01_'+i,sourceId:'source_'+Math.floor(i/9),decision:'pass',review:Array(9).fill(true),inspection:{scope:'actual-source',at:'2026-11-05T00:00:00Z',method:'合成図形の検品テスト'}},sha256:sha,path:'image'+i+'.png'}));
 return {input:{schema:'animal-stickers-chat-handoff/v1',characterId:'char',masterReference:'https://docs.google.com/spreadsheets/d/master/edit',masterSheet:'候補81',masterModifiedTime:'2026-11-05T00:00:00Z',master,entries},get:async()=>blob,decode:async()=>pixels};
}
test('browser-free 81-image producer keeps 78 passes, records exclusions, and matches the existing ZIP reader',async()=>{
 const f=await fixture();for(const [i,decision] of [[0,'fail'],[1,'review'],[2,'unknown']]){f.input.entries[i].record.decision=decision;f.input.entries[i].reason='fixture issue';}
 const before=structuredClone(f.input),result=await prepareChatHandoff(f.input,f);assert.deepEqual(f.input,before);
 assert.deepEqual(result.summary,{total:81,passed:78,failed:1,review:1,unknown:1,driveSaved:false,userReadbackVerified:false});
 const zip=new JSZip();zip.file('technical-review.json',JSON.stringify(result.manifest));for(const e of result.accepted)zip.file(e.record.filename,e.png);
 const bytes=await zip.generateAsync({type:'uint8array'}),reopened=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const current={characterId:'char',modifiedTime:f.input.masterModifiedTime,masterSheet:f.input.masterSheet,masterReference:f.input.masterReference,master:f.input.master};
 const read=await reviewedBundleFromDrive(reopened,{characterId:'char',masterForCharacter:async()=>current,decode:f.decode});assert.equal(read.entries.length,78);
 let items=[];const data=new Map(),adapter={items:()=>items,get:async id=>data.get(id),decode:f.decode,write:async(item,b)=>{item.characterId='char';items.push(item);data.set(item.id,b)}};
 const imported=await importCrops(read.entries,adapter,f.input.master);assert.equal(imported.added,78);assert.deepEqual(imported.errors,[]);
 assert.ok(items.every(x=>x.technicalPassed&&!x.touched));assert.equal((await inspectionSummary(items[0],blob)).status,'pass');
 assert.equal((await inspectionSummary(items[0],new Blob(['changed'],{type:'image/png'}))).status,'unknown');
 items[0].rating='o';items[0].touched=true;items[0].revision='chosen';items[0].comment='keep';confirmLocal(items);
 const exported=await prepareExport(items,{get:adapter.get,decode:f.decode});assert.equal(exported.images.length,1);assert.equal(exported.images[0].technicalStatus,'pass');
 const vote=JSON.stringify([items[0].rating,items[0].comment,items[0].selectionHistory]);assert.equal((await importCrops(read.entries,adapter,f.input.master)).existing,78);assert.equal(JSON.stringify([items[0].rating,items[0].comment,items[0].selectionHistory]),vote);
 let resolutions=0;const groups=await groupCharacters(items,{resolve:async()=>assert.fail('source lookup not needed'),resolveCharacter:async id=>{resolutions++;return {id,name:'fixture'}}});assert.equal(groups.length,1);assert.equal(resolutions,1);
 await assert.rejects(groupCharacters(items,{resolveCharacter:async()=>({id:'other'})}),/保存先/);
});
for(const [name,change] of [
 ['missing candidate',f=>f.input.entries.pop()],['duplicate ID',f=>f.input.entries[1].record.imageId='image0'],['duplicate filename',f=>f.input.entries[1].record.filename='image0.png'],['wrong phrase',f=>f.input.entries[1].record.phrase='changed'],['unreviewed pass',f=>f.input.entries[1].record.review=[]],['missing source',f=>delete f.input.entries[1].record.sourceId],['missing inspection time',f=>delete f.input.entries[1].record.inspection.at],['changed PNG',f=>f.input.entries[1].sha256='0'.repeat(64)],['empty pixels',f=>f.decode=async()=>({...pixels,data:new Uint8ClampedArray(pixels.data.length)})],['reasonless exclusion',f=>f.input.entries[1].record.decision='review']
])test(name+' cannot produce a reviewed package',async()=>{const f=await fixture(9);change(f);await assert.rejects(prepareChatHandoff(f.input,f));});
test('operator CLI decodes RGBA PNGs, builds and reopens a ZIP, refuses output overwrite',async()=>{
 const f=await fixture(9),dir=await fs.mkdtemp(path.join(os.tmpdir(),'chat-handoff-'));
 for(const e of f.input.entries)await fs.writeFile(path.join(dir,e.path),Buffer.from(await blob.arrayBuffer()));
 const input=path.join(dir,'input.json'),out=path.join(dir,'out');await fs.writeFile(input,JSON.stringify(f.input));
 const value=JSON.parse(execFileSync(process.execPath,['scripts/prepare-chat-handoff.mjs',input,out],{encoding:'utf8'}));assert.equal(value.passed,9);assert.equal(value.userReadbackVerified,false);
 const zip=await JSZip.loadAsync(await fs.readFile(value.zip),{checkCRC32:true});assert.equal((await reviewedBundle(zip,f.input.master,{decode:f.decode})).length,9);
 assert.throws(()=>execFileSync(process.execPath,['scripts/prepare-chat-handoff.mjs',input,out],{stdio:'pipe'}));
});
test('reviewed import upgrades existing draft evidence, preserving votes and old audit; newer failures block stale ZIPs',async()=>{
 const f=await fixture(9),built=await prepareChatHandoff(f.input,f),zip=new JSZip();zip.file('technical-review.json',JSON.stringify(built.manifest));for(const e of built.accepted)zip.file(e.record.filename,e.png);
 const entries=await reviewedBundle(zip,f.input.master,{decode:f.decode});let items=[],saves=0;const adapter={items:()=>items,get:f.get,decode:f.decode,write:async x=>items.push(x),persist:async()=>{saves++}};
 await importCrops(entries,adapter,f.input.master);const item=items[0];item.technicalPassed=false;item.rating='h';item.touched=true;item.comment='keep';item.inspectionAudit={decision:'review',reviewedAt:'2026-11-04T00:00:00Z',comment:'previous'};item.candidateManifest={previous:true};const previous=structuredClone(item);
 await importReviewedCrops(entries,adapter,f.input.master,'char');assert.equal(item.technicalPassed,true);assert.equal(item.rating,'h');assert.equal(item.comment,'keep');assert.equal(saves,1);assert.deepEqual(item.reviewedImportHistory[0].previous.inspectionAudit,previous.inspectionAudit);assert.equal(item.candidateManifest,undefined);assert.equal((await inspectionSummary(item,blob)).status,'pass');
 await importReviewedCrops(entries,adapter,f.input.master,'char');assert.equal(saves,1);
 item.inspectionAudit={decision:'fail',reviewedAt:'2026-11-06T00:00:00Z',comment:'new defect'};await assert.rejects(importReviewedCrops(entries,adapter,f.input.master,'char'),/より新しい/);
});
test('reviewed upgrade restores existing state when persistence fails',async()=>{
 const f=await fixture(9),built=await prepareChatHandoff(f.input,f),zip=new JSZip();zip.file('technical-review.json',JSON.stringify(built.manifest));for(const e of built.accepted)zip.file(e.record.filename,e.png);
 const entries=await reviewedBundle(zip,f.input.master,{decode:f.decode});let items=[];const adapter={items:()=>items,get:f.get,decode:f.decode,write:async x=>items.push(x),persist:async()=>{throw Error('quota')}};
 await importCrops(entries,adapter,f.input.master);items[0].technicalPassed=false;const before=structuredClone(items);await assert.rejects(importReviewedCrops(entries,adapter,f.input.master,'char'),/quota/);assert.deepEqual(items,before);
});
test('reviewed ZIP goes through pending Drive save, retry, reader reload and selection-result matching without fabricated browser audits',async()=>{
 const f=await fixture(9),built=await prepareChatHandoff(f.input,f),zip=new JSZip();zip.file('technical-review.json',JSON.stringify(built.manifest));for(const e of built.accepted)zip.file(e.record.filename,e.png);
 const entries=await reviewedBundle(zip,f.input.master,{decode:f.decode});let items=[];const adapter={items:()=>items,get:f.get,decode:f.decode,persist:()=>{},write:async x=>{x.characterId='char';items.push(x)}};await importReviewedCrops(entries,adapter,f.input.master,'char');
 const remote=new CandidateExportFixture();remote.files.set('pending',{id:'pending',name:'00_選抜待ち',mimeType:'application/vnd.google-apps.folder',parents:['char']});remote.files.set('master',{id:'master',name:'Synthetic_Master',mimeType:'application/vnd.google-apps.spreadsheet',parents:['char'],modifiedTime:f.input.masterModifiedTime});
 const fetchImpl=async(url,options={})=>{if(url.startsWith('https://sheets.googleapis.com'))return Response.json(url.includes('/values/')?{values:[['ID','分類','セリフ（厳密）','文字なしテーマ','基本ポーズ','優先度','メモ'],...f.input.master.map(m=>[m.candidateId,'',m.phrase,'',m.pose,'',''])]}:{sheets:[{properties:{title:'候補81',gridProperties:{rowCount:82,columnCount:7}}}]});return remote.fetch(url,options);};
 const journal=new Map(),drive=createExportDrive({getToken:()=> 'fixture',fetchImpl,readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)}),options={characterId:'char',accountId:'account',get:f.get,decode:f.decode};
 assert.ok(items.every(x=>!x.inspectionAudit&&!x.candidateManifest));const saved=await drive.registerPending(items,options);assert.equal(saved.entries.length,9);const posts=remote.posts;await drive.registerPending(items,options);assert.equal(remote.posts,posts);
 const reloaded=await createPendingDrive({getToken:()=> 'fixture',fetchImpl}).load('char',{decode:f.decode});assert.equal(reloaded.entries.length,9);
 items[0].touched=true;items[0].rating='o';items[0].revision='vote';confirmLocal(items);const plan=await prepareExport(items,{get:f.get,decode:f.decode});const doc=JSON.parse(await plan.manifest.blob.text());assert.equal(savedEvaluation(doc,reloaded.entries[0].record,'char').rating,'o');
 items[0].inspectionAudit={decision:'fail',reviewedAt:'2026-11-06T00:00:00Z',comment:'new defect'};await assert.rejects(drive.registerPending(items,options),/新しい検品結果/);assert.equal(remote.posts,posts);
});

test('a newly reviewed handoff refuses detached background residue before selection registration',async()=>{const f=await fixture(9),dirty={...pixels,data:pixels.data.slice()};dirty.data.set([120,50,40,60],(10*370+10)*4);f.decode=async()=>dirty;await assert.rejects(prepareChatHandoff(f.input,f),/背景残留|PNG実画素/);});
