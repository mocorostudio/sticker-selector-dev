import {SET_COUNTS,validateSubmission} from './submission-core.mjs?v=20261024-zip1';
import {digest} from './drive-export.mjs?v=20261024-zip1';
import {inspect,gate} from './crop-v9/core.mjs?v=20261023-merge1';
import {trialEligible} from './drive-pending.mjs?v=20261024-progress1';
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
// PNG is already compressed. A stored ZIP needs no network dependency and preserves exact bytes.
export async function storedZip(entries){
 if(!entries.length||entries.length>40)throw Error('ZIPの画像数が不正です。');
 const local=[],central=[],names=new Set();let offset=0,size=0;
 for(const e of entries){if(!/^\d{2}\.png$/.test(e.name)||names.has(e.name))throw Error('ZIPの画像名が不正です。');names.add(e.name);const data=new Uint8Array(await e.blob.arrayBuffer()),name=encoder.encode(e.name),crc=crc32(data);size+=data.length;if(size>150000000)throw Error('ZIPは150MB以下にしてください。');
  const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);local.push(h,data);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'});
}
export async function prepareSelectionZip(plan,{items=[],get,decode,getRemote,onProgress=()=>{}}){
 const trial=plan?.schema==='animal-stickers-submission-trial/v1';
 if(!trial)validateSubmission(plan);
 if(trial&&(plan.technicalApproval!==false||plan.purpose!=='selection-test-only'))throw Error('試用計画が不正です。');
 if(!/^[-\w]{1,256}$/.test(plan?.characterId)||!Array.isArray(plan.sets)||!plan.sets.length||!Array.isArray(plan.entries))throw Error('ZIPの選択を確認できません。');
 const ids=new Set();for(const s of plan.sets){if(ids.has(s.id)||!SET_COUNTS.includes(s.target)||plan.entries.filter(e=>e.setId===s.id).length!==s.target)throw Error('選択枚数を目標に合わせてください。');ids.add(s.id);}
 const selectedIds=new Set();for(const e of plan.entries){if(selectedIds.has(e.fileId)||!ids.has(e.setId))throw Error('候補が重複しているかセットが不明です。');selectedIds.add(e.fileId);}
 const archives=[];let done=0;
 for(const set of plan.sets){const entries=[],mapping=[];
  for(const e of plan.entries.filter(e=>e.setId===set.id)){let blob,technicalStatus='pass';
   if(trial){const matches=items.filter(x=>x.id===e.localItemId&&x.imageId===e.imageId);if(matches.length!==1)throw Error('候補画像の対応を確認できません。');const item=matches[0];if(item.origin!=='crop-local'||!item.touched||item.rating!=='o'||item.imageId!==e.fileId||item.characterId&&item.characterId!==plan.characterId)throw Error('候補の選抜・キャラを確認できません。');blob=await get(item.id);if(!blob||blob.type!=='image/png'||blob.size>15000000)throw Error('候補のPNGを取得できません。');const qa=inspect(await decode(blob),item.crop?.crossing),approved=item.technicalPassed===true&&gate({...item.crop,qa})==='pass';if(!approved&&!trialEligible({...item.crop,qa}))throw Error('技術検品・試用許可を確認できません。');technicalStatus=approved?'pass':'review';
   }else{blob=await getRemote(e);if(!blob||blob.type!=='image/png'||blob.size!==Number(e.size))throw Error('保存前の画像サイズが一致しません。');if(e.sha256Checksum&&await digest(blob)!==e.sha256Checksum)throw Error('保存前の画像内容が一致しません。');const qa=inspect(await decode(blob),false);if(qa.issues.length)throw Error('申請画像の再検品に失敗しました。');}
   const name=String(entries.length+1).padStart(2,'0')+'.png';entries.push({name,blob});mapping.push({filename:name,imageId:e.imageId||e.fileId,sourceFileId:trial?null:e.fileId,localItemId:trial?e.localItemId:null,sha256:await digest(blob),technicalStatus});onProgress({done:++done,total:plan.entries.length});
  }
  const blob=await storedZip(entries),sha=await digest(blob),name=(trial?'TRIAL_':'')+'selected_png_'+entries.length+'_'+sha.slice(0,12)+'.zip';
  archives.push({name,blob,sha,count:entries.length,trial,setName:set.name,mapping});
 }
 const record={schema:'animal-stickers-selected-zip/v1',characterId:plan.characterId,trial,technicalApproval:!trial,purpose:trial?'selection-test-only':'selected-png-archive',includesMainAndTab:false,archives:archives.map(({name,sha,count,setName,mapping})=>({name,sha,count,setName,mapping}))};
 const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),sha=await digest(blob);
 return {characterId:plan.characterId,trial,archives,manifest:{name:'selected-zip_'+sha.slice(0,12)+'.json',blob,sha}};
}
