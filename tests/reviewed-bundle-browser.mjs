// Opt-in actual-source test; never commit the input ZIP or screenshots.
import {chromium} from 'playwright';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startServer} from './server.mjs';
if(!process.env.TEST_REVIEWED_ZIP)throw Error('Set TEST_REVIEWED_ZIP');
const zipBytes=await fs.readFile(process.env.TEST_REVIEWED_ZIP),zip=await JSZip.loadAsync(zipBytes);
const manifest=JSON.parse(await zip.file('technical-review.json').async('string'));
const jszip=await fs.readFile('node_modules/jszip/dist/jszip.min.js');
const service=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}: {})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const external=[];
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin===service.url)return r.continue();if(r.request().url()==='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')return r.fulfill({body:jszip,contentType:'text/javascript'});external.push(r.request().url());return r.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(service.url+'/integration-v1/workflow.html?view=selection');
 await page.locator('#selectionScreen:not([hidden])').waitFor();
 await page.locator('#selectionScreen details summary').first().click();
 await page.locator('label[for="files"]').waitFor();
 const upload=async()=>{await page.locator('#files').setInputFiles({name:'reviewed.zip',mimeType:'application/zip',buffer:zipBytes});await page.waitForFunction(()=>!document.querySelector('#files').disabled);};
 await upload();await page.waitForFunction(()=>!document.querySelector('#selectionScreen').hidden||document.querySelector('#error').textContent).catch(async e=>{console.log(JSON.stringify(await page.evaluate(()=>({error:document.querySelector('#error').textContent,cards:document.querySelectorAll('.card').length,tabDisabled:document.querySelector('#selectionTab').disabled,zip:!!window.JSZip}))),errors);throw e;});
 assert.equal(await page.locator('#error').textContent(),'');await page.locator('#selectionScreen:not([hidden])').waitFor();
 await page.waitForFunction(n=>document.querySelectorAll('.stage img').length===n&&[...document.querySelectorAll('.stage img')].every(x=>x.naturalWidth===370&&x.naturalHeight===320),manifest.entries.length);
 assert.equal(await page.locator('.chosen').count(),0);assert.equal(await page.locator('#error').textContent(),'');
 const state=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sticker-selector-v9:crop-workflow:')&&!k.endsWith('-visible-ids')).map(k=>JSON.parse(localStorage.getItem(k))).find(v=>v.items));
 const initial=await state();assert.equal(initial.items.length,manifest.entries.length);assert.ok(initial.items.every(x=>x.technicalPassed&&x.technicalScope==='actual-source'&&!x.touched));
 assert.deepEqual(initial.items.map(x=>x.candidate),manifest.entries.map(x=>x.record.candidateId));
 await upload();assert.equal((await state()).items.length,manifest.entries.length);assert.equal(await page.locator('#error').textContent(),'');
 // The entire bundle is checked before writes; a new first entry cannot sneak
 // in ahead of an invalid later review.
 const corrupt=structuredClone(manifest);corrupt.entries[0].record.imageId+='-new';corrupt.entries.at(-1).record.review=[];zip.file('technical-review.json',JSON.stringify(corrupt));
 await page.locator('#files').setInputFiles({name:'invalid-review.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
 await page.waitForFunction(()=>!document.querySelector('#files').disabled);assert.match(await page.locator('#error').textContent(),/技術合格/);assert.equal((await state()).items.length,manifest.entries.length);
 await page.reload();await page.locator('#selectionTab').click();await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,manifest.entries.length);
 assert.equal(await page.locator('.chosen').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/reviewed-selection-phone.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.ok(external.every(url=>url==='https://accounts.google.com/gsi/client'));
 console.log('PASS reviewed bundle: actual PNGs decoded; candidate/text matched; technical passes only; unrated; duplicate-safe; invalid bundle blocked; reload retained; no external image transfers.');
 await context.close();
}finally{await browser.close();await new Promise(ok=>service.server.close(ok));}
