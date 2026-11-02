import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNineCellHandoff} from '../integration-v1/strict-handoff-bridge.mjs';
test('no authenticated Drive connector refuses handoff',async()=>{
 await assert.rejects(prepareNineCellHandoff({pending:null,characterId:'c1',entries:[],assignments:[]}),/Drive接続/);
});
test('wrong character from Drive refuses handoff',async()=>{
 const pending={masterForCharacter:async()=>({characterId:'other',modifiedTime:'2026-11-03'})};
 await assert.rejects(prepareNineCellHandoff({pending,characterId:'c1',entries:[],assignments:[]}),/最新マスター/);
});
test('missing master timestamp refuses handoff',async()=>{
 const pending={masterForCharacter:async()=>({characterId:'c1'})};
 await assert.rejects(prepareNineCellHandoff({pending,characterId:'c1',entries:[],assignments:[]}),/最新マスター/);
});
test('Drive failure propagates without writing',async()=>{
 const pending={masterForCharacter:async()=>{throw Error('認証切れ');}};
 await assert.rejects(prepareNineCellHandoff({pending,characterId:'c1',entries:[],assignments:[]}),/認証切れ/);
});
