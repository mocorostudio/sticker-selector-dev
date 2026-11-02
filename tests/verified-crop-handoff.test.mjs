import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import {importVerifiedCrops} from '../integration-v1/crop-handoff.mjs';
globalThis.crypto??=webcrypto;
// A real CRC-valid, decodable RGBA PNG, generated without external dependencies.
function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),body=Buffer.from(data),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,body])));return Buffer.concat([len,tag,body,crc]);}
function makePNG(){const w=370,h=320,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc(h*(w*4+1));for(let y=65;y<255;y++)for(let x=75;x<295;x++){let k=y*(w*4+1)+1+x*4;raw[k]=90;raw[k+1]=120;raw[k+2]=130;raw[k+3]=255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const bytes=makePNG();
function decodePNG(blob){return blob.arrayBuffer().then(buffer=>{const b=Buffer.from(buffer);if(!b.subarray(0,8).equals(bytes.subarray(0,8)))throw Error('PNG signature');let pos=8,body=[],width=0,height=0;
 while(pos<b.length){const len=b.readUInt32BE(pos),tag=b.toString('ascii',pos+4,pos+8),data=b.subarray(pos+8,pos+8+len),expected=b.readUInt32BE(pos+8+len);if(crc32(b.subarray(pos+4,pos+8+len))!==expected)throw Error('PNG CRC');if(tag==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);if(data[9]!==6||data[8]!==8)throw Error('PNG RGBA expected');}if(tag==='IDAT')body.push(data);pos+=12+len;if(tag==='IEND')break;}
 const raw=inflateSync(Buffer.concat(body));if(raw.length!==height*(width*4+1))throw Error('PNG pixel length');const out=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++){if(raw[y*(width*4+1)]!==0)throw Error('PNG filter');out.set(raw.subarray(y*(width*4+1)+1,(y+1)*(width*4+1)),y*width*4);}return {width,height,data:out};});}
const hash=createHash('sha256').update(bytes).digest('hex');
const master=[{candidateId:'C01',phrase:'ありがとう',pose:'おじぎ'}];
function make(overrides={}){
 const record={imageId:'img01',candidateId:'C01',filename:'crop01.png',phrase:'ありがとう',pose:'おじぎ',pngSha256:hash,qa:{automatic:'pass'},technicalStatus:'pass',
  review:Array(9).fill(true),inspection:{scope:'actual-source',visualPassed:true,phraseVerified:true,anatomyVerified:true,styleVerified:true,alphaVerified:true},...overrides};
 const manifest={schemaVersion:1,entries:[{imageId:'img01',candidateId:'C01',batchId:'B01',slot:1,filename:record.filename,phrase:'ありがとう',pose:'おじぎ',pngSha256:hash}]};
 const state=[], blobs=new Map();
 const adapter={items:()=>state,get:async id=>blobs.get(id),decode:decodePNG,
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
