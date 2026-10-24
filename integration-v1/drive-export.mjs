import {completeSelection} from './selection-completion.mjs?v=20261024-save1';
import {trialEligible} from './drive-pending.mjs?v=20261024-progress1';
import {isLocalConfirmed} from './crop-handoff.mjs?v=20261023-merge1';
import {gate,inspect,cleanTransparency} from './crop-v9/core.mjs?v=20261023-merge1';
const API='https://www.googleapis.com/drive/v3/files',FOLDER='application/vnd.google-apps.folder';
const FIELDS='id,name,mimeType,parents,size,sha256Checksum,appProperties,trashed,webViewLink';
export const EXPORT_APP='animal-stickers-selection-v1';
const id=value=>{if(typeof value!=='string'||!/^[-\w]{1,256}$/.test(value))throw Error('保存先IDが不正です');return value;};
export async function digest(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function confirmForExport(api){
 await api.ready;const result=await completeSelection(api);
 if(result.empty)throw Error('先に◯・△・✕を選んでください。');
 return result;
}
export async function prepareExport(items,{get,decode,encode,onProgress=()=>{},preparedCache}){
 const rows=items.filter(x=>x.origin==='crop-local');if(!rows.length)throw Error('先に切り出した画像を選抜へ送ってください。');
 if(rows.some(x=>x.touched&&!isLocalConfirmed(x)))throw Error('選択内容を確定できません。Driveへの保存をやり直してください。');
 if(!rows.some(isLocalConfirmed))throw Error('先に画像を選抜してください。');
 const images=[],results=[];let total=0;onProgress({done:0,total:rows.length});
 for(const item of rows){
  const confirmed=isLocalConfirmed(item),trial=trialEligible(item.crop),approved=item.technicalPassed===true&&gate(item.crop||{})==='pass';
  const row={imageId:item.imageId,number:item.sequenceLabel||'',candidateId:item.candidate||null,phrase:item.phrase||'',rating:confirmed?item.rating:null,comment:item.comment||'',revision:item.revision||null,confirmed,selectionHistory:structuredClone(item.selectionHistory||[]),technicalStatus:approved?'pass':'review'};
  if(item.crop?.trialSelection){row.purpose='selection-test-only';row.technicalStatus='review';row.qualityException=structuredClone(item.crop.trialSelection);}
  if(confirmed&&['o','h'].includes(item.rating)){
   if(!approved&&!trial)throw Error((row.number||item.name)+'は技術検品・試用許可を照合できません。');
   id(item.imageId);let blob=await get(item.id);if(!blob||blob.type!=='image/png'||blob.size<24||blob.size>15000000)throw Error((row.number||item.name)+'のPNGを読み込めません。');
   total+=blob.size;if(total>150000000)throw Error('一度の保存は150MB以下にしてください。');
   const cacheKey=preparedCache?await digest(blob)+':'+!!item.crop?.crossing+':'+row.technicalStatus:null;let prepared=preparedCache?.get(cacheKey);
   if(!prepared){const decoded=await decode(blob),cleaned=trial?decoded:cleanTransparency(decoded);
    if(cleaned.removed){if(!encode)throw Error('透過仕上げを準備できません。アプリを再読み込みしてください。');blob=await encode(cleaned);}
    const qa=inspect(cleaned,item.crop?.crossing);if(gate({...item.crop,qa})!=='pass'&&!trialEligible({...item.crop,qa}))throw Error((row.number||item.name)+'のPNG画素の再検品に失敗しました。');
    prepared={blob,qa,removed:cleaned.removed||0};if(preparedCache){if(preparedCache.size>=256)preparedCache.delete(preparedCache.keys().next().value);preparedCache.set(cacheKey,prepared);}
   }
   blob=prepared.blob;const qa=prepared.qa;if(gate({...item.crop,qa})!=='pass'&&!trialEligible({...item.crop,qa}))throw Error((row.number||item.name)+'のPNG画素の再検品に失敗しました。');
   const name=(item.rating==='h'?'HOLD_':'ST_')+(row.number.replace(/[^\w-]/g,'')||'image')+'_'+item.imageId+'.png',sha=await digest(blob);
   images.push({name,blob,sha,imageId:item.imageId,rating:item.rating,technicalStatus:row.technicalStatus});
   Object.assign(row,{filename:name,sha256:sha,technicalWarnings:[...qa.issues,...(trial?item.crop.inspection?.unresolved||[]:[])],transparencyCleanup:{version:1,removed:prepared.removed}});
  }
  results.push(row);onProgress({done:results.length,total:rows.length});
 }
 const manifest={schema:'animal-stickers-selection-export/v1',purpose:'ユーザーの採用・保留候補。技術合格・最終採用は別に管理。',results},json=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),key=await digest(json);
 return {key,images,summary:{records:results.length,confirmed:results.filter(x=>x.confirmed).length,trialRecords:results.filter(x=>x.purpose==='selection-test-only').length,pngCopies:images.length},manifest:{name:'selection-results.json',blob:json,sha:key},counts:{adopted:results.filter(x=>x.rating==='o').length,held:results.filter(x=>x.rating==='h').length,rejected:results.filter(x=>x.rating==='x').length,unrated:results.filter(x=>!x.rating).length}};
}
// Create app-owned files; move only verified app-owned PNGs between this character's 01/02 folders. No deletes or permission changes.
export function createExportDrive({getToken,fetchImpl=globalThis.fetch,readJournal,writeJournal}){
 async function request(url,options={}){const token=getToken();if(!token)throw Error('Googleに接続してください。');let response;try{response=await fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(options.method==='POST'?120000:45000)});}catch(e){if(e.name==='AbortError'||e.name==='TimeoutError'||/aborted/i.test(e.message||''))throw Error('Driveとの通信が時間切れ、または中断されました。保存完了は未確認です。Safariを開いたまま同じ内容で再開してください。');throw Error('Driveとの通信に失敗しました。通信状態を確認して同じ内容で再開してください。');}if(response.status===404)return null;if(!response.ok)throw Error(response.status===401?'Google接続の期限が切れました。接続し直してください。':response.status===403?'Driveの保存権限・空き容量を確認してください。':'Drive保存失敗（HTTP '+response.status+'）。同じ内容で再開できます。');return response;}
 async function meta(fileId){const r=await request(API+'/'+id(fileId)+'?'+new URLSearchParams({fields:FIELDS}));return r?await r.json():null;}
 async function reserve(key){let reserved=readJournal(key);if(reserved)return id(reserved);const r=await request(API+'/generateIds?count=1&space=drive&type=files');const value=(await r.json()).ids?.[0];id(value);writeJournal(key,value);return value;}
 function matches(file,expected){return file&&file.id===expected.id&&!file.trashed&&file.name===expected.name&&file.mimeType===expected.mimeType&&(!expected.parents||file.parents?.length===1&&file.parents[0]===expected.parents[0])&&Object.entries(expected.appProperties).every(([k,v])=>file.appProperties?.[k]===v);}
 async function folder(key,name,parent,properties){const fileId=await reserve(key),expected={id:fileId,name,mimeType:FOLDER,...(parent?{parents:[id(parent)]}:{}),appProperties:{exportApp:EXPORT_APP,...properties}};let file=await meta(fileId);if(!file){await request(API+'?'+new URLSearchParams({fields:FIELDS}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(expected)});file=await meta(fileId);}if(!matches(file,expected))throw Error('保存先フォルダの照合に失敗しました。既存ファイルは変更していません。');return file;}
 async function put(key,parent,entry,{allowedParents=[]}={}){const fileId=await reserve(key),expected={id:fileId,name:entry.name,mimeType:entry.blob.type,parents:[parent],appProperties:{exportApp:EXPORT_APP,sha256:entry.sha,...(entry.blob.type==='image/png'?{technicalStatus:entry.technicalStatus==='pass'?'pass':'review'}:{})}};let file=await meta(fileId);if(file&&(file.name!==expected.name||file.parents?.[0]!==parent)){if(file.trashed||file.mimeType!==expected.mimeType||file.parents?.length!==1||!allowedParents.includes(file.parents[0])||file.appProperties?.exportApp!==EXPORT_APP||file.appProperties?.sha256!==entry.sha||!file.name.endsWith('_'+entry.imageId+'.png')||Number(file.size)!==entry.blob.size)throw Error('既存画像の移動条件を照合できません。変更せず停止しました。');let checksum=file.sha256Checksum;if(!checksum){const response=await request(API+'/'+fileId+'?alt=media');if(!response)throw Error('既存画像の内容を確認できません。');const content=await response.blob();if(content.size!==entry.blob.size)throw Error('既存画像のサイズが一致しません。');checksum=await digest(content);}if(checksum!==entry.sha)throw Error('既存画像の内容が一致しません。');await request(API+'/'+fileId+'?'+new URLSearchParams({addParents:parent,removeParents:file.parents[0],fields:FIELDS}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:entry.name})});file=await meta(fileId);}if(!file){const boundary='sticker_'+crypto.randomUUID(),body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(expected),'\r\n--'+boundary+'\r\nContent-Type: '+entry.blob.type+'\r\n\r\n',entry.blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':body.type},body});file=await meta(fileId);}
  if(!matches(file,expected)||Number(file.size)!==entry.blob.size)throw Error('保存ファイルの照合に失敗しました。再試行してください。');let sha=file.sha256Checksum;if(!sha){const r=await request(API+'/'+fileId+'?alt=media');if(!r)throw Error('保存ファイルを再読込できません。');const blob=await r.blob();if(blob.size!==entry.blob.size)throw Error('保存サイズが一致しません。');sha=await digest(blob);}if(sha!==entry.sha)throw Error('保存内容が一致しません。既存ファイルは変更していません。');return file;
 }
 async function children(parent,name){const q="trashed = false and mimeType = '"+FOLDER+"' and '"+id(parent)+"' in parents and name = '"+name+"'";const r=await request(API+'?'+new URLSearchParams({q,fields:'files('+FIELDS+'),nextPageToken',pageSize:'100'}));const result=await r.json();if(result.nextPageToken)throw Error('保存先候補が多すぎます。フォルダを整理してください。');return result.files||[];}
 async function characterFolder(folderId){const f=await meta(folderId);if(!f||f.trashed||f.mimeType!==FOLDER)throw Error('キャラフォルダを確認できません。');const source=await children(f.id,'03_元画像・生成履歴');if(source.length!==1)throw Error('「03_元画像・生成履歴」があるキャラフォルダを指定してください。');return {id:f.id,name:f.name};}
 async function character(fileId){let f=await meta(fileId);if(!f||f.trashed)throw Error('元画像を確認できません。保存先は変更していません。');const seen=new Set();for(let depth=0;depth<12;depth++){if(!f.parents||f.parents.length!==1)throw Error('キャラを特定できません。キャラフォルダを指定してください。');f=await meta(f.parents[0]);if(!f||f.trashed||seen.has(f.id))break;seen.add(f.id);if(f.mimeType===FOLDER&&f.name==='03_元画像・生成履歴'){if(f.parents?.length!==1)break;return characterFolder(f.parents[0]);}}throw Error('キャラを特定できません。キャラフォルダを指定してください。');}
 return {
  character,characterFolder,
  async account(){const r=await request('https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)');const user=(await r.json()).user;if(!user?.permissionId)throw Error('保存するGoogleアカウントを確認できません。');return user;},
  async roots(){const r=await request(API+'?'+new URLSearchParams({q:"trashed = false and mimeType = '"+FOLDER+"' and appProperties has { key='exportApp' and value='"+EXPORT_APP+"' } and appProperties has { key='kind' and value='export-root' }",fields:'files('+FIELDS+'),nextPageToken',pageSize:'100'}));return (await r.json()).files;},
  async saveArtwork(bundle,{accountId,characterId}){
   id(accountId);if(bundle.characterId!==characterId||bundle.images?.length!==2||new Set(bundle.images.map(e=>e.kind)).size!==2||!bundle.images.every(e=>['main','tab'].includes(e.kind)))throw Error('メイン・タブのキャラと画像を確認できません。');
   for(const e of bundle.images)if(e.blob?.type!=='image/png'||e.blob.size>1000000||e.technicalStatus!=='review'||!/^PREVIEW_(main|tab)_[a-f0-9]{12}\.png$/.test(e.name)||await digest(e.blob)!==e.sha)throw Error('メイン・タブの内容を確認できません。');
   if(bundle.manifest?.blob?.type!=='application/json'||bundle.manifest.sha!==await digest(bundle.manifest.blob))throw Error('編集記録を確認できません。');const record=JSON.parse(await bundle.manifest.blob.text());if(record.schema!=='animal-stickers-artwork/v1'||record.characterId!==characterId||record.technicalApproval!==false)throw Error('編集記録の技術判定を確認できません。');
   await characterFolder(characterId);const history=await children(characterId,'03_元画像・生成履歴');if(history.length!==1||history[0].parents?.length!==1||history[0].parents[0]!==characterId)throw Error('編集画像の保存先を照合できません。');const prefix='artwork:'+accountId+':'+characterId+':',files=[];
   for(const e of bundle.images){const f=await put(prefix+e.kind+':'+e.sha,history[0].id,e);files.push({id:f.id,name:f.name,link:f.webViewLink||'https://drive.google.com/file/d/'+f.id+'/view'});}await put(prefix+'record:'+bundle.manifest.sha,history[0].id,bundle.manifest);return {files,folderId:history[0].id};
  },
  async saveArchives(bundle,{accountId,characterId,onProgress=()=>{}}){
   id(accountId);if(bundle.characterId!==characterId||typeof bundle.trial!=='boolean'||!bundle.archives?.length)throw Error('ZIPのキャラを確認できません。');
   const kit=bundle.applicationKit===true;onProgress({stage:'destination'});const characterInfo=await characterFolder(characterId),targetName=kit?'04_申請用':bundle.trial?'03_元画像・生成履歴':'04_申請用',targets=await children(characterInfo.id,targetName),history=await children(characterInfo.id,'03_元画像・生成履歴');
   if(targets.length!==1||targets[0].parents?.length!==1||targets[0].parents[0]!==characterId||history.length!==1||history[0].parents?.length!==1||history[0].parents[0]!==characterId)throw Error('ZIP保存先を照合できません。');
   const prefix=(kit?'application-kit:':'selected-zip:')+accountId+':'+characterId+':'+(bundle.trial?'trial:':'approved:');
   // Validate every payload before writes. Trial archives never become technical-pass images.
   onProgress({stage:'validating'});for(const a of bundle.archives){if(a.trial!==bundle.trial||a.blob?.type!=='application/zip'||!(kit?/^REVIEW_application_\d+_[a-f0-9]{12}\.zip$/:/^(TRIAL_)?selected_png_\d+_[a-f0-9]{12}\.zip$/).test(a.name)||a.sha!==await digest(a.blob)||!a.mapping?.length||a.mapping.length!==a.count||!kit&&!bundle.trial&&a.mapping.some(e=>e.technicalStatus!=='pass'))throw Error('ZIPの内容・技術判定を確認できません。');}
   if(bundle.manifest?.blob?.type!=='application/json'||bundle.manifest.sha!==await digest(bundle.manifest.blob))throw Error('ZIPの記録を確認できません。');
   if(kit){const record=JSON.parse(await bundle.manifest.blob.text());if(record.schema!=='animal-stickers-application-kit/v1'||record.characterId!==characterId||record.technicalApproval!==false||record.includesMainAndTab!==true||JSON.stringify(record.archives)!==JSON.stringify(bundle.archives.map(({name,sha,count,setName,mapping,artwork})=>({name,sha,count,setName,mapping,artwork})))||bundle.archives.some(a=>!a.artwork||a.artwork.length!==2||!['main.png','tab.png'].every(n=>a.artwork.some(e=>e.filename===n&&e.technicalStatus==='review'))))throw Error('申請用一式の記録を確認できません。');}
   const results=[];for(const a of bundle.archives){onProgress({stage:'uploading',done:results.length,total:bundle.archives.length,bytes:a.blob.size});const f=await put(prefix+'zip:'+a.sha,targets[0].id,a);results.push({id:f.id,name:f.name,count:a.count,link:f.webViewLink||'https://drive.google.com/file/d/'+f.id+'/view'});}
   onProgress({stage:'recording'});await put(prefix+'manifest:'+bundle.manifest.sha,history[0].id,bundle.manifest);return {archives:results,folderId:targets[0].id};
  },
  async save(plan,{accountId,characterId,onProgress=()=>{}}){
   id(accountId);if(!characterId)throw Error('キャラ別の保存先を確認してください。マイドライブ直下には保存しません。');
   const characterInfo=await characterFolder(characterId),prefix='drive-export:'+accountId+':'+characterInfo.id+':direct-v1:';
   const destinations={};for(const [key,name] of [['o','01_採用予定'],['h','02_保留'],['history','03_元画像・生成履歴']]){const found=await children(characterInfo.id,name);if(found.length!==1||found[0].parents?.length!==1||found[0].parents[0]!==characterInfo.id)throw Error(name+'がないか複数あります。キャラの保存先を確認してください。');destinations[key]=found[0];}
   // Read both classification folders once; reuse exact app-owned bytes already migrated or saved.
   const existing=[];let pageToken='';for(let page=0;page<10;page++){const q="trashed = false and mimeType = 'image/png' and ('"+destinations.o.id+"' in parents or '"+destinations.h.id+"' in parents or appProperties has { key='submissionCharacter' and value='"+characterInfo.id+"' })";const r=await request(API+'?'+new URLSearchParams({q,fields:'files('+FIELDS+'),nextPageToken',pageSize:'100',...(pageToken?{pageToken}:{})}));const result=await r.json();existing.push(...(result.files||[]));pageToken=result.nextPageToken||'';if(!pageToken)break;}if(pageToken)throw Error('保存先の画像が多すぎるため停止しました。');
   const allowedParents=[destinations.o.id,destinations.h.id],total=plan.images.length+1;let done=0;
   for(const entry of plan.images){if(!['o','h'].includes(entry.rating)||!entry.imageId)throw Error('画像の評価・IDが不正です。保存準備をやり直してください。');const key=prefix+'image:'+entry.imageId+':'+entry.sha;
    const matches=existing.filter(f=>f.name?.endsWith('_'+entry.imageId+'.png')&&f.appProperties?.exportApp===EXPORT_APP&&f.appProperties?.sha256===entry.sha&&f.sha256Checksum===entry.sha&&Number(f.size)===entry.blob.size);if(matches.length>1)throw Error('同じ画像が保存先に複数あります。上書きせず停止しました。');
    // A connector repair may have copied an exact candidate without app metadata.
    // Adopt only a byte-verified review copy inside this character’s candidate folders.
    if(!matches.length&&entry.technicalStatus==='review'){
     const candidates=existing.filter(f=>!f.appProperties?.exportApp&&(!f.appProperties?.technicalStatus||f.appProperties.technicalStatus==='review')&&f.name?.endsWith('_'+entry.imageId+'.png')&&f.parents?.length===1&&allowedParents.includes(f.parents[0])&&Number(f.size)===entry.blob.size),copies=[];
     for(const file of candidates){let checksum=file.sha256Checksum;if(!checksum){const response=await request(API+'/'+file.id+'?alt=media');if(!response)throw Error('既存候補を照合できません。');const content=await response.blob();if(content.size!==entry.blob.size)throw Error('既存候補のサイズが一致しません。');checksum=await digest(content);}if(checksum!==entry.sha)throw Error('同じ画像IDの内容が一致しません。上書きせず停止しました。');copies.push(file);}
     if(copies.length>1)throw Error('同じ候補が保存先に複数あります。変更せず停止しました。');
     if(copies.length){const file=copies[0];await request(API+'/'+file.id+'?'+new URLSearchParams({fields:FIELDS}),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{...file.appProperties,exportApp:EXPORT_APP,sha256:entry.sha,technicalStatus:'review'}})});matches.push(await meta(file.id));}
    }
