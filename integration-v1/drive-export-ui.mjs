import {googleTestAuth} from './google-auth.mjs?v=20261024-auth1';
import {prepareExport,confirmForExport,createExportDrive,groupCharacters,exportSummary} from './drive-export.mjs?v=20261025-pngsave1';
export function initDriveExport(api,{authFactory=googleTestAuth,driveFactory=createExportDrive,onSnapshot=()=>{}}={}){
 const params=new URLSearchParams(location.search),trial=params.get('selectionMode')==='trial';
 const tray=document.createElement('aside');tray.id='driveExport';tray.hidden=true;tray.setAttribute('aria-label','Google Driveの保存状況');
 const status=document.createElement('p');status.id='driveExportStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const progress=document.createElement('progress');progress.setAttribute('aria-label','Driveに保存・照合した画像');progress.hidden=true;
 const note=document.createElement('small');note.textContent='選択は端末に自動保存されます。Drive保存中も申請候補を選べます。';
 const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='保存先・詳細';
 const description=document.createElement('p');description.textContent='◯は01_採用予定、△は02_保留へ保存します。技術検品の合否は別に保持します。申請候補の選択は端末に自動保存され、LINEへの申請は行いません。';
 const fallback=document.createElement('input');fallback.type='url';fallback.setAttribute('aria-label','キャラフォルダのDrive URL');fallback.placeholder='保存先を指定する場合はキャラフォルダのDrive URL';
 const destinations=document.createElement('ul'),links=document.createElement('div');details.append(heading,description,fallback,destinations,links);
 const actions=document.createElement('div'),retry=document.createElement('button'),close=document.createElement('button');retry.id='resumeDriveSave';retry.disabled=true;retry.textContent='Drive保存を再開';close.textContent='閉じる';actions.append(retry,close);tray.append(status,progress,note,details,actions);document.body.append(tray);
 const style=document.createElement('style');style.textContent=`#driveExport{position:fixed;bottom:0;left:0;right:0;z-index:24;background:#f0f8f3;border-top:2px solid #225b42;padding:8px 12px calc(8px + env(safe-area-inset-bottom));max-height:40dvh;overflow:auto}#driveExport>*{max-width:620px;margin:4px auto;display:block}#driveExport[hidden],#driveExport [hidden]{display:none!important}#driveExportStatus{font-size:13px;line-height:1.5}#driveExport small{font-size:11px}#driveExport progress{width:100%;height:10px}#driveExport>div{display:flex;gap:8px}#driveExport button{min-height:40px;padding:6px 12px}#driveExport details{font-size:12px}#driveExport input{max-width:100%;box-sizing:border-box}#syncBar,#submissionBar{bottom:var(--drive-save-height,0px)}#submissionScreen{padding-bottom:calc(145px + var(--drive-save-height,0px))}#selectionScreen{padding-bottom:calc(250px + var(--drive-save-height,0px))}`;document.head.append(style);
 const resize=()=>document.documentElement.style.setProperty('--drive-save-height',tray.hidden?'0px':Math.ceil(tray.getBoundingClientRect().height)+'px');new ResizeObserver(resize).observe(tray);
 const preparedCache=new Map();let auth,authReady=false,busy=false,jobKey='';
 const journal={readJournal:key=>localStorage.getItem(key),writeJournal:(key,value)=>{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error('再開用の記録を端末に保存できません。');}};
 function scopeKey(){const chars=[...new Set(api.visible().map(x=>x.characterId).filter(Boolean))];return 'drive-save-pending:'+location.pathname+':'+(params.get('character')||(chars.length===1?chars[0]:'visible'));}
 function record(state){journal.writeJournal(jobKey,JSON.stringify({schema:'drive-save-pending/v1',state,manual:fallback.value,at:new Date().toISOString()}));}
 const button=document.createElement('button');button.id='saveToDrive';button.className='primary';button.disabled=true;document.getElementById('syncBar').append(button);
 function label(pending=false){button.textContent=pending?(trial?'Drive保存を再開して申請用を選ぶ':'Drive保存を再開'):(trial?'保存して申請用を選ぶ':'Google Driveに保存');}
 function reveal(){tray.hidden=false;resize();}
 function lock(value){busy=value;close.disabled=value;retry.hidden=value;retry.disabled=value||!authReady;button.disabled=value||!authReady;document.getElementById('selectionScreen').inert=value;tray.setAttribute('aria-busy',String(value));}
 close.onclick=()=>{if(!busy){tray.hidden=true;resize();}};
 async function encode(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data),im.width,im.height),0,0);return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('透過仕上げのPNGを作れません。')),'image/png'));}
 async function save(tokenPromise){lock(true);reveal();links.replaceChildren();destinations.replaceChildren();progress.hidden=true;try{
  record('pending');status.textContent='Googleに接続中…';const token=await tokenPromise,drive=driveFactory({getToken:()=>token,...journal});
  status.textContent='選択内容を確定中…';await confirmForExport(api);const snapshot=structuredClone(api.visible());
  // The export owns this immutable snapshot. Submission choices use their own draft.
  onSnapshot();status.textContent='選択は端末に保存済み。Driveの保存先を確認中…';const account=await drive.account();
  let manual;if(fallback.value.trim()){const u=new URL(fallback.value.trim());if(u.origin!=='https://drive.google.com'||!/^\/drive\/folders\/[-\w]+\/?$/.test(u.pathname))throw Error('Google DriveのキャラフォルダURLを入力してください。');manual=await drive.characterFolder(u.pathname.split('/')[3]);}
  const groups=await groupCharacters(snapshot,{resolve:drive.character,fallback:manual});
  // Validate all characters before remote writes; do not promote technical review images.
  for(const g of groups){g.plan=await prepareExport(g.items,{get:api.get,decode:api.decode,encode,preparedCache,onProgress:p=>{status.textContent='保存する画像を確認中 '+p.done+'／'+p.total+'枚。申請候補を選べます。';}});const li=document.createElement('li');li.textContent=g.character.name+' ／ '+exportSummary([g.plan]);destinations.append(li);}
  const total=groups.reduce((n,g)=>n+g.plan.images.length,0);let finished=0;progress.hidden=false;progress.max=Math.max(total,1);progress.value=0;
  for(const g of groups){const result=await drive.save(g.plan,{accountId:account.permissionId,characterId:g.character.id,onProgress:p=>{const done=finished+Math.min(p.done,g.plan.images.length);progress.value=done;status.textContent='Drive保存・照合済み '+done+'／'+total+'枚（残り '+(total-done)+'枚）'+(done===total?'。選抜結果の記録を照合中…':'。申請候補を選べます。');}});finished+=g.plan.images.length;const a=document.createElement('a');a.textContent=g.character.name+'の保存先を開く';a.href=result.link;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createElement('br'));}
  record('complete');label();retry.hidden=true;status.textContent='Drive保存・照合が完了しました。'+exportSummary(groups.map(g=>g.plan))+(snapshot.some(x=>x.crop?.draftSelection)?' 仮選抜の◯は01、△は02へPNGを保存しました。評価記録は03、技術検品は未確定です。':'');note.textContent='Driveに保存済みです。申請候補の選択は端末に自動保存されます。';
 }catch(e){label(true);status.textContent='保存は完了していません：'+(e.message||'通信に失敗しました。')+' 選択は端末に残っています。「Drive保存を再開」で続けられます。';note.textContent='ブラウザを閉じた場合も、同じSafariで開き直して再開できます。';
 }finally{lock(false);let pending=true;try{pending=JSON.parse(localStorage.getItem(jobKey))?.state!=='complete';}catch{}retry.hidden=!pending;resize();}}
 function open(){if(busy||!authReady)return;jobKey=scopeKey();let token;try{token=auth.getToken();}catch(e){reveal();status.textContent=e.message;return;}void save(token);}
 button.onclick=open;retry.onclick=open;label();jobKey=scopeKey();try{const saved=JSON.parse(localStorage.getItem(jobKey)||'null');if(saved?.schema==='drive-save-pending/v1'&&saved.state==='pending'){fallback.value=saved.manual||'';label(true);reveal();status.textContent='未完了のDrive保存があります。選別・申請候補の選択は端末に残っています。「Drive保存を再開」で残りを照合・保存できます。';}}catch{}
 auth=authFactory();auth.ready.then(()=>{authReady=true;button.disabled=busy;retry.disabled=busy;}).catch(e=>{reveal();status.textContent=e.message;retry.disabled=true;});return {open};
}
