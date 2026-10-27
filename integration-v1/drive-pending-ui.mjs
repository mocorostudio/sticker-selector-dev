import {restoreEvaluation} from './reselection.mjs?v=20261025-reselectall1';
import {googleTestAuth} from './google-auth.mjs?v=20261023-merge1';
import {createPendingDrive} from './drive-pending.mjs?v=20261026-inspected1';
import {importCrops} from './crop-handoff.mjs?v=20261026-inspected1';
export function initDrivePending(api,{onLoaded=()=>{}}={}){
 const dialog=document.createElement('dialog');dialog.id='drivePending';dialog.setAttribute('aria-labelledby','drivePendingTitle');
 const title=document.createElement('h2');title.id='drivePendingTitle';title.textContent='Driveの画像を選抜する';
 const description=document.createElement('p');description.textContent='キャラを選んで画像を読み込みます。採用・保留・不採用を含む全候補を再表示します。検品未確定の画像は仮選抜として表示します。';
 const status=document.createElement('p');status.id='drivePendingStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const connect=document.createElement('button');connect.id='pendingConnect';connect.textContent='Googleに接続して読み込む';connect.disabled=true;
 const label=document.createElement('label');label.textContent='選ぶキャラ';label.hidden=true;
 const select=document.createElement('select');select.id='pendingCharacter';label.append(select);
 const load=document.createElement('button');load.id='pendingLoad';load.textContent='このキャラの画像を読み込む';load.hidden=true;
 const close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>dialog.close();
 dialog.append(title,description,status,connect,label,load,close);document.body.append(dialog);
 const params=new URLSearchParams(location.search),target=params.get('character'),includeTrials=params.get('selectionMode')==='trial';
 if(includeTrials)description.textContent='外周線を残した試用画像も読み込みます。◯△✕は試用選抜として記録し、申請用の合格にはしません。';
 let auth,ready=false,token='',drive,busy=false;
 const controls=()=>{connect.disabled=busy||!ready;select.disabled=busy;load.disabled=busy||!select.value;close.disabled=busy;dialog.setAttribute('aria-busy',String(busy));};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 select.onchange=()=>{api.setCharacter(select.value);controls();};
 const progress=document.createElement('p');progress.id='drivePendingProgress';progress.setAttribute('role','status');progress.setAttribute('aria-live','polite');progress.hidden=true;document.getElementById('list').before(progress);
 const report=text=>{status.textContent=text;progress.textContent=text;};
 async function read(characterId){
  if(api.isBusy())throw Error('別の処理が終わってから読み込んでください。');
  await api.ready;api.setCharacter(characterId);
  const ids=api.visible().map(x=>x.id);let received=0;
  progress.hidden=false;report('キャラと検品記録を確認中…');
  try{
   const result=await drive.load(characterId,{allCandidates:true,decode:api.decode,
    getCachedBytes:async({record,image,sha256})=>{const old=api.items().find(x=>x.imageId===record.imageId),proof=old?.crop?.pendingDrive;if(!proof||!image.version||proof.version!==String(image.version)||proof.sha256!==sha256||proof.fileId!==image.id)return null;const blob=await api.get(old.id);return blob?blob.arrayBuffer():null;},
    onProgress:p=>report(p.stage==='master'?'セリフと検品記録を照合中…':p.character+'：'+p.done+'／'+p.total+'枚読み込み済み。表示された画像から選べます。'),
    onEntry:async({entry:e,master,done,total})=>{
     // A short local save or another operation may finish first; the network
     // loader itself must never make the selection list inert.
     while(api.isBusy())await new Promise(resolve=>setTimeout(resolve,50));
     const old=api.items().find(x=>x.imageId===e.record.imageId);
     if(old?.driveFileId&&e.record.pendingDrive.fileId&&old.driveFileId!==e.record.pendingDrive.fileId)throw Error('保存済み画像のDrive IDが異なります。選抜は保持しています。');
     const part=await importCrops([e],{items:api.items,get:api.get,decode:api.decode,write:async(item,blob)=>{await api.put(item.id,blob);api.items().push(item);try{api.save();}catch(error){api.replaceItems(api.items().filter(x=>x!==item));throw error;}}},master,{forSelection:!!e.record.trialSelection||e.record.draftSelection===true});
     if(part.errors.length)throw Error(part.errors.map(x=>x.message).join(' / '));
     const item=api.items().find(x=>x.imageId===e.record.imageId);
     restoreEvaluation(item,e.savedEvaluation);
     if(e.record.pendingDrive.fileId)item.driveFileId=e.record.pendingDrive.fileId;item.characterId=characterId;item.crop.pendingDrive=structuredClone(e.record.pendingDrive);
     api.save();for(const id of part.ids)if(!ids.includes(id))ids.push(id);
     api.setView(ids,false,{forceReplace:true});api.redraw({appendOnly:true});received=done;
     if(dialog.open)dialog.close();report(done+'／'+total+'枚読み込み済み。残りを読み込みながら選べます。');
    }});
   if(!result.entries.length){report(result.character.name+'の候補は見つかりません。');return;}
   report(result.entries.length+'枚の読み込みが完了しました。');
   onLoaded({...result,count:result.entries.length});
  }catch(error){report('読み込みは途中で止まりました：'+error.message+(received?' 読み込み済み'+received+'枚と選抜結果は残っています。残りは再接続して読み込めます。':''));error.pendingReported=true;throw error;}
 }
 async function run(action){if(busy)return;busy=true;controls();try{await action();}catch(e){if(!e.pendingReported)report(e.message||'読み込めませんでした。もう一度お試しください。');}finally{busy=false;controls();}}
 connect.onclick=()=>run(async()=>{
  status.textContent='Googleに接続中…';auth.disconnect();token='';drive=null;token=await auth.getToken();
  drive=createPendingDrive({getToken:()=>token,onUnauthorized:()=>{token='';auth.disconnect();},includeTrials,onRetry:p=>report('通信が遅れているため再試行中（'+p.attempt+'／'+p.max+'）。表示済みの画像は選べます。')});
  status.textContent='指定キャラと選抜待ちを確認しています…';const characters=await drive.characters({preferredId:target});
  select.replaceChildren(...characters.map(c=>new Option(c.name,c.id)));label.hidden=load.hidden=characters.length===0;
  if(!characters.length){status.textContent='「00_選抜待ち」のあるキャラが見つかりません。画像を保存したGoogleアカウントで接続してください。';return;}
  if(target&&characters.some(c=>c.id===target))select.value=target;
  if(characters.length===1){await read(characters[0].id);return;}
  status.textContent='選ぶキャラを選んで、読み込みを押してください。';
 });
 load.onclick=()=>run(()=>read(select.value));
 function open(){
  if(dialog.open)return;status.textContent=ready?'Googleに接続すると画像を読み込みます。':'Google接続を準備中…';dialog.showModal();controls();
  if(!auth){auth=googleTestAuth({readOnly:true});auth.ready.then(()=>{ready=true;controls();if(dialog.open)status.textContent='「Googleに接続して読み込む」を押してください。';}).catch(e=>status.textContent=e.message);}
 }
 return {open};
}
