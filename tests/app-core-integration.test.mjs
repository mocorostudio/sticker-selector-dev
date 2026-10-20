import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('the UI uses one shared engine and explicit test-only Drive activation',()=>{
 const app=fs.readFileSync('app.mjs','utf8');
 assert.match(app,/import .*syncSelections.*sync-engine/);
 assert.match(app,/syncSelections\(adapter,choices/);
 assert.doesNotMatch(app,/googleapis|access_token|TEST_SHEET_ID/);
});