if(matches.length===1&&matches[0].appProperties?.submissionSet){const file=matches[0],setFolder=await meta(file.parents?.[0]),application=await children(characterInfo.id,'04_申請用');if(entry.rating!=='o')throw Error('申請用へ移動済みの画像があります。申請セットを確認してから評価を変更してください。');if(file.parents?.length!==1||!setFolder||setFolder.trashed||application.length!==1||setFolder.parents?.length!==1||setFolder.parents[0]!==application[0].id||setFolder.appProperties?.submissionSet!==file.appProperties.submissionSet||setFolder.appProperties?.submissionCharacter!==characterInfo.id||file.appProperties?.submissionCharacter!==characterInfo.id)throw Error('申請用画像の保存先を照合できません。');onProgress({done:++done,total,name:entry.name});continue;}if(matches.length===1){const reserved=readJournal(key);if(reserved&&reserved!==matches[0].id)throw Error('保存再開の画像IDが一致しません。');writeJournal(key,matches[0].id);}
    onProgress({done,total,name:entry.name});await put(key,destinations[entry.rating].id,entry,{allowedParents});onProgress({done:++done,total,name:entry.name});
   }
   const manifest={...plan.manifest,name:'selection-results_'+plan.key.slice(0,12)+'.json'};await put(prefix+'manifest:'+plan.key,destinations.history.id,manifest);onProgress({done:++done,total,name:manifest.name});
   return {folderId:characterInfo.id,rootId:characterInfo.id,link:'https://drive.google.com/drive/folders/'+characterInfo.id,count:done};

  }
 };
}

