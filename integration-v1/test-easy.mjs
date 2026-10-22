// Simplified, reversible test controls. No Google Drive writes.
import {storageKeys} from './session-store.mjs';
const frame=document.getElementById('cropFrame');
const selection=document.getElementById('selectionScreen');
const advanced=selection?.querySelector('details');
if(advanced){const text=advanced.querySelector('summary');if(text)text.textContent='詳細設定・バックアップ（通常は不要）';}
function deleteDb(name){return new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('別タブでアプリを開いています。閉じてから再試行してください。'));});}
async function newTest(){
 if(!confirm('前の犬など、このテスト画面に保存された未確定の画像・評価・切り出し履歴を端末から消して、新しいパグのテストを開始します。Drive内のファイルは削除しません。必要なものは先にバックアップしてください。続けますか？'))return;
 const path=location.pathname;
 const key=storageKeys({workflowLocal:true,pathname:path});
 try{
   frame.contentWindow?.document?.body?.setAttribute('aria-busy','true');
   // Close the iframe's IndexedDB connections first by navigating it to a blank same-origin page.
   frame.src='about:blank';
   await new Promise(resolve=>setTimeout(resolve,300));
   localStorage.removeItem(key.store);localStorage.removeItem(key.view);
   await new Promise((resolve,reject)=>{const req=indexedDB.open(key.db);req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('images')){db.close();resolve();return;}const tx=db.transaction('images','readwrite');tx.objectStore('images').clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};req.onerror=()=>reject(req.error);});
   const cropName='sticker-crop-v9:workflow:'+new URL('..',new URL('crop-v9/',location.href)).pathname;
   await deleteDb(cropName);
   location.reload();
 }catch(e){alert('初期化できませんでした：'+e.message+'。画像はそのまま保持しています。');location.reload();}
}
function simplifyCrop(){
 const doc=frame.contentDocument;if(!doc)return;
 const main=doc.querySelector('main');if(!main)return;
 if(doc.getElementById('easyModeAdded'))return;
 const bar=doc.createElement('section');bar.id='easyModeAdded';bar.style.cssText='background:#e2eee8;padding:12px;border-radius:12px;margin:12px 0;';
 const heading=doc.createElement('strong');heading.textContent='パグの切り出しテスト：①画像を選ぶ → ②まとめて切り出す → ③選抜へ送る';
 const reset=doc.createElement('button');reset.textContent='前の犬を消して新しいテストを開始';reset.onclick=newTest;
 bar.append(heading,doc.createElement('p'),reset);
 main.insertBefore(bar,main.querySelector('#driveOpen'));
 const run=doc.getElementById('run');if(run){run.textContent='② 選んだ画像を9枚ずつ切り出す';run.style.cssText='display:block;width:100%;font-weight:bold;';}
 const details=doc.createElement('details');details.id='advancedCrop';const summary=doc.createElement('summary');summary.textContent='詳細設定・バックアップ（通常は開かなくてOK）';details.append(summary);
 for(const el of ['grid','prefix','erase','backup','restore','manifest','retry','sourceFilter','showHistory','prevPage','nextPage','pauseQueue']) {
   const node=doc.getElementById(el);if(!node)continue;const wrap=node.closest('label')||node;details.append(wrap);
 }
 const queue=main.querySelector('.queue-panel');if(queue)queue.append(details);else main.append(details);
 const grid=doc.getElementById('grid');if(grid)grid.value='3';
 const legend=doc.getElementById('sourceSelection');if(legend)legend.textContent+='　※前の犬が表示されている場合は「新しいテスト」を押して切り替え';
}
frame.addEventListener('load',simplifyCrop);if(frame.contentDocument?.readyState==='complete')simplifyCrop();
