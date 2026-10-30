import {SCHEMA,parseMaster,validateProgress,mergeProgress} from './progress-core.mjs';
const FILES='https://www.googleapis.com/drive/v3/files',SHEETS='https://sheets.googleapis.com/v4/spreadsheets';
const PREFIX='sticker-progress_';
const id=s=>{if(!/^[-\w]{1,256}$/.test(s||''))throw Error('保存先IDが不正です。');return s;};
export function progressDrive({getToken,fetchImpl=globalThis.fetch}){
 let master,root;
 async function request(url,options={}){const r=await fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+await getToken()},signal:AbortSignal.timeout(30000),redirect:'error'});if(!r.ok){const e=Error('Googleとの通信に失敗（'+r.status+'）。記録は保持しています。');e.status=r.status;throw e;}return r;}
 const json=async(url,options)=>(await request(url,options)).json();
 async function list(q){let pageToken='',files=[];do{const r=await json(FILES+'?'+new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,parents,modifiedTime)',pageSize:'100',...(pageToken?{pageToken}:{})}));files.push(...(r.files||[]));pageToken=r.nextPageToken||'';if(files.length>2000)throw Error('履歴が多いため読み込みを止めました。');}while(pageToken);return files;}
 async function load(){
  const found=await list("trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and name='全体管理マスター_v9'");
  if(found.length!==1||found[0].parents?.length!==1)throw Error('全体管理マスターv9が見つからないか重複しています。保存先のGoogleアカウントで接続してください。');
  master=found[0];root=id(master.parents[0]);
  const book=await json(SHEETS+'/'+id(master.id)+'?fields=sheets(properties)');
  let base;
  for(const s of book.sheets||[]){const p=s.properties,g=p.gridProperties;if(!g)continue;const range="'"+p.title.replaceAll("'","''")+"'!A1:"+(g.columnCount>=15?'O':'J')+Math.min(g.rowCount,2000);const data=await json(SHEETS+'/'+master.id+'/values/'+encodeURIComponent(range));if(data.values?.[0]?.includes('動物')&&data.values[0].includes('フォルダ')){base=parseMaster(data.values);break;}}
  if(!base)throw Error('全体管理マスターの一覧タブを確認できません。');
  const docs=[];for(const f of await list("trashed=false and '"+root+"' in parents and mimeType='application/json' and name contains '"+PREFIX+"'")){if(!f.name.startsWith(PREFIX))continue;const d=await json(FILES+'/'+id(f.id)+'?alt=media');validateProgress(d);docs.push(d);}
  return {records:mergeProgress(base,docs),masterId:master.id,root,loadedAt:new Date().toISOString()};
 }
 async function reserve(){return (await json(FILES+'/generateIds?count=1&space=drive&type=files')).ids[0];}
 async function save(doc,fileId){
  validateProgress(doc);if(!root)throw Error('先に最新の一覧を読み込んでください。');id(fileId);
  const text=JSON.stringify(doc),metadata={id:fileId,name:PREFIX+fileId+'.json',parents:[root],mimeType:'application/json'};
  const boundary='progress_'+crypto.randomUUID();const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+text+'\r\n--'+boundary+'--';
  try{await json('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});}catch(e){if(e.status!==409)throw e;}
  const meta=await json(FILES+'/'+fileId+'?fields=id,parents,mimeType,trashed');if(meta.trashed||meta.parents?.length!==1||meta.parents[0]!==root||meta.mimeType!=='application/json')throw Error('進捗履歴の保存先が一致しません。');
  const actual=await json(FILES+'/'+fileId+'?alt=media');if(JSON.stringify(actual)!==text)throw Error('進捗履歴の保存照合に失敗しました。');return fileId;
 }
 return {load,reserve,save};
}
