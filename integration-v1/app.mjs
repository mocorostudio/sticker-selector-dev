import {createPendingDrive} from './drive-pending.mjs?v=20261125-storage3';
import {byteCache,thumbnail,previewSource} from './image-preview.mjs?v=20261125-storage3';
import {readSelectionState,saveSelectionState,isStorageQuotaError} from './selection-storage.mjs?v=20261108-quota1';
import {preserveCardPosition} from './selection-position.mjs';
import {inspectionSummary,inspectionSummaryFromHash,renderInspectionSummary} from './inspection-summary.mjs?v=20261125-storage3';
import {isLocalConfirmed} from './crop-handoff.mjs?v=20261125-storage3';
import {initWorkflow} from './integration-ui.mjs?v=20261125-storage3';
import {selectionView} from './selection-view.mjs?v=20261024-character1';
import {importCrops} from './crop-handoff.mjs?v=20261125-storage3';
import {reviewedBundleFromDrive,importReviewedCrops} from './reviewed-bundle.mjs?v=20261106-scrollqa1';
import {GoogleTestDriveAdapter} from './google-test-drive.mjs?v=20261023-merge1';
import {googleTestAuth} from './google-auth.mjs';
import {MockDriveAdapter} from './drive-adapter.mjs';
import {syncSelections,assertIdentity} from './sync-engine.mjs?v=20261023-merge1';
import {storageKeys,recoverDraft} from './session-store.mjs';
import {archiveOtherCharacters} from './selection-cleanup.mjs';

