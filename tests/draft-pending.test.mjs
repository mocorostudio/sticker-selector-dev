import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DRAFT_SCHEMA,unpackDraft} from '../integration-v1/draft-bundle.mjs';
import {createPendingDrive,pngHash,readMasterRows} from '../integration-v1/drive-pending.mjs';
import {importCrops} from '../integration-v1/crop-handoff.mjs';
import {gate} from '../integration-v1/crop-v9/core.mjs';
import {selectionView} from '../integration-v1/selection-view.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';
globalThis.JSZip=JSZip;
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(30).fill(0)]);
const decode=async()=>{const data=new Uint8ClampedArray(370*320*4);data[(100*370+100)*4+3]=255;return {width:370,height:320,data};};
async function fixture(){
 const f=await new PendingFixture().setup(png,2),entries=f.manifest.entries.map(e=>({...e.record,sha256:e.sha256}));
 for(const id of ['png1','png2','manifest'])f.files.delete(id);
 const zip=new JSZip();for(const e of entries)zip.file(e.filename,png);const bytes=await zip.generateAsync({type:'uint8array'});
 f.put('archive','draft.zip','history','application/zip',bytes);
 f.draft={schema:DRAFT_SCHEMA,characterId:'char',pendingFolderId:'pending',historyFolderId:'history',masterReference:'https://docs.google.com/spreadsheets/d/master/edit',masterSheet:'116候補マスター',technicalPassed:false,archive:{fileId:'archive',sha256:await pngHash(bytes)},entries};
 f.saveDraft=()=>f.put('draft','selection-draft_fixture.json','history','application/json',new TextEncoder().encode(JSON.stringify(f.draft)));f.saveDraft();return f;
}
const read=f=>createPendingDrive({getToken:()=> 'fixture',fetchImpl:f.fetch.bind(f)}).load('char',{decode});
test('Drive draft ZIP is bound to character, live master and byte hashes without promoting technical status',async()=>{
 const f=await fixture(),r=await read(f);assert.equal(r.draft,true);assert.equal(r.entries.length,2);assert.ok(r.entries.every(e=>e.record.decision==='review'&&gate(e.record)==='review'));
 const bear={id:'bear',characterId:'bear',rating:'h',comment:'keep',touched:true},items=[bear],blobs=new Map();
 const result=await importCrops(r.entries,{items:()=>items,decode,get:async id=>blobs.get(id),write:async(i,b)=>{items.push(i);blobs.set(i.id,b);}},r.master,{forSelection:true});
 assert.equal(result.errors.length,0);for(const i of items.slice(1)){i.characterId='char';assert.equal(i.technicalPassed,false);assert.equal(i.touched,false);}
 assert.deepEqual(selectionView(items,{workflowLocal:true,characterId:'char'}).length,2);assert.deepEqual(items[0],bear);
 assert.ok(f.calls.every(c=>c.method==='GET'));
});
for(const [name,mutate] of [
 ['wrong character',f=>f.draft.characterId='bear'],['wrong folder',f=>f.files.get('archive').parents=['bear']],
 ['archive hash mismatch',f=>f.draft.archive.sha256='0'.repeat(64)],['PNG hash mismatch',f=>f.draft.entries[0].sha256='0'.repeat(64)],
 ['live phrase changed',f=>f.rows[1][2]='changed'],['duplicate candidate',f=>f.draft.entries[1].candidateId=f.draft.entries[0].candidateId],
 ['false approval',f=>f.draft.technicalPassed=true]
])test('draft reader refuses '+name,async()=>{const f=await fixture();mutate(f);f.saveDraft();await assert.rejects(read(f));});
test('existing inspected pending PNGs retain priority over a draft bundle',async()=>{
 const f=await new PendingFixture().setup(png,2);f.put('draft','selection-draft_bad.json','history','application/json',new TextEncoder().encode('{}'));const r=await read(f);assert.equal(r.entries.length,2);assert.equal(r.draft,undefined);
});
test('an old trial-mode bookmark can switch to a draft character without treating original sheets as pending PNGs',async()=>{
 const f=await fixture();f.put('original','original.png','history','image/png',png);
 const r=await createPendingDrive({getToken:()=> 'fixture',fetchImpl:f.fetch.bind(f),includeTrials:true}).load('char',{decode});assert.equal(r.draft,true);assert.equal(r.entries.length,2);
});
test('character-specific master headers are supported without changing exact text',()=>{
 assert.deepEqual(readMasterRows([['候補ID','セリフ（厳密）','構図・ポーズ・目線'],['PMD001','ほんと？','斜め上']]),[{candidateId:'PMD001',phrase:'ほんと？',pose:'斜め上'}]);
});
test('a directly addressed character remains selectable when global folder search omits it',async()=>{
 const f=await fixture();f.folder('bear','05_Bear','root');f.folder('bearPending','00_選抜待ち','bear');
 const original=f.fetch.bind(f);const fetchImpl=async(url,options)=>{const u=new URL(url);if(u.pathname==='/drive/v3/files'&&u.searchParams.get('q')?.includes("name = '00_選抜待ち'"))return Response.json({files:[f.files.get('bearPending')]});return original(url,options);};
 const drive=createPendingDrive({getToken:()=> 'fixture',fetchImpl});const chars=await drive.characters({preferredId:'char'});assert.deepEqual(new Set(chars.map(c=>c.id)),new Set(['char','bear']));
 assert.equal((await drive.load('char',{decode})).entries.length,2);
 await assert.rejects(drive.characters({preferredId:'inaccessible'}),/見つかりません/);
 f.folder('extra','00_選抜待ち','char');await assert.rejects(drive.characters({preferredId:'char'}),/重複/);
});

