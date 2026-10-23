import {digest} from '../drive-export.mjs';
const API='https://www.googleapis.com/drive/v3/files',FOLDER='application/vnd.google-apps.folder';
const fields='id,name,mimeType,parents,size,sha256Checksum,trashed,appProperties';
const id=x=>{if(typeof x!=='string'||!/^[-\w]{1,256}$/.test(x))throw Error('Drive IDが不正です');return x;};
const quote=x=>"'"+String(x).replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
export async function prepareSources(files){
 if(!files.length||files.length>20)throw Error('元画像PNGを1〜20枚選んでください');
 const out=[],seen=new Set();
 for(const blob of files){
  if(blob.size<33||blob.size>25000000)throw Error('PNGは25MB以下にしてください');
  const bytes=new Uint8Array(await blob.slice(0,33).arrayBuffer());
  if([137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('PNG元画像だけを保存できます');
  const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);
  if(!w||!h||w*h>16000000)throw Error('元画像は1600万画素以下にしてください');
  const sha=await digest(blob);if(seen.has(sha))continue;seen.add(sha);
  out.push({blob,sha,name:'SOURCE_'+sha+'.png',originalName:blob.name||'source.png',width:w,height:h});
 }
 return {entries:out,selected:files.length,duplicateInputs:files.length-out.length};
}
// Create-only transport. Never PATCH, move, replace or delete any source/history.
export function createSourceSave({getToken,fetchImpl=globalThis.fetch,readJournal,writeJournal}){
 async function request(url,options={}){
  const token=getToken();if(!token)throw Error('Googleに接続してください');
  const r=await fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(120000)});
  if(r.status===404||r.status===409)return r;
  if(!r.ok)throw Error('Drive通信失敗（HTTP '+r.status+'）。保存は未確認です。同じ画像で再開してください');return r;
 }
 async function meta(fileId){const r=await request(API+'/'+id(fileId)+'?'+new URLSearchParams({fields}));if(r.status===404)return null;return r.json();}
 async function list(parent,name){
  const files=[];let pageToken='';
  for(let page=0;page<50;page++){
   const q='trashed = false and '+quote(id(parent))+' in parents'+(name?' and name = '+quote(name):'');
   const r=await request(API+'?'+new URLSearchParams({q,fields:'files('+fields+'),nextPageToken',pageSize:'100',...(pageToken?{pageToken}:{})}));
   const result=await r.json();if(!Array.isArray(result.files))throw Error('Drive一覧を照合できません');files.push(...result.files);pageToken=result.nextPageToken||'';if(!pageToken)return files;
  }throw Error('保存先件数が多いため照合を停止しました');
 }
 async function destination(characterId){
  const character=await meta(characterId);if(!character||character.trashed||character.mimeType!==FOLDER)throw Error('キャラフォルダを確認してください');
  const found=await list(characterId,'03_元画像・生成履歴');
  if(found.length!==1||found[0].mimeType!==FOLDER||found[0].parents?.length!==1||found[0].parents[0]!==characterId)throw Error('03_元画像・生成履歴がないか複数あります。書き込みを停止しました');
  return {character,folder:found[0]};
 }
 async function verify(file,entry,parent){
  if(!file||file.trashed||file.mimeType!=='image/png'||file.parents?.length!==1||file.parents[0]!==parent||Number(file.size)!==entry.blob.size)throw Error('保存先・サイズ・ファイルIDの照合に失敗しました');
  let hash=file.sha256Checksum;if(!hash){const r=await request(API+'/'+id(file.id)+'?alt=media');if(!r.ok)throw Error('保存PNGを再読込できません');hash=await digest(await r.blob());}
  if(hash!==entry.sha)throw Error('PNG内容が一致しません。既存ファイルは変更していません');return file;
 }
 return {destination,async save(plan,characterId,onProgress=()=>{}){
  // Revalidate input; callers cannot supply forged hashes or MIME metadata.
  if(!plan?.entries?.length)throw Error('保存するPNGがありません');
  const checked=await prepareSources(plan.entries.map(x=>x.blob));
  if(checked.entries.length!==plan.entries.length||checked.entries.some((e,i)=>e.sha!==plan.entries[i].sha||e.name!==plan.entries[i].name))throw Error('保存準備が変更されています');
  const {character,folder}=await destination(id(characterId));
  const accountResponse=await request('https://www.googleapis.com/drive/v3/about?fields=user(permissionId)');const account=(await accountResponse.json()).user?.permissionId;id(account);
  const results=[];
  for(const entry of plan.entries){
   const key='source-save:v1:'+account+':'+folder.id+':'+entry.sha;
   const existing=await list(folder.id),matches=existing.filter(f=>f.mimeType==='image/png'&&(f.sha256Checksum===entry.sha||f.appProperties?.sourceSha256===entry.sha||f.name===entry.name));
   if(matches.length>1)throw Error('同じ元画像が複数あります。削除・上書きせず停止しました');
   let file=matches[0],reserved=readJournal(key);
   if(file&&reserved&&file.id!==reserved)throw Error('保存再開IDとDriveのIDが一致しません');
   if(!file&&reserved)file=await meta(reserved);
   const reused=!!file;
   if(!file){
    if(!reserved){const r=await request(API+'/generateIds?count=1&space=drive&type=files');reserved=id((await r.json()).ids?.[0]);writeJournal(key,reserved);if(readJournal(key)!==reserved)throw Error('再開用IDを端末に保存できません');}
    const metadata={id:reserved,name:entry.name,mimeType:'image/png',parents:[folder.id],appProperties:{sourceSha256:entry.sha,sourceGrid:'3x3',sourceApp:'animal-stickers-original/v1'}};
    const boundary='source_'+crypto.randomUUID(),body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(metadata),'\r\n--'+boundary+'\r\nContent-Type: image/png\r\n\r\n',entry.blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});
    await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':body.type},body});file=await meta(reserved);
    if(file?.id!==reserved||file?.name!==entry.name)throw Error('保存ファイルID・名前が一致しません');
   }
   await verify(file,entry,folder.id);writeJournal(key,file.id);
   const after=await list(folder.id),duplicates=after.filter(f=>f.mimeType==='image/png'&&(f.sha256Checksum===entry.sha||f.appProperties?.sourceSha256===entry.sha||f.name===entry.name));
   if(duplicates.length!==1||duplicates[0].id!==file.id)throw Error('保存後の件数・重複照合が未完了です。同じ画像で再開してください');
   await verify(await meta(file.id),entry,folder.id);
   results.push({fileId:file.id,name:file.name,originalName:entry.originalName,sha256:entry.sha,folderId:folder.id,reused,verifiedAt:new Date().toISOString(),state:'verified'});onProgress([...results]);
  }
  return {character:character.name,folderId:folder.id,count:results.length,duplicateInputs:plan.duplicateInputs,results};
 }};
}