'use strict';
const params=new URLSearchParams(location.search);
const workflowLocal=document.body.dataset.localWorkflow==='true';
const driveTest=!workflowLocal&&params.get('drive')==='test';
// GitHub Pages projects share an origin. Isolate test drafts without modifying legacy data.
const {store:STORE,db:DB,view:VIEW_KEY}=storageKeys({driveTest,workflowLocal,pathname:location.pathname});
let legacyItems=[];
if(driveTest){try{legacyItems=JSON.parse(localStorage.getItem('sticker-selector-v9'))?.items||[]}catch(e){}}
const $=id=>document.getElementById(id);
// Keep confirmation and its result reachable after the last card.
$('syncBar').append($('sync'),$('driveStatus'));
const reserveSyncBar=()=>{document.body.style.paddingBottom=($('syncBar').getBoundingClientRect().height+16)+'px'};
new ResizeObserver(reserveSyncBar).observe($('syncBar'));
let workflow;
let state;try{state=readSelectionState(localStorage,STORE)}catch(e){}
if(!state||!Array.isArray(state.items))state={items:[],background:'checker'};
// Display selection is stored separately; original v9 state is not migrated, deleted or reordered.
let shownIds;try{const saved=JSON.parse(localStorage.getItem(VIEW_KEY));shownIds=Array.isArray(saved)?saved:null}catch(e){shownIds=null}
const CHARACTER_KEY=VIEW_KEY+'-character',VIEW_SCOPE_KEY=VIEW_KEY+'-scope';
let activeCharacter=workflowLocal?(params.get('character')||localStorage.getItem(CHARACTER_KEY)||null):null;
if(activeCharacter){viewSetting(CHARACTER_KEY,activeCharacter);if(localStorage.getItem(VIEW_SCOPE_KEY)!==activeCharacter)shownIds=null;}
const visible=()=>selectionView(state.items,{workflowLocal,shownIds,characterId:activeCharacter});
function setCharacter(id){if(!workflowLocal)return;activeCharacter=id;viewSetting(CHARACTER_KEY,id);shownIds=null;redraw();}
if(activeCharacter)$('showAll').textContent='このキャラの保存済み画像を表示';
function setView(ids,append=false,{forceReplace=false}={}){const unique=[...new Set(ids)];shownIds=forceReplace||!append&&$('importMode').value==='replace'?unique:[...new Set([...visible().map(x=>x.id),...unique])];viewSetting(VIEW_KEY,JSON.stringify(shownIds));if(activeCharacter)viewSetting(VIEW_SCOPE_KEY,activeCharacter)}
$('showAll').onclick=()=>{shownIds=null;viewSetting(VIEW_KEY,null);redraw()};
const selectionTotals=document.createElement('strong');selectionTotals.id='selectionTotals';selectionTotals.setAttribute('role','status');selectionTotals.setAttribute('aria-live','polite');$('syncBar').prepend(selectionTotals);
const requestedTarget=Number(params.get('target')),selectionTarget=[8,16,24,32,40].includes(requestedTarget)?requestedTarget:40;
function updateSyncCount(){const items=visible().filter(x=>x.touched&&x.imageId&&(!workflowLocal||x.origin==='crop-local'));const pending=workflowLocal?items.filter(x=>!isLocalConfirmed(x)).length:items.length;const adopted=items.filter(x=>x.rating==='o').length;selectionTotals.textContent='候補 ◯ '+adopted+'枚 ／ 申請予定 '+selectionTarget+'枚';$('syncCount').textContent=workflowLocal?'選択済み：'+items.length+'枚（操作は端末に自動保持）':'確定する画像：'+pending+'枚'}
async function save(){
 updateSyncCount();
 if(!databaseState){
  try{
   if(!workflowLocal||JSON.stringify(state).length<500000){saveSelectionState(localStorage,STORE,state);return;}
  }catch(error){if(!workflowLocal||!isStorageQuotaError(error))throw error;}
  databaseState=true;
 }
 const snapshot=structuredClone(state);
 const operation=saveQueue.then(()=>writeSelection(snapshot));
 saveQueue=operation.catch(()=>{});
 await operation;
}
function saveFromCard(){
 save().catch(error=>{$('error').textContent='選抜操作を保存できません：'+errorText(error)+'。この画面で選択を保持しています。';});
}
function viewSetting(key,value){
 try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}
 catch(error){if(!isStorageQuotaError(error))throw error;}
}
new MutationObserver(updateSyncCount).observe($('list'),{childList:true});
updateSyncCount();
let db;
let databaseState=false,saveQueue=Promise.resolve(),imageReader;
function openDb(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('images'))q.result.createObjectStore('images')};q.onsuccess=()=>{db=q.result;ok()};q.onerror=()=>no(q.error)})}
function errorText(error){return error?.message||String(error||'端末内保存エラー')}
async function put(id,blob){
 // ArrayBuffer storage avoids WebKit's Blob structured-clone failures. Read old Blobs unchanged.
 const value={bytes:await blob.arrayBuffer(),type:blob.type||'image/png'};
 return new Promise((ok,no)=>{const tx=db.transaction('images','readwrite'),q=tx.objectStore('images').put(value,id);let failure;
 q.onerror=()=>{failure=q.error};tx.oncomplete=()=>ok();tx.onabort=()=>no(failure||tx.error||Error('画像保存中断'));tx.onerror=e=>{failure=e.target?.error||failure};
 });
}
function getLocal(id){return new Promise((ok,no)=>{const q=db.transaction('images','readonly').objectStore('images').get(id);q.onsuccess=()=>{const value=q.result;ok(value?.bytes?new Blob([value.bytes],{type:value.type}):value)};q.onerror=()=>no(q.error||Error('画像取得失敗'))})}
const selectionKey='selection-state:'+STORE;
function readSelection(){
 return new Promise((resolve,reject)=>{
  const request=db.transaction('images','readonly').objectStore('images').get(selectionKey);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
function writeSelection(snapshot){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('images','readwrite');
  tx.objectStore('images').put(snapshot,selectionKey);
  tx.oncomplete=resolve;
  tx.onabort=()=>reject(tx.error||Error('選抜情報の保存が中断されました。'));
 });
}
async function get(id){
 const local=await getLocal(id);
 if(local)return local;
 const item=state.items.find(x=>x.id===id);
 if(!item?.imageSource)return null;
 if(!imageReader)throw Error('「Driveから読み込む」でGoogleに接続してください。');
 return imageReader(item.imageSource,item.name);
}
if(workflowLocal){
 const cleanup=document.createElement('button');cleanup.id='cleanupOtherCharacters';cleanup.textContent='他キャラの保存一覧を整理（今のキャラは残す）';
 const message=document.createElement('p');message.setAttribute('role','status');
 $('status').after(cleanup,message);
 cleanup.onclick=()=>withBusy(async()=>{
  const current=activeCharacter;
  const result=await archiveOtherCharacters(state,current,{
   archive:async record=>{
    const key='selection-archive:'+crypto.randomUUID();
    await new Promise((ok,no)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(record,key);tx.oncomplete=ok;tx.onabort=()=>no(tx.error||Error('退避できないため整理を停止しました。'));tx.onerror=()=>{};});
    const restored=await new Promise((ok,no)=>{const q=db.transaction('images','readonly').objectStore('images').get(key);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});
    if(JSON.stringify(restored)!==JSON.stringify(record))throw Error('退避を照合できず、一覧は変更していません。');
   },
   save:async next=>{const before=state;state=next;try{await save();}catch(error){state=before;throw error;}}
  });
  state=result.state;redraw();updateSyncCount();
  message.textContent=result.count+'枚を保存一覧から退避しました。今のキャラの画像・選択と、他キャラの画像・履歴は端末に保持しています。Driveから読み込むで残りを再開してください。';
 });
}
function updateRatingStatus(){const items=visible(),t={o:0,h:0,x:0};items.forEach(i=>{if(i.touched&&t[i.rating]!==undefined)t[i.rating]++});$('status').textContent=`表示${items.length}枚（保存済み${state.items.length}枚）/ ◯ ${t.o} / △ ${t.h} / ✕ ${t.x} / 未選抜 ${items.length-t.o-t.h-t.x}`;}
let renderVersion=0,zoomURL;
const thumbnails=byteCache(4*1024*1024);
const cards=new Map();
const previews=new IntersectionObserver(entries=>{
 for(const entry of entries){
  const preview=cards.get(entry.target);
  if(!preview)continue;
  preview.visible=entry.isIntersecting;
  if(preview.visible)void showPreview(preview);
  else releasePreview(preview);
 }
},{rootMargin:'160px'});
function releasePreview(preview){
 preview.stamp++;
 if(preview.url)URL.revokeObjectURL(preview.url);
 preview.url=null;
 preview.img.removeAttribute('src');
}
function clearURLs(){
 previews.disconnect();
 for(const preview of cards.values())releasePreview(preview);
 cards.clear();
}
async function showPreview(preview){
 if(preview.img.hasAttribute('src')||preview.loading)return;
 const stamp=preview.stamp, {item,img,host,note}=preview;
 const key=JSON.stringify([item.id,item.imageSource?.sha256,item.inspectionAudit?.reviewedAt,item.inspectionAudit?.decision,item.inspectionAudit?.sha256,item.candidate,item.crop?.pendingDrive?.manifestFileId,item.technicalStatus]);
 preview.loading=true;
 try{
  let cached=thumbnails.get(key);
  if(!cached){
   const original=await get(item.id);
   if(!original)throw Error('画像を再追加してください。');
   cached={blob:await thumbnail(original),summary:await inspectionSummary(item,original)};
   thumbnails.set(key,cached);
  }
  const source=await previewSource(cached.blob);
  if(!preview.visible||!img.isConnected||stamp!==preview.stamp)return;
  img.src=source;
  note.title='';
  if(note.dataset.previewError){note.textContent=cardNote(item);delete note.dataset.previewError;}
  preserveCardPosition($('list'),()=>renderInspectionSummary(host,cached.summary));
 }catch(error){
  if(preview.visible&&img.isConnected&&stamp===preview.stamp){
   note.title=errorText(error);
   if(item.imageSource){note.dataset.previewError='true';note.textContent=errorText(error);}
   else renderInspectionSummary(host,{status:'unknown',label:'確認待ち',reasons:[errorText(error)]});
  }
 }finally{
  preview.loading=false;
  if(stamp!==preview.stamp&&preview.visible&&img.isConnected)void showPreview(preview);
 }
}
$('zoom').addEventListener('close',()=>{
 if(zoomURL)URL.revokeObjectURL(zoomURL);
 zoomURL=null;
 $('zoomimg').removeAttribute('src');
});
function redraw(options={}){return preserveCardPosition($('list'),()=>drawCards(options));}
function cardNote(it){return it.origin==='crop-local'?(isLocalConfirmed(it)?'端末内で確定済':it.touched?'選択済・未確定':'未選抜（仮◯）'):(it.touched?'操作済':'未選抜（仮◯）');}
function drawCards({appendOnly=false}={}){const current=visible(),previous=[...$('list').children],append=appendOnly&&previous.every((card,i)=>card.dataset.itemId===current[i]?.id);const version=append?renderVersion:++renderVersion;if(!append)clearURLs();$('background').value=state.background||'checker';const items=visible(),t={o:0,h:0,x:0};items.forEach(i=>{if(i.touched&&t[i.rating]!==undefined)t[i.rating]++});$('status').textContent=`表示${items.length}枚（保存済み${state.items.length}枚）/ ◯ ${t.o} / △ ${t.h} / ✕ ${t.x} / 未選抜 ${items.length-t.o-t.h-t.x}`;const list=$('list');if(!append)list.replaceChildren();items.forEach((it,index)=>{if(append&&index<previous.length)return;const card=document.createElement('article');card.className='card';card.dataset.itemId=it.id;const stage=document.createElement('div');stage.className='stage '+(it.background||state.background||'checker');const img=document.createElement('img');img.alt=it.name;stage.append(img);card.append(stage);const meta=document.createElement('div');meta.className='meta';const filename=document.createElement('div');filename.className='filename';filename.textContent=`${index+1}. ${it.name}${it.candidate?' ／ '+it.candidate+' ／ '+it.attemptId:''}${it.imageId?' ／ '+it.imageId:''}${it.phrase?' ／ '+it.phrase:''}`;if(it.sequenceLabel)filename.textContent='画像 '+it.sequenceLabel+(it.phrase?' ／ '+it.phrase:'');meta.append(filename);if(it.crop?.trialId){const trial=document.createElement('p');trial.className='trial-identity';trial.textContent=[it.candidate,'試行 '+it.crop.trialId,it.crop.previousCandidateId&&it.crop.previousCandidateId!==it.candidate?'旧候補 '+it.crop.previousCandidateId:'',it.crop.changeReason||''].filter(Boolean).join(' ／ ');meta.append(trial);}if(workflowLocal&&it.origin==='crop-local'){const edit=document.createElement('button');edit.textContent='切り直す・大きさ／位置を修正';edit.onclick=()=>window.dispatchEvent(new CustomEvent('workflow-edit',{detail:{imageId:it.imageId}}));meta.append(edit);} {const qa=document.createElement('section');qa.className='inspection-summary';qa.setAttribute('aria-label','ルイの検品結果');renderInspectionSummary(qa,{status:'unknown',label:'確認中',reasons:[]});meta.append(qa);const inspectThis=document.createElement('button');inspectThis.textContent='検品の詳細・理由を確認';inspectThis.onclick=()=>window.dispatchEvent(new CustomEvent('workflow-inspect',{detail:{imageId:it.imageId}}));meta.append(inspectThis);}const perbg=document.createElement('div');perbg.className='per-bg';for(const [v,txt] of [['checker','市松'],['white','白'],['black','黒']]){const b=document.createElement('button');b.textContent=txt;if((it.background||state.background||'checker')===v)b.classList.add('active');b.onclick=()=>{it.background=v;saveFromCard();stage.className='stage '+v;perbg.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))};perbg.append(b)}meta.append(perbg);const choices=document.createElement('div');choices.className='choices';for(const [v,txt] of [['o','◯'],['h','△'],['x','✕']]){const label=document.createElement('label');if(it.touched&&it.rating===v)label.classList.add('chosen');const input=document.createElement('input');input.type='radio';input.name='vote'+index;input.value=v;input.checked=!!it.touched&&it.rating===v;label.append(input,document.createTextNode(txt));input.onchange=()=>{it.rating=v;it.touched=true;it.revision=crypto.randomUUID();it.evaluatedAt=new Date().toISOString();saveFromCard();preserveCardPosition($('list'),()=>{choices.querySelectorAll('label').forEach(x=>x.classList.toggle('chosen',x.querySelector('input').value===v));note.textContent=it.origin==='crop-local'?'選択済・未確定':'操作済';updateRatingStatus();},it.id)};choices.append(label)}meta.append(choices);const comment=document.createElement('input');comment.className='comment';comment.placeholder='コメント（任意）';comment.value=it.comment||'';comment.oninput=e=>{it.comment=e.target.value;it.commentEditedLocally=true;it.revision=crypto.randomUUID();it.evaluatedAt=new Date().toISOString();saveFromCard();if(it.origin==='crop-local')note.textContent='選択済・未確定'};meta.append(comment);const note=document.createElement('small');note.textContent=cardNote(it);meta.append(note);card.append(meta);list.append(card);const host=card.querySelector('.inspection-summary');
 if(workflowLocal){
  if(it.imageSource?.sha256)renderInspectionSummary(host,inspectionSummaryFromHash(it,it.imageSource.sha256));
  cards.set(stage,{item:it,img,host,note,stamp:0});
  previews.observe(stage);
 }else{
  get(it.id).then(async blob=>{
   if(!blob||version!==renderVersion||!img.isConnected)return;
   const value=await inspectionSummary(it,blob);
   if(version!==renderVersion||!img.isConnected)return;
   const url=URL.createObjectURL(blob);
   cards.set(img,{img,url,stamp:0});
   img.src=url;
   renderInspectionSummary(host,value);
  }).catch(()=>{note.textContent='画像読込失敗';});
 }
 img.onclick=async()=>{
  try{
   const blob=await get(it.id);
   if(!blob||!img.isConnected)return;
   if(zoomURL)URL.revokeObjectURL(zoomURL);
   zoomURL=URL.createObjectURL(blob);
   $('zoomimg').src=zoomURL;
   if(!$('zoom').open)$('zoom').showModal();
  }catch(error){$('error').textContent=errorText(error);}
 };
})}

