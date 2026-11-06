import test from 'node:test';import assert from 'node:assert/strict';
import {archiveSaveProgress} from '../integration-v1/submission-save-progress.mjs';
test('PNG progress is explicit, bounded, and separate from ZIP upload and metadata',()=>{
 assert.deepEqual(archiveSaveProgress({stage:'components',done:30,total:42}),{message:'PNGの保存・照合：30／42枚完了',done:30,total:42});
 assert.match(archiveSaveProgress({stage:'uploading',done:0,total:1}).message,/ZIP.*0／1個/);
 assert.match(archiveSaveProgress({stage:'recording'}).message,/順番・判定理由/);
 assert.equal(archiveSaveProgress({stage:'components',done:99,total:42}).done,42);
 assert.equal(archiveSaveProgress({stage:'components',done:-1,total:42}).done,0);
 assert(!archiveSaveProgress({stage:'recording'}).message.includes('NaN'));
});
