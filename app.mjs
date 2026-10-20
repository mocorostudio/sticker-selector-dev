import {GoogleTestDriveAdapter} from './google-test-drive.mjs';
import {googleTestAuth} from './google-auth.mjs';
import {MockDriveAdapter} from './drive-adapter.mjs';
import {syncSelections,assertIdentity} from './sync-engine.mjs';

'use strict';
// Keep original v9 localStorage + IndexedDB keys, image identities and ratings unchanged.
const STORE='sticker-selector-v9',DB='sticker-selector-images-v9';
const $=id=>document.getElementById(id);
let state;try{state=JSON.parse(localStorage.getItem(STORE))}catch(e){}
if(!state||!Array.isArray(state.items))state={items:[],background:'checker'};
// Display selection is stored separately; original v9 state is not migrated, deleted or reordered.
const VIEW_KEY='sticker-selector-v9-visible-ids';
let shownIds;try{const saved=JSON.parse(localStorage.getItem(VIEW_KEY));shownIds=Array.isArray(saved)?saved:null}catch(e){shownIds=null}
const visible=()=>shownIds===null?state.items:state.items.filter(x=>shownIds.includes(x.id));
function setView(ids){const unique=[...new Set(ids)];shownIds=$('importMode').value==='replace'?unique:[...new Set([...visible().map(x=>x.id),...unique])];localStorage.setItem(VIEW_KEY,JSON.stringify(shownIds))}
$('showAll').onclick=()=>{shownIds=null;localStorage.removeItem(VIEW_KEY);redraw()};
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
let db;
function openDb(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('images'))q.result.createObjectStore('images')};q.onsuccess=()=>{db=q.result;ok()};q.onerror=()=>no(q.error)})}
function errorText(error){return error?.message||String(error||'端末内保存エラー')}
async function put(id,blob){
 // ArrayBuffer storage avoids WebKit's Blob structured-clone failures. Read old Blobs unchanged.
 const value={bytes:await blob.arrayBuffer(),type:blob.type||'image/png'};
 return new Promise((ok,no)=>{const tx=db.transaction('images','readwrite'),q=tx.objectStore('images').put(value,id);let failure;
 q.onerror=()=>{failure=q.error};tx.oncomplete=()=>ok();tx.onabort=()=>no(failure||tx.error||Error('画像保存中断'));tx.onerror=e=>{failure=e.target?.error||failure};
 });
}
function get(id){return new Promise((ok,no)=>{const q=db.transaction('images','readonly').objectStore('images').get(id);q.onsuccess=()=>{const value=q.result;ok(value?.bytes?new Blob([value.bytes],{type:value.type}):value)};q.onerror=()=>no(q.error||Error('画像取得失敗'))})}
let renderVersion=0;let urls=[];function clearURLs(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[]}
function redraw(){const version=++renderVersion;clearURLs();$('background').value=state.background||'checker';const items=visible(),t={o:0,h:0,x:0};items.forEach(i=>{if(i.touched&&t[i.rating]!==undefined)t[i.rating]++});$('status').textContent=`表示${items.length}枚（保存済み${state.items.length}枚）/ ◯ ${t.o} / △ ${t.h} / ✕ ${t.x} / 未選抜 ${items.length-t.o-t.h-t.x}`;const list=$('list');list.replaceChildren();items.forEach((it,index)=>{const card=document.createElement('article');card.className='card';const stage=document.createElement('div');stage.className='stage '+(it.background||state.background||'checker');const img=document.createElement('img');img.alt=it.name;stage.append(img);card.append(stage);const meta=document.createElement('div');meta.className='meta';const filename=document.createElement('div');filename.className='filename';filename.textContent=`${index+1}. ${it.name}${it.candidate?' ／ '+it.candidate+' ／ '+it.attemptId:''}${it.imageId?' ／ '+it.imageId:''}${it.phrase?' ／ '+it.phrase:''}`;meta.append(filename);const perbg=document.createElement('div');perbg.className='per-bg';for(const [v,txt] of [['checker','市松'],['white','白'],['black','黒']]){const b=document.createElement('button');b.textContent=txt;if((it.background||state.background||'checker')===v)b.classList.add('active');b.onclick=()=>{it.background=v;save();stage.className='stage '+v;perbg.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))};perbg.append(b)}meta.append(perbg);const choices=document.createElement('div');choices.className='choices';for(const [v,txt] of [['o','◯'],['h','△'],['x','✕']]){const label=document.createElement('label');if(it.touched&&it.rating===v)label.classList.add('chosen');const input=document.createElement('input');input.type='radio';input.name='vote'+index;input.value=v;input.checked=!!it.touched&&it.rating===v;label.append(input,document.createTextNode(txt));input.onchange=()=>{it.rating=v;it.touched=true;it.revision=crypto.randomUUID();it.evaluatedAt=new Date().toISOString();save();redraw()};choices.append(label)}meta.append(choices);const comment=document.createElement('input');comment.className='comment';comment.placeholder='コメント（任意）';comment.value=it.comment||'';comment.oninput=e=>{it.comment=e.target.value;it.revision=crypto.randomUUID();it.evaluatedAt=new Date().toISOString();save()};meta.append(comment);const note=document.createElement('small');note.textContent=it.touched?'操作済':'未選抜（仮◯）';meta.append(note);card.append(meta);list.append(card);get(it.id).then(blob=>{if(version!==renderVersion)return;if(blob){const u=URL.createObjectURL(blob);urls.push(u);img.src=u}else note.textContent='画像を再追加してください'}).catch(()=>note.textContent='画像読込失敗');img.onclick=()=>{if(img.src){$('zoomimg').src=img.src;$('zoom').showModal()}}})}
async function validatePNG(blob){
 if(!blob.size||blob.size>15e6)throw Error('PNGサイズ不正');
 const signature=new Uint8Array(await blob.slice(0,8).arrayBuffer());
 if([137,80,78,71,13,10,26,10].some((v,i)=>signature[i]!==v))throw Error('PNG形式不正');
 const u=URL.createObjectURL(blob);try{await new Promise((ok,no)=>{const im=new Image();im.onload=ok;im.onerror=()=>no(Error('画像を表示できません'));im.src=u})}finally{URL.revokeObjectURL(u)}
}
async function addPNG(blob,name){
 if(!name.toLowerCase().endsWith('.png'))return null;
 await validatePNG(blob);
 const bytes=await blob.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 // Compare legacy blobs before introducing a content key. Never change existing IDs.
 for(const it of state.items.filter(x=>x.name===name)){
  const old=await get(it.id);if(old&&old.size===blob.size){const a=new Uint8Array(await old.arrayBuffer()),b=new Uint8Array(bytes);if(a.every((v,i)=>v===b[i]))return it.id}
 }
 const id='local:'+name+'|'+hash;
 if(state.items.some(x=>x.id===id))return id;
 await put(id,blob);state.items.push({id,name,rating:'o',touched:false,comment:''});save();return id;
}
async function loadZip(file,ids){
 if(!window.JSZip){
   await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=ok;s.onerror=no;document.head.append(s)})
 }
 const zip=await JSZip.loadAsync(file);
 for(const entry of Object.values(zip.files)){
   if(entry.dir || !entry.name.toLowerCase().endsWith('.png') || entry.name.startsWith('__MACOSX/'))continue;
   const blob=await entry.async('blob');
   const basename=entry.name.split('/').pop();
   try{const id=await addPNG(new File([blob],basename,{type:'image/png'}),entry.name);if(id)ids.push(id)}catch(error){importErrors.push(entry.name+': '+errorText(error))}
 }
}
let importErrors=[];
$('files').onchange=async e=>{
 const files=[...e.target.files];e.target.value='';const ids=[];importErrors=[];
 await withBusy(async()=>{
 for(const file of files){try{if(file.name.toLowerCase().endsWith('.zip'))await loadZip(file,ids);else{const id=await addPNG(file,file.name);if(id)ids.push(id)}}catch(error){importErrors.push(file.name+': '+errorText(error))}}
 setView(ids);redraw();$('error').textContent=importErrors.join('\n');
 });
};
$('background').onchange=e=>{state.background=e.target.value;state.items.forEach(x=>delete x.background);save();redraw()};$('close').onclick=()=>$('zoom').close();
$('setAll').onclick=()=>{if(!confirm('表示中の画像をすべて◯で操作済みにしますか？'))return;visible().forEach(x=>{x.rating='o';x.touched=true;x.revision=crypto.randomUUID();x.evaluatedAt=new Date().toISOString()});save();redraw()};
function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}
function exportRows(){return state.items.map(i=>({image_id:i.imageId||i.id,candidate_id:i.candidate||null,attempt_id:i.attemptId||null,drive_file_id:i.driveFileId||null,evaluated_at:i.evaluatedAt||null,revision:i.revision||null,filename:i.name,rating:i.touched?i.rating:null,confirmed:!!i.touched,comment:i.comment||''}))}
$('json').onclick=()=>download('sticker-selection-v9.json',JSON.stringify({schema_version:9,drive_synced:false,exported_at:new Date().toISOString(),items:exportRows()},null,2),'application/json');
$('csv').onclick=()=>{const rows=[['image_id','candidate_id','attempt_id','drive_file_id','filename','rating','confirmed','comment','evaluated_at','revision'],...exportRows().map(x=>[x.image_id,x.candidate_id||'',x.attempt_id||'',x.drive_file_id||'',x.filename,x.rating||'',x.confirmed,x.comment,x.evaluated_at||'',x.revision||''])];download('sticker-selection-v9.csv',rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv')};
// Do not write state on initial page load: preserve original v9 localStorage content.
openDb().then(redraw).catch(e=>$('error').textContent='端末内画像を読み込めません：'+errorText(e));

const params=new URLSearchParams(location.search);
const auth=params.get('drive')==='test'?googleTestAuth():null;
const adapter=auth?new GoogleTestDriveAdapter({getToken:auth.getToken}):params.get('mock')==='1'?new MockDriveAdapter():null;
let busy=false;
async function withBusy(fn){if(busy)return;busy=true;$('list').inert=true;document.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);try{await fn()}catch(e){$('error').textContent=errorText(e)}finally{busy=false;$('list').inert=false;document.querySelectorAll('button,input,select').forEach(x=>x.disabled=false)}}
function driveMessage(message){$('driveStatus').textContent=message}
$('loadPending').onclick=()=>withBusy(async()=>{
 if(!adapter){driveMessage('実Drive連携は未有効です。PNG・ZIPの選抜は補助機能から利用できます。');return}
 const records=await adapter.list(),ids=[],errors=[];
 for(const r of records.filter(x=>adapter.mode==='drive-test' ? x.testFixture&&!x.confirmed : x.folder==='pending'&&!x.confirmed)){
  try{
   if(records.filter(x=>x.imageId===r.imageId||x.driveFileId===r.driveFileId).length!==1)throw Error('重複する画像ID・Drive ID');
   const file=await adapter.metadata(r.driveFileId);assertIdentity(r,file);
   if(adapter.mode!=='drive-test'&&file.folder!=='pending')throw Error('選抜待ち以外のPNG');
   const blob=await adapter.image(r.driveFileId);await validatePNG(blob);
   const old=state.items.find(x=>x.id===r.imageId);
   if(old&&(old.candidate!==r.candidate||old.attemptId!==r.attemptId||old.driveFileId!==r.driveFileId))throw Error('保存済みID不一致');
   await put(r.imageId,blob);
   if(!old)state.items.push({id:r.imageId,imageId:r.imageId,candidate:r.candidate,attemptId:r.attemptId,driveFileId:r.driveFileId,name:r.filename,phrase:r.phrase||'',rating:'o',touched:false,comment:''});
   ids.push(r.imageId);save();
  }catch(e){errors.push(r.filename+': '+errorText(e))}
 }
 shownIds=ids;localStorage.setItem(VIEW_KEY,JSON.stringify(ids));redraw();
 driveMessage('読込 '+ids.length+'枚／失敗 '+errors.length+'件。Drive変更なし。'+(errors.length?'\n'+errors.join('\n'):''));
});
$('sync').onclick=()=>withBusy(async()=>{
 if(!adapter){driveMessage('実Drive同期は未有効です。評価JSONを保存できます。');return}
 const selected=visible().filter(x=>x.touched&&x.imageId);
 if(!selected.length){driveMessage('対象の評価済み画像がありません。初期◯は未選抜です。');return}
 // Capture choices before asynchronous operations; no mutable UI state enters a request.
 const choices=selected.map(x=>({imageId:x.imageId,candidate:x.candidate,attemptId:x.attemptId,rating:x.rating,comment:x.comment||'',touched:x.touched,revision:x.revision,evaluatedAt:x.evaluatedAt}));
 if(!confirm(choices.length+'枚の選抜を確定して'+(adapter.mode==='drive-test'?'テスト用Google Drive':'模擬Drive')+'へ同期します。✕のPNGは移動・削除しません。'))return;
 driveMessage('同期中…');
 const run=()=>syncSelections(adapter,choices,{confirmed:true});
 const result=await (adapter.confirmRun?adapter.confirmRun(run):run());
 driveMessage('同期 '+result.saved.length+'件／一致 '+result.unchanged.length+'件／失敗 '+result.errors.length+'件'+(result.errors.length?'\n'+result.errors.map(x=>x.imageId+': '+x.message).join('\n'):''));
});
if(adapter)$('mode').textContent=adapter.mode==='drive-test'?'実Driveテスト：既存のテストPNG3枚のみ。制作用データは対象外です。':'模擬Driveモード：本番データには接続しません';
if(auth){$('loadPending').textContent='テスト画像を読み込む';$('disconnect').hidden=false;$('disconnect').onclick=()=>{auth.disconnect();driveMessage('Google接続を端末内で解除しました。画像と評価は保持しています。')};auth.ready.then(()=>driveMessage('Google認証の準備ができました。「テスト画像を読み込む」を押してください。')).catch(e=>driveMessage(errorText(e)));}
