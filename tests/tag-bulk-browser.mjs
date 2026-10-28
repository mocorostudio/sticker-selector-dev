import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {launchBulkTags} from '../integration-v1/tag-helper/bulk.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});let passed=0;
try{
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const html=`<!doctype html><meta charset="utf-8"><main id="editor"></main><script>
const actualTimeout=setTimeout;window.setTimeout=(f,ms)=>actualTimeout(f,Math.min(ms,5));
window.model=Array.from({length:40},()=>['急ぐ']);window.pos=1;window.drop=false;window.writes=0;
const tags=['急ぐ','ネコ','ダッシュ','ありがとう','a','b','c','d','e','f','g'];
window.render=()=>{document.querySelector('#editor').innerHTML='<button class="btn-dropdown"><span class="btn-dropdown-text">'+String(pos).padStart(2,'0')+'</span></button><button class="btn-previous-image" '+(pos===1?'disabled':'')+'>前へ</button><button class="btn-next-image" '+(pos===40?'disabled':'')+'>次へ</button>'+tags.map(t=>'<label class="cm-product-image-tag"><input type="checkbox" '+(model[pos-1].includes(t)?'checked':'')+'><span class="cm-product-image-tag-name-text" data-test="tag-name">'+t+'</span></label>').join('<br>')};
document.addEventListener('click',e=>{if(e.target.matches('.btn-next-image,.btn-previous-image')){pos+=e.target.matches('.btn-next-image')?1:-1;actualTimeout(render,1)}});
document.addEventListener('change',e=>{if(e.target.type!=='checkbox')return;writes++;if(!drop)model[pos-1]=[...document.querySelectorAll('label')].filter(l=>l.querySelector('input').checked).map(l=>l.querySelector('span').textContent)});render();</script>`;
await ctx.route('https://creator.line.me/**',r=>r.fulfill({contentType:'text/html',body:html}));
const page=await ctx.newPage();const start=async()=>page.evaluate('('+launchBulkTags.toString()+')()');
const state=()=>page.locator('#rui-bulk [role=status]').innerText();
async function fresh(){await page.goto('https://creator.line.me/synthetic');await page.evaluate(()=>sessionStorage.clear());await start();}
async function trial(text){await page.getByLabel('タグ一覧').fill(text);await page.getByRole('button',{name:'2枚まで試す',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-bulk [data-x=close]').disabled);}
await fresh();await trial('01,ネコ\n02,ダッシュ\n03,ありがとう');assert.match(await state(),/確認済み 2\/3/);assert.equal(await page.evaluate(()=>writes),2);assert.deepEqual(await page.evaluate(()=>model[0]),['急ぐ','ネコ']);assert.deepEqual(await page.evaluate(()=>model[2]),['急ぐ']);passed++;
await page.getByRole('button',{name:'残りを実行',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-bulk [data-x=close]').disabled);assert.match(await state(),/確認済み 3\/3/);assert.equal(await page.evaluate(()=>writes),3);passed++;
await page.reload();await start();assert.match(await state(),/確認済み 3\/3/);assert.equal(await page.getByRole('button',{name:'残りを実行',exact:true}).isEnabled(),false);passed++;
await fresh();await page.evaluate(()=>drop=true);await trial('01,ネコ\n02,ダッシュ');assert.match(await state(),/再表示後のタグが不一致/);assert.equal(await page.evaluate(()=>writes),1);assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rui-bulk-tags-v1:'+location.pathname+location.search)).done.length),0);passed++;
await page.getByRole('button',{name:'2枚まで試す',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-bulk [data-x=close]').disabled);assert.match(await state(),/前回の追加結果が不一致/);assert.equal(await page.evaluate(()=>writes),1);passed++;
for(const bad of ['01,ネコ\n01,ダッシュ','01,ネコ,ネコ','41,ネコ']){await fresh();await trial(bad);assert.equal(await page.evaluate(()=>writes),0);assert.match(await state(),/停止/);passed++;}
await fresh();await page.evaluate(()=>{model[0]=['急ぐ','a','b','c','d','e','f','g','ありがとう'];render()});await trial('01,ネコ');assert.equal(await page.evaluate(()=>writes),0);assert.match(await state(),/9個上限/);assert.match(await state(),/確認済み 1\/1/);assert.equal(await page.evaluate(()=>model[0].length),9);passed++;
await fresh();await trial('01,ネコ,ないタグ\n02,ダッシュ');assert.match(await state(),/確認済み 2\/2枚／未追加 1タグ/);assert.match(await state(),/ないタグ（画面にない）/);assert.equal(await page.evaluate(()=>writes),2);passed++;
await fresh();await page.evaluate(()=>sessionStorage.setItem('rui-bulk-tags-v1:'+location.pathname+location.search,JSON.stringify({scope:location.pathname+location.search,rows:[{n:1,tags:['ネコ']},{n:2,tags:['ネコ','もうすぐ']}],done:[1],pending:null})));await page.reload();await start();await page.getByRole('button',{name:'2枚まで試す',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-bulk [data-x=close]').disabled);assert.match(await state(),/確認済み 2\/2枚／未追加 1タグ/);assert.equal(await page.evaluate(()=>writes),1);passed++;
await fresh();await trial(Array.from({length:40},(_,i)=>String(i+1).padStart(2,'0')+',ネコ').join('\n'));assert.match(await state(),/確認済み 2\/40/);await page.getByRole('button',{name:'残りを実行',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-bulk [data-x=close]').disabled);assert.match(await state(),/確認済み 40\/40/);assert.equal(await page.evaluate(()=>writes),40);assert.ok(await page.evaluate(()=>model.every(t=>t.includes('急ぐ')&&t.includes('ネコ'))));passed++;
console.log(passed+' synthetic bulk scenarios passed; navigation, autosave failures, preservation and 40-row flow. No LINE live test.');
}finally{await browser.close();}
