import {createBusyScreen} from './busy-screen.mjs?v=20261022-submit1';
import {googleTestAuth} from './google-auth.mjs?v=20261022-submit1';
import {prepareExport,createExportDrive,groupCharacters} from './drive-export.mjs?v=20261022-submit1';
export function initDriveExport(api){
 const dialog=document.createElement('dialog');dialog.id='driveExport';dialog.setAttribute('aria-labelledby','driveExportTitle');
 const title=document.createElement('h2');title.id='driveExportTitle';title.textContent='キャラ別にGoogle Driveへ保存';
 const description=document.createElement('p');description.textContent='元画像の場所からキャラを判定し、各キャラの◯は「01_採用予定」、△は「02_保留」へPNGを保存します。評価・コメントの記録は「03_元画像・生成履歴」に残します。△の画像名はHOLD_で始まります。ほぼ透明な点を除いてから保存します。';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const connect=document.createElement('button');connect.textContent='保存用のGoogleアカウントに接続';connect.disabled=true;
 const fallbackLabel=document.createElement('label');fallbackLabel.textContent='元画像の場所が不明な場合だけ：キャラフォルダのDrive URL';
 const fallback=document.createElement('input');fallback.type='url';fallback.placeholder='「変な犬」などのキャラフォルダURL';fallbackLabel.append(fallback);
 const note=document.createElement('p');note.textContent='Googleの確認画面でDriveへのアクセス許可が必要です。キャラの確認と専用フォルダへの保存に使います。保存先の確認中は書き込みません。';
 const check=document.createElement('button');check.textContent='① 透過仕上げ・保存準備';check.disabled=true;
 const destinations=document.createElement('ul');
 const save=document.createElement('button');save.textContent='② 準備したPNGをDriveへ送信';save.disabled=true;
 const links=document.createElement('div');const close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>dialog.close();
 dialog.append(title,description,status,connect,fallbackLabel,note,check,destinations,save,links,close);document.body.append(dialog);
 const processing=createBusyScreen({watch:status}),preparedCache=new Map();
 let auth,token='',drive,account,busy=false,authReady=false,groups=null;
 const journal={readJournal:key=>localStorage.getItem(key),writeJournal:(key,value)=>{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('再開用の記録を端末に保存できません。');}};
 function invalidate(){groups=null;destinations.replaceChildren();save.disabled=true;}
 function lock(value){busy=value;dialog.setAttribute('aria-busy',String(value));if(value)processing.show('処理を準備しています…');else processing.hide();for(const el of [connect,fallback,close])el.disabled=value;check.disabled=value||!account;save.disabled=value||!account||!groups;}
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});fallback.oninput=invalidate;
 async function encode(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data),im.width,im.height),0,0);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('透過仕上げのPNGを作れません。')),'image/png'));}
 async function resolveGroups(){await api.ready;let manual;if(fallback.value.trim()){const url=new URL(fallback.value.trim());if(url.origin!=='https://drive.google.com'||!/^\/drive\/folders\/[-\w]+\/?$/.test(url.pathname))throw Error('Google DriveのキャラフォルダURLを入力してください。');manual=await drive.characterFolder(url.pathname.split('/')[3]);}
 status.textContent='元画像からキャラ別の保存先を確認中…';
 return groupCharacters(structuredClone(api.visible()),{resolve:drive.character,fallback:manual});
 }
 async function preview(){invalidate();const next=await resolveGroups();
 // Prepare every group before the first write. Failed detection never partially routes a batch.
 for(const g of next)g.plan=await prepareExport(g.items,{get:api.get,decode:api.decode,encode,preparedCache,onProgress:p=>{status.textContent=g.character.name+"の透過仕上げ・保存準備中…";processing.progress(p.done,p.total);}});
 for(const g of next){const li=document.createElement('li');li.textContent=g.character.name+' ／ 01_採用予定：'+g.plan.counts.adopted+'枚 ／ 02_保留：'+g.plan.counts.held+'枚＋選抜結果JSON';destinations.append(li);}groups=next;status.textContent='① 透過仕上げ・保存準備が完了しました。②を押すとDriveへの送信を始めます。';
 }
 connect.onclick=async()=>{lock(true);invalidate();try{status.textContent='Googleに接続中…';account=null;auth.disconnect();token=await auth.getToken();drive=createExportDrive({getToken:()=>token,...journal});account=await drive.account();await preview();}catch(e){status.textContent=e.message;}finally{lock(false);}};
 check.onclick=async()=>{if(busy||!account)return;lock(true);try{await preview();}catch(e){status.textContent=e.message;}finally{lock(false);}};
 save.onclick=async()=>{if(busy||!account||!groups)return;lock(true);links.replaceChildren();try{
 // Refresh the snapshot so changes made outside this dialog are never silently omitted.
 status.textContent='送信前に選抜内容と保存先を確認中…';const current=await resolveGroups(),snapshot=xs=>JSON.stringify(xs.map(g=>[g.character.id,g.items]));if(snapshot(groups)!==snapshot(current)){invalidate();throw Error('選抜内容または保存先が変わりました。①で保存準備をやり直してください。');}
 for(const g of groups){status.textContent=g.character.name+'の保存先を照合中…';processing.show(status.textContent);const result=await drive.save(g.plan,{accountId:account.permissionId,characterId:g.character.id,onProgress:p=>{status.textContent=g.character.name+'をDriveに保存・照合中…';processing.progress(p.done,p.total);}});const a=document.createElement('a');a.textContent=g.character.name+'の保存フォルダを開く';a.href=result.link;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createElement('br'));}
 status.textContent='Driveに保存しました。'+groups.length+'キャラ分のPNGと選抜記録を照合しました。';
 }catch(e){status.textContent='保存を完了できませんでした：'+e.message+' 同じ内容で再開すると保存済み分を照合します。';}finally{lock(false);}};
 function open(){if(dialog.open)return;invalidate();links.replaceChildren();status.textContent='Googleに接続して、キャラ別の保存先を確認してください。';connect.disabled=!authReady;check.disabled=!account;dialog.showModal();if(!auth){auth=googleTestAuth();auth.ready.then(()=>{authReady=true;connect.disabled=false;}).catch(e=>status.textContent=e.message);}}
 const button=document.createElement('button');button.id='saveToDrive';button.className='primary';button.textContent='Google Driveに保存';button.onclick=open;document.getElementById('syncBar').append(button);return {open};
}
