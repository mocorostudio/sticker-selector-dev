import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {automaticInspection,inspectionDecision,stageCandidateAssignments,visualChecks} from '../integration-v1/inspection-core.mjs';
import {prepareAuditedFormalPayload} from '../integration-v1/crop-v9/formal-sender.mjs';
import {prepareNineCellHandoff} from '../integration-v1/strict-handoff-bridge.mjs';
import {importVerifiedCrops} from '../integration-v1/crop-handoff.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
// Encode actual RGBA pixels with PNG CRCs; SHA-256 always hashes real PNG bytes.
function chunk(tag,bytes){const t=Buffer.from(tag),data=Buffer.concat([t,bytes]);let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}const len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,data,crc]);}
const pixels=validPixels(),header=Buffer.alloc(13);header.writeUInt32BE(370,0);header.writeUInt32BE(320,4);header[8]=8;header[9]=6;
const raw=Buffer.alloc(320*(370*4+1));for(let y=0;y<320;y++)raw.set(pixels.data.subarray(y*1480,(y+1)*1480),y*1481+1);
const blob=new Blob([Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])],{type:'image/png'});
async function setup(){
 const master=Array.from({length:9},(_,i)=>({candidateId:'C'+i,phrase:'文字'+i,pose:'構図'+i}));
 const records=master.map((m,i)=>({imageId:'img'+i,filename:'img'+i+'.png',crossing:false,qa:{automatic:'pass'},history:[],review:[]}));
 const assignments=records.map((r,i)=>({...master[i],imageId:r.imageId,batchId:'B03',slot:i+1}));
 let items=records.map(r=>({id:'crop:'+r.imageId,imageId:r.imageId,origin:'crop-local',name:r.filename,candidate:'',phrase:'',pose:'',crop:r,rating:'h',touched:true,comment:'keep',selectionHistory:[{revision:'keep'}],edit:{keep:true}}));
 items=stageCandidateAssignments(items,assignments,master).map(s=>s.next);
 for(const item of items)item.inspectionAudit=inspectionDecision(await automaticInspection(item,blob,async()=>pixels),'pass',Array(visualChecks.length).fill(true),'test fixture visual evidence');
 return {records,pngs:await Promise.all(records.map(()=>blob.arrayBuffer())),items,assignments,master,characterId:'char'};
}
test('audited sender uses original completed audit and drives existing strict gate',async()=>{
 const base=await setup(),before=structuredClone(base),payload=await prepareAuditedFormalPayload(base);
 assert.equal(payload.entries.length,9);assert.deepEqual(base,before);
 const pending={masterForCharacter:async()=>({characterId:'char',master:base.master,modifiedTime:'2026-11-03',masterSheet:'候補',masterReference:'https://docs.google.com/spreadsheets/d/master/edit'})};
 const prepared=await prepareNineCellHandoff({pending,...payload});let promotions=0;
 const adapter={items:()=>base.items,get:async()=>blob,decode:async()=>pixels,write:async()=>assert.fail('must reuse same images'),promote:async(item,record)=>{item.crop=record;promotions++;}};
 const result=await importVerifiedCrops(payload.entries,adapter,prepared.master,prepared.manifest);
 assert.equal(result.existing,9);assert.deepEqual(result.errors,[]);assert.equal(promotions,9);
 assert.ok(base.items.every(i=>i.rating==='h'&&i.comment==='keep'&&i.edit.keep&&i.selectionHistory.length===1));
});
for(const [name,mutate] of [
 ['missing audit',b=>delete b.items[0].inspectionAudit],
 ['unfinished checks',b=>b.items[0].inspectionAudit.checks[0]=false],
 ['wrong audit image',b=>b.items[0].inspectionAudit.imageId='wrong'],
 ['changed PNG',b=>b.pngs[0]=new Uint8Array([1,2,3]).buffer],
 ['changed master phrase',b=>b.master[0].phrase='changed'],
 ['wrong candidate',b=>b.assignments[0].candidateId='C1'],
 ['missing PNG',b=>b.pngs.pop()],
 ['failed inspection',b=>b.items[0].inspectionAudit.decision='fail']
])test('audited sender rejects '+name,async()=>{const b=await setup();mutate(b);await assert.rejects(prepareAuditedFormalPayload(b));});
test('candidate assignment is atomic, preserves votes and never creates approval',async()=>{
 const b=await setup(),items=b.items.map(i=>({...i,candidate:'',phrase:'',pose:''})),before=structuredClone(items);
 const staged=stageCandidateAssignments(items,b.assignments,b.master);assert.deepEqual(items,before);assert.ok(staged.every(s=>s.next.inspectionAudit===undefined&&s.next.rating==='h'&&s.next.comment==='keep'));
 assert.throws(()=>stageCandidateAssignments(b.items,b.assignments.map((a,i)=>i? a:{...a,candidateId:'other'}),b.master));assert.deepEqual(items,before);
});

