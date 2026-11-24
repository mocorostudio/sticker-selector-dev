import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';import {startServer} from './server.mjs';
const service=await startServer(),browser=await (process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...(process.env.TEST_BROWSER!=='webkit'?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}:{})});
try{const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(service.url+'/crop-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body></body>'}));
async function setup(){await page.goto(service.url+'/crop-fixture');await page.evaluate(async()=>{document.body.innerHTML='<nav class="workflow-tabs"></nav><button id="open">編集</button><main id="host"></main>';const {initSubmissionArtwork}=await import('/integration-v1/submission-artwork-ui.mjs');const {readSubmission,writeSubmission,submissionJournal}=await import('/integration-v1/submission-store.mjs');const key='submission-trial-draft:/fixture:test';let draft=readSubmission(localStorage,key)?.draft||{sets:[{id:'s',name:'test',target:8}],assignments:{a:'s'},artwork:{s:{mainId:'a',tabId:'a',strokes:[]}}};const c=document.createElement('canvas');c.width=370;c.height=320;const x=c.getContext('2d');x.fillStyle='#345678';x.fillRect(90,80,180,180);x.fillRect(50,30,260,30);const blob=await new Promise(r=>c.toBlob(r));window.editor=initSubmissionArtwork({getDraft:()=>draft,getFiles:()=>[{id:'a',name:'test.png'}],getSetId:()=> 's',getCharacterId:()=> 'test',commit:d=>{writeSubmission(localStorage,key,{draft:d,operation:null});draft=d;},loadPreview:async()=>blob,isLocked:()=>false,isReady:()=>true,onSave:async prepare=>{window.result=await prepare();return {files:[]};},button:document.querySelector('#open'),container:document.querySelector('#host'),selectionParts:[]});});await page.locator('#open').click();await page.waitForFunction(()=>!document.querySelector('#artworkSaveDrive').disabled);}
await setup();
const before=await page.locator('#artworkMainPreview').evaluate(c=>c.toDataURL());
await page.evaluate(()=>{
 const key='submission-trial-draft:/fixture:test';
 const record={state:'pending',plan:{entries:Array.from({length:1500},(_,i)=>({id:'image-'+i,reason:'元画像と選抜と編集履歴を保全する'.repeat(20)}))}};
 localStorage.setItem(key+':zip-pending',JSON.stringify(record));window.pendingBefore=JSON.stringify(record);
 const size=()=>Object.keys(localStorage).reduce((n,k)=>n+k.length+localStorage.getItem(k).length,0),limit=size()+10,original=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){if(size()-(this.getItem(k)===null?0:k.length+this.getItem(k).length)+k.length+String(v).length>limit)throw new DOMException('The quota has been exceeded.','QuotaExceededError');return original.call(this,k,v);};
});
await page.locator('#artworkCanvas').scrollIntoViewIfNeeded();const box=await page.locator('#artworkCanvas').boundingBox();
await page.touchscreen.tap(box.x+180/370*box.width,box.y+45/320*box.height);
await page.waitForFunction(()=>document.querySelector('#artworkCanvas').getContext('2d').getImageData(180,45,1,1).data[3]===0);
assert.equal(await page.locator('#artworkMainPreview').evaluate(c=>c.toDataURL()),before);
assert.equal(await page.evaluate(async()=>{const {submissionJournal}=await import('/integration-v1/submission-store.mjs');return submissionJournal(localStorage).readJournal('submission-trial-draft:/fixture:test:zip-pending')===window.pendingBefore;}),true);
await setup();assert.equal(await page.locator('#artworkCanvas').evaluate(c=>c.getContext('2d').getImageData(180,45,1,1).data[3]),0);
await page.locator('#artworkUndo').click();assert.equal(await page.locator('#artworkCanvas').evaluate(c=>c.getContext('2d').getImageData(180,45,1,1).data[3]),255);
assert.deepEqual(errors,[]);console.log('PASS: phone eraser under quota, pending ZIP retained, reload, undo, original main unchanged');

}finally{await browser.close();await new Promise(r=>service.server.close(r));}
