import {isLocalConfirmed} from './crop-handoff.mjs?v=20261022-drive1';
import {inspect} from './crop-v9/core.mjs?v=20261022-drive1';
const API='https://www.googleapis.com/drive/v3/files',FOLDER='application/vnd.google-apps.folder';
const FIELDS='id,name,mimeType,parents,size,sha256Checksum,appProperties,trashed,webViewLink';
export const EXPORT_APP='animal-stickers-selection-v1';
const id=value=>{if(typeof value!=='string'||!/^[-\w]{1,256}$/.test(value))throw Error('保存先IDが不正です');return value;};
export async function digest(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function prepareExport(items,{get,decode}){
 const rows=items.filter(x=>x.origin==='crop-local');if(!rows.length)throw Error('先に切り出した画像を選抜へ送ってください。');
 if(rows.some(x=>x.touched&&!isLocalConfirmed(x)))throw Error('先に「選抜結果を端末に保存」を押してください。');
 if(!rows.some(isLocalConfirmed))throw Error('先に画像を選抜し、結果を端末内に保存してください。');
 const images=[],results=[];let total=0;
 for(const item of rows){const confirmed=isLocalConfirmed(item),row={imageId:item.imageId,number:item.sequenceLabel||'',candidateId:item.candidate||null,phrase:item.phrase||'',rating:confirmed?item.rating:null,comment:item.comment||'',revision:item.revision||null,confirmed,selectionHistory:structuredClone(item.selectionHistory||[]),technicalStatus:'review'};
  if(confirmed&&item.rating==='o'){id(item.imageId);const blob=await get(item.id);if(!blob||blob.type!=='image/png'||blob.size<24||blob.size>15000000)throw Error((row.number||item.name)+'のPNGを読み込めません。');total+=blob.size;if(total>150000000)throw Error('一度の保存は150MB以下にしてください。');const qa=inspect(await decode(blob),item.crop?.crossing);if(qa.issues.includes('空画像'))throw Error((row.number||item.name)+'は空画像です。');const name='ST_'+(row.number.replace(/[^\w-]/g,'')||'image')+'_'+item.imageId+'.png',sha=await digest(blob);images.push({name,blob,sha});Object.assign(row,{filename:name,sha256:sha,technicalWarnings:qa.issues});}
  results.push(row);
 }
 const manifest={schema:'animal-stickers-selection-export/v1',purpose:'採用候補の保存。申請用の最終技術確認は別途必要。',results},json=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'}),key=await digest(json);
 return {key,images,manifest:{name:'selection-results.json',blob:json,sha:key},counts:{adopted:images.length,held:results.filter(x=>x.rating==='h').length,rejected:results.filter(x=>x.rating==='x').length,unrated:results.filter(x=>!x.rating).length}};
}
// Only creates app-owned folders/files. No PATCH, DELETE, moves, or permission changes.
export function createExportDrive({getToken,fetchImpl=globalThis.fetch,readJournal,writeJournal}){
 async function request(url,options={}){const token=getToken();if(!token)throw Error('Googleに接続してください。');const response=await fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});if(response.status===404)return null;if(!response.ok)throw Error(response.status===401?'Google接続の期限が切れました。接続し直してください。':response.status===403?'Driveの保存権限・空き容量を確認してください。':'Drive保存失敗（HTTP '+response.status+'）。同じ内容で再開できます。');return response;}
 async function meta(fileId){const r=await request(API+'/'+id(fileId)+'?'+new URLSearchParams({fields:FIELDS}));return r?await r.json():null;}
 async function reserve(key){let reserved=readJournal(key);if(reserved)return id(reserved);const r=await request(API+'/generateIds?count=1&space=drive&type=files');const value=(await r.json()).ids?.[0];id(value);writeJournal(key,value);return value;}
 function matches(file,expected){return file&&file.id===expected.id&&!file.trashed&&file.name===expected.name&&file.mimeType===expected.mimeType&&(!expected.parents||file.parents?.length===1&&file.parents[0]===expected.parents[0])&&Object.entries(expected.appProperties).every(([k,v])=>file.appProperties?.[k]===v);}
 async function folder(key,name,parent,properties){const fileId=await reserve(key),expected={id:fileId,name,mimeType:FOLDER,...(parent?{parents:[id(parent)]}:{}),appProperties:{exportApp:EXPORT_APP,...properties}};let file=await meta(fileId);if(!file){await request(API+'?'+new URLSearchParams({fields:FIELDS}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(expected)});file=await meta(fileId);}if(!matches(file,expected))throw Error('保存先フォルダの照合に失敗しました。既存ファイルは変更していません。');return file;}
 async function put(key,parent,entry){const fileId=await reserve(key),expected={id:fileId,name:entry.name,mimeType:entry.blob.type,parents:[parent],appProperties:{exportApp:EXPORT_APP,sha256:entry.sha}};let file=await meta(fileId);if(!file){const boundary='sticker_'+crypto.randomUUID(),body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(expected),'\r\n--'+boundary+'\r\nContent-Type: '+entry.blob.type+'\r\n\r\n',entry.blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':body.type},body});file=await meta(fileId);}
  if(!matches(file,expected)||Number(file.size)!==entry.blob.size)throw Error('保存ファイルの照合に失敗しました。再試行してください。');let sha=file.sha256Checksum;if(!sha){const r=await request(API+'/'+fileId+'?alt=media');if(!r)throw Error('保存ファイルを再読込できません。');const blob=await r.blob();if(blob.size!==entry.blob.size)throw Error('保存サイズが一致しません。');sha=await digest(blob);}if(sha!==entry.sha)throw Error('保存内容が一致しません。既存ファイルは変更していません。');return file;
 }
 return {
  async account(){const r=await request('https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)');const user=(await r.json()).user;if(!user?.permissionId)throw Error('保存するGoogleアカウントを確認できません。');return user;},
  async roots(){const r=await request(API+'?'+new URLSearchParams({q:"trashed = false and mimeType = '"+FOLDER+"' and appProperties has { key='exportApp' and value='"+EXPORT_APP+"' } and appProperties has { key='kind' and value='export-root' }",fields:'files('+FIELDS+'),nextPageToken',pageSize:'100'}));return (await r.json()).files;},
  async save(plan,{accountId,rootId,rootName='動物スタンプ_選抜保存',onProgress=()=>{}}){id(accountId);const prefix='drive-export:'+accountId+':';let root;if(rootId){root=await meta(rootId);if(!root||root.trashed||root.mimeType!==FOLDER||root.appProperties?.exportApp!==EXPORT_APP||root.appProperties?.kind!=='export-root')throw Error('このアプリの保存用フォルダを選んでください。');}else{if(!rootName.trim()||rootName.length>100)throw Error('保存用フォルダ名を1〜100文字で入力してください。');root=await folder(prefix+'root:'+await digest(new Blob([rootName.trim()])),rootName.trim(),null,{kind:'export-root'});}
   const bundle=await folder(prefix+root.id+':'+plan.key+':folder','選抜_'+plan.key.slice(0,12),root.id,{kind:'selection-bundle',bundle:plan.key});const entries=[...plan.images,plan.manifest];let done=0;for(const entry of entries){onProgress({done,total:entries.length,name:entry.name});await put(prefix+bundle.id+':'+entry.name,bundle.id,entry);onProgress({done:++done,total:entries.length,name:entry.name});}return {folderId:bundle.id,rootId:root.id,link:bundle.webViewLink||'https://drive.google.com/drive/folders/'+bundle.id,count:done};
  }
 };
}
