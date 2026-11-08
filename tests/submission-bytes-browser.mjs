// Isolated phone UI test. Never contacts the user's Drive or uses production votes.
import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {startServer} from './server.mjs';
import {SourceFixture} from './source-save-fixture.mjs';
import {pngFixture} from './submission-png-fixture.mjs';
import {storedZip} from '../integration-v1/submission-zip.mjs';
import {normalizeSubmissionPng,inspectSubmissionZip,sha256} from '../integration-v1/submission-validation.mjs';
const service=await startServer();
try{for(const [engine,type] of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.TEST_BROWSER||n===process.env.TEST_BROWSER)){
 const browser=await type.launch({headless:true,...(engine==='chromium'&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{})});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),f=new SourceFixture(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));f.files.set('application',{id:'application',name:'04_申請用',mimeType:'application/vnd.google-apps.folder',parents:['char']});
 await page.exposeBinding('mockDrive',async(_,{url,method,headers,bytes})=>{const opts={method,headers,body:new Blob([new Uint8Array(bytes)])};if(method==='POST'&&url.includes('/upload/')){const text=await opts.body.text(),metadata=JSON.parse(text.split('\r\n\r\n')[1].split('\r\n--')[0]);if(!metadata.id){++f.serial; // Metadata replacement must preserve binary bytes.
 const raw=Buffer.from(bytes),a=raw.indexOf(Buffer.from(JSON.stringify(metadata))),replacement=Buffer.from(JSON.stringify({...metadata,id:'reorder'+f.serial}));opts.body=new Blob([raw.subarray(0,a),replacement,raw.subarray(a+Buffer.byteLength(JSON.stringify(metadata)))]);}}
 const r=await f.fetch(url,opts);return {status:r.status,headers:Object.fromEntries(r.headers),bytes:[...new Uint8Array(await r.arrayBuffer())]};});
 await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>{if(!navigator.userActivation.isActive)throw Error('OAuth requires a click');o.callback({access_token:'mock',scope:o.scope,expires_in:3600});}})}}};const original=window.fetch.bind(window);window.fetch=async(url,options={})=>{if(typeof url==='string'&&url.startsWith('https://www.googleapis.com/')){const r=await window.mockDrive({url,method:options.method||'GET',headers:options.headers||{},bytes:options.body?[...new Uint8Array(await options.body.arrayBuffer())]:[]});return new Response(new Uint8Array(r.bytes),{status:r.status,headers:r.headers});}return original(url,options);};});
 await page.route('**/*',r=>new URL(r.request().url()).origin===service.url?r.continue():r.abort());
 const entries=Array.from({length:40},(_,i)=>({name:String(i+1).padStart(2,'0')+'.png',blob:pngFixture(370,320,{color:90+i})}));entries.push({name:'main.png',blob:pngFixture(240,240)},{name:'tab.png',blob:pngFixture(96,74)});const original=await storedZip(entries,{includeArtwork:true});
 await page.goto(service.url+'/integration-v1/reorder-finished.html');await page.locator('#file').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:Buffer.from(await original.arrayBuffer())});await page.locator('#editor:visible').waitFor();
 await page.locator('.reorder-card').nth(39).click();await page.locator('#moveFirst').click();await page.locator('#folder').fill('https://drive.google.com/drive/folders/char');
 f.lose=true;await page.locator('#save').click();await page.locator('#saveProgress').filter({hasText:'保存未確認'}).waitFor();assert.equal([...f.files.values()].filter(x=>x.mimeType==='application/zip').length,1);
 await page.locator('#save').click();await page.locator('#saveProgress').filter({hasText:'一致確認が完了'}).waitFor();
 const file=[...f.files.values()].find(x=>x.mimeType==='application/zip'),blob=f.blobs.get(file.id),report=await inspectSubmissionZip(blob);assert.equal(report.imageCount,42);assert.deepEqual(file.parents,['application']);
 assert.equal(report.images.find(x=>x.filename==='01.png').sha256,await sha256(await normalizeSubmissionPng('01.png',entries[39].blob)));assert.equal(report.images.find(x=>x.filename==='main.png').sha256,await sha256(await normalizeSubmissionPng('main.png',entries[40].blob)));
 await page.locator('#save').dblclick();await page.waitForFunction(()=>!document.querySelector('#save').disabled);assert.equal([...f.files.values()].filter(x=>x.mimeType==='application/zip').length,1);
 // The normal screen uses these exact export/save functions. Exercise them in
 // WebKit independently of unrelated all-candidate preference-screen tests.
 const normalEntries=Array.from({length:40},(_,i)=>({name:String(i+1).padStart(2,'0')+'.png',blob:pngFixture(370,320,{color:90+i,margin:60})}));normalEntries.push(entries[40],entries[41]);
 const normalInput=await Promise.all(normalEntries.map(async e=>({name:e.name,bytes:[...new Uint8Array(await e.blob.arrayBuffer())]})));
 const normalResult=await page.evaluate(async input=>{
  const {prepareSelectionZip}=await import('/integration-v1/submission-zip.mjs?v=20261108-issue9'),{prepareSubmission}=await import('/integration-v1/submission-core.mjs'),{createExportDrive,digest}=await import('/integration-v1/drive-export.mjs?v=20261108-issue9');
  const images=input.map(e=>({...e,blob:new Blob([new Uint8Array(e.bytes)],{type:'image/png'})})),files=await Promise.all(images.slice(0,40).map(async(e,i)=>({id:'normal'+i,name:e.name,mimeType:'image/png',size:String(e.blob.size),sha256Checksum:await digest(e.blob),parents:['adopt'],appProperties:{technicalStatus:'pass'}}))),draft={sets:[{id:'normal-set',name:'normal',target:40}],assignments:Object.fromEntries(files.map(f=>[f.id,'normal-set'])),orders:{'normal-set':files.map(f=>f.id).reverse()},artwork:{'normal-set':{mainId:'normal1',tabId:'normal2',strokes:[]}}},before=JSON.stringify(draft),plan=prepareSubmission(draft,files,{characterId:'char',id:'normal-plan'});
  const decode=async blob=>{const im=await createImageBitmap(blob),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);im.close();return g.getImageData(0,0,c.width,c.height);};
  const artwork=await Promise.all(images.slice(40).map(async e=>({kind:e.name.split('.')[0],blob:e.blob,sha:await digest(e.blob)}))),bundle=await prepareSelectionZip(plan,{decode,getRemote:async e=>images[Number(e.fileId.slice(6))].blob,prepareArtwork:async()=>({characterId:'char',images:artwork,manifest:{blob:new Blob([JSON.stringify({characterId:'char',setId:'normal-set',main:draft.artwork['normal-set'],tab:draft.artwork['normal-set']})])}})}),journal=new Map(),drive=createExportDrive({getToken:()=> 'mock',readJournal:k=>journal.get(k),writeJournal:(k,v)=>journal.set(k,v)}),result=await drive.saveArchives(bundle,{accountId:'normal-account',characterId:'char'}),again=await drive.saveArchives(bundle,{accountId:'normal-account',characterId:'char'});
  if(JSON.stringify(draft)!==before||result.archives[0].id!==again.archives[0].id)throw Error('Normal export changed draft or duplicated ZIP');return result;
 },normalInput);
 const normalArchive=normalResult.archives[0];assert.equal(normalArchive.verification.imageCount,42);assert.equal(normalArchive.folderId,'application');assert.equal(normalArchive.verification.images[0].imageId,'normal39');assert.equal(normalArchive.verification.images.find(e=>e.filename==='main.png').sha256,await sha256(await normalizeSubmissionPng('main.png',normalEntries[40].blob)));await inspectSubmissionZip(f.blobs.get(normalArchive.id));assert.equal([...f.files.values()].filter(x=>x.mimeType==='application/zip').length,2);
 console.log('PASS '+engine+' normal export/save pipeline: all 42 actual PNGs, source IDs and reverse order, latest artwork, readback, repeat save, draft preserved. Mock Drive.');
 await page.reload();await page.locator('#editor:visible').waitFor();await page.locator('#orderSummary').filter({hasText:'変更 40枚'}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS '+engine+' phone: reorder, metadata-only 72dpi, actual 42 PNG validation, lost response retry, duplicate click, restore order, artwork preserved. Mock Drive.');
 }finally{await browser.close();}
}}finally{await new Promise(resolve=>service.server.close(resolve));}