import {createExportDrive} from '../integration-v1/drive-export.mjs';
import {createPendingDrive} from '../integration-v1/drive-pending.mjs';
import {SourceFixture} from './source-save-fixture.mjs';
import {registerBulkFormal} from '../integration-v1/bulk-formal.mjs';
async function registrationSetup(){
 const b=await setup(),payload=await prepareAuditedFormalPayload(b);
 const current={characterId:'char',master:b.master,modifiedTime:'2026-11-03',masterSheet:'候補',masterReference:'https://docs.google.com/spreadsheets/d/master/edit'};
 const prepared=await prepareNineCellHandoff({pending:{masterForCharacter:async()=>current},...payload});
 b.items.forEach((item,i)=>Object.assign(item,{characterId:'char',technicalPassed:true,crop:payload.entries[i].record,candidateManifest:prepared.manifest}));
 const fixture=new SourceFixture();fixture.files.set('pending',{id:'pending',name:'00_選抜待ち',mimeType:'application/vnd.google-apps.folder',parents:['char']});fixture.files.set('master',{id:'master',name:'Synthetic_Master',mimeType:'application/vnd.google-apps.spreadsheet',parents:['char'],modifiedTime:'2026-11-03'});
 const fetchImpl=async(url,options={})=>{if(url.startsWith('https://sheets.googleapis.com'))return Response.json(url.includes('/values/')?{values:[['ID','分類','セリフ（厳密）','文字なしテーマ','基本ポーズ','優先度','メモ'],...b.master.map(m=>[m.candidateId,'',m.phrase,'',m.pose,'',''])]}:{sheets:[{properties:{title:'候補',gridProperties:{rowCount:10,columnCount:7}}}]});return fixture.fetch(url,options);};
 const journal=new Map(),drive=createExportDrive({getToken:()=> 'fixture',fetchImpl,readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)});
 return {b,fixture,drive,fetchImpl,options:{accountId:'account',characterId:'char',get:async()=>blob,decode:async()=>pixels}};
}
test('formal pending save/readback/retry uses existing transport; reader restores nine original candidates',async()=>{
 const {b,fixture,drive,fetchImpl,options}=await registrationSetup(),before=structuredClone(b.items);
 const result=await drive.registerPending(b.items,options);assert.equal(result.entries.length,9);assert.equal(fixture.posts,10);assert.deepEqual(b.items,before);
 const again=await drive.registerPending(b.items,options);assert.equal(fixture.posts,10);assert.equal(again.manifestFileId,result.manifestFileId);
 const reader=createPendingDrive({getToken:()=> 'fixture',fetchImpl}),loaded=await reader.load('char',{decode:async()=>pixels});
 assert.equal(loaded.entries.length,9);assert.deepEqual(loaded.entries.map(e=>e.record.candidateId),b.items.map(i=>i.candidate));assert.ok(loaded.entries.every(e=>e.record.inspection.audit.reviewedAt));
});
test('pending registration refuses unfinished evidence before any remote write',async()=>{
 const {b,fixture,drive,options}=await registrationSetup();b.items[8].inspectionAudit.checks[8]=false;
 await assert.rejects(drive.registerPending(b.items,options));assert.equal(fixture.posts,0);
});
test('pending registration fails closed on mismatched readback and retries without overwriting old files',async()=>{
 const {b,fixture,drive,options}=await registrationSetup();fixture.badReadback=true;
 await assert.rejects(drive.registerPending(b.items,options),/照合/);assert.equal(fixture.posts,1);fixture.badReadback=false;
 const result=await drive.registerPending(b.items,options);assert.equal(result.entries.length,9);assert.equal(fixture.posts,10);
});
test('mixed batch registration saves and reloads only its eight approved cells through the existing Drive transport',async()=>{
 const {b,fixture,drive,fetchImpl,options}=await registrationSetup();
 b.items[8].inspectionAudit.decision='fail';b.items[8].inspectionAudit.comment='synthetic defect';
 const api={items:()=>b.items,replaceItems:items=>b.items=items,get:options.get,decode:options.decode,save:()=>{}};
 const current={characterId:'char',master:b.master,modifiedTime:'2026-11-03',masterSheet:'候補',masterReference:'https://docs.google.com/spreadsheets/d/master/edit'};
 const result=await registerBulkFormal(api,{masterForCharacter:async()=>current},{schema:'animal-stickers-bulk-formal/v1',registrationMode:'approved-only',characterId:'char',assignments:b.assignments});
 assert.equal(result.registered,8);assert.equal(b.items[8].technicalPassed,false);assert.equal(b.items[8].rating,'h');
 const good=b.items.filter(x=>x.candidateManifest&&x.technicalPassed===true);
 const saved=await drive.registerPending(good,options);assert.equal(saved.entries.length,8);assert.equal(fixture.posts,9);
 await drive.registerPending(good,options);assert.equal(fixture.posts,9);
 const loaded=await createPendingDrive({getToken:()=> 'fixture',fetchImpl}).load('char',{decode:options.decode});
 assert.equal(loaded.entries.length,8);assert.ok(loaded.entries.every(e=>e.record.imageId!=='img8'));
});
