import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startServer} from '../../tests/server.mjs';
const service=await startServer();
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==service.url)return route.abort();
  if(url.pathname.endsWith('inspection-browser-fixture.mjs')){const body=(await fs.readFile('integration-v1/tests/inspection-browser-fixture.mjs','utf8')).replace('i<8','i<81');return route.fulfill({contentType:'text/javascript',body});}return route.continue();
 });
 await page.goto(service.url+'/integration-v1/tests/inspection-selection.html?view=selection&character=review-fixture');
 const cards=page.locator('.card');await cards.nth(80).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.inspection-summary[data-inspection-status=pass]').length===20);
 const card=cards.nth(40);await card.scrollIntoViewIfNeeded();
 const initial=await card.evaluate(x=>x.getBoundingClientRect().top);
 await card.evaluate(x=>{window.savedCard=x;window.savedImage=x.querySelector('img')});
 for(const value of ['o','h','x','o','x','h']){
  await card.locator('input[value='+value+']').check();
  assert.ok(Math.abs(await card.evaluate(x=>x.getBoundingClientRect().top)-initial)<2,'anchor position');
  assert.equal(await card.evaluate(x=>x===window.savedCard&&x.querySelector('img')===window.savedImage),true);
 }
 await card.locator('.comment').fill('keep comment');
 assert.match(await cards.nth(0).innerText(),/技術判定：× 不合格[\s\S]*耳が1本欠け/);
 assert.match(await cards.nth(1).innerText(),/△ 要確認/);
 assert.equal(await cards.count(),81);
 await page.reload();await cards.nth(80).waitFor();
 assert.equal(await cards.nth(40).locator('input[value=h]').isChecked(),true);
 assert.equal(await cards.nth(40).locator('.comment').inputValue(),'keep comment');
 assert.equal(await cards.nth(0).locator('.comment').inputValue(),'自分の選択を保持');
 await cards.nth(1).getByRole('button',{name:'検品の詳細・理由を確認'}).click();
 await page.locator('#inspectionComment').fill('小物がマスターと違う');await page.locator('#inspectionFail').click();await page.locator('#inspectionClose').click();
 await page.waitForFunction(()=>document.querySelectorAll('.inspection-summary')[1].textContent.includes('小物がマスターと違う'));
 assert.match(await cards.nth(1).innerText(),/△ 要確認/);
 assert.equal(await cards.nth(40).locator('input[value=h]').isChecked(),true);
 console.log('PASS '+engine.name()+': 81 cards, repeated ratings retain DOM and anchor; reload/comments/order; independent review reasons and minor classification');
 }finally{await browser.close();}
}}finally{await new Promise(r=>service.server.close(r));}
