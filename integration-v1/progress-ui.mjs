import {GROUPS,SCHEMA,nextTask,localCounts,validateProgress} from './progress-core.mjs';
import {progressDrive} from './progress-drive.mjs';
import {googleTestAuth} from './google-auth.mjs';
import {storageKeys} from './session-store.mjs';
const $=id=>document.getElementById(id),KEY='sticker-progress-v1:'+location.pathname,QUEUE=KEY+':pending';
let records=[],filter='all',drive,editing,busy=false,live=false,cache;
try{cache=JSON.parse(localStorage.getItem(KEY));if(cache?.records){validateProgress({schema:SCHEMA,records:cache.records.filter(r=>r.updatedAt)});records=cache.records;}}catch{$('error').textContent='端末内の控えを読み込めません。Googleから最新の一覧を読み込んでください。';}
const readAuth=googleTestAuth({readOnly:true});let writeAuth;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url){const a=node('a',text);a.href=url;a.target='sticker-workflow';a.rel='noopener';return a;}
function items(){try{const path=location.pathname.replace(/progress\.html$/,'workflow.html');return JSON.parse(localStorage.getItem(storageKeys({workflowLocal:true,pathname:path}).store))?.items||[];}catch{return [];}}
function card(r){const a=node('article',undefined,'card');a.append(node('span',GROUPS[r.stage],'badge'),node('h3',r.name),node('p',r.next));
 a.append(node('small',(r.updatedAt?new Date(r.updatedAt).toLocaleString('ja-JP'):'更新日時未確認')+' · '+r.source));
 const c=localCounts(items(),r.characterId);if(c.total)a.append(node('small','この端末：操作済み '+c.rated+'／'+c.total+'枚（同期・検品の完了とは別）'));
 const actions=node('div',undefined,'actions');if(r.stage==='you')actions.append(link('選抜画面を開く ↗','workflow.html?character='+encodeURIComponent(r.characterId)));
 const edit=node('button',r.stage==='trash'?'復元する':'進捗を更新');edit.disabled=!live;edit.onclick=()=>open(r);actions.append(edit);a.append(actions);
 const d=node('details'),s=node('summary','マスター・保存先・過去記録');d.append(s,node('p','過去の保存状況：'+r.legacy),node('p','過去の申請状況：'+r.legacyApplication));
 for(const [name,url] of [['マスター',r.master],['保存フォルダ',r.folder]]){try{const u=new URL(url);if(u.protocol==='https:'&&['docs.google.com','drive.google.com'].includes(u.hostname))d.append(link(name,url),document.createTextNode('　'));}catch{}}
 a.append(d);return a;}
