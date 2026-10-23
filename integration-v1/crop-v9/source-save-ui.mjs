import {googleTestAuth} from '../google-auth.mjs';
import {prepareSources,createSourceSave} from './source-save.mjs';
export function initSourceSave(){
 const $=id=>document.getElementById(id),panel=document.createElement('section');panel.setAttribute('aria-label','元画像PNGのDrive保存');
 panel.innerHTML='<details><summary>3×3元画像PNGをDriveに保存</summary><p>上でiPhoneから選んだPNGを、加工せず1枚ずつ保存します。保存と切り出しは別の工程です。</p><label>キャラフォルダのDrive URL<input id="sourceCharacter" type="url" placeholder="キャラフォルダのURL"></label><p>保存先はキャラ内の「03_元画像・生成履歴」。保存用Google接続では、既存フォルダの照合と新規PNG保存のためDrive権限を使います。</p><button id="sourceConnect">保存用Googleに接続</button><button id="sourceSave" disabled>選んだ元画像PNGをDriveに保存する</button><button id="sourceDisconnect">保存用Google接続を解除</button><p id="sourceSaveStatus" role="status" aria-live="polite">元画像は未保存です。技術検品の合格とは別です。</p><ol id="sourceSaveResults"></ol></details>';
 $('sourceSelection').after(panel);
 let auth,token='',drive,busy=false;
 const prefix='original-save:'+location.pathname+':';
 const readJournal=k=>localStorage.getItem(prefix+k),writeJournal=(k,v)=>localStorage.setItem(prefix+k,v);
 function lock(value){busy=value;for(const key of ['sourceConnect','sourceSave','sourceDisconnect','sourceCharacter'])$(key).disabled=value||key==='sourceSave'&&!token;}
 function render(rows){$('sourceSaveResults').replaceChildren();for(const r of rows){const li=document.createElement('li');li.textContent=r.originalName+' ／ 照合済み ／ ID: '+r.fileId+(r.reused?'（保存済みを再利用）':'');$('sourceSaveResults').append(li);}}
 $('sourceConnect').onclick=async()=>{if(busy)return;lock(true);try{auth??=googleTestAuth();await auth.ready;token=await auth.getToken();drive=createSourceSave({getToken:()=>token,readJournal,writeJournal});$('sourceSaveStatus').textContent='接続しました。キャラの保存先とPNGを確認して、保存ボタンを押してください。';}catch(e){token='';$('sourceSaveStatus').textContent=e.message;}finally{lock(false);}};
 $('sourceDisconnect').onclick=()=>{if(busy)return;auth?.disconnect();token='';drive=null;lock(false);$('sourceSaveStatus').textContent='保存用接続を解除しました。照合記録は保持しています。';};
 $('sourceSave').onclick=async()=>{if(busy||!drive)return;lock(true);const rows=[];render(rows);try{
  if($('grid').value!=='3')throw Error('元画像保存は3×3用です。配置を3×3にしてください');
  const url=new URL($('sourceCharacter').value.trim());if(url.origin!=='https://drive.google.com'||!/^\/drive\/folders\/[-\w]+\/?$/.test(url.pathname))throw Error('キャラフォルダのDrive URLを入力してください');
  const files=[...$('files').files],plan=await prepareSources(files);
  // Decode before writes: PNG signature alone does not prove a readable image.
  for(const entry of plan.entries){const bitmap=await createImageBitmap(entry.blob);try{if(bitmap.width!==entry.width||bitmap.height!==entry.height)throw Error('PNGのサイズを照合できません');}finally{bitmap.close();}}
  $('sourceSaveStatus').textContent='元画像の保存・再読込・重複照合中…';
  const execute=()=>drive.save(plan,url.pathname.split('/')[3],verified=>{rows.splice(0,rows.length,...verified);render(rows);$('sourceSaveStatus').textContent='照合済み '+rows.length+' / '+plan.entries.length+'枚';});
  if(!navigator.locks)throw Error('安全な保存に必要なブラウザーのロック機能がありません。Safariを更新してください');
  const result=await navigator.locks.request('animal-stickers-source-save',{ifAvailable:true},lock=>{if(!lock)throw Error('別のタブで保存中です。完了後に再開してください');return execute();});
  const report={...result,at:new Date().toISOString()};localStorage.setItem(prefix+'report:'+crypto.randomUUID(),JSON.stringify(report));
  $('sourceSaveStatus').textContent=result.character+' ／ 保存照合済み '+result.count+'枚 ／ 選択内の同一PNG '+result.duplicateInputs+'枚を除外 ／ Drive内の重複なし。切り出し・技術検品は別途実行してください。';
 }catch(e){$('sourceSaveStatus').textContent='照合済み '+rows.length+'枚。他の保存状態は未確認：'+e.message+' 同じPNGで再開できます。';}finally{lock(false);}};
}
