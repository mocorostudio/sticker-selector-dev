import {gate,inspect} from './crop-v9/core.mjs?v=20261021-flow2';
const signature=[137,80,78,71,13,10,26,10];
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
// No remote IO. The adapter persists PNG + metadata, then reads both back.
export async function importCrops(entries,adapter,master){
 if(!Array.isArray(entries)||entries.length>64)throw Error('受け渡し件数が不正です');
 const result={ids:[],added:0,existing:0,errors:[]};
 for(const entry of entries){try{
  const r=entry?.record,m=master.find(x=>x.candidateId===r?.candidateId);
  if(!r||!m||m.phrase!==r.phrase||m.pose!==r.pose||gate(r)!=='pass')throw Error('候補・セリフ・検品の照合に失敗');
  if(typeof r.imageId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(r.imageId)||typeof r.filename!=='string'||!/^[-A-Za-z0-9_]+\.png$/.test(r.filename))throw Error('画像ID・ファイル名が不正');
  if(!(entry.png instanceof ArrayBuffer)||entry.png.byteLength<24||entry.png.byteLength>15e6)throw Error('実PNGが必要です');
  const bytes=new Uint8Array(entry.png);if(!equal(bytes.subarray(0,8),signature))throw Error('PNG形式不正');
  const blob=new Blob([bytes],{type:'image/png'}),decoded=await adapter.decode(blob);
  if(gate({...r,qa:inspect(decoded,r.crossing)})!=='pass')throw Error('PNG画素の再検査に失敗');
  const id='crop:'+r.imageId,items=adapter.items(),old=items.find(x=>x.id===id||x.imageId===r.imageId);
  if(items.some(x=>x.name===r.filename&&x.imageId!==r.imageId))throw Error('ファイル名が既存画像と重複');
  if(old){
   if(old.id!==id||old.origin!=='crop-local'||old.candidate!==r.candidateId||old.phrase!==r.phrase||old.name!==r.filename)throw Error('既存画像IDの情報が不一致');
   const stored=await adapter.get(id);if(!stored||!equal(new Uint8Array(await stored.arrayBuffer()),bytes))throw Error('既存PNGと内容が不一致');
   result.existing++;
  }else{
   const {pixels,...metadata}=r;
   const item={id,imageId:r.imageId,candidate:r.candidateId,attemptId:r.imageId,name:r.filename,phrase:r.phrase,pose:r.pose,origin:'crop-local',technicalPassed:true,technicalStatus:'pass',technicalScope:'local-test',masterSource:'attached-v3-116',crop:structuredClone(metadata),saveState:'local',rating:'o',touched:false,comment:'',selectionHistory:[]};
   await adapter.write(item,blob);
   const check=adapter.items().find(x=>x.id===id),stored=await adapter.get(id);
   if(!check||check.imageId!==r.imageId||check.candidate!==r.candidateId||check.name!==r.filename||!stored||!equal(new Uint8Array(await stored.arrayBuffer()),bytes))throw Error('端末保存の再照合に失敗');
   result.added++;
  }
  result.ids.push(id);
 }catch(e){result.errors.push({imageId:entry?.record?.imageId||'',message:e.message});}}
 return result;
}
export function confirmLocal(items,now=new Date().toISOString()){
 let added=0;
 for(const item of items.filter(x=>x.origin==='crop-local'&&x.touched)){
  if(!['o','h','x'].includes(item.rating)||!item.revision)continue;
  item.selectionHistory??=[];
  if(item.selectionHistory.some(x=>x.revision===item.revision))continue;
  item.selectionHistory.push({revision:item.revision,at:now,rating:item.rating,comment:item.comment||'',scope:'local'});added++;
 }
 return added;
}

export function isLocalConfirmed(item){return item.origin==='crop-local'&&!!item.touched&&!!item.revision&&!!item.selectionHistory?.some(x=>x.revision===item.revision);}
