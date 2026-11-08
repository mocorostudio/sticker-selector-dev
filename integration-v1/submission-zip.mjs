import {finalizeTransparency} from './final-transparency.mjs?v=20261107-alpha1';
import {auditedCandidateBinding} from './inspection-core.mjs?v=20261107-alpha1';
import {withPngDpi} from './png-density.mjs?v=20261030-dpi1';
import {SET_COUNTS,validateSubmission} from './submission-core.mjs?v=20261107-alpha1';
import {digest} from './drive-export.mjs?v=20261108-variants1';
import {inspect,gate} from './crop-v9/core.mjs?v=20261107-alpha1';
import {trialEligible} from './drive-pending.mjs?v=20261108-variants1';
// Percentage padding is a generation target. Review archives use actual final pixels;
// this never promotes a draft to technical approval.
export function draftArchivePixelsEligible(pixels,qa,crossing=false){
 if(crossing||pixels?.width!==370||pixels?.height!==320||pixels.data?.length!==370*320*4||!Array.isArray(qa?.issues)||qa.issues.some(x=>x!=='安全余白10%未満'))return false;
 let x0=370,y0=320,x1=-1,y1=-1;
 for(let y=0;y<320;y++)for(let x=0;x<370;x++)if(pixels.data[(y*370+x)*4+3]>0){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 return x1>=x0&&Math.min(x0,y0,369-x1,319-y1)>=10;
}
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
// PNG is already compressed. A stored ZIP needs no network dependency and preserves exact bytes.
export async function storedZip(entries,{includeArtwork=false,emoji=false}={}){
 if(!entries.length||entries.length>(includeArtwork?42:40))throw Error('ZIPの画像数が不正です。');
 const local=[],central=[],names=new Set();let offset=0,size=0;
 for(const e of entries){if(!(emoji?/^(?:0(?:0[1-9]|[1-3][0-9]|40)|tab)\.png$/:includeArtwork?/^(?:\d{2}|main|tab)\.png$/:/^\d{2}\.png$/).test(e.name)||names.has(e.name))throw Error('ZIPの画像名が不正です。');names.add(e.name);const data=new Uint8Array(await e.blob.arrayBuffer()),name=encoder.encode(e.name),crc=crc32(data);size+=data.length;if(size>150000000)throw Error('ZIPは150MB以下にしてください。');
  const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);local.push(h,data);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...local,...central,end],{type:'application/zip'});
}
export async function prepareSelectionZip(plan,{items=[],get,decode,getRemote,onProgress=()=>{},prepareArtwork,decodeArtwork=decode,confirmationOnly=false,selectionSnapshot=null,encodePNG}){
 const trial=plan?.schema==='animal-stickers-submission-trial/v1';
 if(!trial)validateSubmission(plan);
 if(trial&&(plan.technicalApproval!==false||plan.purpose!=='selection-test-only'))throw Error('試用計画が不正です。');
 if(!/^[-\w]{1,256}$/.test(plan?.characterId)||!Array.isArray(plan.sets)||!plan.sets.length||!Array.isArray(plan.entries))throw Error('ZIPの選択を確認できません。');
 const ids=new Set();for(const s of plan.sets){if(ids.has(s.id)||!SET_COUNTS.includes(s.target)||plan.entries.filter(e=>e.setId===s.id).length!==s.target)throw Error('選択枚数を目標に合わせてください。');ids.add(s.id);}
 const selectedIds=new Set();for(const e of plan.entries){if(selectedIds.has(e.fileId)||!ids.has(e.setId))throw Error('候補が重複しているかセットが不明です。');selectedIds.add(e.fileId);}
 const kit=typeof prepareArtwork==='function',archives=[];let done=0;
 if(confirmationOnly&&(!kit||!trial))throw Error('確認用保存にはメイン・タブ付きの選抜計画が必要です。');
 const selectionRecords=kit?structuredClone(items.filter(x=>x.characterId===plan.characterId).map(({id,imageId,candidate,phrase,pose,rating,comment,touched,revision,selectionHistory,technicalPassed,crop,inspectionAudit,inspectionHistory})=>({id,imageId,candidateId:candidate,phrase,pose,rating,comment,touched,revision,selectionHistory,technicalPassed,crop,inspectionAudit,inspectionHistory}))):[];
 const seenCandidates=new Set(),seenHashes=new Set();
 for(const set of plan.sets){const entries=[],mapping=[];
  for(const e of plan.entries.filter(e=>e.setId===set.id)){let blob,technicalStatus='pass',technicalWarnings=[],identity={};
   if(trial){const matches=items.filter(x=>x.id===e.localItemId&&x.imageId===e.imageId);if(matches.length!==1)throw Error('候補画像の対応を確認できません。');const item=matches[0];if(item.origin!=='crop-local'||!item.touched||!(item.rating==='o'||item.rating==='h'&&e.fromHold===true&&e.sourceRating==='h')||item.imageId!==e.fileId||item.characterId&&item.characterId!==plan.characterId)throw Error('候補の選抜・キャラを確認できません。');blob=await get(item.id);if(!blob||blob.type!=='image/png'||blob.size>15000000)throw Error('候補のPNGを取得できません。');if(item.candidateManifest)await auditedCandidateBinding(item,blob,[{candidateId:item.candidate,phrase:item.phrase,pose:item.pose}],{imageId:item.imageId,candidateId:item.candidate,phrase:item.phrase,pose:item.pose});const pixels=await decode(blob),qa=inspect(pixels,item.crop?.crossing),approved=item.technicalPassed===true&&gate({...item.crop,qa})==='pass';const proof=item.crop?.pendingDrive,draft=item.crop?.draftSelection===true&&proof?.characterId===plan.characterId&&!!proof.archiveFileId&&!!proof.manifestFileId&&proof.sha256===await digest(blob)&&item.crop?.decision!=='fail'&&item.inspectionAudit?.decision!=='fail'&&draftArchivePixelsEligible(pixels,qa,item.crop?.crossing===true);let confirmation=false;
    if(confirmationOnly&&item.crop?.reviewDisplay===true){
     const review=item.crop.displayReview,sha=await digest(blob);
     if(!proof?.archiveFileId||!proof?.manifestFileId||proof.characterId!==plan.characterId||proof.sha256!==sha||review?.sha256!==sha||review.imageId!==item.imageId||review.candidateId!==item.candidate||review.phrase!==item.phrase||review.pose!==item.pose||!['pass','hold','fail','unknown'].includes(review.status)||!review.reason?.trim())throw Error('確認用画像と候補ID・判定理由・ハッシュが一致しません。');
     if(pixels.width!==370||pixels.height!==320||pixels.data?.length!==370*320*4||!pixels.data.some((v,i)=>i%4===3&&v>0))throw Error('確認用PNGの寸法・画素を確認できません。');
     confirmation=true;identity={technicalReview:structuredClone(review),sourceProof:structuredClone(proof),formalApproval:false};
    }
    if(!approved&&!trialEligible({...item.crop,qa})&&!draft&&!confirmation){const review=item.crop?.displayReview;const label=(item.candidate||item.imageId||e.fileId);if(item.crop?.reviewDisplay===true){throw Error(label+'：理由付き確認用の画像は、正式な技術検品・申請用ZIPの許可が未完了です。'+(review?.reason?' 記録：'+review.reason:'')+' 選抜◯は保持しています。再検品と正式登録が必要です。');}throw Error(label+'：技術検品・試用許可を確認できません。選抜結果は保持しています。');}technicalStatus=confirmation?(item.crop.displayReview.status==='fail'?'fail':'review'):approved?'pass':'review';technicalWarnings=approved?[]:[...qa.issues];
    const sourceSha=await digest(blob);if(confirmationOnly&&(seenHashes.has(sourceSha)||item.candidate&&seenCandidates.has(item.candidate)))throw Error('候補IDまたは画像ハッシュが重複しています。選択は変更していません。');seenHashes.add(sourceSha);if(item.candidate)seenCandidates.add(item.candidate);
    Object.assign(identity,{candidateId:item.candidate||null,phrase:item.phrase||'',sourceSha256:sourceSha,rating:item.rating,comment:item.comment||'',selectionHistory:structuredClone(item.selectionHistory||[]),inspectionAudit:structuredClone(item.inspectionAudit||null)});
   }else{blob=await getRemote(e);if(!blob||blob.type!=='image/png'||blob.size!==Number(e.size))throw Error('保存前の画像サイズが一致しません。');if(e.sha256Checksum&&await digest(blob)!==e.sha256Checksum)throw Error('保存前の画像内容が一致しません。');const qa=inspect(await decode(blob),false);if(qa.issues.length)throw Error('申請画像の再検品に失敗しました。');}
   const final=await finalizeTransparency(blob,decode,encodePNG);if(final.report.removed){if(!confirmationOnly)throw Error('透過を修正した画像は再検品が必要です。確認用一式として保存してください。');technicalStatus=technicalStatus==='fail'?'fail':'review';technicalWarnings.push('背景透過を修正した派生画像。技術承認は変更していません。');}blob=final.blob;identity.transparencyCleanup=final.report;
   if(kit)blob=await withPngDpi(blob);
   const name=String(entries.length+1).padStart(2,'0')+'.png';entries.push({name,blob});mapping.push({...identity,filename:name,imageId:e.imageId||e.fileId,sourceFileId:trial?null:e.fileId,localItemId:trial?e.localItemId:null,sha256:await digest(blob),technicalStatus,...(technicalWarnings.length?{technicalWarnings}:{}),...(e.fromHold?{sourceRating:'h',fromHold:true}: {})});onProgress({done:++done,total:plan.entries.length});
  }
  const count=entries.length,artwork=[];
  if(kit){const a=await prepareArtwork(set.id);if(a.characterId!==plan.characterId||a.images?.length!==2||new Set(a.images.map(e=>e.kind)).size!==2)throw Error('セットのメイン・タブを確認できません。');const record=JSON.parse(await a.manifest.blob.text());if(record.setId!==set.id||record.characterId!==plan.characterId)throw Error('編集画像のセットが一致しません。');for(const image of a.images){if(!['main','tab'].includes(image.kind)||image.blob?.type!=='image/png'||image.blob.size>1000000||await digest(image.blob)!==image.sha)throw Error('メイン・タブのPNGを確認できません。');const pixels=await decodeArtwork(image.blob),spec=image.kind==='main'?[240,240]:[96,74];if(pixels.width!==spec[0]||pixels.height!==spec[1]||!pixels.data.some((v,i)=>i%4===3&&v>0)||pixels.data[3]!==0)throw Error('メイン・タブのサイズ・透過を確認できません。');const filename=image.kind+'.png';const final=await finalizeTransparency(image.blob,decodeArtwork,encodePNG);const output=await withPngDpi(final.blob);entries.push({name:filename,blob:output});artwork.push({filename,sha256:await digest(output),technicalStatus:'review',sourceSha256:image.sha,transparencyCleanup:final.report,source:record[image.kind]});}if(entries.some(e=>e.blob.size>1000000))throw Error('申請用のPNGは1枚1MB以下にしてください。');}
  const blob=await storedZip(entries,{includeArtwork:kit});if(kit&&blob.size>60000000)throw Error('申請用ZIPは60MB以下にしてください。');const sha=await digest(blob),name=kit?'REVIEW_application_'+count+'_'+sha.slice(0,12)+'.zip':(trial?'TRIAL_':'')+'selected_png_'+count+'_'+sha.slice(0,12)+'.zip';
  archives.push({name,blob,sha,count,trial,setName:set.name,mapping,...(kit?{artwork,images:entries}: {})});
 }
 const record={schema:kit?'animal-stickers-application-kit/v1':'animal-stickers-selected-zip/v1',characterId:plan.characterId,trial,technicalApproval:kit?false:!trial,purpose:trial?'selection-test-only':'selected-png-archive',includesMainAndTab:kit,...(kit?{confirmationOnly,purpose:confirmationOnly?'confirmation-only':'selected-png-archive',warning:'確認用一式。技術承認・LINE申請可能を意味しません。',selectionSnapshot:structuredClone(selectionSnapshot),selectionRecords}:{}),archives:archives.map(({name,sha,count,setName,mapping,artwork})=>({name,sha,count,setName,mapping,...(kit?{artwork}: {})}))};
 const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),sha=await digest(blob);
 return {characterId:plan.characterId,trial,...(kit?{applicationKit:true}:{}),archives,manifest:{name:(kit?'application-kit_':'selected-zip_')+sha.slice(0,12)+'.json',blob,sha}};
}
