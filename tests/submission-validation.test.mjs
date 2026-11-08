import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {pngFixture} from './submission-png-fixture.mjs';
import {withPngDpi} from '../integration-v1/png-density.mjs';
import {normalizeSubmissionPng,inspectSubmissionPng,inspectSubmissionZip,sha256} from '../integration-v1/submission-validation.mjs';
import {storedZip,prepareSelectionZip} from '../integration-v1/submission-zip.mjs';
import {prepareSubmission} from '../integration-v1/submission-core.mjs';
import {createExportDrive} from '../integration-v1/drive-export.mjs';
import {CandidateExportFixture,validPixels} from './candidate-export-fixture.mjs';
export async function completeBundle(){
 const blobs=Array.from({length:40},(_,i)=>pngFixture(370,320,{color:90+i})),files=await Promise.all(blobs.map(async(blob,i)=>({id:'source'+i,name:'source'+i+'.png',mimeType:'image/png',size:String(blob.size),sha256Checksum:await sha256(blob),parents:['adopt'],appProperties:{technicalStatus:'pass'}}))),draft={sets:[{id:'set',name:'40',target:40}],assignments:Object.fromEntries(files.map(f=>[f.id,'set'])),orders:{set:files.map(f=>f.id).reverse()},artwork:{set:{mainId:'source1',tabId:'source2',strokes:[]}}},before=structuredClone(draft),plan=prepareSubmission(draft,files,{characterId:'char',id:'plan'}),artImages=await Promise.all(['main','tab'].map(async kind=>{const blob=pngFixture(kind==='main'?240:96,kind==='main'?240:74);return {kind,blob,sha:await sha256(blob)};}));
 const bundle=await prepareSelectionZip(plan,{getRemote:async e=>blobs[Number(e.fileId.slice(6))],decode:async()=>validPixels(),prepareArtwork:async()=>({characterId:'char',images:artImages,manifest:{blob:new Blob([JSON.stringify({setId:'set',characterId:'char',main:draft.artwork.set,tab:draft.artwork.set})])}}),decodeArtwork:async blob=>{const main=blob===artImages[0].blob,width=main?240:96,height=main?240:74,data=new Uint8ClampedArray(width*height*4);data[1000*4+3]=255;return {width,height,data};}});
 assert.deepEqual(draft,before);return bundle;
}
test('normal and reorder normalization yields all 42 identical valid PNGs without changing source IDAT or selection',async()=>{
 const bundle=await completeBundle(),a=bundle.archives[0],zip=await JSZip.loadAsync(await a.blob.arrayBuffer(),{checkCRC32:true}),entries=[];
 for(const name of Object.keys(zip.files)){const original=new Blob([await zip.file(name).async('uint8array')],{type:'image/png'}),blob=await normalizeSubmissionPng(name,original);assert.equal(await sha256(blob),await sha256(original));entries.push({name,blob});}
 const report=await inspectSubmissionZip(await storedZip(entries,{includeArtwork:true}),{expected:[...a.mapping,...a.artwork]});assert.equal(report.imageCount,42);assert.ok(report.images.every(x=>x.dpiX>=72&&x.transparentPixels>0&&x.visiblePixels>0));assert.equal(report.images[0].imageId,a.mapping[0].imageId);
});
test('PNG rejects missing DPI, opaque/empty alpha, wrong dimensions, capacity and damaged CRC; normalization is metadata only',async()=>{
 const source=pngFixture();await assert.rejects(inspectSubmissionPng('01.png',source),/72dpi/);
 const normalized=await normalizeSubmissionPng('01.png',source),bytes=new Uint8Array(await normalized.arrayBuffer());
 assert.deepEqual(await normalized.arrayBuffer(),await (await normalizeSubmissionPng('01.png',normalized)).arrayBuffer());
 const idat=b=>{const v=new DataView(b.buffer);let p=8;while(p<b.length){const n=v.getUint32(p);if(String.fromCharCode(...b.slice(p+4,p+8))==='IDAT')return b.slice(p+8,p+8+n);p+=12+n;}};assert.deepEqual(idat(bytes),idat(new Uint8Array(await source.arrayBuffer())));
 for(const options of [{opaque:true},{empty:true}])await assert.rejects(normalizeSubmissionPng('01.png',pngFixture(370,320,options)),/実アルファ/);
 await assert.rejects(normalizeSubmissionPng('01.png',pngFixture(240,240)),/寸法/);
 await assert.rejects(inspectSubmissionPng('01.png',new Blob([new Uint8Array(1000001)])),/1MB/);
 bytes[bytes.length-5]^=1;await assert.rejects(inspectSubmissionPng('01.png',new Blob([bytes])),/CRC/);
});
test('ZIP recheck rejects wrong name, missing entry, wrong mapping and corrupted bytes',async()=>{
 const b=await completeBundle(),a=b.archives[0],opts={expected:[...a.mapping,...a.artwork]};await inspectSubmissionZip(a.blob,opts);
 await assert.rejects(inspectSubmissionZip(a.blob,{expected:opts.expected.map((e,i)=>i?e:{...e,sha256:'0'.repeat(64)})}),/SHA-256/);
 const z=await JSZip.loadAsync(await a.blob.arrayBuffer());z.remove('40.png');await assert.rejects(inspectSubmissionZip(new Blob([await z.generateAsync({type:'uint8array'})])),/件数/);
 const raw=new Uint8Array(await a.blob.arrayBuffer());raw[100]^=1;await assert.rejects(inspectSubmissionZip(new Blob([raw])),/CRC|ヘッダー/);
});
test('Drive always downloads and unpacks all 42 PNGs; retries deduplicate and preserve originals',async()=>{
 const b=await completeBundle(),f=new CandidateExportFixture(),journal=new Map(),drive=createExportDrive({getToken:()=> 'test',fetchImpl:f.fetch.bind(f),readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)});
 f.lose=true;await assert.rejects(drive.saveArchives(b,{accountId:'a',characterId:'char'}));const r=await drive.saveArchives(b,{accountId:'a',characterId:'char'}),a=r.archives[0];assert.equal(a.verification.imageCount,42);assert.equal(a.folderId,'application');assert.equal(a.duplicateCount,0);assert.ok(f.calls.some(x=>x.url.includes(a.id+'?alt=media')));
 const ids=[...f.files.keys()];const [again,twice]=await Promise.all([drive.saveArchives(b,{accountId:'a',characterId:'char'}),drive.saveArchives(b,{accountId:'a',characterId:'char'})]);assert.equal(again,twice);assert.deepEqual([...f.files.keys()],ids);const fresh=new Map(),newDevice=createExportDrive({getToken:()=> 'test',fetchImpl:f.fetch.bind(f),readJournal:k=>fresh.get(k),writeJournal:(k,v)=>fresh.set(k,v)});const resumed=await newDevice.saveArchives(b,{accountId:'a',characterId:'char'});assert.equal(resumed.archives[0].id,a.id);assert.equal([...f.files.values()].filter(x=>x.mimeType==='application/zip').length,1);
 // Even a matching server checksum may not replace a byte-level download check.
 f.blobs.set(a.id,new Blob(['broken']));await assert.rejects(drive.saveArchives(b,{accountId:'a',characterId:'char'}),/ZIP終端/);
 assert.ok(f.calls.every(x=>!['PATCH','DELETE'].includes(x.method)));
});
test('wrong parent, duplicate listing and inaccessible Drive never return success',async()=>{
 const b=await completeBundle();for(const mode of ['parent','duplicate','readback','upload']){
  const f=new CandidateExportFixture(),journal=new Map(),base=f.fetch.bind(f),fetchImpl=async(url,options={})=>{if(mode==='upload'&&url.includes('/upload/'))return new Response('',{status:403});if(mode==='readback'&&url.includes('alt=media'))return new Response('',{status:404});const response=await base(url,options);if(mode==='parent'&&url.includes('/files/new')&&!url.includes('alt=media')){const value=await response.json();return Response.json({...value,parents:['wrong']});}if(mode==='duplicate'&&new URL(url).searchParams.get('q')?.includes("name = 'REVIEW_")){const value=await response.json();return Response.json({...value,files:[...value.files,{id:'duplicate'}]});}return response;};
  const drive=createExportDrive({getToken:()=> 'test',fetchImpl,readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)});await assert.rejects(drive.saveArchives(b,{accountId:'a',characterId:'char'}),mode);
 }
});
