import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {startServer} from './server.mjs';
import {SourceFixture} from './source-save-fixture.mjs';
const service=await startServer();
try{for(const [name,type] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.TEST_BROWSER||process.env.TEST_BROWSER===name)){
 const browser=await type.launch({headless:true,...(name==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}: {})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),remote=new SourceFixture(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.url()==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'fixture',scope:o.scope,expires_in:3600})})}}}"});
   if(url.origin==='https://www.googleapis.com')return route.abort(); // no external API request may escape the fixture
   if(req.url()==='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')return route.fulfill({contentType:'text/javascript',body:await readFile('node_modules/jszip/dist/jszip.min.js')});
   return url.origin===service.url?route.continue():route.abort();
  });
  // WebKit's route API may omit streamed Blob request bodies. Pass exact Blob bytes
  // through a browser binding instead, so both engines test the same transport payload.
  await page.exposeBinding('sourceFixtureFetch',async(_source,request)=>{
   const response=await remote.fetch(request.url,{method:request.method,headers:request.headers,body:new Blob([new Uint8Array(request.body)])});
   return {status:response.status,headers:Object.fromEntries(response.headers),body:[...new Uint8Array(await response.arrayBuffer())]};
  });
  await page.addInitScript(()=>{
   const original=window.fetch.bind(window);
   window.fetch=async(input,options={})=>{
    if(typeof input==='string'&&input.startsWith('https://www.googleapis.com/')){
     const response=await window.sourceFixtureFetch({url:input,method:options.method||'GET',headers:options.headers||{},body:options.body?[...new Uint8Array(await options.body.arrayBuffer())]:[]});
     return new Response(new Uint8Array(response.body),{status:response.status,headers:response.headers});
    }
    return original(input,options);
   };
  });
  await page.goto(service.url+'/integration-v1/workflow.html');
  const frame=page.frameLocator('#cropFrame');await frame.locator('#sourceSave').waitFor({state:'attached'});
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const ctx=c.getContext('2d');ctx.fillStyle='#795939';for(let y=0;y<3;y++)for(let x=0;x<3;x++)ctx.fillRect(55+x*200,55+y*200,90,90);return c.toDataURL().split(',')[1];});
  const bytes=Buffer.from(png,'base64');await frame.locator('#files').setInputFiles({name:'synthetic-grid.png',mimeType:'image/png',buffer:bytes});
  await frame.getByText('3×3元画像PNGをDriveに保存',{exact:true}).click();
  await frame.locator('#sourceCharacter').fill('https://drive.google.com/drive/folders/char');
  await frame.locator('#sourceConnect').click();await frame.locator('#sourceSave').waitFor({state:'visible'});
  await frame.locator('#sourceSave').click();await frame.locator('#sourceSaveStatus').filter({hasText:'保存照合済み 1枚'}).waitFor();
  assert.equal(remote.posts,1);assert.deepEqual(Buffer.from(await remote.blobs.get('new1').arrayBuffer()),bytes);
  await frame.locator('#sourceSave').click();await frame.locator('#sourceSaveStatus').filter({hasText:'保存照合済み 1枚'}).waitFor();assert.equal(remote.posts,1);
  await frame.locator('#run').click();await frame.locator('#handoff').filter({hasText:'全9枚'}).waitFor();
  const qa=await page.frames().find(f=>f.url().includes('/crop-v9/')).evaluate(async()=>{const names=await indexedDB.databases(),name=names.find(x=>x.name.startsWith('sticker-crop-v9:workflow:')).name;const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>{db.close();resolve(r.result.records.map(x=>({qa:x.qa,review:x.review})));};});});
  assert.equal(qa.length,9);assert.ok(qa.every(x=>x.qa.automatic==='pass'&&x.review.length===0));
  await frame.locator('#handoff').click();await page.locator('#selectionScreen').waitFor({state:'visible'});assert.equal(await page.locator('.card').count(),9);
  assert.ok((await page.locator('#list').innerText()).includes('未')); // drafts are never technical approvals
  await page.locator('.choices label').first().click();
  await page.locator('#sync').click();await page.locator('#selectionComplete').waitFor({state:'visible'});
  assert.match(await page.locator('#selectionComplete').innerText(),/保存しました/);
  await page.reload();await page.locator('#selectionTab').click();assert.equal(await page.locator('.card').count(),9);
  assert.equal(remote.posts,1);assert.deepEqual(errors,[]);
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/integration-'+name+'.png',fullPage:true});
  console.log('PASS',name,'source save/readback/retry → crop 9 → automatic QA pending visual review → selection → reload');await context.close();
 }catch(e){console.error('Integration browser failure:',name,e);for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(await p.locator('body').innerText().catch(()=>''));await mkdir('test-results',{recursive:true});await p.screenshot({path:'test-results/integration-failed-'+name+'.png',fullPage:true}).catch(()=>{});}throw e;}finally{await browser.close();}
}}finally{service.server.close();}
