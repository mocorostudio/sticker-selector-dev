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
  await page.locator('#selectionScreen details summary').first().click();await page.locator('#importMode').selectOption('append');await page.locator('#selectionScreen details summary').first().click();
  const load=async()=>{await page.locator('#loadPending').click();await page.waitForFunction(()=>!document.querySelector('#pendingConnect').disabled);await page.locator('#pendingConnect').click();};
  await load();await page.locator('#drivePending').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===9&&[...document.querySelectorAll('.stage img')].every(im=>im.naturalWidth===370&&im.naturalHeight===320));
  assert.equal(await page.locator('.chosen').count(),0);assert.equal(await page.locator('#error').textContent(),'');
  assert.equal(await page.evaluate(()=>window.fixtureScope),'https://www.googleapis.com/auth/drive.readonly');
  const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.store);
  assert.equal((await saved()).items.length,10);assert.ok((await saved()).items.filter(x=>x.id!==old.id).every(x=>x.technicalPassed&&x.driveFileId&&!x.touched));
  await page.locator('.card').first().locator('.choices label').nth(1).click();await page.locator('.comment').first().fill('keep this choice');
  const chosen=(await saved()).items.find(x=>x.touched&&x.id!==old.id);
  await load();await page.locator('#drivePending').waitFor({state:'hidden'});
  assert.equal((await saved()).items.length,10);const again=(await saved()).items.find(x=>x.id===chosen.id);assert.equal(again.rating,'h');assert.equal(again.comment,'keep this choice');assert.equal(again.revision,chosen.revision);
  assert.deepEqual((await saved()).items.find(x=>x.id===old.id),old);
  // A failed reconnect must preserve the already loaded images and choice.
  fixture.unauthorized=true;await load();await page.locator('#drivePendingStatus').filter({hasText:'期限'}).waitFor();assert.equal((await saved()).items.length,10);assert.equal((await saved()).items.find(x=>x.id===chosen.id).rating,'h');
  await page.getByRole('button',{name:'閉じる',exact:true}).filter({visible:true}).click();
  fixture.unauthorized=false;await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);assert.equal(await page.locator('.chosen').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sticker-selector-v9')),legacy);assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('pending-fixture-token')),false);
  assert.ok(fixture.calls.every(c=>c.method==='GET'));assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/pending-'+engine+(process.env.TEST_PENDING_MANIFEST?'-private':'')+'.png',fullPage:true});await page.screenshot({path:'test-results/pending-'+engine+'-viewport.png'});
  console.log('PASS '+engine+' Drive pending: Google readonly -> live master + reviewed PNGs -> nine unrated cards; repeat/read/reload retain choices; auth expiry preserves work; no Drive writes or ZIP transfer.');
  await context.close();
 }finally{await browser.close();}
}}finally{await new Promise(ok=>service.server.close(ok));}
