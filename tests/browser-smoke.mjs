import {GoogleRestFixture} from './google-drive-fixture.mjs';
import { chromium,webkit } from 'playwright';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {readFile,mkdir} from 'node:fs/promises';
import {startServer} from './server.mjs';
import {png} from './mock-drive.mjs';
const service=await startServer();
let failed=0,passed=0;
async function scenario(browser,name,fn){service.reset();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);const rest=new GoogleRestFixture();page.on('pageerror',e=>errors.push(e.message));
 // Network allowlist: tests cannot contact Google or any external host.
 await context.route('**/*',async r=>{if(r.request().url()==='https://accounts.google.com/gsi/client')return r.fulfill({contentType:'text/javascript',body: `window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test-token',expires_in:3600})})}}}`});
 if(['https://www.googleapis.com','https://sheets.googleapis.com'].includes(new URL(r.request().url()).origin)){const request=r.request();if(request.method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'}});const response=await rest.fetch(request.url(),{method:request.method(),headers:{Authorization:request.headers()['authorization'],'Content-Type':request.headers()['content-type']},body:request.postData()});return r.fulfill({status:response.status,headers:{...Object.fromEntries(response.headers.entries()),'Access-Control-Allow-Origin':'*'},body:Buffer.from(await response.arrayBuffer())})}
 if(r.request().url()==='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')return r.fulfill({contentType:'text/javascript',body:await readFile('node_modules/jszip/dist/jszip.min.js')});return new URL(r.request().url()).origin===service.url?r.continue():r.abort()});
 page.on('dialog',d=>d.accept());
 try{await page.goto(service.url+(name.includes('Google REST')?'/?drive=test':'/?mock=1'));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('表示'));await fn(page,rest);assert.deepEqual(errors,[]);console.log('PASS',name);passed++}
 catch(e){failed++;console.error('FAIL',name,e,'UI:',await page.locator('#error').textContent(),await page.locator('#driveStatus').textContent());await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/'+name.replaceAll(/[^\w-]/g,'_')+'.png',fullPage:true}).catch(()=>{})}
 finally{await context.close()}}
try{for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
 await scenario(browser,engine+' phone load/rate/background/reload/sync',async page=>{
  await page.locator('#loadPending').click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===3);
  await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(x=>x.complete&&x.naturalWidth>0));
  assert.equal(service.drive.events.size,0);assert.ok(service.drive.calls.every(c=>!c.startsWith('save:')&&!c.startsWith('move:')));
  await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('対象の評価済み画像'));
  for(let i=0;i<3;i++)await page.locator('.card').nth(i).locator('.choices label').nth(i).click();
  await page.locator('.comment').first().fill('履歴を保持');
  await page.locator('.card').first().getByRole('button',{name:'黒',exact:true}).click();
  await page.locator('.stage img').first().click();assert.ok(await page.locator('#zoom').isVisible());await page.locator('#close').click();
  assert.equal(service.drive.events.size,0);
  await page.reload();await page.locator('.card').first().waitFor();
  assert.equal(await page.locator('.chosen').count(),3);assert.equal(await page.locator('.comment').first().inputValue(),'履歴を保持');assert.match(await page.locator('.stage').first().getAttribute('class'),/black/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#syncCount').textContent(),'確定する画像：3枚');
  // The confirmation stays reachable at either end, without covering the final comment.
  for(const atBottom of [false,true]){
   await page.evaluate(bottom=>window.scrollTo(0,bottom?document.body.scrollHeight:0),atBottom);
   await page.waitForTimeout(100);
   const layout=await page.evaluate(()=>({bar:document.querySelector('#syncBar').getBoundingClientRect().toJSON(),button:document.querySelector('#sync').getBoundingClientRect().toJSON(),last:document.querySelector('.card:last-child').getBoundingClientRect().toJSON(),height:innerHeight}));
   assert.ok(layout.button.top>=0&&layout.button.bottom<=layout.height);
   assert.ok(Math.abs(layout.bar.bottom-layout.height)<2);
   if(atBottom)assert.ok(layout.last.bottom<=layout.bar.top);
  }
  await page.screenshot({path:'test-results/'+engine+'-bottom-actions.png'});
  await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('同期 3件'));
  assert.equal(service.drive.events.size,3);assert.deepEqual(service.drive.rows.map(x=>x.folder),['adopt','hold','pending']);
  await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('一致 3件'));assert.equal(service.drive.events.size,3);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/'+engine+'-iphone.png',fullPage:true});
 });
 await scenario(browser,engine+' partial failure and reload resume',async page=>{
  await page.locator('#loadPending').click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===3);
  for(let i=0;i<3;i++)await page.locator('.card').nth(i).locator('.choices label').nth(i).click();
  service.drive.fail='save:image-0:after';await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('失敗 1件'));
  assert.equal(service.drive.rows.filter(x=>x.confirmed).length,3);
  await page.reload();await page.locator('.card').first().waitFor();await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('同期 1件／一致 2件／失敗 0件'));
  assert.equal(service.drive.events.size,3);assert.ok([...service.drive.events.values()].every(x=>x.status==='complete'));
 });
 await scenario(browser,engine+' per-image read failure, untested and ambiguous ID',async page=>{
  service.drive.rows[0].technicalPassed=false;service.drive.files.get('file-1').name='wrong.png';
  await page.locator('#loadPending').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('失敗 2件'));assert.equal(await page.locator('.card').count(),1);
  assert.equal(service.drive.events.size,0);
 });
 await scenario(browser,engine+' local PNG failure isolation and duplicate retention',async page=>{
  await page.locator('summary').click();
  await page.locator('#files').setInputFiles([{name:'bad.png',mimeType:'image/png',buffer:Buffer.from('invalid')},{name:'good.png',mimeType:'image/png',buffer:png}]);
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===1);await page.locator('.choices label').nth(1).click();
  await page.locator('#files').setInputFiles({name:'good.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!document.querySelector('#files').disabled);
  assert.equal(await page.locator('.card').count(),1);assert.equal(await page.locator('.chosen').textContent(),'△');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sticker-selector-v9')).items[0].id);
  await page.reload();await page.locator('.card').waitFor();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('sticker-selector-v9')).items[0].id);assert.equal(before,after);
 });
 await scenario(browser,engine+' 130-PNG ZIP import/reimport/export',async page=>{
  const zip=new JSZip();for(let i=0;i<130;i++)zip.file('set/ZIP'+i+'.png',png);zip.file('set/bad.png','broken image');
  const buffer=await zip.generateAsync({type:'nodebuffer'});
  await page.locator('summary').click();await page.locator('#files').setInputFiles({name:'batch.zip',mimeType:'application/zip',buffer});
  await page.waitForFunction(()=>document.querySelectorAll('.card').length===130,{},{timeout:30000});
  assert.match(await page.locator('#error').textContent(),/bad.png/);
  await page.locator('.card').nth(129).locator('.choices label').nth(2).click();
  await page.locator('#files').setInputFiles({name:'batch.zip',mimeType:'application/zip',buffer});
  await page.waitForFunction(()=>!document.querySelector('#files').disabled,{},{timeout:30000});
  assert.equal(await page.locator('.card').count(),130);assert.equal(await page.locator('.chosen').textContent(),'✕');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#json').click()]);
  const data=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(data.items.length,130);assert.equal(data.items.filter(x=>x.confirmed).length,1);assert.equal(data.drive_synced,false);
 });
 await scenario(browser,engine+' Google REST OAuth/read/sync/reload',async(page,rest)=>{
  await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('Google認証の準備'));
  assert.equal(rest.writes().length,0);
  await page.locator('#loadPending').click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===3);
  assert.equal(rest.writes().length,0);
  await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(x=>x.complete&&x.naturalWidth>0));
  for(let i=0;i<3;i++)await page.locator('.card').nth(i).locator('.choices label').nth(i).click();
  assert.equal(rest.writes().length,0);
  await page.locator('#sync').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('同期 3件／一致 0件／失敗 0件'));
  assert.equal([...rest.files.values()].filter(f=>f.data).length,9);
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('test-token')),false);
  await page.reload();await page.locator('.card').first().waitFor();await page.locator('#sync').click();
  await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('同期 0件／一致 3件／失敗 0件'));
  assert.equal([...rest.files.values()].filter(f=>f.data).length,9);
 });
 await scenario(browser,engine+' Google REST legacy isolation and exact draft recovery',async(page,rest)=>{
  const row=rest.rows[3];
  const draft={id:row[1],imageId:row[1],candidate:row[0],attemptId:row[1],driveFileId:row[7],name:'v9_test_03.png',rating:'x',touched:true,revision:'legacy-revision',comment:'未同期の評価'};
  const legacy=JSON.stringify({items:[...Array.from({length:38},(_,i)=>({id:'old-'+i,name:'v9_test_06.png',rating:'h',touched:true})),draft],background:'black'});
  await page.evaluate(value=>{localStorage.setItem('sticker-selector-v9',value);localStorage.setItem('sticker-selector-v9-visible-ids',JSON.stringify(['old-0','old-1','old-2','old-3','old-4','old-5','old-6']))},legacy);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('表示0枚'));
  assert.equal(await page.locator('.card').count(),0);
  await page.locator('#loadPending').click();await page.waitForFunction(()=>document.querySelectorAll('.card').length===3);
  await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(x=>x.complete&&x.naturalWidth>0));
  assert.equal(await page.locator('.card').nth(2).locator('.chosen').textContent(),'✕');
  assert.equal(await page.locator('.card').nth(2).locator('.comment').inputValue(),'未同期の評価');
  await page.locator('.card').first().locator('.choices label').first().click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sticker-selector-v9')),legacy);
  assert.equal(rest.writes().length,0);
 });
 await scenario(browser,engine+' Google REST legacy image ID conflict stays preserved and loads cleanly',async(page,rest)=>{
  const row=rest.rows[3];
  const legacy=JSON.stringify({items:[...Array.from({length:38},(_,i)=>({id:'old-'+i,name:'old.png',rating:'o',touched:true})),{id:row[1],name:'v9_test_03.png',rating:'h',touched:true}],background:'black'});
  await page.evaluate(value=>localStorage.setItem('sticker-selector-v9',value),legacy);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('表示0枚'));
  await page.locator('#loadPending').click();
  await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('読込 3枚／失敗 0件'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(x=>x.complete&&x.naturalWidth>0));
  assert.equal(await page.locator('.card').count(),3);assert.equal(await page.locator('.chosen').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sticker-selector-v9')),legacy);
  assert.equal(rest.writes().length,0);
 });
 }finally{await browser.close()}
}}finally{await new Promise(resolve=>service.server.close(resolve))}
console.log('Browser scenarios: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
