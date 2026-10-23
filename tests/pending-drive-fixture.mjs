import {pngHash,PENDING_SCHEMA} from '../integration-v1/drive-pending.mjs';
import {visualChecks} from '../integration-v1/crop-v9/core.mjs';
export class PendingFixture{
 constructor(){this.files=new Map();this.media=new Map();this.calls=[];this.rows=[['ID','分類','セリフ（厳密）','文字なしテーマ','基本ポーズ','優先度','メモ']];this.unauthorized=false;this.changeOnMedia=null;}
 folder(id,name,parent){const f={id,name,mimeType:'application/vnd.google-apps.folder',parents:[parent],version:'1',modifiedTime:'2026-10-24T00:00:00Z'};this.files.set(id,f);return f;}
 put(id,name,parent,mimeType,bytes){this.media.set(id,bytes);const f={id,name,mimeType,parents:[parent],size:String(bytes.byteLength),version:'1',modifiedTime:'2026-10-24T00:00:00Z',capabilities:{canDownload:true}};this.files.set(id,f);return f;}
 saveManifest(){const bytes=new TextEncoder().encode(JSON.stringify(this.manifest));this.put('manifest','selection-manifest_fixture.json',this.historyId||'history','application/json',bytes);}
 async setup(png,count=9){
  this.folder('char','05_合成テスト','root');this.folder('pending','00_選抜待ち','char');this.folder('history','03_元画像・生成履歴','char');
  this.files.set('master',{id:'master',name:'Synthetic_Master_v9',mimeType:'application/vnd.google-apps.spreadsheet',parents:['char']});
  this.manifest={schema:PENDING_SCHEMA,characterId:'char',pendingFolderId:'pending',masterReference:'https://docs.google.com/spreadsheets/d/master/edit',entries:[]};
  const sha256=await pngHash(png);
  for(let i=1;i<=count;i++){
   const n=String(i).padStart(2,'0'),candidateId='D'+n,imageId='synthetic_'+n,filename=imageId+'.png',phrase='合成テスト'+n,pose='テストのポーズ';
   this.rows.push([candidateId,'日常会話',phrase,'',pose,'高','']);this.put('png'+i,filename,'pending','image/png',png);
   this.manifest.entries.push({driveFileId:'png'+i,sha256,record:{imageId,filename,candidateId,phrase,pose,sourceId:'source',driveSource:{fileId:'source'},hasPixels:true,crossing:false,qa:{automatic:'pass',issues:[]},review:visualChecks.map(()=>true),inspection:{scope:'actual-source',at:'2026-10-24T00:00:00Z'},history:[],sequenceLabel:'01-'+n}});
  }
  this.saveManifest();return this;
 }
 async fetch(url,options={}){
  const u=new URL(url);this.calls.push({url,method:options.method,authorization:options.headers?.Authorization});
  if(options.method!=='GET')throw Error('Fixture forbids remote writes');
  if(this.unauthorized)return Response.json({error:'expired'},{status:401});
  if(u.origin==='https://sheets.googleapis.com')return Response.json(u.pathname.includes('/values/')?{values:this.rows}:{spreadsheetId:'master',sheets:[{properties:{sheetId:1,title:'116候補マスター',gridProperties:{rowCount:200,columnCount:7}}}]});
  if(u.pathname==='/drive/v3/files'){
   const q=u.searchParams.get('q'),parent=q.match(/'([-\w]+)' in parents/)?.[1],name=q.match(/name = '([^']+)'/)?.[1],contains=q.match(/name contains '([^']+)'/)?.[1],mime=q.match(/mimeType = '([^']+)'/)?.[1];
   return Response.json({files:[...this.files.values()].filter(f=>!f.trashed&&(!parent||f.parents?.includes(parent))&&(!name||f.name===name)&&(!contains||f.name.includes(contains))&&(!mime||f.mimeType===mime))});
  }
  const id=u.pathname.split('/').pop(),f=this.files.get(id);if(!f)return Response.json({error:'not found'},{status:404});
  if(u.searchParams.get('alt')==='media'){if(this.changeOnMedia===id)this.files.get(id).version='2';return new Response(this.media.get(id));}
  return Response.json(f);
 }
}
