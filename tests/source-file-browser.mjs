// Opt-in private source check. Never commit source images or generated results.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './server.mjs';
if(!process.env.TEST_SOURCE_PNG)throw Error('Set TEST_SOURCE_PNG to a local 3x3 PNG');
const service=await startServer();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}: {})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',r=>new URL(r.request().url()).origin===service.url?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(service.url+'/integration-v1/workflow.html');
 const crop=page.frameLocator('#cropFrame');await crop.locator('#handoff').waitFor();
 await crop.locator('#files').setInputFiles(process.env.TEST_SOURCE_PNG);
 await crop.locator('#run').click();await crop.locator('#handoff').filter({hasText:'全9枚'}).waitFor();
 const cropFrame=page.frames().find(f=>f.url().includes('/crop-v9/'));
 const results=await cropFrame.evaluate(async()=>{
  const names=await indexedDB.databases(),name=names.find(x=>x.name.startsWith('sticker-crop-v9:workflow:')).name;
  const db=await new Promise((ok,no)=>{const q=indexedDB.open(name);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
  return new Promise(ok=>{const q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{db.close();ok(q.result.records.map(r=>({number:r.sequenceLabel,qa:r.qa,review:r.review,candidateId:r.candidateId,hasPixels:r.hasPixels})))}});
 });
 assert.equal(results.length,9);assert.ok(results.every(r=>r.hasPixels&&r.review.length===0));
 await crop.locator('#handoff').click();await page.locator('#selectionScreen').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelectorAll('.stage img').length===9&&[...document.querySelectorAll('.stage img')].every(im=>im.naturalWidth===370&&im.naturalHeight===320));
 assert.equal(await page.locator('.chosen').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const items=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sticker-selector-v9:crop-workflow:')&&!k.endsWith('-visible-ids')).map(k=>JSON.parse(localStorage.getItem(k))).find(v=>v.items)?.items);
 assert.equal(items.length,9);assert.ok(items.every(i=>!i.technicalPassed&&!i.touched));
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/private-source-selection.png',fullPage:true});
 await page.reload();await crop.locator('#handoff').waitFor();await page.locator('#selectionTab').click();
 await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
 assert.deepEqual(errors,[]);
 await writeFile('test-results/private-source-check.json',JSON.stringify({sourceSheets:1,croppedPNGs:9,dimensions:[370,320],technicalPassed:0,userRatings:0,results},null,2));
 console.log('PASS private source: 1 actual PNG -> 9 decoded crops -> automatic QA -> 9 unrated local drafts -> reload. No Drive writes or technical approvals.');
 console.log(JSON.stringify(results));await context.close();
}finally{await browser.close();await new Promise(ok=>service.server.close(ok));}
