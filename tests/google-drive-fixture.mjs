import {TEST_DRIVE} from '../google-test-drive.mjs';
import {png} from './mock-drive.mjs';
export class Storage{data=new Map();getItem(k){return this.data.get(k)||null}setItem(k,v){this.data.set(k,v)}}
export class GoogleRestFixture{
 files=new Map();calls=[];rows=[['候補ID','画像ID','セリフ','評価','選抜確定','評価日時','同期状態','DriveファイルID','保存先','備考']];nextId=0;lose='';
 constructor(){
  this.files.set(TEST_DRIVE.root,{id:TEST_DRIVE.root,name:'99_v9選抜同期_テスト専用',mimeType:'application/vnd.google-apps.folder'});
  for(const [key,id] of Object.entries(TEST_DRIVE.folders))this.files.set(id,{id,name:{pending:'00_選抜待ち_TEST',adopt:'01_採用予定_TEST',hold:'02_保留_TEST'}[key],mimeType:'application/vnd.google-apps.folder',parents:[TEST_DRIVE.root]});
  TEST_DRIVE.fixtures.forEach((f,i)=>{this.files.set(f.driveFileId,{id:f.driveFileId,name:f.filename,mimeType:'image/png',parents:[TEST_DRIVE.folders.pending]});this.rows.push([f.candidate,f.filename+'|123|existing-id', 'テスト'+i,'◯','確定','old-time','old-state',f.driveFileId,'00_選抜待ち_TEST','保持する備考'])});
 }
 fetch=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET';this.calls.push({url,method,body:options.body,headers:options.headers});
  const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
  if(options.headers?.Authorization!=='Bearer test-token')return json({},401);
  if(u.origin==='https://sheets.googleapis.com'){if(method!=='GET')throw Error('legacy sheet write forbidden');return json({values:this.rows})}
  if(u.pathname.endsWith('/generateIds'))return json({ids:['generated-'+(++this.nextId)]});
  if(u.pathname==='/upload/drive/v3/files'){
   if(method!=='POST')throw Error('unexpected upload');
   const boundary=options.headers['Content-Type'].split('boundary=')[1];const parts=options.body.split('--'+boundary);const meta=JSON.parse(parts[1].split('\r\n\r\n')[1].trim());const data=JSON.parse(parts[2].split('\r\n\r\n')[1].trim());
   if(meta.parents[0]!==TEST_DRIVE.root)throw Error('outside sandbox');
   if(this.files.has(meta.id))return json({},409);
   this.files.set(meta.id,{...meta,data});
   if(this.lose&&meta.name.endsWith(this.lose+'.json')){this.lose='';throw Error('lost upload response')}
   return json({id:meta.id});
  }
  if(u.pathname==='/drive/v3/files')return json({files:[...this.files.values()].filter(f=>f.name.startsWith('selector-v9-test-')).map(({data,...m})=>m)});
  const id=decodeURIComponent(u.pathname.split('/').at(-1)),file=this.files.get(id);if(!file)return json({},404);
  if(method==='PATCH'){
   if(!TEST_DRIVE.fixtures.some(f=>f.driveFileId===id))throw Error('unexpected write');
   const to=u.searchParams.get('addParents'),from=u.searchParams.get('removeParents');if(file.parents[0]!==from)throw Error('concurrent move');if(!Object.values(TEST_DRIVE.folders).includes(to))throw Error('unsafe destination');file.parents=[to];return json({id,parents:[to]});
  }
  if(u.searchParams.get('alt')==='media')return file.data?json(file.data):new Response(png,{headers:{'Content-Type':'image/png'}});
  return json(file);
 };
 writes(){return this.calls.filter(x=>x.method!=='GET')}
}
