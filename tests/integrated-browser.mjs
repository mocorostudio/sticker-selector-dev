import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startServer} from './server.mjs';
const server=await startServer();
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu']}: {})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>new URL(route.request().url()).origin===server.url?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(server.url+'/integration-v1/workflow.html');
 const crop=page.frameLocator('#cropFrame');await crop.locator('#handoff').waitFor();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const g=c.getContext('2d');g.fillStyle='black';for(const y of [100,300,500])for(const x of [100,300,500]){g.beginPath();g.arc(x,y,35,0,Math.PI*2);g.fill();}return c.toDataURL().split(',')[1]});
 await crop.locator('#files').setInputFiles({name:'synthetic-3x3.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await crop.locator('#run').click();await crop.locator('#handoff').filter({hasText:'全9枚'}).waitFor();
 await crop.locator('#handoff').click();await page.locator('#selectionScreen:not([hidden])').waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
 await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(im=>im.naturalWidth===370));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('.choices label').first().click();await page.locator('#sync').click();
 await page.getByText('選抜結果を保存しました',{exact:true}).waitFor();
 await page.getByRole('button',{name:'選抜一覧に戻る',exact:true}).click();
 await page.reload();await crop.locator('#handoff').waitFor();await page.locator('#selectionTab').click();
 await page.locator('.chosen').waitFor();assert.equal(await page.locator('.chosen').count(),1);
 // A second batch replaces the view while retaining the first batch and its saved vote.
 await page.locator('#cropTab').click();
 await crop.locator('#files').setInputFiles({name:'second-batch.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await crop.locator('#run').click();
 await crop.locator('#queueStatus').filter({hasText:'2/2'}).waitFor();
 await crop.locator('#handoff').click();await page.locator('#selectionScreen:not([hidden])').waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.card').length===9);
 assert.equal(await page.locator('.chosen').count(),0);
 const retained=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('sticker-selector-v9:crop-workflow:')&&!k.endsWith('-visible-ids')).map(k=>JSON.parse(localStorage.getItem(k))).find(v=>v.items)?.items);
 assert.equal(retained.length,18);assert.equal(retained.filter(i=>i.touched).length,1);
 // Return to crop editing without creating a second vote or losing the original.
 await page.locator('.card').first().getByRole('button',{name:'切り直す・大きさ／位置を修正'}).click();
 await page.locator('#cropFrame:not([hidden])').waitFor();
 assert.deepEqual(errors,[]);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/integrated-crop-phone.png'});
 console.log('PASS integrated phone: source -> 9 cropped PNGs -> selection -> local confirm -> reload -> second batch without old images -> crop editor');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));}
