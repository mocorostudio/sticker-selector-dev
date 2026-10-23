import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedBundle} from '../integration-v1/reviewed-bundle.mjs';
import {visualChecks} from '../integration-v1/crop-v9/core.mjs';
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(30).fill(0)]).buffer;
const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',png))].map(x=>x.toString(16).padStart(2,'0')).join('');
const master=[{candidateId:'D01',phrase:'おはよう',pose:'伸びをする'}];
const record=()=>({imageId:'test-image',filename:'test-image.png',...master[0],qa:{automatic:'pass',issues:[]},review:visualChecks.map(()=>true),inspection:{at:'2026-10-23T10:00:00Z',scope:'actual-source'}});
const manifest=()=>({schema:'animal-stickers-reviewed-crops/v1',masterReference:'https://docs.google.com/spreadsheets/d/example/edit',entries:[{record:record(),sha256:sha}]});
const zip=m=>({file:name=>name==='technical-review.json'?{async:async()=>JSON.stringify(m)}:name==='test-image.png'?{async:async()=>png}:null});
const decode=async()=>{const data=new Uint8ClampedArray(370*320*4);for(let y=60;y<260;y++)for(let x=70;x<300;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};};
test('reviewed bundle preserves candidate identity and rechecks actual pixels before import',async()=>{const entries=await reviewedBundle(zip(manifest()),master,{decode});assert.equal(entries.length,1);assert.equal(entries[0].record.candidateId,'D01');assert.equal(entries[0].record.qa.automatic,'pass');});
test('changed PNG, incomplete review, wrong phrase, duplicate and empty pixels cannot enter formal selection',async()=>{
 for(const change of [m=>m.entries[0].sha256='0'.repeat(64),m=>m.entries[0].record.review=[],m=>m.entries[0].record.phrase='別の文',m=>m.entries.push(m.entries[0])]){const m=manifest();change(m);await assert.rejects(reviewedBundle(zip(m),master,{decode}));}
 await assert.rejects(reviewedBundle(zip(manifest()),master,{decode:async()=>({width:370,height:320,data:new Uint8ClampedArray(370*320*4)})}));
});
