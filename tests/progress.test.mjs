import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA,parseMaster,mergeProgress,nextTask,localCounts,validateProgress} from '../integration-v1/progress-core.mjs';
import {progressDrive} from '../integration-v1/progress-drive.mjs';
const rows=[['動物','フォルダ','申請状況','PNG保存状況'],['test','https://drive.google.com/drive/folders/abc','未申請','未保存']];
const event=(stage,at='2026-10-30T01:00:00Z')=>({schema:SCHEMA,records:[{characterId:'abc',stage,next:'next',updatedAt:at,source:'fixture',priority:1}]});
test('old master never infers completion; newest explicit journal wins regardless of read order',()=>{
 const base=parseMaster(rows);assert.equal(base[0].stage,'unknown');assert.equal(nextTask(base),null);
 const merged=mergeProgress(base,[event('submitted'),event('you','2026-10-29T01:00:00Z')]);assert.equal(merged[0].stage,'submitted');assert.equal(base[0].stage,'unknown');
 assert.equal(nextTask(mergeProgress(base,[event('you')])).characterId,'abc');
 assert.throws(()=>validateProgress(event('fake')));assert.equal(localCounts([{characterId:'abc',touched:true,technicalPassed:false}],'abc').passed,0);
});
test('create-only save reconciles 409 and reads content and parent back',async()=>{
 let writes=0;const doc=event('submitted'),fetchImpl=async(url,opt)=>{
  if(url.includes('upload/')){writes++;assert.equal(opt.method,'POST');return new Response('{}',{status:409});}
  if(url.includes('alt=media'))return Response.json(doc);
  if(url.includes('/abcfile?'))return Response.json({id:'abcfile',parents:['root'],mimeType:'application/json'});
  if(url.includes('sheets.googleapis.com'))return Response.json(url.includes('/values/')?{values:rows}:{sheets:[{properties:{title:'一覧',gridProperties:{rowCount:10,columnCount:10}}}]});
  return Response.json({files:url.includes('全体')?[]:[]});
 };
 // Explicit synthetic discovery and a separate journal listing.
 const fixture=async(url,opt)=>{if(url.startsWith('https://www.googleapis.com/drive/v3/files?')){const q=new URL(url).searchParams.get('q');return Response.json({files:q.includes('spreadsheet')?[{id:'master',parents:['root']}]:[]});}return fetchImpl(url,opt);};
 const drive=progressDrive({getToken:()=> 'fixture-token',fetchImpl:fixture});await drive.load();await drive.save(doc,'abcfile');assert.equal(writes,1);
});
test('trash is excluded from next task and requires explicit confirmation',async()=>{
 const r=mergeProgress(parseMaster(rows),[event('trash')]);assert.equal(r[0].stage,'trash');assert.equal(nextTask(r),null);
 let calls=0;const drive=progressDrive({getToken:()=> 'fixture',fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 await assert.rejects(drive.setFolderTrashed('abc',true),/確認/);assert.equal(calls,0);
});
