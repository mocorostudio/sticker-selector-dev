import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExport,exportSummary} from '../integration-v1/drive-export.mjs';
import {candidateItems,validPixels} from './candidate-export-fixture.mjs';
test('72 votes save all 41 adopted and five held PNGs; technical review remains separate',async()=>{const plan=await prepareExport(candidateItems(),{get:async()=>new Blob([new Uint8Array(30)],{type:'image/png'}),decode:async()=>validPixels()});assert.deepEqual(plan.summary,{records:72,confirmed:72,trialRecords:63,pngCopies:46});assert.equal(plan.counts.adopted,41);assert.equal(plan.counts.held,5);assert.equal(plan.counts.rejected,26);assert.equal(plan.images.filter(x=>x.technicalStatus==='review').length,38);const text=exportSummary([plan]);assert.match(text,/選抜結果72件（◯41・△5・✕26）／PNG 46枚/);assert.match(text,/技術判定は未合格/);});
