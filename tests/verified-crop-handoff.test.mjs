import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {importVerifiedCrops} from '../integration-v1/crop-handoff.mjs';
globalThis.crypto??=webcrypto;
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(7)]);
const hash=createHash('sha256').update(bytes).digest('hex');
const master=[{candidateId:'C01',phrase:'ありがとう',pose:'おじぎ'}];
function make(overrides={}){
 const record={imageId:'img01',candidateId:'C01',filename:'crop01.png',phrase:'ありがとう',pose:'おじぎ',pngSha256:hash,qa:{automatic:'pass'},technicalStatus:'pass',
  review:Array(9).fill(true),inspection:{scope:'actual-source',visualPassed:true,phraseVerified:true,anatomyVerified:true,styleVerified:true,alphaVerified:true},...overrides};
 const manifest={schemaVersion:1,entries:[{imageId:'img01',candidateId:'C01',batchId:'B01',slot:1,filename:record.filename,phrase:'ありがとう',pose:'おじぎ',pngSha256:hash}]};
 const state=[], blobs=new Map();
 const adapter={items:()=>state,get:async id=>blobs.get(id),decode:async(blob)=>{const raw=new Uint8Array(await blob.arrayBuffer());if(raw.length!==bytes.length||raw.some((v,i)=>v!==bytes[i]))throw Error('画像デコード失敗');const data=new Uint8ClampedArray(370*320*4);for(let y=65;y<255;y++)for(let x=75;x<295;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};},
  write:async(item,blob)=>{state.push(item);blobs.set(item.id,blob)}};
 return {entries:[{record,png:bytes.slice().buffer}],manifest,adapter,state};
}
test('strict handoff persists verified record and readback without changing user votes',async()=>{
 const a=make(),result=await importVerifiedCrops(a.entries,a.adapter,master,a.manifest);
 assert.equal(result.added,1);assert.deepEqual(result.errors,[]);assert.equal(a.state[0].touched,false);
 a.state[0].rating='h';a.state[0].touched=true;a.state[0].comment='選抜保持';const again=await importVerifiedCrops(a.entries,a.adapter,master,a.manifest);assert.equal(again.existing,1);assert.equal(a.state.length,1);assert.equal(a.state[0].rating,'h');assert.equal(a.state[0].comment,'選抜保持');
});
test('strict handoff rejects uninspected without writing',async()=>{
 const a=make({inspection:{scope:'draft'}}),r=await importVerifiedCrops(a.entries,a.adapter,master,a.manifest);
 assert.equal(r.ids.length,0);assert.equal(a.state.length,0);
});
test('strict handoff rejects changed bytes before any write',async()=>{
 const a=make();a.entries[0].png=Uint8Array.from([...bytes.slice(0,-1),22]).buffer;
 await assert.rejects(importVerifiedCrops(a.entries,a.adapter,master,a.manifest),/ハッシュ/);assert.equal(a.state.length,0);
});
test('strict handoff rejects invalid position without writes',async()=>{
 const a=make();a.manifest.entries[0].slot=10;
 const r=await importVerifiedCrops(a.entries,a.adapter,master,a.manifest);
 assert.equal(r.ids.length,0);assert.equal(a.state.length,0);
});
test('strict handoff rejects failed visual gate despite forged status',async()=>{
 const a=make({review:Array(9).fill(false)});
 const r=await importVerifiedCrops(a.entries,a.adapter,master,a.manifest);
 assert.equal(r.added,0);assert.equal(a.state.length,0);
});

test('strict handoff rejects absent bytes without writing',async()=>{const a=make();a.entries[0].png=null;await assert.rejects(importVerifiedCrops(a.entries,a.adapter,master,a.manifest),/PNG実体/);assert.equal(a.state.length,0)});
