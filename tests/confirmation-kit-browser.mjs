import {chromium,webkit} from 'playwright';
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
 browser=await (process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...(process.env.TEST_BROWSER==='webkit'?{}:{executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']})});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const raw=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=370;c.height=320;const g=c.getContext('2d');g.fillStyle='#935';g.fillRect(60,60,240,200);return c.toDataURL().split(',')[1];});
 const png=new Uint8Array(Buffer.from(raw,'base64')),f=new PendingFixture();let value,archiveBytes,generatedVariantSheets=null;
 if(process.env.REVIEW_DISPLAY_MANIFEST){
  value=JSON.parse(await fs.readFile(process.env.REVIEW_DISPLAY_MANIFEST,'utf8'));
  f.rows=JSON.parse(await fs.readFile(process.env.REVIEW_DISPLAY_ROWS,'utf8'));
  archiveBytes=new Uint8Array(await fs.readFile(process.env.REVIEW_DISPLAY_ZIP));
 }else{
  await f.setup(png,81);const unique=await page.evaluate(n=>Array.from({length:n},(_,i)=>{const c=document.createElement('canvas');c.width=370;c.height=320;const g=c.getContext('2d');g.fillStyle='rgb('+(80+i)+',60,50)';g.fillRect(60,60,240,200);return c.toDataURL().split(',')[1];}),process.env.REVIEW_VARIANTS_TEST?90:81);const entries=await Promise.all(f.manifest.entries.map(async(e,i)=>({...e.record,sha256:await pngHash(new Uint8Array(Buffer.from(unique[i],'base64'))),technicalReview:{status:i<60?'pass':i<63?'hold':'fail',reason:'候補'+(i+1)+'の個別検品理由',recordVersion:'test'}})));
  if(process.env.REVIEW_VARIANTS_TEST){
   entries.forEach((e,i)=>{e.trialId='B01_T01';e.technicalReview.status=i<74?'pass':'hold';});
   const extra=entries.slice(0,9).map((e,i)=>({...e,imageId:'variant_'+i,filename:'variant_'+i+'.png',trialId:'R01_T02',masterSheet:'差替候補_test',candidateId:i===8?'D82':e.candidateId,phrase:i===8?'新年おめでとうございます':e.phrase,pose:'冬小物 '+i,sourceId:'regen',previousCandidateId:e.candidateId,changeReason:'クリスマスから冬の小物へ',sha256:'',technicalReview:{status:'pass',reason:'差替版の個別確認理由',recordVersion:'test'}}));
   for(const [i,e] of extra.entries())e.sha256=await pngHash(new Uint8Array(Buffer.from(unique[81+i],'base64')));
   entries.push(...extra);generatedVariantSheets={'116候補マスター':f.rows,'差替候補_test':[['再生成群','候補ID','旧候補ID','セリフ','変更後デザイン','元画像ID'],...extra.map(e=>[e.trialId,e.candidateId,e.previousCandidateId,e.phrase,e.pose,e.sourceId])]};
  }
  const z=new JSZip();for(const [i,e] of entries.entries())z.file(e.filename,Buffer.from(unique[i],'base64'));archiveBytes=await z.generateAsync({type:'uint8array'});
  value={schema:REVIEW_DISPLAY_SCHEMA,characterId:'char',pendingFolderId:'pending',historyFolderId:'history',approval:'display-only',candidateCount:entries.length,masterReference:'https://docs.google.com/spreadsheets/d/master/edit',masterSheet:'116候補マスター',archive:{fileId:'archive',sha256:await pngHash(archiveBytes)},entries};
 }
 const nativeSheets=process.env.REVIEW_DISPLAY_SHEETS?JSON.parse(await fs.readFile(process.env.REVIEW_DISPLAY_SHEETS,'utf8')):generatedVariantSheets;
 const cohortCount=value.entries.length,counts={pass:0,review:0,fail:0};for(const e of value.entries)counts[e.technicalReview.status==='hold'?'review':e.technicalReview.status]++;
 const char=value.characterId,history=value.historyFolderId,master=value.masterReference.match(/\/d\/([-\w]+)/)[1];
 f.folder(char,'確認用キャラ','root');f.folder(value.pendingFolderId,'00_選抜待ち',char);f.folder(history,'03_元画像・生成履歴',char);
 f.folder('application','04_申請用',char);f.folder('review-adopt','01_採用予定',char);f.folder('review-hold','02_保留',char);
 f.files.set(master,{id:master,name:'Master',mimeType:'application/vnd.google-apps.spreadsheet',parents:[char]});
 f.put(value.archive.fileId,'review81.zip',history,'application/zip',archiveBytes);f.put('reviewManifest','selection-review_fixture.json',history,'application/json',new TextEncoder().encode(JSON.stringify(value)));
 const writer=new SourceFixture();writer.files=f.files;writer.blobs=f.media;
 let pauseComponent=false,releaseComponent;const writeFetch=writer.fetch.bind(writer);writer.fetch=async(url,options)=>{if(pauseComponent&&new URL(url).pathname.startsWith('/upload/')){pauseComponent=false;await new Promise(resolve=>releaseComponent=resolve);}return writeFetch(url,options);};
 const originalFetch=f.fetch.bind(f);f.fetch=async(url,options)=>{const u=new URL(url);if(u.origin==='https://sheets.googleapis.com'){if(!u.pathname.includes('/values/'))return Response.json({spreadsheetId:master,sheets:(nativeSheets?Object.keys(nativeSheets):[value.masterSheet]).map(title=>({properties:{title,gridProperties:{rowCount:200,columnCount:26}}}))});if(nativeSheets){const range=decodeURIComponent(u.pathname.split('/values/')[1]),name=range.match(/^'((?:''|[^'])+)'!/)?.[1]?.replaceAll("''","'");return Response.json({values:nativeSheets[name]||[]});}}return originalFetch(url,options);};
 const jszip=await fs.readFile(new URL('../node_modules/jszip/dist/jszip.min.js',import.meta.url),'utf8');
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===service.url||u.protocol==='blob:')return route.continue();
  if(req.url()==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'isolated-test',expires_in:3600,scope:o.scope})})}}};"});
  if(req.url().includes('jszip.min.js'))return route.fulfill({contentType:'text/javascript',body:jszip});
  if(['https://www.googleapis.com','https://sheets.googleapis.com'].includes(u.origin)){
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   const opts={method:req.method(),headers:{Authorization:req.headers().authorization,'Content-Type':req.headers()['content-type']},body:new Blob([req.postDataBuffer()||new Uint8Array()])};let r;try{r=await (req.method()!=='GET'||u.pathname.endsWith('/about')||u.pathname.endsWith('/generateIds')?writer.fetch(req.url(),opts):f.fetch(req.url(),opts));}catch{return route.abort('failed');}return route.fulfill({status:r.status,headers:{...Object.fromEntries(r.headers),...cors},body:Buffer.from(await r.arrayBuffer())});
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
 await load();await page.waitForFunction(n=>document.querySelectorAll('.card').length===n&&[...document.querySelectorAll('.stage img')].every(x=>x.naturalWidth===370),cohortCount);
 if(nativeSheets){assert.equal(await page.locator('.trial-identity').count(),cohortCount);for(const [i,e] of value.entries.entries()){assert.ok((await page.locator('.trial-identity').nth(i).innerText()).includes(e.trialId));}}
 const badges=page.locator('.inspection-summary');await page.waitForFunction(c=>['pass','review','fail'].every(k=>document.querySelectorAll('[data-inspection-status='+k+']').length===c[k]),counts);
 const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),keys.store);
 for(let i=0;i<cohortCount;i++){if(value.entries[i].technicalReview.status==='pass')assert.equal((await badges.nth(i).innerText()).trim(),'合格');else assert.ok((await badges.nth(i).innerText()).includes(value.entries[i].technicalReview.reason));}
 assert.deepEqual((await state()).items.find(i=>i.id===old.id),old);assert.equal((await state()).items.length,cohortCount+1);
 const card=page.locator('.card').nth(19);await card.locator('.choices label').nth(1).click();await card.locator('.comment').fill('この選択と理由を保持');
 const choice=(await state()).items.find(i=>i.imageId===value.entries[19].imageId);
 await page.locator('#saveToDrive').click();await page.locator('#driveExportStatus').filter({hasText:'Drive保存・照合が完了しました'}).waitFor();
 assert.equal(writer.posts,1);
 const written=[...f.files.values()].filter(x=>x.name?.startsWith('selection-results_'));assert.equal(written.length,1);
 const savedDocument=JSON.parse(await f.media.get(written[0].id).text());assert.equal(savedDocument.results.length,cohortCount);assert.ok(savedDocument.results.every(x=>x.technicalReview.reason&&x.formalApproval===false));
 await page.locator('#driveExport').getByRole('button',{name:'閉じる',exact:true}).click();
 await load();assert.equal((await state()).items.find(i=>i.id===choice.id).revision,choice.revision);
 await page.reload();await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,cohortCount);await page.locator('.card').nth(19).locator('.choices label.chosen').waitFor();
 assert.equal(await page.locator('.card').nth(19).locator('.comment').inputValue(),'この選択と理由を保持');assert.deepEqual((await state()).items.find(i=>i.id===old.id),old);
 assert.ok((await state()).items.filter(i=>i.id!==old.id).every(i=>!i.technicalPassed));
 await page.evaluate(({key,old})=>localStorage.setItem(key,JSON.stringify({items:[old],background:'checker'})),{key:keys.store,old});await page.reload();await load();
 await page.locator('.card').nth(19).locator('.choices label.chosen').waitFor();assert.equal(await page.locator('.card').nth(19).locator('.comment').inputValue(),'この選択と理由を保持');
 await page.waitForFunction(n=>document.querySelectorAll('.inspection-summary[data-inspection-status=fail]').length===n,counts.fail);assert.equal(await page.locator('.inspection-summary[data-inspection-status=fail]').count(),counts.fail);assert.ok(f.calls.every(c=>c.method==='GET'));assert.deepEqual(errors,[]);
 // Isolated confirmation package: retain fail/hold and exact edited state.
 const chosenEntries=value.entries.slice(41,81);chosenEntries[0]=value.entries[23];
 const order=chosenEntries.map(e=>e.imageId).reverse(),key='submission-trial-draft:/integration-v1/workflow.html:'+char;
 const draft={sets:[{id:'confirm-set',name:'確認セット',target:40}],assignments:Object.fromEntries(order.map(id=>[id,'confirm-set'])),orders:{'confirm-set':order},artwork:{'confirm-set':{mainId:order[0],tabId:order[1],strokes:[{radius:4,points:[[.5,.5]]}]}},selectionRatings:Object.fromEntries(value.entries.map(e=>[e.imageId,order.includes(e.imageId)?'o':'x'])),seenCandidateIds:value.entries.map(e=>e.imageId)};
 await page.evaluate(({store,key,draft,order})=>{const s=JSON.parse(localStorage.getItem(store));for(const i of s.items){if(i.crop?.reviewDisplay){i.rating=order.includes(i.imageId)?'o':'x';i.touched=true;i.comment='確認用保存 '+i.candidate;}}localStorage.setItem(store,JSON.stringify(s));localStorage.setItem(key,JSON.stringify({draft,operation:null}));},{store:keys.store,key,draft,order});
 await page.reload();await page.locator('#submissionTab').click();await page.locator('#submissionWorkspace:not([hidden])').waitFor();
 await page.waitForFunction(()=>!document.querySelector('#submissionKit').disabled);
 assert.match(await page.locator('#submissionReadiness').innerText(),/技術承認・LINE申請可能を意味しません/);
 const before=await page.evaluate(({store,key})=>({votes:localStorage.getItem(store),draft:JSON.parse(localStorage.getItem(key)).draft}),{store:keys.store,key});
 writer.lose=true;await page.locator('#submissionKit').click();await page.locator('#submissionZipRetry:visible').waitFor();pauseComponent=true;await page.locator('#submissionZipRetry').click();await new Promise((resolve,reject)=>{const start=Date.now(),poll=()=>releaseComponent?resolve():Date.now()-start>15000?reject(Error('PNG upload was not paused')):setTimeout(poll,20);poll();});await page.locator('#submissionZipActivityText').filter({hasText:'順番・判定理由の記録を保存・照合中'}).waitFor();assert.match(await page.locator('#submissionStatus').innerText(),/順番・判定理由の記録を保存・照合中/);assert.equal(await page.locator('#submissionZipActivity progress').getAttribute('value'),null);assert.equal(await page.locator('#submissionZipActivity progress').getAttribute('max'),'1');releaseComponent();
 await page.locator('#submissionZipActivityText').filter({hasText:'確認用一式の保存・照合が完了'}).waitFor();
 const components=[...f.files.values()].filter(x=>x.name?.startsWith('CONFIRM_'));assert.equal(components.length,0);assert.ok(components.every(x=>x.parents[0]==='application'&&x.appProperties.technicalStatus==='review'));
 const manifest=[...f.files.values()].find(x=>x.name?.startsWith('application-kit_')),record=JSON.parse(await f.media.get(manifest.id).text());assert.equal(record.confirmationOnly,true);assert.equal(record.technicalApproval,false);assert.equal(record.selectionRecords.filter(x=>x.crop?.reviewDisplay).length,cohortCount);assert.deepEqual(record.selectionSnapshot,before.draft);assert.deepEqual(record.archives[0].mapping.map(x=>x.imageId),order);assert.ok(record.archives[0].mapping.some(x=>x.technicalReview.reason));assert.ok(record.selectionRecords.some(x=>x.crop?.displayReview?.status==='hold'));
 if(nativeSheets){assert.equal((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).items.filter(i=>i.crop?.trialId).length,keys.store)),cohortCount);const stored=(await state()).items;for(const e of value.entries){const i=stored.find(i=>i.imageId===e.imageId);assert.equal(i.crop.trialId,e.trialId);assert.equal(i.crop.displayReview.status,e.technicalReview.status);}}
 const archive=[...f.files.values()].find(x=>x.name?.startsWith('REVIEW_application_')),zip=await JSZip.loadAsync(await f.media.get(archive.id).arrayBuffer());assert.equal(Object.keys(zip.files).length,42);
 for(const e of [...record.archives[0].mapping,...record.archives[0].artwork]){const bytes=await zip.file(e.filename).async('uint8array');assert.equal(await pngHash(bytes),e.sha256);const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),spec=e.filename==='main.png'?[240,240]:e.filename==='tab.png'?[96,74]:[370,320];assert.equal(header.getUint32(16),spec[0]);assert.equal(header.getUint32(20),spec[1]);assert.equal(bytes[25],6);const pixels=await page.evaluate(async raw=>{const im=await createImageBitmap(new Blob([new Uint8Array(raw)],{type:'image/png'})),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let visible=0,transparent=0,border=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const a=d[(y*c.width+x)*4+3];if(a)visible++;else transparent++;if(x===0||y===0||x===c.width-1||y===c.height-1)border+=a;}im.close();return {visible,transparent,border};},Array.from(bytes));assert(pixels.visible>0&&pixels.transparent>0);assert.equal(pixels.border,0);}
 const ids=[...f.files.keys()];await page.locator('#submissionKit').click();await page.waitForFunction(()=>!document.querySelector('#submissionKit').disabled);await page.locator('#submissionZipActivityText').filter({hasText:'確認用一式の保存・照合が完了'}).waitFor();assert.deepEqual([...f.files.keys()],ids);
 await page.reload();await page.locator('#submissionTab').click();await page.locator('#submissionWorkspace:not([hidden])').waitFor();const after=await page.evaluate(({store,key})=>({votes:localStorage.getItem(store),draft:JSON.parse(localStorage.getItem(key)).draft}),{store:keys.store,key});assert.deepEqual(after,before);assert.deepEqual(errors,[]);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/confirmation40-phone.png'});
 console.log('PASS confirmation40: Drive import, reasons, full choices/comments, reverse order, edited main/tab, 42 exact PNGs + ZIP + metadata, interrupted upload retry, repeat save without duplicates, reload unchanged. Isolated mock Drive only.');
}finally{await browser?.close();await new Promise(r=>service.server.close(r));}
