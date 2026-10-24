import {googleTestAuth} from './google-auth.mjs?v=20261023-merge1';
import {createPendingDrive} from './drive-pending.mjs?v=20261024-trial1';
import {importCrops} from './crop-handoff.mjs?v=20261023-bear1';
export function initDrivePending(api,{onLoaded=()=>{}}={}){
 const dialog=document.createElement('dialog');dialog.id='drivePending';dialog.setAttribute('aria-labelledby','drivePendingTitle');
 const title=document.createElement('h2');title.id='drivePendingTitle';title.textContent='Driveの画像を選抜する';
 const description=document.createElement('p');description.textContent='キャラの「00_選抜待ち」から検品済み画像を読み込みます。';
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
 select.onchange=controls;
 async function read(characterId){
  if(api.isBusy())throw Error('別の処理が終わってから読み込んでください。');
  api.setCharacter(characterId);
  let loaded,failure;
  await api.withBusy(async()=>{try{
   status.textContent='キャラと検品記録を確認中…';
   const result=await drive.load(characterId,{decode:api.decode,onProgress:p=>{status.textContent=p.stage==='master'?'セリフと検品記録を照合中…':p.character+'：画像を読み込み中 '+p.done+'／'+p.total+'枚';}});
   if(!result.entries.length){status.textContent=result.character.name+'の選抜待ちはありません。';return;}
   // A pre-existing choice belongs to the user. Loading can add provenance,
   // but may never replace its rating, comment, revision or confirmation.
   for(const e of result.entries){const old=api.items().find(x=>x.imageId===e.record.imageId);if(old?.driveFileId&&old.driveFileId!==e.record.pendingDrive.fileId)throw Error('保存済み画像のDrive IDが異なります。選抜は保持しています。');}
   const imported={ids:[],errors:[]};
   for(const trial of [false,true]){const entries=result.entries.filter(e=>!!e.record.trialSelection===trial);
    for(let start=0;start<entries.length;start+=64){const part=await importCrops(entries.slice(start,start+64),{items:api.items,get:api.get,decode:api.decode,write:async(item,blob)=>{await api.put(item.id,blob);api.items().push(item);try{api.save();}catch(e){api.replaceItems(api.items().filter(x=>x!==item));throw e;}}},result.master,{forSelection:trial});imported.ids.push(...part.ids);imported.errors.push(...part.errors);}
   }
   if(imported.errors.length)throw Error(imported.errors.map(x=>x.message).join(' / '));
   for(const e of result.entries){const item=api.items().find(x=>x.imageId===e.record.imageId);if(item){item.driveFileId=e.record.pendingDrive.fileId;item.characterId=result.character.id;item.crop.pendingDrive=structuredClone(e.record.pendingDrive);}}
   api.save();api.setView(imported.ids,false,{forceReplace:true});api.redraw();
   loaded={...result,count:imported.ids.length};
  }catch(e){failure=e;}});
  if(failure)throw failure;
  if(loaded){dialog.close();onLoaded(loaded);}
 }
 async function run(action){if(busy)return;busy=true;controls();try{await action();}catch(e){status.textContent=e.message||'読み込めませんでした。もう一度お試しください。';}finally{busy=false;controls();}}
 connect.onclick=()=>run(async()=>{
  status.textContent='Googleに接続中…';auth.disconnect();token='';drive=null;token=await auth.getToken();
  drive=createPendingDrive({getToken:()=>token,onUnauthorized:()=>{token='';auth.disconnect();},includeTrials});
  if(target){await read(target);return;}
  status.textContent='選抜待ちのあるキャラを探しています…';const characters=await drive.characters();
  select.replaceChildren(...characters.map(c=>new Option(c.name,c.id)));label.hidden=load.hidden=characters.length===0;
  if(!characters.length){status.textContent='「00_選抜待ち」のあるキャラが見つかりません。画像を保存したGoogleアカウントで接続してください。';return;}
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
