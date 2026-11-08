import {googleTestAuth} from './google-auth.mjs?v=20261023-merge1';
import {orderedFiles} from './submission-order.mjs?v=20261024-order1';
import {validateWorkspace,validateDraft,workspaceKey,assignWorkspace,swapWorkspace,moveWorkspace,sha256,readWorkspaceImages} from './product-workspace.mjs?v=20261108-1';
const $=id=>document.getElementById(id),API='https://www.googleapis.com/drive/v3/files',auth=googleTestAuth();
const single=new URLSearchParams(location.search).get('mode')==='single';
if(single){document.querySelector('h1').textContent='40枚を選ぶ';$('save').textContent='選択をDriveに保存';}
let workspace,draft,images=new Map(),urls=new Map(),page=0,swapFrom='',undo=[],busy=false,dirty=false;
const quote=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
async function request(url,options={}){const token=await auth.getToken();const r=await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000),redirect:'error'});if(!r.ok)throw Error(r.status===401?'Googleに接続し直してください。':`Drive通信に失敗しました（${r.status}）。端末の編集は残っています。`);return r;}
const meta=async id=>(await request(API+'/'+encodeURIComponent(id)+'?fields=id,name,mimeType,parents,size')).json();
const bytes=async id=>(await request(API+'/'+encodeURIComponent(id)+'?alt=media')).arrayBuffer();
async function run(fn){if(busy)return;busy=true;$('connect').disabled=true;$('save').disabled=true;$('load').disabled=true;$('editor').inert=true;try{await fn();}catch(e){$('status').textContent=e.message||String(e);}finally{busy=false;$('connect').disabled=false;$('save').disabled=false;$('load').disabled=false;$('editor').inert=false;}}
function remember(next){validateDraft(workspace,next);const nextUndo=[...undo,structuredClone(draft)],record={draft:next,undo:nextUndo,dirty:true};try{localStorage.setItem(workspaceKey(workspace),JSON.stringify(record));if(localStorage.getItem(workspaceKey(workspace))!==JSON.stringify(record))throw Error('保存照合失敗');}catch{throw Error('端末へ編集を保存できません。元の編集を保持して停止しました。「Driveに保存」してから再試行してください。');}draft=next;undo=nextUndo;dirty=true;render();}
function edit(fn){try{remember(fn());}catch(e){$('status').textContent=e.message;}}
function render(){
 const files=workspace.entries.map(e=>({id:e.imageId,...e})),scope=$('scope').value,style=$('style').value,term=$('search').value.trim().toLocaleLowerCase();
 $('counts').textContent=draft.sets.map(s=>s.name+' '+Object.values(draft.assignments).filter(id=>id===s.id).length+'/40枚').join(' ／ ')+' ／ 予備 '+workspace.entries.filter(e=>!draft.assignments[e.imageId]).length+'枚';
 let rows=scope==='unused'?files.filter(e=>!draft.assignments[e.id]):scope?orderedFiles(draft,files,scope):files;
 rows=rows.filter(e=>(!style||e.style===style)&&(!term||[e.phrase,e.motifGroup,e.candidateId].join(' ').toLocaleLowerCase().includes(term)));
 page=Math.min(page,Math.max(0,Math.ceil(rows.length/12)-1));$('grid').replaceChildren();
 for(const e of rows.slice(page*12,page*12+12)){
  const card=document.createElement('article');card.className='card'+(swapFrom===e.id?' pending':'');card.dataset.imageId=e.id;
  const assigned=draft.sets.find(s=>s.id===draft.assignments[e.id]),order=assigned?orderedFiles(draft,files,assigned.id).findIndex(x=>x.id===e.id)+1:null;
  const pos=document.createElement('div');pos.className='position';pos.textContent=assigned?assigned.name+'・'+order+'番':'予備';
  const im=document.createElement('img');im.className='preview '+$('background').value;im.alt=e.phrase;im.src=urls.get(e.id);im.loading='lazy';
  const name=document.createElement('h2');name.textContent=e.phrase;const detail=document.createElement('div');detail.className='meta';detail.textContent=e.candidateId+' ／ '+e.style+' ／ 合格';
  const dest=document.createElement('select');dest.setAttribute('aria-label',e.phrase+'の移動先');dest.add(new Option('予備にする',''));for(const s of draft.sets)dest.add(new Option(s.name,s.id));dest.value=assigned?.id||'';dest.onchange=()=>edit(()=>assignWorkspace(workspace,draft,e.id,dest.value));
  const actions=document.createElement('div');actions.className='actions';const swap=document.createElement('button');swap.textContent=swapFrom&&swapFrom!==e.id?'この画像と交換':'入れ替える';swap.onclick=()=>{if(swapFrom&&swapFrom!==e.id){const from=swapFrom;edit(()=>swapWorkspace(workspace,draft,from,e.id));swapFrom='';render();}else{swapFrom=swapFrom?'':e.id;$('scope').value='';page=0;render();}};
  const up=document.createElement('button'),down=document.createElement('button');up.textContent='↑ 前へ';down.textContent='↓ 後へ';up.disabled=!assigned||order===1;down.disabled=!assigned||order===orderedFiles(draft,files,assigned?.id).length;up.onclick=()=>edit(()=>moveWorkspace(workspace,draft,e.id,-1));down.onclick=()=>edit(()=>moveWorkspace(workspace,draft,e.id,1));actions.append(swap,up,down);card.append(pos,im,name,detail,dest,actions);if(single&&draft.sets.length===1){dest.hidden=true;swap.hidden=true;const pick=document.createElement('button');pick.className='single-pick';pick.setAttribute('aria-pressed',String(!!assigned));pick.textContent=assigned?'✓ 選択中（押すと外す）':'このセットに戻す';pick.onclick=()=>edit(()=>assignWorkspace(workspace,draft,e.id,assigned?'':draft.sets[0].id));card.insertBefore(pick,actions);}$('grid').append(card);
 }
 $('page').textContent=rows.length?`${page*12+1}〜${Math.min((page+1)*12,rows.length)}／${rows.length}枚`:'該当なし';$('prev').disabled=page===0;$('next').disabled=(page+1)*12>=rows.length;$('undo').disabled=!undo.length;$('cancelSwap').hidden=!swapFrom;$('hint').textContent=swapFrom?'交換する相手を選んでください。検索や演出の絞り込みも使えます。':single?'選択中の画像を押して不要な分を外し、40枚にしてください。外した画像は「予備だけ」から戻せます。':'移動先でセットを変更。「入れ替える」で2枚を選ぶと、枚数を保ったまま交換できます。';$('saveState').textContent=dirty?'端末に自動保存済み／Driveは未保存':'端末・Driveの保存内容で再開';
}
async function discover(){
 $('status').textContent='保存済みの組み直し案を探しています…';const found=[];let token='';do{const params=new URLSearchParams({q:"trashed=false and mimeType='application/json' and name contains 'product-workspace_'"+(single?" and name contains '_single_'":''),fields:'files(id,name,modifiedTime,parents),nextPageToken',pageSize:'100',orderBy:'modifiedTime desc',...(token?{pageToken:token}:{})});const list=await (await request(API+'?'+params)).json();found.push(...list.files);token=list.nextPageToken||'';if(found.length>1000)throw Error('候補が多いため検索を止めました。');}while(token);
 if(!found.length)throw Error('保存済みの組み直し案が見つかりません。保存先とGoogleアカウントを確認してください。');$('versions').replaceChildren();for(const f of found)$('versions').add(new Option(f.name,f.id));$('chooser').hidden=false;$('load').hidden=false;await loadWorkspace(found[0].id);
}
async function loadWorkspace(fileId){
 if(workspace){$('status').textContent='現在の編集は保持しています。別の案は新しいタブで開いてください。';return;}
 $('status').textContent='組み直し案と画像を照合しています…';const [record,recordMeta]=await Promise.all([bytes(fileId),meta(fileId)]);const w=validateWorkspace(JSON.parse(new TextDecoder().decode(record)));
 const [history,archive]=await Promise.all([meta(w.historyFolderId),meta(w.archive.fileId)]);if(recordMeta.parents?.length!==1||recordMeta.parents[0]!==w.historyFolderId||history.mimeType!=='application/vnd.google-apps.folder'||history.parents?.length!==1||history.parents[0]!==w.characterId||archive.mimeType!=='application/zip'||archive.parents?.length!==1||archive.parents[0]!==w.historyFolderId)throw Error('保存先の照合に失敗しました。');
 const raw=localStorage.getItem(workspaceKey(w));let saved;if(raw!==null){try{saved=JSON.parse(raw);validateDraft(w,saved.draft);if(!Array.isArray(saved.undo))throw Error();for(const d of saved.undo)validateDraft(w,d);}catch{throw Error('端末の編集中データを読めません。上書きせず停止しました。');}}
 $('status').textContent=w.characterName+'：'+w.candidateCount+'枚の画像を読み込み中…';const pngs=await readWorkspaceImages(w,await bytes(w.archive.fileId));
 // No workflow selection store, ratings, images or prior product keys are written.
 const next=saved||{draft:structuredClone(w.draft),undo:[],dirty:false};if(!saved){localStorage.setItem(workspaceKey(w),JSON.stringify(next));if(localStorage.getItem(workspaceKey(w))!==JSON.stringify(next))throw Error('端末へ保存できません。');}
 workspace=w;draft=next.draft;undo=next.undo;dirty=next.dirty===true;images=pngs;urls=new Map([...images].map(([id,blob])=>[id,URL.createObjectURL(blob)]));$('scope').replaceChildren(new Option('すべてのセット・予備',''),...draft.sets.map(s=>new Option(s.name,s.id)),new Option('予備だけ','unused'));$('scope').value=draft.sets[0].id;$('editor').hidden=false;$('savebar').hidden=false;$('status').textContent=w.characterName+'：'+pngs.size+'枚を照合して開きました。'+(saved?'端末の編集中の内容を優先して再開しました。':single?'この第1群だけの◯・合格62枚から40枚を選んでください。':'セット案と予備から自由に組み直せます。')+' 元の◯・検品結果は変更しません。';render();
}
async function save(){
 if(!workspace)return;const snapshot={...structuredClone(workspace),draft:structuredClone(draft),savedAt:new Date().toISOString(),savedBy:'product-editor'},json=JSON.stringify(snapshot),data=new TextEncoder().encode(json),expectedHash=await sha256(data);validateWorkspace(snapshot);
 const body=new FormData();body.append('metadata',new Blob([JSON.stringify({name:'product-workspace_'+workspace.workspaceId+'_'+snapshot.savedAt.replace(/[:.]/g,'-')+'.json',mimeType:'application/json',parents:[workspace.historyFolderId]})],{type:'application/json'}));body.append('file',new Blob([data],{type:'application/json'}));$('status').textContent='組み直しをDriveに保存・照合中…';
 const f=await (await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,parents,webViewLink',{method:'POST',body})).json();const savedMeta=await meta(f.id),savedBytes=await bytes(f.id);if(savedMeta.parents?.length!==1||savedMeta.parents[0]!==workspace.historyFolderId||await sha256(savedBytes)!==expectedHash)throw Error('Drive保存後の照合が完了しませんでした。端末の編集は残っています。');
 dirty=false;localStorage.setItem(workspaceKey(workspace),JSON.stringify({draft,undo,dirty:false}));$('saved').href='https://drive.google.com/file/d/'+f.id+'/view';$('saved').hidden=false;render();$('status').textContent='組み直しのDrive保存・再取得照合が完了しました。セット割当・並び順・予備を保存しました。メイン・タブ・申請ZIPは次の工程です。';
}
$('connect').onclick=()=>{const token=auth.getToken();run(async()=>{await token;await discover();});};$('load').onclick=()=>run(()=>loadWorkspace($('versions').value));$('save').onclick=()=>{const token=auth.getToken();run(async()=>{await token;await save();});};
for(const id of ['scope','style','background'])$(id).onchange=()=>{page=0;render();};$('search').oninput=()=>{page=0;render();};$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};$('cancelSwap').onclick=()=>{swapFrom='';render();};$('undo').onclick=()=>{if(!undo.length)return;const next=undo.at(-1),history=undo.slice(0,-1);try{localStorage.setItem(workspaceKey(workspace),JSON.stringify({draft:next,undo:history,dirty:true}));draft=next;undo=history;dirty=true;swapFrom='';render();}catch{$('status').textContent='端末へ保存できず、取り消しを停止しました。';}};
auth.ready.then(()=>{$('connect').disabled=false;$('status').textContent='Googleに接続すると、保存済みのセット案と候補を開きます。';}).catch(e=>{$('status').textContent=e.message;});

