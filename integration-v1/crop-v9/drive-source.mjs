export const FOLDER='application/vnd.google-apps.folder';
export const IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
const API='https://www.googleapis.com/drive/v3/files';
const fields='id,name,mimeType,parents,size,modifiedTime,version,md5Checksum,trashed,capabilities(canDownload)';
const validId=id=>{if(typeof id!=='string'||!/^[-\w]{1,256}$/.test(id))throw Error('Drive IDが不正です');return id;};
const quoted=value=>"'"+String(value).replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
export function createDriveSource({getToken,fetchImpl=globalThis.fetch,onUnauthorized=()=>{}}){
 let requests=0;
 async function request(url){
  if(++requests>100)throw Error('読み込み回数の上限です。少し時間を置いてから接続し直してください。');
  const token=getToken();if(!token)throw Error('Googleに接続してください。');
  const r=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(r.status===401){onUnauthorized();throw Error('Google接続の期限が切れました。もう一度接続してください。');}
  if(!r.ok)throw Error(r.status===403?'Driveの閲覧権限を確認してください。':r.status===429?'Driveの読込上限です。自動再試行は停止しました。':'Drive読込失敗（HTTP '+r.status+'）');
  return r;
 }
 const metadata=async id=>(await request(API+'/'+validId(id)+'?'+new URLSearchParams({fields,supportsAllDrives:'true'}))).json();
 function check(file){if(!file?.id||file.trashed||!IMAGE_TYPES.includes(file.mimeType)||!Number.isFinite(Number(file.size))||Number(file.size)<1||Number(file.size)>25000000||file.capabilities?.canDownload===false)throw Error('対応画像でないか、25MBを超えているか、ダウンロードが許可されていません。');}
 return {
  async list({folder='root',search='',pageToken=''}={}){
   validId(folder);if(search.length>200)throw Error('検索文字が長すぎます');
   const typeQuery=[FOLDER,...IMAGE_TYPES].map(t=>'mimeType = '+quoted(t)).join(' or ');
   const q='trashed = false and ('+typeQuery+') and '+(search?'name contains '+quoted(search):quoted(folder)+' in parents');
   const r=await request(API+'?'+new URLSearchParams({q,fields:'nextPageToken,files('+fields+')',pageSize:'100',orderBy:'folder,name',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})}));
   const result=await r.json();if(!Array.isArray(result.files))throw Error('Driveの一覧形式が不正です');return result;
  },
  async read(id){
   const before=await metadata(id);check(before);
   const response=await request(API+'/'+validId(id)+'?alt=media&supportsAllDrives=true');
   const length=Number(response.headers.get('content-length'));if(length>25000000)throw Error('画像は25MB以下にしてください');
   const reader=response.body?.getReader();if(!reader)throw Error('画像ストリームを読めません');const chunks=[];let size=0;
   try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>25000000){await reader.cancel();throw Error('画像は25MB以下にしてください');}chunks.push(next.value);}}finally{reader.releaseLock();}
   const after=await metadata(id);check(after);
   if(size!==Number(before.size)||['id','mimeType','size','modifiedTime','version','md5Checksum'].some(k=>before[k]!==after[k]))throw Error('読込中に元画像が変更されました。もう一度選んでください。');
   return {file:new File(chunks,before.name,{type:before.mimeType,lastModified:Date.parse(before.modifiedTime)||0}),driveSource:{fileId:before.id,name:before.name,parents:before.parents,version:before.version,modifiedTime:before.modifiedTime,md5Checksum:before.md5Checksum,readAt:new Date().toISOString()}};
  }
 };
}
