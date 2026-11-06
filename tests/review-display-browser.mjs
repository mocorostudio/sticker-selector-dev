import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {startServer} from './server.mjs';
import {PendingFixture} from './pending-drive-fixture.mjs';
import {SourceFixture} from './source-save-fixture.mjs';
import {storageKeys} from '../integration-v1/session-store.mjs';
import {pngHash} from '../integration-v1/drive-pending.mjs';
import {REVIEW_DISPLAY_SCHEMA} from '../integration-v1/review-display.mjs';
const service=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const raw=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=370;c.height=320;const g=c.getContext('2d');g.fillStyle='#935';g.fillRect(60,60,240,200);return c.toDataURL().split(',')[1];});
 const png=new Uint8Array(Buffer.from(raw,'base64')),f=new PendingFixture();let value,archiveBytes;
 if(process.env.REVIEW_DISPLAY_MANIFEST){
  value=JSON.parse(await fs.readFile(process.env.REVIEW_DISPLAY_MANIFEST,'utf8'));
  f.rows=JSON.parse(await fs.readFile(process.env.REVIEW_DISPLAY_ROWS,'utf8'));
  archiveBytes=new Uint8Array(await fs.readFile(process.env.REVIEW_DISPLAY_ZIP));
 }else{
  await f.setup(png,81);const entries=f.manifest.entries.map((e,i)=>({...e.record,sha256:e.sha256,technicalReview:{status:i<60?'pass':i<63?'hold':'fail',reason:'候補'+(i+1)+'の個別検品理由',recordVersion:'test'}}));
  const z=new JSZip();for(const e of entries)z.file(e.filename,png);archiveBytes=await z.generateAsync({type:'uint8array'});
  value={schema:REVIEW_DISPLAY_SCHEMA,characterId:'char',pendingFolderId:'pending',historyFolderId:'history',approval:'display-only',candidateCount:81,masterReference:'https://docs.google.com/spreadsheets/d/master/edit',masterSheet:'116候補マスター',archive:{fileId:'archive',sha256:await pngHash(archiveBytes)},entries};
 }
 const char=value.characterId,history=value.historyFolderId,master=value.masterReference.match(/\/d\/([-\w]+)/)[1];
 f.folder(char,'確認用キャラ','root');f.folder(value.pendingFolderId,'00_選抜待ち',char);f.folder(history,'03_元画像・生成履歴',char);
 f.folder('review-adopt','01_採用予定',char);f.folder('review-hold','02_保留',char);
 f.files.set(master,{id:master,name:'Master',mimeType:'application/vnd.google-apps.spreadsheet',parents:[char]});
 f.put(value.archive.fileId,'review81.zip',history,'application/zip',archiveBytes);f.put('reviewManifest','selection-review_fixture.json',history,'application/json',new TextEncoder().encode(JSON.stringify(value)));
 const writer=new SourceFixture();writer.files=f.files;writer.blobs=f.media;
 const originalFetch=f.fetch.bind(f);f.fetch=async(url,options)=>{const u=new URL(url);if(u.origin==='https://sheets.googleapis.com'&&!u.pathname.includes('/values/'))return Response.json({spreadsheetId:master,sheets:[{properties:{title:value.masterSheet,gridProperties:{rowCount:200,columnCount:26}}}]});return originalFetch(url,options);};
 const jszip=await fs.readFile(new URL('../node_modules/jszip/dist/jszip.min.js',import.meta.url),'utf8');
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===service.url||u.protocol==='blob:')return route.continue();
  if(req.url()==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'isolated-test',expires_in:3600,scope:o.scope})})}}};"});
  if(req.url().includes('jszip.min.js'))return route.fulfill({contentType:'text/javascript',body:jszip});
  if(['https://www.googleapis.com','https://sheets.googleapis.com'].includes(u.origin)){
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   const opts={method:req.method(),headers:{Authorization:req.headers().authorization,'Content-Type':req.headers()['content-type']},body:new Blob([req.postDataBuffer()||new Uint8Array()])};const r=await (req.method()!=='GET'||u.pathname.endsWith('/about')||u.pathname.endsWith('/generateIds')?writer.fetch(req.url(),opts):f.fetch(req.url(),opts));return route.fulfill({status:r.status,headers:{...Object.fromEntries(r.headers),...cors},body:Buffer.from(await r.arrayBuffer())});
  }return route.abort();
 });
 const keys=storageKeys({workflowLocal:true,pathname:'/integration-v1/workflow.html'}),url=service.url+'/integration-v1/workflow.html?view=selection&character='+char;
 await page.goto(url);await page.locator('#selectionScreen:not([hidden])').waitFor();
 assert.equal(await page.getByRole('button',{name:'Driveから読み込む',exact:true}).count(),1);
 assert.equal(await page.locator('#workflowNextGuide button:visible').count(),0);
 assert.equal(await page.locator('#loadReviewedZip').count(),0);
 assert.equal(await page.locator('#selectionTools').getAttribute('open'),null);assert.equal(await page.locator('label[for=files]').isVisible(),false);
 assert.equal(await page.locator('#background').isVisible(),true);
 const old={id:'crop:old-review',imageId:'old-review',characterId:char,name:'old.png',origin:'crop-local',rating:'x',touched:true,revision:'unsaved-vote',comment:'旧選抜を残す',selectionHistory:[],crop:{history:[]}};
 await page.evaluate(({keys,old})=>localStorage.setItem(keys.store,JSON.stringify({items:[old],background:'checker'})),{keys,old});await page.reload();
 const load=async()=>{await page.locator('#loadPending').click();await page.waitForFunction(()=>!document.querySelector('#pendingConnect').disabled);await page.locator('#pendingConnect').click();await page.locator('#drivePendingProgress').filter({hasText:'読み込みが完了'}).waitFor();};
 await load();await page.waitForFunction(()=>document.querySelectorAll('.card').length===81&&[...document.querySelectorAll('.stage img')].every(x=>x.naturalWidth===370));
 const badges=page.locator('.inspection-summary');await page.waitForFunction(()=>document.querySelectorAll('[data-inspection-status="pass"]').length===60&&document.querySelectorAll('[data-inspection-status="review"]').length===3&&document.querySelectorAll('[data-inspection-status="fail"]').length===18);
 const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.store);
 for(let i=0;i<81;i++)assert.ok((await badges.nth(i).innerText()).includes(value.entries[i].technicalReview.reason));
 assert.deepEqual((await state()).items.find(i=>i.id===old.id),old);assert.equal((await state()).items.length,82);
 const card=page.locator('.card').nth(19);await card.locator('.choices label').nth(1).click();await card.locator('.comment').fill('この選択と理由を保持');
 const choice=(await state()).items.find(i=>i.imageId===value.entries[19].imageId);
 await page.locator('#saveToDrive').click();await page.locator('#driveExportStatus').filter({hasText:'Drive保存・照合が完了しました'}).waitFor();
 assert.equal(writer.posts,1);
 const written=[...f.files.values()].filter(x=>x.name?.startsWith('selection-results_'));assert.equal(written.length,1);
 const savedDocument=JSON.parse(await f.media.get(written[0].id).text());assert.equal(savedDocument.results.length,81);assert.ok(savedDocument.results.every(x=>x.technicalReview.reason&&x.formalApproval===false));
 await page.locator('#driveExport').getByRole('button',{name:'閉じる',exact:true}).click();
 await load();assert.equal((await state()).items.find(i=>i.id===choice.id).revision,choice.revision);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.card').length===81);await page.locator('.card').nth(19).locator('.choices label.chosen').waitFor();
 assert.equal(await page.locator('.card').nth(19).locator('.comment').inputValue(),'この選択と理由を保持');assert.deepEqual((await state()).items.find(i=>i.id===old.id),old);
 assert.ok((await state()).items.filter(i=>i.id!==old.id).every(i=>!i.technicalPassed));
 await page.evaluate(({key,old})=>localStorage.setItem(key,JSON.stringify({items:[old],background:'checker'})),{key:keys.store,old});await page.reload();await load();
 await page.locator('.card').nth(19).locator('.choices label.chosen').waitFor();assert.equal(await page.locator('.card').nth(19).locator('.comment').inputValue(),'この選択と理由を保持');
 await page.waitForFunction(()=>document.querySelectorAll('.inspection-summary[data-inspection-status=fail]').length===18);assert.equal(await page.locator('.inspection-summary[data-inspection-status=fail]').count(),18);assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(errors,[]);
 await fs.mkdir('test-results',{recursive:true});await page.locator('.card').nth(19).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/review81-phone.png'});
 console.log('PASS: actual loader -> 81 cards (60 pass, 3 hold, 18 fail), every reason, one Drive entry, preferences saved/read back in isolated Drive, old votes preserved; no image writes or formal promotion.');
}finally{await browser?.close();await new Promise(r=>service.server.close(r));}
