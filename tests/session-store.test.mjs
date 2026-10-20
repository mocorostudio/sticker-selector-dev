import test from 'node:test';
import assert from 'node:assert/strict';
import {storageKeys,recoverDraft} from '../session-store.mjs';

test('real Drive test storage is isolated from production, other paths and local imports',()=>{
 const original=storageKeys(),preview=storageKeys({driveTest:true,pathname:'/sticker-selector-dev/'}),other=storageKeys({driveTest:true,pathname:'/sticker-selector/'});
 for(const field of ['store','db','view']){assert.notEqual(preview[field],original[field]);assert.notEqual(preview[field],other[field])}
 assert.deepEqual(preview,storageKeys({driveTest:true,pathname:'/sticker-selector-dev/index.html'}));
 assert.equal(original.store,'sticker-selector-v9');
});

test('draft recovery preserves the exact existing image and evaluation without changing source',()=>{
 const record={imageId:'existing-image',candidate:'TEST03',attemptId:'existing-attempt',driveFileId:'existing-drive-id',filename:'v9_test_03.png'};
 const source=[{id:record.imageId,...record,name:record.filename,rating:'x',touched:true,revision:'old-revision',comment:'残す'}],before=JSON.stringify(source);
 const recovered=recoverDraft(source,record);assert.equal(recovered.revision,'old-revision');assert.equal(recovered.rating,'x');recovered.comment='new';assert.equal(JSON.stringify(source),before);
 for(const field of ['candidate','attemptId','driveFileId','filename'])assert.equal(recoverDraft(source,{...record,[field]:'different'}),null);
 assert.equal(recoverDraft([source[0],source[0]],record),null);
});
