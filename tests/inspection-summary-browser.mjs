import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {startServer} from './server.mjs';
const service=await startServer();
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']}: {})});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===service.url?route.continue():route.abort());
 await page.goto(service.url+'/integration-v1/tests/inspection-selection.html?view=selection&character=review-fixture');
 const badges=page.locator('.inspection-summary');await badges.first().filter({hasText:'× 明らかな不良'}).waitFor();
 assert.match(await badges.nth(0).innerText(),/耳が1本欠けています/);assert.match(await badges.nth(1).innerText(),/△ 注意点あり[\s\S]*文字の一部が薄い/);assert.match(await badges.nth(2).innerText(),/未検品/);assert.match(await badges.nth(3).innerText(),/問題なし/);
 await page.locator('.card').first().locator('.choices label').first().click();
 assert.match(await badges.first().innerText(),/× 明らかな不良/);
 await page.locator('.card').nth(1).getByRole('button',{name:'検品の詳細・理由を確認'}).click();
 await page.locator('#inspectionComment').fill('文字に薄い所があります');await page.locator('#inspectionReview').click();await page.locator('#inspectionClose').click();
 await badges.nth(1).filter({hasText:'文字に薄い所があります'}).waitFor();
 await page.reload();await badges.first().filter({hasText:'× 明らかな不良'}).waitFor();await badges.nth(1).filter({hasText:'文字に薄い所があります'}).waitFor();
 assert.equal(await page.locator('.card').first().locator('input[value=o]').isChecked(),true);
 assert.equal(await page.locator('.card').first().locator('.comment').inputValue(),'自分の選択を保持');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/inspection-summary-phone.png',fullPage:true});
 console.log('PASS: phone cards show independent ×/△ reasons; editing review and reload preserve preferences and comments; no external writes');
}finally{if(browser)await browser.close();await new Promise(resolve=>service.server.close(resolve));}
