import test from 'node:test';
import assert from 'node:assert/strict';
import {GoogleTestDriveAdapter,TEST_DRIVE} from '../google-test-drive.mjs';
import {syncSelections} from '../sync-engine.mjs';
import {Storage,GoogleRestFixture} from './google-drive-fixture.mjs';
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_key,_opts,fn)=>fn({name:'lock'})}}});
async function setup(){const rest=new GoogleRestFixture(),storage=new Storage();const adapter=new GoogleTestDriveAdapter({getToken:async()=>'test-token',fetchImpl:rest.fetch,storage});const rows=await adapter.list();return {rest,storage,adapter,rows,choices:rows.map((r,i)=>({...r,touched:true,rating:['o','h','x'][i],revision:'revision-1'}))}}
const run=(a,c)=>a.confirmRun(()=>syncSelections(a,c,{confirmed:true}));
test('real REST adapter reads registered fixtures without writing or storing a token',async()=>{const {adapter,rest,storage,rows}=await setup();assert.equal(rows.length,3);await adapter.image(rows[0].driveFileId);assert.equal(rest.writes().length,0);assert.equal(rows[0].technicalPassed,false);assert.equal(rows[0].testFixture,true);assert.equal(storage.data.size,0)});
test('writes blocked without explicit confirmed session',async()=>{const {adapter,rest,choices}=await setup();const r=await syncSelections(adapter,choices,{confirmed:true});assert.equal(r.errors.length,3);assert.equal(rest.writes().length,0)});
test('real REST protocol preserves legacy master, existing images and exact-once journal on retry',async()=>{const {adapter,rest,choices,storage}=await setup();const old=JSON.stringify(rest.rows);const result=await run(adapter,choices);assert.equal(result.saved.length,3);assert.equal(result.errors.length,0);assert.equal((await run(adapter,choices)).unchanged.length,3);assert.equal([...rest.files.values()].filter(x=>x.data).length,9);assert.equal(JSON.stringify(rest.rows),old);assert.equal(rest.files.get(TEST_DRIVE.fixtures[2].driveFileId).parents[0],TEST_DRIVE.folders.pending);assert.ok([...storage.data.values()].every(x=>!x.includes('test-token')))});
for(const stage of ['prepared','result','complete'])test('lost '+stage+' response resumes after new adapter instance without duplicate files',async()=>{const {rest,adapter,choices,storage}=await setup();rest.lose='-'+stage;const first=await run(adapter,choices);assert.equal(first.errors.length,1);assert.equal(first.saved.length,2);const reload=new GoogleTestDriveAdapter({getToken:async()=>'test-token',fetchImpl:rest.fetch,storage});const second=await run(reload,choices);assert.equal(second.errors.length,0);assert.equal(second.saved.length+second.unchanged.length,3);assert.equal([...rest.files.values()].filter(x=>x.data).length,9)});
test('foreign PNG, reject destination, and changed folder ancestry are denied',async()=>{const {adapter,rest}=await setup();await assert.rejects(adapter.metadata('production-file'),/対象外/);await assert.rejects(adapter.confirmRun(()=>adapter.move(TEST_DRIVE.fixtures[0].driveFileId,'pending','reject')),/移動先/);rest.files.get(TEST_DRIVE.folders.adopt).parents=['production-folder'];await assert.rejects(adapter.list(),/フォルダ不一致/);assert.equal(rest.writes().length,0)});
test('one bad real test image does not block other fixture records',async()=>{const {adapter,rest,choices}=await setup();rest.files.get(TEST_DRIVE.fixtures[0].driveFileId).name='wrong.png';const r=await run(adapter,choices);assert.equal(r.errors.length,1);assert.equal(r.saved.length,2)});
test('different revision keeps both old and new evaluation histories',async()=>{const {adapter,rest,choices}=await setup();const c=choices.slice(0,1);await run(adapter,c);c[0].rating='h';c[0].revision='revision-2';await run(adapter,c);assert.equal([...rest.files.values()].filter(x=>x.data).length,6);assert.equal((await adapter.list())[0].rating,'h')});
test('uncertain create and delayed search reuse reserved Drive ID',async()=>{
 const {adapter,rest,choices,storage}=await setup();rest.lose='-prepared';await run(adapter,choices.slice(0,1));
 const original=rest.fetch;let hiddenSearches=4;
 const fetchImpl=async(url,opts)=>{const response=await original(url,opts);const u=new URL(url);if(u.pathname==='/drive/v3/files'&&hiddenSearches-->0)return new Response(JSON.stringify({files:[]}),{headers:{'Content-Type':'application/json'}});return response};
 const reload=new GoogleTestDriveAdapter({getToken:async()=>'test-token',fetchImpl,storage});
 const second=await run(reload,choices.slice(0,1));
 assert.equal(second.errors.length,0);assert.equal(second.saved.length,1);
 assert.equal([...rest.files.values()].filter(x=>x.data).length,3);
 const creates=rest.writes().filter(x=>x.url.includes('/upload/'));
 assert.equal(creates.length,4); // original create, 409 retry, result and completion
});
