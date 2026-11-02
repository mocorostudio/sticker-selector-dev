import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {prepareFormalCropPayload} from '../integration-v1/crop-v9/formal-sender.mjs';
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(25).fill(0)]).buffer;
const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',png)).toString('hex');
const records=Array.from({length:9},(_,i)=>({imageId:'img'+i,candidateId:'C'+i,phrase:'phrase'+i,pose:'pose'+i,pngSha256:hash,qa:{automatic:'pass'},technicalStatus:'pass',inspection:{scope:'actual-source',visualPassed:true,phraseVerified:true,anatomyVerified:true,styleVerified:true,alphaVerified:true}}));
const assignments=records.map((r,i)=>({imageId:r.imageId,candidateId:r.candidateId,phrase:r.phrase,pose:r.pose,batchId:'B01',slot:i+1}));
const base={records,pngs:Array(9).fill(png),assignments,characterId:'character123',subtle:webcrypto.subtle};
test('strict sender prepares nine entries only with matching inspection binding',async()=>{const aligned={...base,records:records.map(r=>({...r,inspection:{...r.inspection,candidateBinding:{imageId:r.imageId,candidateId:r.candidateId,phrase:r.phrase,pose:r.pose}}}))};assert.equal((await prepareFormalCropPayload(aligned)).entries.length,9)});
test('missing character rejected',async()=>assert.rejects(prepareFormalCropPayload({...base,characterId:''})));
test('duplicate slot rejected',async()=>assert.rejects(prepareFormalCropPayload({...base,assignments:assignments.map((a,i)=>i===8?{...a,slot:1}:a)})));
test('wrong phrase rejected',async()=>assert.rejects(prepareFormalCropPayload({...base,assignments:assignments.map((a,i)=>i===0?{...a,phrase:'wrong'}:a)})));
test('uninspected rejected',async()=>assert.rejects(prepareFormalCropPayload({...base,records:records.map((r,i)=>i===0?{...r,technicalStatus:'review'}:r)})));
test('hash mismatch rejected',async()=>assert.rejects(prepareFormalCropPayload({...base,records:records.map((r,i)=>i===0?{...r,pngSha256:'0'.repeat(64)}:r)})));

test('no inspection binding blocks approval',async()=>assert.rejects(prepareFormalCropPayload(base),/技術検品記録/));
test('wrong image binding blocks approval',async()=>assert.rejects(prepareFormalCropPayload({...base,records:records.map((r,i)=>({...r,inspection:{...r.inspection,candidateBinding:{imageId:i===0?'other':r.imageId,candidateId:r.candidateId,phrase:r.phrase,pose:r.pose}}}))}),/技術検品記録/));
