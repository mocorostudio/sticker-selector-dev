import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {startServer} from './server.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';
import {storageKeys} from '../integration-v1/session-store.mjs';
const service=await startServer();
try{for(const [engine,type] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.TEST_BROWSER||name===process.env.TEST_BROWSER)){
 const browser=await type.launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}: {})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const raw=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=370;c.height=320;const g=c.getContext('2d');g.fillStyle='#9f6335';g.fillRect(90,70,190,180);return c.toDataURL('image/png').split(',')[1];});
  const fixture=await new PendingFixture().setup(new Uint8Array(Buffer.from(raw,'base64')));
  let character='char';
  if(process.env.TEST_PENDING_MANIFEST){
   const manifest=JSON.parse(await fs.readFile(process.env.TEST_PENDING_MANIFEST,'utf8')),source=JSON.parse(await fs.readFile(process.env.TEST_PENDING_SOURCE,'utf8'));
   fixture.files.clear();fixture.media.clear();fixture.historyId=source.historyFolderId;
   character=manifest.characterId;fixture.folder(character,'検証キャラ','root');fixture.folder(manifest.pendingFolderId,'00_選抜待ち',character);fixture.folder(source.historyFolderId,'03_元画像・生成履歴',character);
   const master=manifest.masterReference.match(/\/d\/([-\w]+)/)[1];fixture.files.set(master,{id:master,name:'Actual_Master_v9',mimeType:'application/vnd.google-apps.spreadsheet',parents:[character]});
   fixture.rows=source.rows;fixture.manifest=manifest;fixture.saveManifest();
   for(const e of manifest.entries){if(!/^[-\w]+\.png$/.test(e.record.filename))throw Error('Invalid private fixture path');fixture.put(e.driveFileId,e.record.filename,manifest.pendingFolderId,'image/png',new Uint8Array(await fs.readFile(path.join(process.env.TEST_PENDING_PNG_DIR,e.record.filename))));}
  }
  const external=[];
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===service.url||u.protocol==='blob:')return route.continue();
   if(r.url()==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>{window.fixtureScope=options.scope;options.callback({access_token:'pending-fixture-token',expires_in:3600,scope:options.scope});}})}}};"});
   if(['https://www.googleapis.com','https://sheets.googleapis.com'].includes(u.origin)){
    const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'};
    if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    const response=await fixture.fetch(r.url(),{method:r.method(),headers:{Authorization:r.headers().authorization}});
    return route.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers.entries()),...cors},body:Buffer.from(await response.arrayBuffer())});
   }
   external.push(r.url());return route.abort();
  });
  const url=service.url+'/integration-v1/workflow.html?view=selection&character='+character,keys=storageKeys({workflowLocal:true,pathname:'/integration-v1/workflow.html'});
  await page.goto(url);await page.locator('#selectionScreen:not([hidden])').waitFor();
  const legacy='original legacy votes',old={id:'crop:old-dog',imageId:'old-dog',name:'old.png',origin:'crop-local',rating:'x',touched:true,revision:'old-vote',comment:'keep original',selectionHistory:[],crop:{history:[]}};
  await page.evaluate(({keys,old,legacy})=>{localStorage.setItem('sticker-selector-v9',legacy);localStorage.setItem(keys.store,JSON.stringify({items:[old],background:'checker'}));localStorage.setItem(keys.view,JSON.stringify([old.id]));},{keys,old,legacy});
  await page.reload();await page.locator('#selectionScreen:not([hidden])').waitFor();
  assert.equal(await page.locator('.card').count(),0);
  await page.locator('#showAll').evaluate(el=>el.click());assert.equal(await page.locator('.card').count(),0);
  fixture.unauthorized=true;
  await page.locator('#loadPending').click();await page.waitForFunction(()=>!document.querySelector('#pendingConnect').disabled);await page.locator('#pendingConnect').click();
  await page.locator('#drivePendingStatus').filter({hasText:'期限'}).waitFor();assert.equal(await page.locator('.card').count(),0);
  await page.getByRole('button',{name:'閉じる',exact:true}).filter({visible:true}).click();fixture.unauthorized=false;
  await page.locator('#selectionScreen details summary').first().click();await page.locator('#importMode').selectOption('append');await page.locator('#selectionScreen details summary').first().click();
  const load=async()=>{await page.locator('#loadPending').click();await page.waitForFunction(()=>!document.querySelector('#pendingConnect').disabled);await page.locator('#pendingConnect').click();};
  await load();await page.locator('#drivePending').waitFor({state:'hidden'});await page.locator('#drivePendingProgress').filter({hasText:'読み込みが完了'}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===9&&document.querySelector('.stage img').naturalWidth===160);
  assert.equal(await page.locator('.stage img').last().getAttribute('src'),null);
  await page.locator('.stage img').last().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].at(-1).naturalWidth===160);
  await page.waitForFunction(()=>!document.querySelector('.stage img').hasAttribute('src'));
  await page.locator('.stage img').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.stage img').naturalWidth===160);
  await page.locator('.stage img').first().click();
  await page.waitForFunction(()=>document.querySelector('#zoomimg').naturalWidth===370);
  await page.locator('#close').click();
  const imageKeys=await page.evaluate(dbName=>new Promise((resolve,reject)=>{
   const open=indexedDB.open(dbName);
   open.onsuccess=()=>{const db=open.result,req=db.transaction('images').objectStore('images').getAllKeys();req.onsuccess=()=>{db.close();resolve(req.result);};req.onerror=()=>reject(req.error);};
   open.onerror=()=>reject(open.error);
  }),keys.db);
  assert.deepEqual(imageKeys,[]);
  assert.equal(await page.locator('.chosen').count(),0);assert.equal(await page.locator('#error').textContent(),'');
  assert.equal(await page.evaluate(()=>window.fixtureScope),'https://www.googleapis.com/auth/drive.readonly');
  const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.store);
  assert.equal((await saved()).items.length,10);assert.ok((await saved()).items.filter(x=>x.id!==old.id).every(x=>x.technicalPassed&&x.driveFileId&&!x.touched));
  await page.locator('.card').first().locator('.choices label').nth(1).click();await page.locator('.comment').first().fill('keep this choice');
  const chosen=(await saved()).items.find(x=>x.touched&&x.id!==old.id);
  await load();await page.locator('#drivePending').waitFor({state:'hidden'});await page.locator('#drivePendingProgress').filter({hasText:'読み込みが完了'}).waitFor();
  assert.equal((await saved()).items.length,10);const again=(await saved()).items.find(x=>x.id===chosen.id);assert.equal(again.rating,'h');assert.equal(again.comment,'keep this choice');assert.equal(again.revision,chosen.revision);
  assert.deepEqual((await saved()).items.find(x=>x.id===old.id),old);
  // A failed reconnect must preserve the already loaded images and choice.
  fixture.unauthorized=true;await load();await page.locator('#drivePendingStatus').filter({hasText:'期限'}).waitFor();assert.equal((await saved()).items.length,10);assert.equal((await saved()).items.find(x=>x.id===chosen.id).rating,'h');
  await page.getByRole('button',{name:'閉じる',exact:true}).filter({visible:true}).click();
  fixture.unauthorized=false;await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);assert.equal(await page.locator('.chosen').count(),1);
  await page.goto(service.url+'/integration-v1/workflow.html?view=selection');await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
  await page.locator('#showAll').evaluate(el=>el.click());assert.equal(await page.locator('.card').count(),9);
  await page.goto(service.url+'/integration-v1/workflow.html?view=selection&character=another-character');await page.locator('#selectionScreen:not([hidden])').waitFor();assert.equal(await page.locator('.card').count(),0);
  assert.deepEqual((await saved()).items.find(x=>x.id===old.id),old);
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sticker-selector-v9')),legacy);assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('pending-fixture-token')),false);
  if(!process.env.TEST_PENDING_MANIFEST){
   const legacyState=await saved();
   await page.evaluate(({dbName,oldId})=>new Promise((resolve,reject)=>{
    const open=indexedDB.open(dbName);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
     const db=open.result,tx=db.transaction('images','readwrite');
     tx.objectStore('images').put({bytes:new Uint8Array([7,8,9]).buffer,type:'image/png'},oldId);
     tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
    };
   }),{dbName:keys.db,oldId:old.id});
   await page.addInitScript(store=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
     if(key===store){
      const decoded=JSON.parse(value);
      if(decoded.items?.length>15||decoded.schema==='animal-stickers-selection-state/packed-v1')throw new DOMException('The quota has been exceeded','QuotaExceededError');
     }
     return original.call(this,key,value);
    };
   },keys.store);
   for(const namespace of ['product-a_','product-b_']){
    const product=await new PendingFixture().setup(new Uint8Array(Buffer.from(raw,'base64')),81,namespace);
    for(const e of product.files)fixture.files.set(...e);
    for(const e of product.media)fixture.media.set(...e);
    fixture.rows=product.rows;
    await page.goto(service.url+'/integration-v1/workflow.html?view=selection&character='+namespace+'char');
    await load();
    await page.locator('#drivePendingProgress').filter({hasText:'81枚の読み込みが完了'}).waitFor({timeout:90000});
    assert.equal(await page.locator('.card').count(),81);
    await page.locator('.choices label').first().click();
    await page.locator('.comment').first().fill(namespace+' draft');
    await page.waitForFunction(({dbName,store,comment})=>new Promise(resolve=>{
     const open=indexedDB.open(dbName);
     open.onsuccess=()=>{const db=open.result,r=db.transaction('images').objectStore('images').get('selection-state:'+store);r.onsuccess=()=>{db.close();resolve(r.result?.items.some(i=>i.comment===comment));};};
    }),{dbName:keys.db,store:keys.store,comment:namespace+' draft'});
    await page.reload();
    await page.waitForFunction(()=>document.querySelectorAll('.card').length===81);
    assert.equal(await page.locator('.comment').first().inputValue(),namespace+' draft');
   }
   const stored=await page.evaluate(({dbName,store,oldId})=>new Promise((resolve,reject)=>{
    const open=indexedDB.open(dbName);
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
     const db=open.result,tx=db.transaction('images'),images=tx.objectStore('images'),state=images.get('selection-state:'+store),legacy=images.get(oldId),keys=[];
     const request=images.openKeyCursor();
     request.onsuccess=()=>{const cursor=request.result;if(cursor){keys.push(cursor.key);cursor.continue();}};
     tx.oncomplete=()=>{db.close();resolve({keys,state:state.result,legacy:[...new Uint8Array(legacy.result.bytes)]});};tx.onabort=()=>reject(tx.error);
    };
   }),{dbName:keys.db,store:keys.store,oldId:old.id});
   assert.equal(stored.state?.items.length,172);
   assert.deepEqual(stored.keys.sort(),[old.id,'selection-state:'+keys.store].sort());
   assert.deepEqual(stored.legacy,[7,8,9]);
   assert.deepEqual(stored.state.items.find(i=>i.id===old.id),old);
   assert.equal(stored.state.items.filter(i=>i.touched).length,4);
   assert.deepEqual((await saved()).items.slice(0,legacyState.items.length),legacyState.items);
   console.log('PASS two 81-image products under injected quota after 15 items; legacy image and choices preserved; zero new persisted images.');
  }
  assert.ok(fixture.calls.every(c=>c.method==='GET'));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/pending-'+engine+(process.env.TEST_PENDING_MANIFEST?'-private':'')+'.png',fullPage:!!process.env.TEST_PENDING_MANIFEST});await page.screenshot({path:'test-results/pending-'+engine+'-viewport.png'});
  console.log('PASS '+engine+' Drive pending: Google readonly -> live master + reviewed PNGs -> nine unrated cards; repeat/read/reload retain choices; auth expiry preserves work; no Drive writes or ZIP transfer.');
  await context.close();
 }finally{await browser.close();}
}}finally{await new Promise(ok=>service.server.close(ok));}