test('all candidates reopen even when 00 is empty and adopted/held contain copies; saved rejection is restored',async()=>{
 const f=await fixture();f.files.set('adopt',{id:'adopt',name:'01_採用予定',mimeType:'application/vnd.google-apps.folder',parents:['char']});f.files.set('hold',{id:'hold',name:'02_保留',mimeType:'application/vnd.google-apps.folder',parents:['char']});
 f.put('copy','copy.png','adopt','image/png',png);const r=f.draft.entries[0];const results={schema:'animal-stickers-selection-export/v1',results:[{imageId:r.imageId,candidateId:r.candidateId,phrase:r.phrase,rating:'x',confirmed:true,revision:'saved',comment:'再検討',selectionHistory:[{revision:'saved',rating:'x',comment:'再検討'}],sourceProof:{characterId:'char',sha256:r.sha256}}]};f.put('votes','selection-results_saved.json','history','application/json',new TextEncoder().encode(JSON.stringify(results)));
 const drive=createPendingDrive({getToken:()=> 'fixture',fetchImpl:f.fetch.bind(f)}),result=await drive.load('char',{allCandidates:true,decode});assert.equal(result.entries.length,2);assert.equal(result.entries[0].savedEvaluation.rating,'x');assert.equal(result.entries[0].savedEvaluation.comment,'再検討');assert.equal(result.draft,true);
});

test('formally inspected PNGs remain readable after moving from 00 into adopted and held',async()=>{
 const f=await new PendingFixture().setup(png,2);f.files.set('adopt',{id:'adopt',name:'01_採用予定',mimeType:'application/vnd.google-apps.folder',parents:['char']});f.files.set('hold',{id:'hold',name:'02_保留',mimeType:'application/vnd.google-apps.folder',parents:['char']});f.files.get('png1').parents=['adopt'];f.files.get('png2').parents=['hold'];
 const result=await createPendingDrive({getToken:()=> 'fixture',fetchImpl:f.fetch.bind(f)}).load('char',{allCandidates:true,decode});assert.equal(result.entries.length,2);assert.equal(result.entries[0].record.pendingDrive.folderId,'adopt');assert.equal(result.entries[1].record.pendingDrive.folderId,'hold');
});
