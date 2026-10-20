// Real transport is restricted to these existing synthetic fixtures. No production configuration.
export const TEST_DRIVE=Object.freeze({
 root:'1yssWMluUNljV8qI0YKyON2SdGtw85Qib',
 sheet:'1Q0mFzlIUUGaA_Y9INQXz3J7ZTKZUXDrwVX_fCcYAFno',
 folders:Object.freeze({pending:'1hroBdqdxVy4lQv2yo7WmvFvdE08o6G_a',adopt:'1p0vohtI3ft_bpYMOAMLwnaHZT-EGgN-m',hold:'1gs7ds_fnlxN1pAyNGQ_Jh1TQVeuN7EqJ'}),
 fixtures:Object.freeze([
  Object.freeze({candidate:'TEST01',driveFileId:'1YI4SLhWRzFVvDZ-v8NMyM-XJTi0V5bbY',filename:'v9_test_01.png'}),
  Object.freeze({candidate:'TEST02',driveFileId:'1BKC1dAaMO8Jr-JKe3Vqm7eHhz6nE2111',filename:'v9_test_02.png'}),
  Object.freeze({candidate:'TEST03',driveFileId:'1Vv8OZXvMu5cZoncKSwtmsETcitoT_w0j',filename:'v9_test_03.png'})])
});
const API='https://www.googleapis.com/drive/v3',UPLOAD='https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
const PREFIX='selector-v9-test-';
const copy=x=>JSON.parse(JSON.stringify(x));
export class GoogleTestDriveAdapter{
 mode='drive-test';
 #token;#fetch;#store;#records=[];#writes=false;
 #foldersChecked=false;#sourceRows=null;#journalList=null;#documentCache=new Map();
 constructor({getToken,fetchImpl=globalThis.fetch,storage=globalThis.localStorage}={}){if(typeof getToken!=='function')throw Error('Google認証が必要です');this.#token=getToken;this.#fetch=(...args)=>fetchImpl(...args);this.#store=storage}
 async #request(url,options={}){
  const u=new URL(url);
  if(u.origin!=='https://www.googleapis.com'&&u.origin!=='https://sheets.googleapis.com')throw Error('許可されていないAPI');
  const token=await this.#token();const r=await this.#fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!r.ok){const error=new Error(r.status===401?'Google認証の期限が切れました。接続し直してください。':'Google API HTTP '+r.status);error.status=r.status;throw error}
  return r;
 }
 async #json(url,options){return(await this.#request(url,options)).json()}
 async folderGuard(){
  if(this.#writes&&this.#foldersChecked)return;
  const root=await this.#json(API+'/files/'+TEST_DRIVE.root+'?fields=id,name,mimeType,trashed');
  if(root.id!==TEST_DRIVE.root||root.mimeType!=='application/vnd.google-apps.folder'||root.trashed||!root.name.includes('テスト'))throw Error('テスト領域不一致');
  for(const [key,id] of Object.entries(TEST_DRIVE.folders)){
   const f=await this.#json(API+'/files/'+id+'?fields=id,name,mimeType,parents,trashed');
   if(f.id!==id||f.mimeType!=='application/vnd.google-apps.folder'||f.trashed||f.parents?.length!==1||f.parents[0]!==TEST_DRIVE.root||!f.name.endsWith('_TEST'))throw Error(key+' テストフォルダ不一致');
  }
  if(this.#writes)this.#foldersChecked=true;
 }
 async journalFiles(){
  if(this.#writes&&this.#journalList)return this.#journalList;
  const all=[];let next='';
  do{const q=new URLSearchParams({q:"'"+TEST_DRIVE.root+"' in parents and trashed = false and mimeType = 'application/json' and name contains '"+PREFIX+"'",fields:'nextPageToken,files(id,name,mimeType,parents,trashed)',pageSize:'100',...(next?{pageToken:next}:{})});
   const data=await this.#json(API+'/files?'+q);all.push(...(data.files||[]));next=data.nextPageToken||'';
  }while(next);
  if(this.#writes)this.#journalList=all;
  return all;
 }
 async readFile(file){
  if(file.parents?.length!==1||file.parents[0]!==TEST_DRIVE.root||file.mimeType!=='application/json'||file.trashed||!file.name.startsWith(PREFIX))throw Error('履歴保存先不一致');
  const response=await this.#request(API+'/files/'+encodeURIComponent(file.id)+'?alt=media');
  const raw=await response.text();if(raw.length>50000)throw Error('履歴サイズ不正');
  const data=JSON.parse(raw);if(data.scope!=='isolated-test'||data.schema!==9)throw Error('履歴形式不一致');return data;
 }
 async document(name){
  if(this.#writes&&this.#documentCache.has(name))return this.#documentCache.get(name);
  const matches=(await this.journalFiles()).filter(f=>f.name===PREFIX+name+'.json');
  if(matches.length>1)throw Error('履歴ファイル重複：'+name);
  if(!matches.length)return null;
  const value=await this.readFile(matches[0]);
  if(this.#writes)this.#documentCache.set(name,value);
  return value;
 }
 async createDocument(name,data){
  if(!this.#writes)throw Error('選抜確定操作が必要です');
  const existing=await this.document(name);
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(data))throw Error('履歴内容不一致');return existing}
  const key='selector-v9-test-upload:'+name;
  const staged=this.#store.getItem(key+':payload');
  if(staged){const original=JSON.parse(staged);const normalize=x=>{const out=copy(x);delete out.sequence;if(out.event){delete out.event.createdAt;delete out.event.previousRating;delete out.event.previousComment;delete out.event.previousFolder}return JSON.stringify(out)};if(normalize(original)!==normalize(data))throw Error('保存予約内容不一致');data=original}else this.#store.setItem(key+':payload',JSON.stringify(data));
  let id=this.#store.getItem(key);
  if(!id){id=(await this.#json(API+'/files/generateIds?count=1&space=drive&type=files')).ids?.[0];if(!id)throw Error('保存ID取得失敗');this.#store.setItem(key,id)}
  const boundary='selector_'+crypto.randomUUID().replaceAll('-','');
  const metadata={id,name:PREFIX+name+'.json',mimeType:'application/json',parents:[TEST_DRIVE.root]};
  const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(data)+'\r\n--'+boundary+'--\r\n';
  try{await this.#json(UPLOAD,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body})}catch(e){if(e.status!==409)throw e}
  // Read the reserved ID, not just a possibly delayed search result. Retry uses the same ID.
  const f=await this.#json(API+'/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,parents,trashed');
  if(f.name!==metadata.name)throw Error('保存ID不一致');
  const verified=await this.readFile(f);if(JSON.stringify(verified)!==JSON.stringify(data))throw Error('履歴保存照合失敗');
  // These immutable bytes were read back from Google. Reuse that verified result in this run.
  this.#documentCache.set(name,verified);
  if(this.#journalList&&!this.#journalList.some(x=>x.id===f.id))this.#journalList.push(f);
  return verified;
 }
 async list(){
  await this.folderGuard();
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+TEST_DRIVE.sheet+'/values/'+encodeURIComponent("'テスト選抜履歴'!A1:J1000");
  const rows=this.#writes&&this.#sourceRows?this.#sourceRows:(await this.#json(url)).values||[];
  if(rows[0]?.[0]!=='候補ID'||rows[0]?.[1]!=='画像ID'||rows[0]?.[7]!=='DriveファイルID')throw Error('テストマスター列不一致');
  if(this.#writes)this.#sourceRows=rows;
  const records=TEST_DRIVE.fixtures.map(f=>{
   const matches=rows.slice(1).filter(r=>r[0]===f.candidate||r[7]===f.driveFileId);
   if(matches.length!==1||matches[0][0]!==f.candidate||matches[0][7]!==f.driveFileId||!matches[0][1]?.startsWith(f.filename+'|'))return {...f,imageId:'invalid:'+f.candidate,attemptId:'',folder:'pending',technicalPassed:false,testFixture:true,scope:'isolated-test'};
   const row=matches[0];return {...f,imageId:row[1],attemptId:row[1],phrase:row[2]||'',folder:({['01_採用予定_TEST']:'adopt',['02_保留_TEST']:'hold'})[row[8]]||'pending',technicalPassed:false,testFixture:true,scope:'isolated-test',rating:null,confirmed:false,comment:'',sourceRating:row[3]||'',sourceConfirmed:row[4]||''};
  });
  const results=[];
  for(const f of (await this.journalFiles()).filter(x=>x.name.endsWith('-result.json'))){const name=f.name.slice(PREFIX.length,-5);const value=this.#writes?await this.document(name):await this.readFile(f);if(value.kind==='result')results.push(value)}
  for(const record of records){
   const updates=results.filter(x=>x.imageId===record.imageId&&x.candidate===record.candidate&&x.attemptId===record.attemptId&&x.driveFileId===record.driveFileId).sort((a,b)=>a.sequence-b.sequence||a.operationId.localeCompare(b.operationId));
   if(updates.length)Object.assign(record,updates.at(-1).patch);
  }
  this.#records=copy(records);return records;
 }
 async metadata(id){
  const allowed=TEST_DRIVE.fixtures.find(x=>x.driveFileId===id);if(!allowed)throw Error('テスト対象外のPNG');
  const f=await this.#json(API+'/files/'+id+'?fields=id,name,mimeType,parents,trashed');
  const folder=Object.entries(TEST_DRIVE.folders).find(([,parent])=>f.parents?.length===1&&f.parents[0]===parent)?.[0];
  if(f.id!==id||f.name!==allowed.filename||f.mimeType!=='image/png'||f.trashed||!folder)throw Error('テストPNGの実体・保存先不一致');
  return {...f,folder};
 }
 async image(id){await this.metadata(id);const blob=await(await this.#request(API+'/files/'+id+'?alt=media')).blob();if(!blob.size||blob.size>15e6)throw Error('PNGサイズ不正');return blob}
 async event(id){const data=await this.document(id+'-prepared');if(!data)return null;const done=await this.document(id+'-complete');return {...data.event,status:done?'complete':'started'}}
 async begin(event){
  if(!this.#writes)throw Error('選抜確定操作が必要です');
  const r=this.#records.find(x=>x.imageId===event.imageId);
  if(!r||r.driveFileId!==event.driveFileId||r.candidate!==event.candidate||r.attemptId!==event.attemptId||!TEST_DRIVE.fixtures.some(f=>f.driveFileId===r.driveFileId))throw Error('同期対象不一致');
  const old=await this.document(event.id+'-prepared');
  if(old){for(const k of ['imageId','candidate','attemptId','driveFileId','rating','comment','destination'])if(old.event[k]!==event[k])throw Error('再開履歴不一致');return old.event}
  const doc={schema:9,scope:'isolated-test',kind:'prepared',sequence:Date.now(),event};
  return(await this.createDocument(event.id+'-prepared',doc)).event;
 }
 async move(id,from,to){
  if(!this.#writes)throw Error('選抜確定操作が必要です');
  if(!['pending','adopt','hold'].includes(from)||!['adopt','hold'].includes(to))throw Error('許可されていない移動先');
  await this.folderGuard();const f=await this.metadata(id);if(f.folder===to)return f;if(f.folder!==from)throw Error('PNG保存先が他の操作で変わりました');
  await this.#json(API+'/files/'+id+'?'+new URLSearchParams({addParents:TEST_DRIVE.folders[to],removeParents:TEST_DRIVE.folders[from],fields:'id,name,parents'}),{method:'PATCH'});
  const after=await this.metadata(id);if(after.folder!==to)throw Error('移動後照合失敗');return after;
 }
 async save(imageId,patch){
  const prepared=await this.document(patch.operationId+'-prepared');if(!prepared||prepared.event.imageId!==imageId||prepared.event.rating!==patch.rating||prepared.event.comment!==patch.comment||prepared.event.destination!==patch.folder)throw Error('選抜内容不一致');
  const e=prepared.event;
  return this.createDocument(patch.operationId+'-result',{schema:9,scope:'isolated-test',kind:'result',sequence:prepared.sequence,imageId,candidate:e.candidate,attemptId:e.attemptId,driveFileId:e.driveFileId,operationId:patch.operationId,patch});
 }
 async complete(id){
  const result=await this.document(id+'-result');if(!result)throw Error('評価保存未確認');
  return this.createDocument(id+'-complete',{schema:9,scope:'isolated-test',kind:'complete',operationId:id});
 }
 async confirmRun(fn){
  if(!globalThis.navigator?.locks)throw Error('このブラウザでは安全な同時実行制御を利用できません');
  return navigator.locks.request('selector-v9-real-test-sync',{ifAvailable:true},async lock=>{
   if(!lock)throw Error('別画面で同期中です');
   this.#foldersChecked=false;this.#sourceRows=null;this.#journalList=null;this.#documentCache.clear();this.#writes=true;
   try{return await fn()}finally{this.#writes=false;this.#foldersChecked=false;this.#sourceRows=null;this.#journalList=null;this.#documentCache.clear()}
  });
 }
}
