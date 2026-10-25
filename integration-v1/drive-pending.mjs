import {savedEvaluation} from './reselection.mjs?v=20261025-reselectall1';
import {validateDraft,unpackDraft} from './draft-bundle.mjs?v=20261025-direct2';
import {gate,inspect} from './crop-v9/core.mjs?v=20261023-bear1';
const FILES='https://www.googleapis.com/drive/v3/files',SHEETS='https://sheets.googleapis.com/v4/spreadsheets';
const FOLDER='application/vnd.google-apps.folder',SHEET='application/vnd.google-apps.spreadsheet';
const FIELDS='id,name,mimeType,parents,size,version,modifiedTime,sha256Checksum,trashed,capabilities(canDownload)';
const id=v=>{if(typeof v!=='string'||!/^[-\w]{1,256}$/.test(v))throw Error('Driveの保存先を確認できません。');return v;};
const quote=v=>"'"+id(v)+"'";
const inFolder=(f,parent)=>!f.trashed&&f.parents?.length===1&&f.parents[0]===parent;
const validFolder=f=>f?.mimeType===FOLDER&&!f.trashed;
export const PENDING_SCHEMA='animal-stickers-drive-pending/v1';
export function trialEligible(r){return r?.trialSelection?.explicitUser===true&&r.trialSelection.exception==='outer-outline'&&r.trialSelection.purpose==='selection-test-only'&&r.inspection?.scope==='actual-source'&&!!r.inspection.at&&r.decision==='review'&&r.crossing===false&&r.qa?.automatic==='pass'&&r.cropReview?.confirmed===true&&r.cropReview.imageId===r.imageId&&r.review?.[8]===false;}
export async function pngHash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function masterId(reference){try{const u=new URL(reference);if(u.origin!=='https://docs.google.com')throw Error();const m=u.pathname.match(/^\/spreadsheets\/d\/([-\w]+)(?:\/edit)?\/?$/);if(!m)throw Error();return id(m[1]);}catch{throw Error('検品記録の参照マスターが不明です。');}}
export function readMasterRows(rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('セリフのマスターが空です。');
 const header=rows[0],a=header.includes('ID')?header.indexOf('ID'):header.indexOf('候補ID'),b=header.indexOf('セリフ（厳密）'),c=header.includes('基本ポーズ')?header.indexOf('基本ポーズ'):header.indexOf('構図・ポーズ・目線');
 if([a,b,c].some(x=>x<0))throw Error('マスターのID・セリフ・基本ポーズを確認できません。');
 const seen=new Set(),out=[];
 for(const row of rows.slice(1)){if(!row[a])continue;if(typeof row[a]!=='string'||seen.has(row[a]))throw Error('マスターの候補IDが不正または重複しています。');seen.add(row[a]);out.push({candidateId:row[a],phrase:row[b]||'',pose:row[c]||''});}
 return out;
}
export function validatePendingManifest(value,{characterId,pendingFolderId,masters,includeTrials=false}){
 if(value?.schema!==PENDING_SCHEMA||value.characterId!==characterId||value.pendingFolderId!==pendingFolderId||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>200)throw Error('検品記録とキャラの保存先が一致しません。');
 const spreadsheetId=masterId(value.masterReference);
 if(!masters.some(f=>f.id===spreadsheetId&&f.mimeType===SHEET&&inFolder(f,characterId)))throw Error('別のキャラのマスターは読み込めません。');
 const ids=new Set(),files=new Set(),names=new Set();
 for(const e of value.entries){const r=e?.record;
  if(!r||!/^[-\w]{1,100}$/.test(r.imageId||'')||!/^[-\w]+\.png$/.test(r.filename||'')||!/^[-\w]{1,256}$/.test(e.driveFileId||'')||!/^[a-f0-9]{64}$/.test(e.sha256||''))throw Error('画像ID・検品後のファイル情報が不正です。');
  if(ids.has(r.imageId)||files.has(e.driveFileId)||names.has(r.filename))throw Error('検品記録に重複する画像があります。');
  ids.add(r.imageId);files.add(e.driveFileId);names.add(r.filename);
  if((gate(r)!=='pass'&&!(includeTrials&&value.trialMode===true&&trialEligible(r)))||r.inspection?.scope!=='actual-source'||!r.inspection?.at)throw Error('技術検品が未完了の画像は読み込めません。');
 }
 return spreadsheetId;
}
export function createPendingDrive({getToken,fetchImpl=globalThis.fetch,onUnauthorized=()=>{},includeTrials=false,unpack=unpackDraft,onRetry=()=>{},retryWait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 let calls=0;
 const transient=error=>error?.retryable===true||['AbortError','TimeoutError','TypeError'].includes(error?.name);
 async function retry(read){for(let attempt=0;;attempt++){try{return await read();}catch(error){if(!transient(error)||attempt>=3)throw error;onRetry({attempt:attempt+1,max:3});await retryWait(1000*2**attempt);}}}

 async function request(url){
  const u=new URL(url);if(!['https://www.googleapis.com','https://sheets.googleapis.com'].includes(u.origin))throw Error('許可されていない読み込み先です。');
  if(++calls>10000)throw Error('読み込み回数の上限です。Googleに接続し直してください。');
  const token=await getToken();if(typeof token!=='string'||!token)throw Error('Googleに接続してください。');
  const response=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(180000)});
  if(response.status===401){onUnauthorized();throw Error('Google接続の期限が切れました。接続し直してください。');}
  if(!response.ok){const error=Error(response.status===403?'Driveとマスターの閲覧権限を確認してください。':response.status===404?'画像または保存先が見つかりません。':'Driveの読み込みに失敗しました（HTTP '+response.status+'）。');error.retryable=[408,429,500,502,503,504].includes(response.status);throw error;}
  return response;
 }
 const json=async url=>retry(async()=>(await request(url)).json());
 const meta=fileId=>json(FILES+'/'+id(fileId)+'?'+new URLSearchParams({fields:FIELDS,supportsAllDrives:'true'}));
 async function list(query){const files=[];let pageToken='';for(let page=0;page<20;page++){
  const result=await json(FILES+'?'+new URLSearchParams({q:query,fields:'nextPageToken,files('+FIELDS+')',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})}));
  if(!Array.isArray(result.files))throw Error('Driveの一覧を確認できません。');files.push(...result.files);pageToken=result.nextPageToken||'';if(!pageToken)return files;
 }throw Error('画像・フォルダが多すぎるため停止しました。');}
 async function bytes(file,limit,cached=null){
  if(file.trashed||file.capabilities?.canDownload===false||Number(file.size)<1||!Number.isFinite(Number(file.size))||Number(file.size)>limit)throw Error('ファイルのサイズ・閲覧権限を確認できません。');
  const response=cached?null:await request(FILES+'/'+id(file.id)+'?alt=media&supportsAllDrives=true'),reader=response?.body?.getReader();
  const chunks=[];let size=0;
  if(cached){const value=new Uint8Array(cached);size=value.byteLength;chunks.push(value);}
  else if(reader){try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw Error('ファイルが大きすぎます。');}chunks.push(next.value);}}finally{reader.releaseLock();}}
  else{const value=new Uint8Array(await response.arrayBuffer());size=value.byteLength;chunks.push(value);}
  if(size>limit||size!==Number(file.size))throw Error('読み込んだファイルのサイズが一致しません。');
  const after=await meta(file.id);
  if(['id','name','mimeType','size','version','modifiedTime','sha256Checksum'].some(k=>String(file[k]??'')!==String(after[k]??''))||after.trashed||JSON.stringify(file.parents)!==JSON.stringify(after.parents))throw Error('読み込み中に画像や保存先が変更されました。もう一度読み込んでください。');
  return new Blob(chunks).arrayBuffer();
 }
 async function readMaster(spreadsheetId,sheetName='116候補マスター'){
  const book=await json(SHEETS+'/'+id(spreadsheetId)+'?fields=spreadsheetId,sheets(properties)');
  const sheet=book.sheets?.find(s=>s.properties?.title===sheetName),grid=sheet?.properties?.gridProperties;
  if(!grid||grid.columnCount<7||grid.rowCount<2)throw Error('参照する候補マスターを確認できません。');
  const range="'"+sheetName.replaceAll("'","''")+"'!A1:"+(sheetName==='116候補マスター'?'G':'Z')+Math.min(grid.rowCount,2000);
  return readMasterRows((await json(SHEETS+'/'+id(spreadsheetId)+'/values/'+encodeURIComponent(range))).values);
 }
 return {
  async characters({preferredId=null}={}){
   const out=[];
   // A URL identifies an explicit folder. Verify it directly rather than
   // requiring it to appear in an account-wide name-search response first.
   if(preferredId){
    const parent=await meta(id(preferredId));if(!validFolder(parent))throw Error('指定したキャラのフォルダを確認できません。');
    const children=await list('trashed = false and '+quote(parent.id)+' in parents');
    if(children.filter(f=>validFolder(f)&&f.name==='00_選抜待ち'&&inFolder(f,parent.id)).length!==1)throw Error('指定したキャラの00_選抜待ちがないか重複しています。');
    out.push({id:parent.id,name:parent.name});
   }
   const pending=await list("trashed = false and mimeType = '"+FOLDER+"' and name = '00_選抜待ち'");
   for(const f of pending){if(f.parents?.length!==1||out.some(x=>x.id===f.parents[0]))continue;const parent=await meta(f.parents[0]);if(validFolder(parent))out.push({id:parent.id,name:parent.name});}
   return out.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  },
  async load(characterId,{allCandidates=false,decode,onProgress=()=>{},onEntry=async()=>{},getCachedBytes=async()=>null}){
   id(characterId);const character=await meta(characterId);if(!validFolder(character))throw Error('キャラのフォルダを確認できません。');
   const children=await list('trashed = false and '+quote(characterId)+' in parents');
   function folder(name){const found=children.filter(f=>validFolder(f)&&f.name===name&&inFolder(f,characterId));if(found.length!==1)throw Error(name+'がないか重複しています。');return found[0];}
   const pending=folder('00_選抜待ち'),history=folder('03_元画像・生成履歴'),masters=children.filter(f=>f.mimeType===SHEET&&inFolder(f,characterId));
   const allowedFolders=[pending.id];
   if(allCandidates)for(const name of ['01_採用予定','02_保留']){const found=children.filter(f=>validFolder(f)&&f.name===name&&inFolder(f,characterId));if(found.length>1)throw Error(name+'が重複しています。');if(found.length)allowedFolders.push(found[0].id);}
   let images=[];for(const folderId of allowedFolders)images.push(...(await list('trashed = false and '+quote(folderId)+' in parents')).filter(f=>f.mimeType==='image/png'&&inFolder(f,folderId)));
   let evaluationDocument=null;
   if(allCandidates){const evaluations=(await list('trashed = false and '+quote(history.id)+" in parents and mimeType = 'application/json' and name contains 'selection-results_'" )).filter(f=>inFolder(f,history.id)&&f.name.startsWith('selection-results_')).sort((a,b)=>(b.modifiedTime||'').localeCompare(a.modifiedTime||'')||b.name.localeCompare(a.name));if(evaluations.length)evaluationDocument=JSON.parse(new TextDecoder().decode(await retry(()=>bytes(evaluations[0],3000000))));}
   if(!images.length||allCandidates){
    const drafts=(await list('trashed = false and '+quote(history.id)+" in parents and mimeType = 'application/json' and name contains 'selection-draft_'"));
    if(!drafts.length&&!includeTrials&&!images.length)return {character,entries:[],master:[],skipped:0};
    if(drafts.length){
    if(drafts.length!==1)throw Error('仮選抜記録が複数あります。ルイに整理を依頼してください。');
    const value=JSON.parse(new TextDecoder().decode(await retry(()=>bytes(drafts[0],3000000))));
    const spreadsheetId=validateDraft(value,{characterId,pendingFolderId:pending.id,masters,historyId:history.id});
    onProgress({stage:'master',character:character.name});const master=await readMaster(spreadsheetId,value.masterSheet);
    for(const e of value.entries){const m=master.find(m=>m.candidateId===e.candidateId);if(!m||m.phrase!==e.phrase||m.pose!==e.pose)throw Error('仮選抜記録のセリフ・ポーズが最新マスターと一致しません。');}
    const archive=await meta(value.archive.fileId);if(!inFolder(archive,history.id)||archive.mimeType!=='application/zip')throw Error('仮選抜ZIPの保存先が一致しません。');
    const archiveBytes=await retry(()=>bytes(archive,30000000));if(await pngHash(archiveBytes)!==value.archive.sha256)throw Error('仮選抜ZIPが変更されています。');
    const files=await unpack(archiveBytes,value.entries),entries=[];
    for(const e of value.entries){const png=files.get(e.filename);if(!png||await pngHash(png)!==e.sha256)throw Error('仮選抜PNGの照合に失敗しました。');
     const decoded=await decode(new Blob([png],{type:'image/png'})),qa=inspect(decoded,false);if(decoded.width!==370||decoded.height!==320||qa.issues.includes('空画像'))throw Error('仮選抜PNGのサイズ・描画を確認できません。');
     const record={...e,hasPixels:true,crossing:false,qa,review:[],decision:'review',draftSelection:true,masterReference:value.masterReference,cropReview:{confirmed:true,imageId:e.imageId},pendingDrive:{characterId,folderId:history.id,archiveFileId:archive.id,manifestFileId:drafts[0].id,sha256:e.sha256}};
     const verified={record,png,savedEvaluation:evaluationDocument?savedEvaluation(evaluationDocument,record,characterId):null};await onEntry({entry:verified,character,master,done:entries.length+1,total:value.entries.length});entries.push(verified);onProgress({stage:'images',done:entries.length,total:value.entries.length,character:character.name});
    }
    return {character,entries,master,skipped:0,draft:true};
    }
   }
   if(includeTrials)images.push(...(await list('trashed = false and '+quote(history.id)+' in parents')).filter(f=>f.mimeType==='image/png'&&inFolder(f,history.id)));
   if(images.length>200||images.reduce((n,f)=>n+Number(f.size||0),0)>150000000)throw Error('一度の読み込みは200枚・150MB以下にしてください。');
   if(!images.length)return {character,entries:[],master:[],skipped:0};
   const records=(await list('trashed = false and '+quote(history.id)+" in parents and mimeType = 'application/json' and name contains '"+(includeTrials?'selection-':'selection-manifest_')+"'")).filter(f=>f.name.startsWith('selection-manifest_')||(includeTrials&&f.name.startsWith('selection-trial_')));
   if(!records.length)throw Error('選抜用の検品記録がまだありません。ルイに読み込み準備を依頼してください。');
   const planned=[],known=new Map(),knownFiles=new Map(),masterCache=new Map();
   for(const file of records){
    if(!inFolder(file,history.id)||file.mimeType!=='application/json')throw Error('検品記録の保存先が一致しません。');
    const value=JSON.parse(new TextDecoder().decode(await retry(()=>bytes(file,3000000)))),spreadsheetId=validatePendingManifest(value,{characterId,pendingFolderId:pending.id,masters,includeTrials});
    onProgress({stage:'master',character:character.name});if(!masterCache.has(spreadsheetId))masterCache.set(spreadsheetId,await readMaster(spreadsheetId));const master=masterCache.get(spreadsheetId);
    for(const entry of value.entries){const r=entry.record,m=master.find(x=>x.candidateId===r.candidateId);
     if(!m||m.phrase!==r.phrase||m.pose!==r.pose)throw Error('マスターのセリフ・基本ポーズと検品記録が一致しません。');
     const key=JSON.stringify([r.imageId,entry.driveFileId,entry.sha256,r.filename,r.candidateId,r.phrase,r.pose]);
     if(known.has(r.imageId)){if(known.get(r.imageId)!==key)throw Error('同じ画像IDの検品記録が矛盾しています。');continue;}
     if(knownFiles.has(entry.driveFileId))throw Error('同じPNGに複数の画像IDがあります。');known.set(r.imageId,key);knownFiles.set(entry.driveFileId,key);
     const image=images.find(f=>f.id===entry.driveFileId);if(!image)continue;
     if(image.name!==r.filename||!(trialEligible(r)?inFolder(image,history.id):allowedFolders.some(folderId=>inFolder(image,folderId))))throw Error('PNGの名前または選抜待ちの保存先が一致しません。');
     planned.push({entry,image,manifestFileId:file.id,masterReference:value.masterReference});
    }
   }
   if(!planned.length)throw Error('技術合格の検品記録と一致する選抜待ち画像がありません。');
   planned.sort((a,b)=>(a.entry.record.sequenceLabel||'').localeCompare(b.entry.record.sequenceLabel||'',undefined,{numeric:true}));
   const entries=[];let done=0;
   for(const {entry,image,manifestFileId,masterReference} of planned){
    onProgress({stage:'images',done,total:planned.length,character:character.name});const cached=await getCachedBytes({record:entry.record,image,sha256:entry.sha256});const png=await retry(()=>bytes(image,15000000,cached));
    if(await pngHash(png)!==entry.sha256)throw Error('検品後にPNGが変更されています。読み込みを止めました。');
    const qa=inspect(await decode(new Blob([png],{type:'image/png'})),entry.record.crossing);if(gate({...entry.record,qa})!=='pass'&&!(includeTrials&&trialEligible({...entry.record,qa})))throw Error('PNGの再検品に合格していません。');
    const verified={record:{...entry.record,qa,masterReference,pendingDrive:{characterId,folderId:image.parents[0],fileId:image.id,manifestFileId,sha256:entry.sha256,version:String(image.version||'')}},png};
    if(evaluationDocument)verified.savedEvaluation=savedEvaluation(evaluationDocument,verified.record,characterId);
    await onEntry({entry:verified,character,master:[...masterCache.values()].flat(),done:done+1,total:planned.length});entries.push(verified);
    onProgress({stage:'images',done:++done,total:planned.length,character:character.name});
   }
   return {character,entries,master:[...masterCache.values()].flat(),skipped:images.length-entries.length};
  }
 };
}