async function openPNG(blob){
 if(!blob.size||blob.size>15e6)throw Error('PNGサイズ不正');
 const signature=new Uint8Array(await blob.slice(0,8).arrayBuffer());
 if([137,80,78,71,13,10,26,10].some((v,i)=>signature[i]!==v))throw Error('PNG形式不正');
 try{return await createImageBitmap(blob);}
 catch{throw Error('画像を表示できません');}
}
async function validatePNG(blob){(await openPNG(blob)).close();}
async function addPNG(blob,name){
 if(!name.toLowerCase().endsWith('.png'))return null;
 await validatePNG(blob);
 const bytes=await blob.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 // Compare legacy blobs before introducing a content key. Never change existing IDs.
 for(const it of state.items.filter(x=>x.name===name)){
  const old=await get(it.id);if(old&&old.size===blob.size){const a=new Uint8Array(await old.arrayBuffer()),b=new Uint8Array(bytes);if(a.every((v,i)=>v===b[i]))return it.id}
 }
 const id='local:'+name+'|'+hash;
 if(state.items.some(x=>x.id===id)){await put(id,blob);return id;}
 await put(id,blob);state.items.push({id,name,rating:'o',touched:false,comment:''});await save();return id;
}
async function loadZip(file,ids){
 if(!window.JSZip){
   await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';s.onload=ok;s.onerror=no;document.head.append(s)})
 }
 const zip=await JSZip.loadAsync(file);
 if(workflowLocal&&zip.file('technical-review.json')){
  const {entries,current}=await reviewedBundleFromDrive(zip,{characterId:activeCharacter,masterForCharacter:workflow?.masterForCharacter,decode:decodeCropPNG});
  const master=current.master;
  const result=await importReviewedCrops(entries,{items:()=>state.items,get,decode:decodeCropPNG,persist:save,write:async(item,blob)=>{item.characterId=current.characterId;await put(item.id,blob);state.items.push(item);try{await save();}catch(e){state.items=state.items.filter(x=>x!==item);throw e;}}},master,current.characterId);
  ids.push(...result.ids);importErrors.push(...result.errors.map(e=>e.message));return;
 }
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
 if(ids.length)setView(ids);redraw();$('error').textContent=importErrors.join('\n');
 });
 if(workflowLocal&&ids.length)$('selectionTab').click();
};
$('background').onchange=e=>{const value=e.target.value;if(!['checker','white','black'].includes(value))return;state.background=value;visible().forEach(x=>{x.background=value});saveFromCard();redraw()};$('close').onclick=()=>$('zoom').close();
$('setAll').onclick=()=>{if(!confirm('表示中の画像をすべて◯で操作済みにしますか？'))return;visible().forEach(x=>{x.rating='o';x.touched=true;x.revision=crypto.randomUUID();x.evaluatedAt=new Date().toISOString()});saveFromCard();redraw()};
function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}
function exportRows(){return state.items.map(i=>({image_id:i.imageId||i.id,candidate_id:i.candidate||null,attempt_id:i.attemptId||null,drive_file_id:i.driveFileId||null,evaluated_at:i.evaluatedAt||null,revision:i.revision||null,technical_status:i.technicalStatus||null,technical_scope:i.technicalScope||null,save_state:i.saveState||null,crop:i.crop||null,inspection_audit:i.inspectionAudit||null,inspection_history:i.inspectionHistory||[],selection_history:i.selectionHistory||[],filename:i.name,rating:i.touched?i.rating:null,confirmed:i.origin==='crop-local'?isLocalConfirmed(i):!!i.touched,comment:i.comment||''}))}
$('json').onclick=()=>download('sticker-selection-v9.json',JSON.stringify({schema_version:9,drive_synced:false,exported_at:new Date().toISOString(),items:exportRows()},null,2),'application/json');
$('csv').onclick=()=>{const rows=[['image_id','candidate_id','attempt_id','drive_file_id','filename','rating','confirmed','comment','evaluated_at','revision'],...exportRows().map(x=>[x.image_id,x.candidate_id||'',x.attempt_id||'',x.drive_file_id||'',x.filename,x.rating||'',x.confirmed,x.comment,x.evaluated_at||'',x.revision||''])];download('sticker-selection-v9.csv',rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv')};
// Do not write state on initial page load: preserve original v9 localStorage content.
const dbReady=openDb().then(async()=>{if(workflowLocal){const restored=await readSelection();if(restored){state=restored;databaseState=true;}} redraw();});dbReady.catch(e=>$('error').textContent='端末内画像を読み込めません：'+errorText(e));

const auth=driveTest?googleTestAuth():null;
const adapter=auth?new GoogleTestDriveAdapter({getToken:auth.getToken}):!workflowLocal&&params.get('mock')==='1'?new MockDriveAdapter():null;
let busy=false;
async function withBusy(fn){if(busy)return;busy=true;$('list').inert=true;document.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);try{await dbReady;await fn()}catch(e){$('error').textContent=errorText(e)}finally{busy=false;$('list').inert=false;document.querySelectorAll('button,input,select').forEach(x=>x.disabled=false)}}
function driveMessage(message){$('driveStatus').textContent=message}
$('loadPending').onclick=()=>withBusy(async()=>{
 if(!adapter){driveMessage('実Drive連携は未有効です。PNG・ZIPの選抜は補助機能から利用できます。');return}
 driveMessage('保存済みの評価を確認中…');
 const records=await adapter.list(),ids=[],errors=[];
 for(const r of records.filter(x=>adapter.mode==='drive-test' ? x.testFixture&&!x.confirmed : x.folder==='pending'&&!x.confirmed)){
  try{
   if(records.filter(x=>x.imageId===r.imageId||x.driveFileId===r.driveFileId).length!==1)throw Error('重複する画像ID・Drive ID');
   const file=await adapter.metadata(r.driveFileId);assertIdentity(r,file,{allowTestFixture:adapter.mode==='drive-test'});
   if(adapter.mode!=='drive-test'&&file.folder!=='pending')throw Error('選抜待ち以外のPNG');
   const blob=await adapter.image(r.driveFileId);await validatePNG(blob);
   const old=state.items.find(x=>x.id===r.imageId);
   if(old&&(old.candidate!==r.candidate||old.attemptId!==r.attemptId||old.driveFileId!==r.driveFileId))throw Error('保存済みID不一致');
   await put(r.imageId,blob);
   if(!old)state.items.push((driveTest&&recoverDraft(legacyItems,r))||{id:r.imageId,imageId:r.imageId,candidate:r.candidate,attemptId:r.attemptId,driveFileId:r.driveFileId,name:r.filename,phrase:r.phrase||'',rating:'o',touched:false,comment:''});
   ids.push(r.imageId);await save();
  }catch(e){errors.push(r.filename+': '+errorText(e))}
 }
 shownIds=ids;localStorage.setItem(VIEW_KEY,JSON.stringify(ids));redraw();
 driveMessage('読込 '+ids.length+'枚／失敗 '+errors.length+'件。Drive変更なし。'+(errors.length?'\n'+errors.join('\n'):''));
});
$('sync').onclick=()=>withBusy(async()=>{
 if(!adapter){driveMessage('実Drive同期は未有効です。評価JSONを保存できます。');return}
 const selected=visible().filter(x=>x.touched&&x.imageId&&x.driveFileId);
 if(!selected.length){driveMessage('対象の評価済み画像がありません。初期◯は未選抜です。');return}
 // Capture choices before asynchronous operations; no mutable UI state enters a request.
 const choices=selected.map(x=>({imageId:x.imageId,candidate:x.candidate,attemptId:x.attemptId,rating:x.rating,comment:x.comment||'',touched:x.touched,revision:x.revision,evaluatedAt:x.evaluatedAt}));
 if(!confirm(choices.length+'枚の選抜を確定して'+(adapter.mode==='drive-test'?'テスト用Google Drive':'模擬Drive')+'へ同期します。✕のPNGは移動・削除しません。'))return;
 driveMessage('同期中…');
 const steps={starting:'保存済みの評価を確認中',checking:'画像を確認中',recording:'選択を記録中',moving:'フォルダを整理中',saving:'評価を保存中',complete:'保存完了',unchanged:'保存済み・変更なし',error:'この画像は未完了'};
 const run=()=>syncSelections(adapter,choices,{confirmed:true,onProgress:p=>{
  driveMessage(p.stage==='starting'?steps.starting+'…':p.index+'/'+p.total+'枚目：'+(steps[p.stage]||p.stage)+'（'+(p.candidate||'')+'）');
 }});
 const result=await (adapter.confirmRun?adapter.confirmRun(run):run());
 driveMessage('同期 '+result.saved.length+'件／一致 '+result.unchanged.length+'件／失敗 '+result.errors.length+'件'+(result.errors.length?'\n'+result.errors.map(x=>x.imageId+': '+x.message).join('\n'):''));
});
if(adapter)$('mode').textContent=adapter.mode==='drive-test'?'実Driveテスト：既存のテストPNG3枚のみ。制作用データは対象外です。':'模擬Driveモード：本番データには接続しません';
if(auth){$('loadPending').textContent='テスト画像を読み込む';$('disconnect').hidden=false;$('disconnect').onclick=()=>{auth.disconnect();driveMessage('Google接続を端末内で解除しました。画像と評価は保持しています。')};auth.ready.then(()=>driveMessage('Google認証の準備ができました。「テスト画像を読み込む」を押してください。')).catch(e=>driveMessage(errorText(e)));}

async function decodeCropPNG(blob){
 const image=await openPNG(blob);
 try{
  if(image.width!==370||image.height!==320)throw Error('切り出しPNGの寸法が不正');
  const canvas=document.createElement('canvas');
  canvas.width=image.width;
  canvas.height=image.height;
  const context=canvas.getContext('2d');
  context.drawImage(image,0,0);
  return context.getImageData(0,0,canvas.width,canvas.height);
 }finally{image.close();}
}
if(workflowLocal)workflow=initWorkflow({ready:dbReady,characterId:()=>activeCharacter,items:()=>state.items,replaceItems:items=>{state.items=items},visible,put,get,getLocal,setImageReader:reader=>{imageReader=reader;},connectImageReader:token=>{imageReader=createPendingDrive({getToken:()=>token}).original;},retryPreviews:()=>{for(const preview of cards.values())if(preview.visible)void showPreview(preview);},save,setView,setCharacter,redraw,withBusy,isBusy:()=>busy,decode:decodeCropPNG});


