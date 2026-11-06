import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {startServer} from './server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url+'/integration-v1/tests/products.html?selectionMode=trial&character=char');
 await page.waitForFunction(()=>window.productsReady&&document.querySelectorAll('#submissionGrid button').length===12);
 const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(window.productKey)).draft);
 const initial=await snapshot();assert.equal(Object.keys(initial.assignments).length,40);assert.equal(await page.locator('#submissionProducts').isHidden(),true);
 // Existing single-product main/tab + reverse order export still makes 42 PNGs.
 await page.waitForFunction(()=>!document.querySelector('#submissionKit').disabled);
 await page.locator('#submissionKit').click();await page.waitForFunction(()=>window.savedArchives.length===1);
 const bytes=await page.evaluate(()=>window.savedArchives[0][0].bytes),z=await JSZip.loadAsync(new Uint8Array(bytes));assert.equal(Object.keys(z.files).length,42);assert.ok(z.file('main.png'));assert.ok(z.file('tab.png'));
 await page.waitForFunction(()=>document.querySelector('#submissionZipActivity').getAttribute('aria-busy')==='false');
 await page.locator('#submissionAdd').click();await page.locator('#submissionAdd').click();
 await page.locator('#submissionStoredCircles').click();await page.waitForFunction(()=>document.querySelector('#submissionStatus').textContent.includes('162枚'));
 let d=await snapshot();assert.equal(Object.keys(d.assignments).length,40);assert.equal(d.retainedCandidateIds.length,243);assert.equal(d.productSaves,undefined);
 await page.locator('#submissionActive').selectOption('one');await page.waitForFunction(()=>!document.querySelector('#submissionKit').disabled);await page.locator('#submissionKit').click();await page.waitForFunction(()=>window.savedArchives.length===2&&document.querySelector('#submissionZipActivity').getAttribute('aria-busy')==='false');
 const thirdId=d.sets[2].id;await page.locator('#submissionActive').selectOption(thirdId);d=await snapshot();assert.equal(d.productSaves.length,1);
 assert.deepEqual(d.artwork,initial.artwork);assert.deepEqual(d.orders,initial.orders);
 await page.locator('#submissionGrid button').first().click();d=await snapshot();const third=d.activeSetId;assert.equal(d.assignments.image40,third);
 await page.locator('#submissionProductScope').selectOption('current');assert.equal(await page.locator('#submissionGrid button').count(),1);
 await page.locator('#submissionActive').selectOption('one');assert.equal(await page.locator('#submissionGrid button').count(),12);
 // Reassign a selected image to product3, then restore it to product1.
 await page.locator('#submissionActive').selectOption(third);await page.locator('#submissionProductScope').selectOption('all');await page.locator('#submissionGrid button').first().click();
 d=await snapshot();assert.equal(d.assignments.image0,third);assert.deepEqual(d.artwork,initial.artwork);assert.equal(d.productSaves[0].snapshot.assignments.image0,'one');
 await page.locator('#submissionActive').selectOption('one');await page.locator('#submissionGrid button').first().click();
 await page.locator('#submissionActive').selectOption(third);
 // A new visible batch must not hide the explicitly retained first cohort.
 await page.evaluate(()=>{window.currentItems=window.allItems.slice(81,162);});await page.locator('#submissionLoad').click();
 d=await snapshot();assert.equal(d.activeSetId,third);assert.equal(d.assignments.image0,'one');assert.equal(d.assignments.image40,third);assert.equal(Object.keys(d.assignments).length,41);
 await page.reload();await page.waitForFunction(()=>window.productsReady&&document.querySelectorAll('#submissionGrid button').length>0);
 const recovered=await snapshot();assert.equal(recovered.activeSetId,third);assert.deepEqual(recovered.assignments,d.assignments);assert.deepEqual(recovered.orders,initial.orders);assert.deepEqual(recovered.artwork,initial.artwork);assert.equal(recovered.productSaves[0].status,'archive-saved');
 assert.deepEqual(errors,[]);console.log('PASS: legacy 81 / 42-PNG ZIP; 243 candidates / 3 products; old circles; reassignment; snapshot; cohort reload');
}finally{await browser?.close();await new Promise(r=>server.server.close(r));}
