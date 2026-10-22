import {googleTestAuth} from './google-auth.mjs?v=20261022-character1';
import {prepareExport,createExportDrive,groupCharacters} from './drive-export.mjs?v=20261022-character1';
export function initDriveExport(api){
 const dialog=document.createElement('dialog');dialog.id='driveExport';dialog.setAttribute('aria-labelledby','driveExportTitle');
 const title=document.createElement('h2');title.id='driveExportTitle';title.textContent='キャラ別にGoogle Driveへ保存';
 const description=document.createElement('p');description.textContent='元画像の場所からキャラを判定し、各キャラの「05_選抜結果保存」へ採用PNGと全選抜結果を保存します。ほぼ透明な点を除いてから保存します。';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const connect=document.createElement('button');connect.textContent='保存用のGoogleアカウントに接続';connect.disabled=true;
 const fallbackLabel=document.createElement('label');fallbackLabel.textContent='元画像の場所が不明な場合だけ：キャラフォルダのDrive URL';
 const fallback=document.createElement('input');fallback.type='url';fallback.placeholder='「変な犬」などのキャラフォルダURL';fallbackLabel.append(fallback);
 const note=document.createElement('p');note.textContent='Googleの確認画面でDriveへのアクセス許可が必要です。キャラの確認と専用フォルダへの保存に使います。保存先の確認中は書き込みません。';
 const check=document.createElement('button');check.textContent='保存先と枚数を確認';check.disabled=true;
 const destinations=document.createElement('ul');
 const save=document.createElement('button');save.textContent='確認したキャラフォルダ内へ保存';save.disabled=true;
 const links=document.createElement('div');const close=document.createElement('button');close.textContent='閉じる';close.onclick=()=>dialog.close();
 dialog.append(title,description,status,connect,fallbackLabel,note,check,destinations,save,links,close);document.body.append(dialog);
 let auth,token='',drive,account,busy=false,authReady=false,groups=null;
 const journal={readJournal:key=>localStorage.getItem(key),writeJournal:(key,value)=>{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('再開用の記録を端末に保存できません。');}};
 function invalidate(){groups=null;destinations.replaceChildren();save.disabled=true;}
 function lock(value){busy=value;for(const el of [connect,fallback,close])el.disabled=value;check.disabled=value||!account;save.disabled=value||!account||!groups;}
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});fallback.oninput=invalidate;
 async function encode(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data),im.width,im.height),0,0);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('透過仕上げのPNGを作れません。')),'image/png'));}
 async function preview(){invalidate();await api.ready;let manual;if(fallback.value.trim()){const url=new URL(fallback.value.trim());if(url.origin!=='https://drive.google.com'||!/^\/drive\/folders\/[-\w]+\/?$/.test(url.pathname))throw Error('Google DriveのキャラフォルダURLを入力してください。');manual=await drive.characterFolder(url.pathname.split('/')[3]);}
 const next=await groupCharacters(structuredClone(api.visible()),{resolve:drive.character,fallback:manual});
 // Prepare every group before the first write. Failed detection never partially routes a batch.
 for(const g of next)g.plan=await prepareExport(g.items,{get:api.get,decode:api.decode,encode});
 for(const g of next){const li=document.createElement('li');li.textContent=g.character.name+' → 05_選抜結果保存 ／ 採用PNG '+g.plan.counts.adopted+'枚＋選抜結果JSON';destinations.append(li);}groups=next;status.textContent='保存先を確認しました。下の保存ボタンで書き込みます。';
 }
 connect.onclick=async()=>{lock(true);invalidate();try{status.textContent='Googleに接続中…';account=null;auth.disconnect();token=await auth.getToken();drive=createExportDrive({getToken:()=>token,...journal});account=await drive.account();await preview();}catch(e){status.textContent=e.message;}finally{lock(false);}};
 check.onclick=async()=>{if(busy||!account)return;lock(true);try{await preview();}catch(e){status.textContent=e.message;}finally{lock(false);}};
 save.onclick=async()=>{if(busy||!account||!groups)return;lock(true);links.replaceChildren();try{
 // Refresh the snapshot so changes made outside this dialog are never silently omitted.
 const previous=groups.map(g=>[g.character.id,g.plan.key]);await preview();if(JSON.stringify(previous)!==JSON.stringify(groups.map(g=>[g.character.id,g.plan.key])))throw Error('選抜内容または保存先が変わりました。表示を確認して、もう一度保存を押してください。');
 for(const g of groups){const result=await drive.save(g.plan,{accountId:account.permissionId,characterId:g.character.id,onProgress:p=>status.textContent=g.character.name+'を保存中 '+p.done+'／'+p.total+'件'});const a=document.createElement('a');a.textContent=g.character.name+'の保存フォルダを開く';a.href=result.link;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createElement('br'));}
 status.textContent='Driveに保存しました。'+groups.length+'キャラ分のPNGと選抜記録を照合しました。';
 }catch(e){status.textContent='保存を完了できませんでした：'+e.message+' 同じ内容で再開すると保存済み分を照合します。';}finally{lock(false);}};
 function open(){if(dialog.open)return;invalidate();links.replaceChildren();status.textContent='Googleに接続して、キャラ別の保存先を確認してください。';connect.disabled=!authReady;check.disabled=!account;dialog.showModal();if(!auth){auth=googleTestAuth();auth.ready.then(()=>{authReady=true;connect.disabled=false;}).catch(e=>status.textContent=e.message);}}
 const button=document.createElement('button');button.id='saveToDrive';button.className='primary';button.textContent='Google Driveに保存';button.onclick=open;document.getElementById('syncBar').append(button);return {open};
}
