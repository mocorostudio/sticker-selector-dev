import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startServer} from './server.mjs';
import {SourceFixture} from './source-save-fixture.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';
import {storageKeys} from '../integration-v1/session-store.mjs';
const server=await startServer(),browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const fixture=await new PendingFixture().setup(new Uint8Array(24));fixture.folder('other','06_隔離テスト','root');fixture.folder('other_pending','00_選抜待ち','other');fixture.files.get('master').modifiedTime='2026-11-03T00:00:00Z';for(const [id,name] of [['adopt','01_採用予定'],['hold','02_保留'],['application','04_申請用']])fixture.folder(id,name,'char');for(const [id,file] of fixture.files)if(file.mimeType==='image/png'||id==='manifest'){fixture.files.delete(id);fixture.media.delete(id);}const writer=new SourceFixture();writer.files=fixture.files;writer.blobs=fixture.media;
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());if(u.origin===server.url||u.protocol==='blob:')return route.continue();
  if(r.url()==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'fixture-only',expires_in:3600,scope:o.scope})})}}};"});
  if(['https://www.googleapis.com','https://sheets.googleapis.com'].includes(u.origin)){
   const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'};
   if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const options={method:r.method(),headers:{Authorization:r.headers().authorization,'Content-Type':r.headers()['content-type']},body:new Blob([r.postDataBuffer()||new Uint8Array()])};const response=await (r.method()!=='GET'||u.pathname.endsWith('/about')||u.pathname.endsWith('/generateIds')?writer.fetch(r.url(),options):fixture.fetch(r.url(),options));return route.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers.entries()),...headers},body:Buffer.from(await response.arrayBuffer())});
  }return route.abort();
 });
 await page.goto(server.url+'/integration-v1/workflow.html?character=char');const crop=page.frameLocator('#cropFrame');await crop.locator('#handoff').waitFor({state:'attached'});
 await page.locator('#loadPending').click();await page.locator('#pendingConnect').click();await page.locator('#pendingCharacter').waitFor();await page.locator('#drivePending').getByRole('button',{name:'閉じる',exact:true}).click();
 await page.locator('#cropTab').click();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const g=c.getContext('2d');g.fillStyle='#dd6699';for(const y of [100,300,500])for(const x of [100,300,500])g.fillRect(x-35,y-35,70,70);return c.toDataURL().split(',')[1];});
 await crop.locator('#files').setInputFiles({name:'real-rgba-nine.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await crop.locator('#run').click();
 await page.locator('#selectionScreen:not([hidden])').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
 await page.locator('.choices label').nth(1).click();
 const keys=storageKeys({workflowLocal:true,pathname:'/integration-v1/workflow.html'});
 const snapshot=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).items,keys.store);
 const initial=await snapshot();assert.equal(initial.length,9);
 async function choose(){await page.locator('#cropTab').click();await crop.locator('#formalHandoff').click();const dialog=crop.locator('dialog').filter({hasText:'9セルと最新マスター'});await dialog.waitFor();assert.equal(await dialog.locator('canvas').count(),9);for(let i=0;i<9;i++)await dialog.locator('select').nth(i).selectOption('D'+String(i+1).padStart(2,'0'));await dialog.getByRole('button',{name:'割当を照合して正式送信'}).click();}
 await choose();await page.locator('#inspectionPanel[open]').waitFor();
 const assigned=await snapshot();assert.ok(assigned.every(i=>i.technicalPassed!==true));assert.equal(assigned[0].rating,initial[0].rating);assert.equal(assigned[0].touched,initial[0].touched);
 // Genuine UI visual checks for synthetic squares only; this does not certify artwork.
 for(let i=0;i<9;i++){
  await page.locator('#inspectionImage').selectOption(assigned[i].id);await page.locator('#inspectionPreview').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#inspectionPass').disabled);
  for(const check of await page.locator('#inspectionChecks input').all())await check.check();
  await page.locator('#inspectionPass').click();await page.locator('#inspectionResult').filter({hasText:'記録しました'}).waitFor();
 }
 await page.locator('#inspectionClose').click();await choose();await crop.locator('#status').filter({hasText:'正式照合送信完了：9件'}).waitFor({state:'attached'});
 let saved=await snapshot();assert.equal(saved.length,9);assert.ok(saved.every(i=>i.technicalPassed===true&&i.candidateManifest.entries.length===9));
 assert.equal(saved[0].rating,initial[0].rating);assert.equal(saved[0].touched,initial[0].touched);
 await choose();await crop.locator('#status').filter({hasText:'正式照合送信完了：9件'}).waitFor({state:'attached'});assert.equal((await snapshot()).length,9);
 await page.locator('#selectionTab').click();await page.locator('#saveToDrive').click();await page.locator('#driveExportStatus').filter({hasText:'Drive保存・照合が完了しました'}).waitFor();
 assert.ok((await snapshot()).every(i=>i.formalDriveRegistration?.fileId));assert.equal([...fixture.files.values()].filter(f=>f.parents?.[0]==='pending'&&f.mimeType==='image/png').length,9);
 assert.equal([...fixture.files.values()].filter(f=>f.name?.startsWith('selection-manifest_')).length,1); // one verified manifest; no duplicate registration
 await page.locator('#driveExport').getByRole('button',{name:'閉じる',exact:true}).click();
 await page.reload();await crop.locator('#handoff').waitFor({state:'attached'});saved=await snapshot();assert.ok(saved.every(i=>i.inspectionAudit.decision==='pass'&&i.technicalPassed));
 // Tampering with the persisted visual audit must stop a repeated formal handoff.
 await page.evaluate(key=>{const v=JSON.parse(localStorage.getItem(key));v.items[0].inspectionAudit.checks[0]=false;localStorage.setItem(key,JSON.stringify(v));},keys.store);
 await page.reload();await crop.locator('#handoff').waitFor({state:'attached'});await page.locator('#loadPending').click();await page.locator('#pendingConnect').click();await page.locator('#pendingCharacter').waitFor();await page.locator('#drivePending').getByRole('button',{name:'閉じる',exact:true}).click();
 await choose();await crop.locator('#status').filter({hasText:'正式引き渡し停止'}).waitFor();assert.equal((await snapshot()).length,9);
 assert.deepEqual(errors,[]);assert.ok(fixture.calls.every(c=>c.method==='GET'));assert.ok(writer.posts>=10);
 console.log('PASS audited formal browser: actual RGBA 3x3, nine UI assignments, uninspected stop, visual evidence, formal promotion, duplicate resend, IndexedDB reload, vote preservation, tampered audit rejection; mock Drive pending save/readback plus selection export');
 await context.close();
}catch(error){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error('PARENT',await p.locator('body').innerText().catch(()=>''));for(const f of p.frames().filter(f=>f.url().includes('/crop-v9/')))console.error('CROP',await f.locator('body').innerText().catch(()=>''));await mkdir('test-results',{recursive:true});await p.screenshot({path:'test-results/audited-formal-failure.png',fullPage:true}).catch(()=>{});}throw error;}finally{await browser.close();await new Promise(r=>server.server.close(r));}
