import test from 'node:test';import assert from 'node:assert/strict';
import {durableSubmissionJournal} from '../integration-v1/durable-submission-journal.mjs';
const storage=()=>({data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(){throw new DOMException('Quota exceeded','QuotaExceededError');},get length(){return this.data.size;},key(i){return [...this.data.keys()][i];}});
const backend=()=>({data:new Map(),async entries(){return [...this.data];},async put(k,v){this.data.set(k,v);}});
test('full localStorage saves and verifies resume snapshots and Drive reservations in persistent fallback; reload prefers newer state',async()=>{
 const local=storage(),db=backend(),key='submission-trial-draft:/phone:char:zip-pending';local.data.set(key,JSON.stringify({state:'old',choices:[1,2]}));
 const a=durableSubmissionJournal(local,{database:db});await a.ready;await a.writeJournal(key,JSON.stringify({state:'pending',choices:[1,2],tab:{strokes:[1]}}));await a.writeJournal('application-kit:reserved','drive-id');
 assert.equal(local.getItem(key),JSON.stringify({state:'old',choices:[1,2]}));
 const b=durableSubmissionJournal(local,{database:db});await b.ready;assert.equal(b.readJournal('application-kit:reserved'),'drive-id');assert.deepEqual(JSON.parse(b.readJournal(key)).tab,{strokes:[1]});
 await b.writeJournal(key,'{"state":"complete"}');const c=durableSubmissionJournal(local,{database:db});await c.ready;assert.equal(c.readJournal(key),'{"state":"complete"}');
});
test('both storage failures stop before reporting a durable save; previous value remains readable',async()=>{const local=storage(),db=backend();db.data.set('reserved','old');db.put=async()=>{throw Error('IDB full');};const j=durableSubmissionJournal(local,{database:db});await j.ready;await assert.rejects(j.writeJournal('reserved','new'),/保存できません/);assert.equal(j.readJournal('reserved'),'old');});