export function sourceFileId(item){return item.crop?.driveSource?.fileId||[...(item.crop?.history||[])].reverse().find(h=>h.action==='read-drive-source'&&h.fileId)?.fileId||null;}
export async function groupCharacters(items,{resolve,fallback}){
 const groups=new Map(),cache=new Map();
 for(const item of items.filter(x=>x.origin==='crop-local')){const source=sourceFileId(item);let character;if(source){if(!cache.has(source))cache.set(source,await resolve(source));character=cache.get(source);}else character=fallback;if(!character?.id)throw Error('元画像の場所が不明です。キャラフォルダを指定してください。');if(!groups.has(character.id))groups.set(character.id,{character,items:[]});groups.get(character.id).items.push(item);}
 if(!groups.size)throw Error('先に切り出した画像を選抜へ送ってください。');return [...groups.values()];
}

export function exportSummary(plans){
 const total={records:0,trialRecords:0,pngCopies:0,adopted:0,held:0,rejected:0,unrated:0};
 for(const p of plans){total.records+=p.summary.records;total.trialRecords+=p.summary.trialRecords;total.pngCopies+=p.images.length;for(const key of ['adopted','held','rejected','unrated'])total[key]+=p.counts[key];}
 return '選抜結果'+total.records+'件（◯'+total.adopted+'・△'+total.held+'・✕'+total.rejected+(total.unrated?'・未選抜'+total.unrated:'')+'）／PNG '+total.pngCopies+'枚'+(total.trialRecords?'。試用画像'+total.trialRecords+'件の技術判定は未合格のまま保持します。':'');
}
