import test from 'node:test';import assert from 'node:assert/strict';
import {inspectConfirmationTransparency,verifySavedTransparency} from '../integration-v1/transparency-checkpoint.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
import {pngFixture} from './submission-png-fixture.mjs';
test('confirmation preserves ambiguous pixels and warnings; strict verification still blocks them',async()=>{
 const blob=pngFixture(),pixels=validPixels();pixels.data.set([120,50,40,60],(10*370+10)*4);const before=pixels.data.slice(),bytes=await blob.arrayBuffer();
 const report=await inspectConfirmationTransparency(blob,async()=>pixels,{purpose:'confirmation-only',stage:'artwork'});
 assert.equal(report.status,'needs-repair');assert(report.issues.length);assert.equal(report.technicalApproval,false);assert.equal(report.pixelsUnchanged,true);assert.deepEqual(pixels.data,before);assert.deepEqual(await blob.arrayBuffer(),bytes);
 await assert.rejects(verifySavedTransparency(blob,async()=>pixels),/個別|選抜前|背景/);
 await assert.rejects(inspectConfirmationTransparency(blob,async()=>pixels,{}),/確認用/);
 await assert.rejects(inspectConfirmationTransparency(blob,async()=>pixels,{purpose:'confirmation-only',expectedSha:'0'.repeat(64)}),/ハッシュ/);
});
