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
