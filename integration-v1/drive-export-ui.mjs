import {createBusyScreen} from './busy-screen.mjs?v=20261023-merge1';
import {googleTestAuth} from './google-auth.mjs?v=20261024-auth1';
import {prepareExport,confirmForExport,createExportDrive,groupCharacters,exportSummary} from './drive-export.mjs?v=20261024-save1';
export function initDriveExport(api,{authFactory=googleTestAuth,driveFactory=createExportDrive}={}){
 const dialog=document.createElement('dialog');dialog.id='driveExport';dialog.setAttribute('aria-labelledby','driveExportTitle');
 const title=document.createElement('h2');title.id='driveExportTitle';title.textContent='選抜結果をGoogle Driveへ保存';
 const description=document.createElement('p');description.textContent='◯のPNGは「01_採用予定」、△は「02_保留」へ保存します。試用画像も候補として保存し、技術検品の合否は別に保持します。✕の画像と過去の履歴は削除しません。';
 const status=document.createElement('p');status.id='driveExportStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const advanced=document.createElement('details'),heading=document.createElement('summary'),fallback=document.createElement('input');heading.textContent='保存先を指定する（自動判定できない場合）';fallback.type='url';fallback.setAttribute('aria-label','キャラフォルダのDrive URL');fallback.placeholder='https://drive.google.com/drive/folders/…';advanced.append(heading,fallback);
 const destinations=document.createElement('ul'),links=document.createElement('div'),close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>dialog.close();
 dialog.append(title,description,status,advanced,destinations,links,close);document.body.append(dialog);
 const processing=createBusyScreen({watch:status}),preparedCache=new Map();let auth,authReady=false,busy=false;
 const journal={readJournal:key=>localStorage.getItem(key),writeJournal:(key,value)=>{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('再開用の記録を端末に保存できません。');}};
 const button=document.createElement('button');button.id='saveToDrive';button.className='primary';button.textContent='Google Driveに保存';button.disabled=true;document.getElementById('syncBar').append(button);
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 function lock(value){busy=value;close.disabled=value;button.disabled=value||!authReady;dialog.setAttribute('aria-busy',String(value));if(value)processing.show('選抜結果を保存しています…');else processing.hide();}
 async function encode(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data),im.width,im.height),0,0);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('透過仕上げのPNGを作れません。')),'image/png'));}
 async function save(tokenPromise){lock(true);links.replaceChildren();destinations.replaceChildren();try{
  status.textContent='Googleに接続中…';const token=await tokenPromise,drive=driveFactory({getToken:()=>token,...journal}),account=await drive.account();
  status.textContent='選択内容を確定中…';await confirmForExport(api);
  let manual;if(fallback.value.trim()){const u=new URL(fallback.value.trim());if(u.origin!=='https://drive.google.com'||!/^\/drive\/folders\/[-\w]+\/?$/.test(u.pathname))throw Error('Google DriveのキャラフォルダURLを入力してください。');manual=await drive.characterFolder(u.pathname.split('/')[3]);}
  const groups=await groupCharacters(structuredClone(api.visible()),{resolve:drive.character,fallback:manual});
  // Prepare every character before the first remote write.
  for(const g of groups){g.plan=await prepareExport(g.items,{get:api.get,decode:api.decode,encode,preparedCache,onProgress:p=>{status.textContent=g.character.name+'：画像を確認中…';processing.progress(p.done,p.total);}});const li=document.createElement('li');li.textContent=g.character.name+' ／ '+exportSummary([g.plan]);destinations.append(li);}
  for(const g of groups){const result=await drive.save(g.plan,{accountId:account.permissionId,characterId:g.character.id,onProgress:p=>{status.textContent=g.character.name+'：Driveに保存・照合中…';processing.progress(p.done,p.total);}});const a=document.createElement('a');a.textContent=g.character.name+'の保存先を開く';a.href=result.link;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createElement('br'));}
  status.textContent='Drive保存・照合が完了しました。'+exportSummary(groups.map(g=>g.plan));
 }catch(e){status.textContent='保存は完了していません：'+(e.message||'通信に失敗しました。')+' 選抜結果は端末に残っています。「Google Driveに保存」で再試行できます。';}finally{lock(false);}}
 function open(){if(busy)return;if(!dialog.open)dialog.showModal();if(!authReady){status.textContent='Google接続を準備しています。保存ボタンが有効になってから押してください。';return;}
  // Request the popup within this click, before any asynchronous work.
  let token;try{token=auth.getToken();}catch(e){status.textContent=e.message;return;}void save(token);
 }
 button.onclick=open;auth=authFactory();auth.ready.then(()=>{authReady=true;button.disabled=false;}).catch(e=>{status.textContent=e.message;document.getElementById('driveStatus').textContent=e.message;});return {open};
}
