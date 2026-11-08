// Shared byte-level checks for normal export, reorder export and Drive readback.
// pHYs is the only changed chunk; IDAT, colors, alpha and placement stay intact.
import {withPngDpi} from './png-density.mjs?v=20261108-issue9';
export const VALIDATION_VERSION='submission-bytes/v1';
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return (crc^0xffffffff)>>>0;}
export async function sha256(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function imageSpec(name,{emoji=false}={}){return name==='main.png'?[240,240]:name==='tab.png'?[96,74]:emoji?[180,180]:[370,320];}
export async function inspectSubmissionPng(name,blob,{emoji=false,requireDpi=true}={}){
 if(!blob||blob.size>1000000)throw Error(name+'：PNGは1MB以下にしてください。');
 const b=new Uint8Array(await blob.arrayBuffer()),v=new DataView(b.buffer);if(b.length<45||![137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x))throw Error(name+'：PNG形式が不正です。');
 const [width,height]=imageSpec(name,{emoji}),idat=[];let pos=8,header=false,ended=false,dpi=null,closedData=false;
 while(pos<b.length){if(pos+12>b.length)throw Error(name+'：PNGが途中で切れています。');const len=v.getUint32(pos),end=pos+12+len;if(end>b.length)throw Error(name+'：PNG長が不正です。');const type=String.fromCharCode(...b.subarray(pos+4,pos+8)),data=b.subarray(pos+8,end-4);if(crc32(b.subarray(pos+4,end-4))!==v.getUint32(end-4))throw Error(name+'：PNG CRCが一致しません。');
  if(!header&&type!=='IHDR')throw Error(name+'：IHDRがありません。');
  if(type==='IHDR'){if(header||len!==13||v.getUint32(pos+8)!==width||v.getUint32(pos+12)!==height||data[8]!==8||data[9]!==6||data[10]||data[11]||data[12])throw Error(name+'：寸法・8bit RGBA形式を確認できません。');header=true;}
  else if(type==='pHYs'){if(dpi||idat.length||len!==9)throw Error(name+'：72dpi情報の位置・重複が不正です。');dpi={x:v.getUint32(pos+8),y:v.getUint32(pos+12),unit:data[8]};}
  else if(type==='IDAT'){if(closedData)throw Error(name+'：IDATが連続していません。');idat.push(data);}
  else {if(idat.length)closedData=true;if(type==='IEND'){if(len||!idat.length)throw Error(name+'：IENDが不正です。');ended=true;pos=end;break;}if(!['PLTE'].includes(type)&&type[0]===type[0].toUpperCase())throw Error(name+'：未対応のPNGチャンクです。');}
  pos=end;
 }
 if(!ended||pos!==b.length)throw Error(name+'：PNG終端が不正です。');
 if(requireDpi&&(!dpi||dpi.x!==2835||dpi.y!==2835||dpi.unit!==1))throw Error(name+'：72dpi情報がありません。');
 const raw=new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()),stride=width*4;
 if(raw.length!==height*(stride+1))throw Error(name+'：RGBA実画素の長さが不正です。');
 let previous=new Uint8Array(stride),transparent=0,visible=0;
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)],row=raw.slice(y*(stride+1)+1,(y+1)*(stride+1));if(filter>4)throw Error(name+'：PNGフィルターが不正です。');for(let i=0;i<stride;i++){const a=i>=4?row[i-4]:0,b=previous[i],c=i>=4?previous[i-4]:0;let p=0;if(filter===1)p=a;if(filter===2)p=b;if(filter===3)p=Math.floor((a+b)/2);if(filter===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}row[i]=(row[i]+p)&255;if(i%4===3){if(row[i]===0)transparent++;else visible++;}}previous=row;}
 if(!transparent||!visible)throw Error(name+'：実アルファの透明背景・描画を確認できません。');
 return {filename:name,width,height,colorType:6,bitDepth:8,bytes:blob.size,dpiX:dpi?.x*0.0254,dpiY:dpi?.y*0.0254,transparentPixels:transparent,visiblePixels:visible,sha256:await sha256(blob)};
}
export async function normalizeSubmissionPng(name,blob,options={}){await inspectSubmissionPng(name,blob,{...options,requireDpi:false});const output=await withPngDpi(blob);await inspectSubmissionPng(name,output,options);return output;}
export async function readSubmissionZip(blob,{count=40,includeArtwork=true,emoji=false}={}){
 if(blob.size>(emoji?20000000:60000000))throw Error('ZIP容量が申請上限を超えています。');
 const b=new Uint8Array(await blob.arrayBuffer()),v=new DataView(b.buffer),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===b.length){end=p;break;}
 if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))throw Error('ZIP終端が不正です。');
 const names=Array.from({length:count},(_,i)=>String(i+1).padStart(emoji?3:2,'0')+'.png');if(includeArtwork){if(!emoji)names.push('main.png');names.push('tab.png');}
 if(u16(end+10)!==names.length||u32(end+16)+u32(end+12)!==end)throw Error('ZIP件数・索引が一致しません。');
 const result=new Map();let pos=u32(end+16),localEnd=0;
 for(let n=0;n<names.length;n++){if(pos+46>end||u32(pos)!==0x02014b50)throw Error('ZIP索引が不正です。');const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),size=u32(pos+20),rawSize=u32(pos+24),nl=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42),name=new TextDecoder().decode(b.subarray(pos+46,pos+46+nl));
  if(!names.includes(name)||result.has(name)||rawSize>1000000||flags&1||![0,8].includes(method)||offset!==localEnd||offset+30>u32(end+16)||u32(offset)!==0x04034b50||u16(offset+8)!==method||u16(offset+6)!==flags)throw Error('ZIP内の名前・重複・サイズ・形式が不正です。');
  const start=offset+30+u16(offset+26)+u16(offset+28);if(start+size>u32(end+16)||new TextDecoder().decode(b.subarray(offset+30,offset+30+u16(offset+26)))!==name)throw Error('ZIP内ファイルが不一致です。');
  const compressed=b.slice(start,start+size),raw=method===0?compressed:new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  if(raw.length!==rawSize||crc32(raw)!==crc)throw Error(name+'：ZIP CRC・展開サイズが不一致です。');
  if(flags&8)throw Error('データ記述子付きZIPは再書き出ししてから検品してください。');
  if(u32(offset+14)!==crc||u32(offset+18)!==size||u32(offset+22)!==rawSize)throw Error('ZIPヘッダーが不一致です。');
  result.set(name,new Blob([raw],{type:'image/png'}));localEnd=start+size;pos+=46+nl+extra+comment;
 }
 if(pos!==end||localEnd!==u32(end+16))throw Error('ZIP索引・データ終端が不一致です。');return result;
}
export async function inspectSubmissionZip(blob,{expected,...options}={}){
 const entries=await readSubmissionZip(blob,options),images=[];
 if(expected&&(expected.length!==entries.size||new Set(expected.map(e=>e.filename||e.name)).size!==entries.size))throw Error('ZIP対応IDの件数・重複が不正です。');
 for(const [name,image] of entries){const report=await inspectSubmissionPng(name,image,options);if(expected){const e=expected.find(e=>(e.filename||e.name)===name);const sha=e?.sha256||e?.sha||(e?.blob?await sha256(e.blob):null);if(!e||!sha||sha!==report.sha256)throw Error(name+'：対応ID・最新画像のSHA-256が一致しません。');report.imageId=e.imageId||e.sourceFileId||e.originalIndex?.toString()||name;report.candidateId=e.candidateId||null;}images.push(report);}
 return {version:VALIDATION_VERSION,zipSha256:await sha256(blob),bytes:blob.size,imageCount:images.length,names:images.map(e=>e.filename),images};
}
