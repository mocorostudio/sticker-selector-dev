import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendingDrive,readMasterRows} from '../integration-v1/drive-pending.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(30).fill(0)]);
const decode=async()=>{const data=new Uint8ClampedArray(370*320*4);for(let y=60;y<260;y++)for(let x=70;x<300;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};};
const reader=f=>createPendingDrive({getToken:()=> 'fixture-token',fetchImpl:f.fetch.bind(f)});
test('Drive pending reader gets nine exact inspected PNGs and live master text using GET only',async()=>{
 const f=await new PendingFixture().setup(png),progress=[],r=reader(f);
 assert.deepEqual(await r.characters(),[{id:'char',name:'05_合成テスト'}]);
 const result=await r.load('char',{decode,onProgress:p=>progress.push(p)});
 assert.equal(result.entries.length,9);assert.equal(result.skipped,0);assert.equal(result.master[0].phrase,'合成テスト01');
 assert.equal(result.entries[0].record.pendingDrive.fileId,'png1');assert.ok(f.calls.every(c=>c.method==='GET'&&c.authorization==='Bearer fixture-token'));
 assert.equal(progress.at(-1).done,9);
});
test('unregistered PNGs stay excluded from selection',async()=>{
 const f=await new PendingFixture().setup(png);f.put('unknown','uninspected.png','pending','image/png',png);
 const result=await reader(f).load('char',{decode});assert.equal(result.entries.length,9);assert.equal(result.skipped,1);
});
for(const [name,mutate] of [
 ['wrong character',f=>f.manifest.characterId='other'],
 ['wrong pending folder',f=>f.manifest.pendingFolderId='other'],
 ['foreign master',f=>f.manifest.masterReference='https://docs.google.com/spreadsheets/d/other/edit'],
 ['incomplete visual inspection',f=>f.manifest.entries[0].record.review=[]],
 ['duplicate image IDs',f=>f.manifest.entries[1].record.imageId=f.manifest.entries[0].record.imageId],
 ['duplicate Drive IDs',f=>f.manifest.entries[1].driveFileId=f.manifest.entries[0].driveFileId],
 ['changed phrase',f=>f.rows[1][2]='変更されたセリフ'],
 ['changed PNG bytes',f=>f.media.set('png1',new Uint8Array(png.byteLength).fill(3))],
 ['renamed PNG',f=>f.files.get('png1').name='different.png'],
 ['empty decoded PNG',f=>f.empty=true]
])test('Drive import refuses '+name,async()=>{const f=await new PendingFixture().setup(png);mutate(f);f.saveManifest();await assert.rejects(reader(f).load('char',{decode:f.empty?async()=>({width:370,height:320,data:new Uint8ClampedArray(370*320*4)}):decode}));assert.ok(f.calls.every(c=>c.method==='GET'));});
test('changed file version during read is rejected without retrying or writing',async()=>{const f=await new PendingFixture().setup(png);f.changeOnMedia='png1';await assert.rejects(reader(f).load('char',{decode}),/変更/);});
test('expired authorization stops and clears the connection',async()=>{const f=await new PendingFixture().setup(png);f.unauthorized=true;let disconnected=0;const r=createPendingDrive({getToken:()=> 'expired-fixture',fetchImpl:f.fetch.bind(f),onUnauthorized:()=>disconnected++});await assert.rejects(r.load('char',{decode}),/期限/);assert.equal(disconnected,1);assert.equal(f.calls.length,1);});
test('an account without the character and a character without review records cannot fake an empty successful import',async()=>{const f=await new PendingFixture().setup(png);await assert.rejects(reader(f).load('missing',{decode}));f.files.delete('manifest');await assert.rejects(reader(f).load('char',{decode}),/検品記録/);});
test('live master duplicate IDs never silently choose a phrase',()=>{assert.throws(()=>readMasterRows([['ID','セリフ（厳密）','基本ポーズ'],['D01','a','pose'],['D01','b','pose']]),/重複/);});
test('130 PNGs keep identity and all remain unselected at the transport layer',async()=>{const f=await new PendingFixture().setup(png,130);const result=await reader(f).load('char',{decode});assert.equal(result.entries.length,130);assert.equal(new Set(result.entries.map(x=>x.record.imageId)).size,130);assert.ok(result.entries.every(x=>x.record.rating===undefined));});
test('character-specific exact-text and pose headers retain verbatim punctuation',()=>{
 const rows=[['候補ID','正確なセリフ','ポーズ'],['C001','ありがとうございます♪','両手をそろえる'],['C002','ご都合いかがでしょうか？','会釈']];
 assert.deepEqual(readMasterRows(rows),[{candidateId:'C001',phrase:'ありがとうございます♪',pose:'両手をそろえる'},{candidateId:'C002',phrase:'ご都合いかがでしょうか？',pose:'会釈'}]);
 assert.throws(()=>readMasterRows([['候補ID','不明な文章','ポーズ'],['C001','推測禁止','会釈']]),/マスター/);
});