function render(){
 $('filters').replaceChildren();for(const [k,label] of [['all','すべて'],...Object.entries(GROUPS)]){const count=k==='all'?records.filter(r=>r.stage!=='trash').length:records.filter(r=>r.stage===k).length;const b=node('button',label+' '+count);b.setAttribute('aria-pressed',String(filter===k));b.onclick=()=>{filter=k;render();};$('filters').append(b);}
 const next=nextTask(records);$('focus').replaceChildren(next?card(next):node('p',records.length?'今すぐあなたが確認する作業は登録されていません。ルイの作業待ちを確認できます。':'Googleに接続すると、現在の一覧が表示されます。'));
 $('groups').replaceChildren();for(const [k,label] of Object.entries(GROUPS)){if(filter==='all'&&k==='trash'||filter!=='all'&&filter!==k)continue;const rows=records.filter(r=>r.stage===k);if(!rows.length)continue;const section=node('section'),cards=node('div',undefined,'cards');section.append(node('h2',label+' · '+rows.length));rows.forEach(r=>cards.append(card(r)));section.append(cards);$('groups').append(section);}
}
async function connect(){if(busy)return;busy=true;$('connect').disabled=true;$('error').textContent='';try{const token=await readAuth.getToken();drive=progressDrive({getToken:()=>token});const data=await drive.load();records=data.records;live=true;cache=data;localStorage.setItem(KEY,JSON.stringify(data));$('status').textContent='最新読込：'+new Date(data.loadedAt).toLocaleString('ja-JP');if(!writeAuth){writeAuth=googleTestAuth();await writeAuth.ready;}render();}catch(e){live=false;$('error').textContent=e.message;render();}finally{busy=false;$('connect').disabled=false;}}
function open(r){editing=r;$('editTitle').textContent=r.name;$('stage').value=r.stage==='trash'?'hold':r.stage;$('next').value=r.next;$('priority').value=String([1,10,50].includes(r.priority)?r.priority:50);$('editError').textContent='';let pending;try{pending=JSON.parse(localStorage.getItem(QUEUE));}catch{}if(pending){$('editError').textContent='前回の保存を照合するため、先に同じ記録を再送します。';$('stage').value=pending.doc.records[0].stage;$('next').value=pending.doc.records[0].next;$('priority').value=String(pending.doc.records[0].priority);editing=records.find(x=>x.characterId===pending.doc.records[0].characterId);$('editTitle').textContent=editing?.name||'前回の進捗記録';}$('editor').showModal();}
for(const [value,label] of Object.entries(GROUPS))$('stage').append(new Option(label,value));
const suggestions={you:'使いたい画像を選ぶ（選抜準備が確認済みの場合）',lui:'保存・切り出し・技術検品の現在地を確認する',hold:'再開するまで保留',submitted:'LINEの審査結果を確認する',selling:'販売状況を確認する',unknown:'ルイが現在地を照合する',trash:'作品フォルダをDriveのゴミ箱へ移動済み'};
$('stage').onchange=()=>{$('next').value=suggestions[$('stage').value];};
$('cancel').onclick=()=>$('editor').close();
$('editForm').onsubmit=async e=>{e.preventDefault();if(busy||!editing)return;let queued=JSON.parse(localStorage.getItem(QUEUE)||'null');if(!queued&&($('stage').value==='trash'||editing.stage==='trash')&&!confirm(editing.name+'\n\n'+($('stage').value==='trash'?'元画像・キャラ別マスター・申請ZIPを含む作品フォルダ全体をDriveのゴミ箱へ移動します。全体管理マスター・進捗履歴・端末の選抜データは残します。完全削除はしません。':'作品フォルダをDriveのゴミ箱から復元し、保留など選んだ現在地へ戻します。')))return;busy=true;$('save').disabled=$('cancel').disabled=true;try{
 const token=await writeAuth.getToken(),writer=progressDrive({getToken:()=>token});const latest=await writer.load();let pending=JSON.parse(localStorage.getItem(QUEUE)||'null');
 if(pending&&pending.root!==latest.root)throw Error('前回と保存先のGoogleアカウントが異なります。元のアカウントで接続してください。');
 if(!pending){const record={characterId:editing.characterId,stage:$('stage').value,next:$('next').value.trim(),priority:Number($('priority').value),updatedAt:new Date().toISOString(),source:'ユーザーが進捗画面で更新',...(($('stage').value==='trash'||editing.stage==='trash')?{folderTrashed:$('stage').value==='trash'}:{})};pending={root:latest.root,doc:{schema:SCHEMA,records:[record]},fileId:await writer.reserve()};localStorage.setItem(QUEUE,JSON.stringify(pending));}
 const action=pending.doc.records[0];if(typeof action.folderTrashed==='boolean')await writer.setFolderTrashed(action.characterId,action.folderTrashed,{confirmed:true});
 await writer.save(pending.doc,pending.fileId);localStorage.removeItem(QUEUE);const data=await writer.load();records=data.records;cache=data;localStorage.setItem(KEY,JSON.stringify(data));$('status').textContent='Driveに新しい履歴を保存・照合しました。';$('editor').close();render();
 }catch(e){$('editError').textContent=e.message+' フォルダ移動済みでも履歴保存が未完了の場合があります。入力を保持しています。もう一度保存すると、同じ記録を再照合します。';}finally{busy=false;$('save').disabled=$('cancel').disabled=false;}};
$('connect').onclick=connect;readAuth.ready.then(()=>{$('connect').disabled=false;$('status').textContent=cache?'端末内の控えを表示中。Googleに接続して最新の状態を確認してください。':'Googleに接続すると制作一覧を表示します。';}).catch(e=>{$('error').textContent=e.message;});
$('disconnect').onclick=()=>{readAuth.disconnect();writeAuth?.disconnect();records=[];live=false;cache=null;localStorage.removeItem(KEY);$('status').textContent='接続を解除しました。元の進捗履歴と選抜データは残っています。';render();};
window.addEventListener('storage',()=>render());render();
