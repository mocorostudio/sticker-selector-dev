import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {launchTagHelper} from '../integration-v1/tag-helper/helper.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
let executablePath=process.env.CHROMIUM_PATH;
if(process.env.CHROMIUM_MODULE)executablePath=await require(process.env.CHROMIUM_MODULE).executablePath();
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
let passed=0;
try {
  // Synthetic page, not a captured or authenticated LINE page. No real requests.
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  let saved=[],saveCount=0,dropSave=false,number=1,missingSave=false,duplicates=false,conflict=false;
  const offered=['ありがとう','ネコ','嬉しい','笑う','OK','YES','いいね','こんにちは','おはよう','おやすみ'];
  await ctx.route('https://creator.line.me/**',async route=>{
    if(route.request().url().endsWith('/synthetic-save')){
      saveCount++;if(!dropSave)saved=route.request().postDataJSON();await route.fulfill({json:{ok:!dropSave}});return;
    }
    const labels=[...offered,...(duplicates?['ネコ']:[])].map((t,i)=>`<label class="cm-product-image-tag"><input type="checkbox" ${saved.includes(t)&&!(conflict&&i===10)?'checked':''}><span class="cm-product-image-tag-name-text" data-test="tag-name">${t}</span></label>`).join('<br>');
    await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><h1>SYNTHETIC TAG EDITOR / NOT LINE</h1><button class="btn-dropdown"><span class="btn-dropdown-text">${String(number).padStart(2,'0')}</span></button>${labels}${missingSave?'':'<button data-test="save-btn">保存</button>'}<script>document.body.addEventListener('change',async(e)=>{if(e.target.type!=='checkbox')return;await fetch('/synthetic-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify([...document.querySelectorAll('label')].filter(l=>l.querySelector('input').checked).map(l=>l.querySelector('span').textContent))});document.body.dataset.saved='yes'})</script>`});
  });
  const page=await ctx.newPage();
  const launch=async()=>page.evaluate('('+launchTagHelper.toString()+')()');
  const status=()=>page.locator('#rui-tags [role=status]').innerText();
  async function fresh(options={}){
    duplicates=!!options.duplicates;conflict=!!options.conflict;saved=options.saved||[];saveCount=0;dropSave=!!options.dropSave;number=options.number||1;missingSave=!!options.missingSave;
    await page.goto('https://creator.line.me/synthetic-editor');await page.evaluate(()=>sessionStorage.clear());await launch();
  }
  async function check(text){await page.getByLabel('追加するタグ').fill(text);await page.getByRole('button',{name:'内容を確認',exact:true}).click();}
  async function apply(){await page.getByRole('button',{name:'この1枚に追加',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#rui-tags textarea').disabled);}
  const expectStop=async(text,match)=>{await fresh();await check(text);assert.match(await status(),match);assert.equal(await page.getByRole('button',{name:'この1枚に追加',exact:true}).isEnabled(),false);assert.equal(await page.locator('label input:checked').count(),0);assert.equal(saveCount,0);passed++;};
  await expectStop('02,ネコ',/番号が違い/);
  await expectStop('01,存在しないタグ',/存在しない/);
  await expectStop('01,ネコ,ネコ',/重複/);
  await expectStop('01,ネコ\n02,ありがとう',/1行/);
  await fresh({saved:offered.slice(0,9)});await check('01,おやすみ');assert.match(await status(),/9個/);assert.equal(await page.locator('label input:checked').count(),9);passed++;
  await fresh({saved:['ネコ']});await check('01,ありがとう');await apply();await page.waitForFunction(()=>document.body.dataset.saved==='yes');assert.deepEqual(new Set(saved),new Set(['ネコ','ありがとう']));assert.equal(saveCount,1);assert.match(await status(),/保存確認はまだ/);passed++;
  await page.getByRole('button',{name:'閉じる',exact:true}).click();await launch();assert.match(await status(),/再読み込み/);assert.doesNotMatch(await status(),/一致を確認しました/);passed++;
  await page.reload();await launch();assert.match(await status(),/再読み込み後の一致を確認/);assert.equal(saveCount,1);passed++;
  await fresh({saved:['ネコ'],dropSave:true});await check('01,ありがとう');await apply();await page.waitForFunction(()=>document.body.dataset.saved==='yes');await page.reload();await launch();assert.match(await status(),/一致しません/);assert.equal(saveCount,1);passed++;
  await fresh({missingSave:true});await check('01,ありがとう');await apply();await page.waitForFunction(()=>document.body.dataset.saved==='yes');await page.reload();await launch();assert.match(await status(),/再読み込み後の一致を確認/);assert.equal(saveCount,1);passed++;
  await fresh({saved:['ネコ']});await check('01,ありがとう');await page.locator('label').filter({hasText:'嬉しい'}).locator('input').evaluate(e=>e.checked=true);await apply();assert.match(await status(),/確認後にタグが変わり/);assert.equal(saveCount,0);passed++;
  await fresh({saved:['ネコ']});await check('01,ネコ');assert.match(await status(),/追加は不要/);assert.equal(saveCount,0);passed++;
  await fresh({saved:['ネコ'],duplicates:true});await check('01,ネコ');assert.match(await status(),/追加は不要/);passed++;
  await fresh({saved:['ネコ'],duplicates:true,conflict:true});assert.match(await status(),/同名タグの選択状態が不一致/);assert.equal(saveCount,0);passed++;
  await fresh({saved:['ネコ','ありがとう']});await page.evaluate(()=>sessionStorage.setItem('rui-line-tag-trial-v1',JSON.stringify({path:location.pathname+location.search,number:1,expected:['ネコ','ありがとう'],load:0,stage:'prepared'})));await page.reload();await launch();assert.match(await status(),/再読み込み後の一致を確認/);assert.equal(saveCount,0);passed++;
  const installer=await readFile(new URL('../integration-v1/tag-helper/index.html',import.meta.url),'utf8');
  await ctx.route('https://helper.test/',route=>route.fulfill({contentType:'text/html',body:installer}));
  await page.goto('https://helper.test/');const bookmarklet=await page.locator('#code').inputValue();assert.ok(bookmarklet.startsWith('javascript:'));assert.equal(bookmarklet,'javascript:('+launchTagHelper.toString().replace(/\n\s*/g,'')+')();');assert.ok(Buffer.byteLength(bookmarklet)<8000);passed++;
  // Execute exactly the copied payload, with newlines stripped as URL editors do.
  await fresh();await page.getByRole('button',{name:'閉じる',exact:true}).click();await page.evaluate(bookmarklet.slice('javascript:'.length).replace(/[\r\n]/g,''));assert.equal(await page.locator('#rui-tags').count(),1);passed++;
  console.log(`${passed} synthetic Chromium phone scenarios passed. LINE/iPhone remain unverified.`);
} finally {await browser.close();}

