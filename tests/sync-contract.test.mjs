import assert from 'node:assert/strict';
import test from 'node:test';
import {planSelection} from '../selection-core.mjs';
const row={candidate:'D01',imageId:'attempt-image-1',folder:'pending',rating:null,confirmed:false};
test('planner rejects image or candidate mismatch',()=>{assert.equal(planSelection(row,{candidate:'D01',imageId:'wrong',rating:'o'}).action,'error');assert.equal(planSelection(row,{candidate:'wrong',imageId:row.imageId,rating:'o'}).action,'error')});
test('rejection retains current PNG folder, including previously adopted PNGs',()=>{assert.equal(planSelection(row,{imageId:row.imageId,rating:'x'}).destination,'pending');assert.equal(planSelection({...row,folder:'adopt'},{imageId:row.imageId,rating:'x'}).destination,'adopt')});
test('planner ignores absent records and unsupported ratings',()=>{assert.equal(planSelection(null,{rating:'o'}).reason,'unregistered');assert.equal(planSelection(row,{imageId:row.imageId,rating:'z'}).reason,'unrated')});
test('comment changes require sync even when the rating is unchanged',()=>{const current={...row,rating:'h',folder:'hold',confirmed:true,comment:'before'},choice={imageId:row.imageId,rating:'h',comment:'before'};assert.equal(planSelection(current,choice).action,'unchanged');assert.equal(planSelection(current,{...choice,comment:'after'}).action,'sync')});
