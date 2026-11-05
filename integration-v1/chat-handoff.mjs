import {gate,inspect} from './crop-v9/core.mjs';
import {pngHash} from './inspection-core.mjs';

// Browser-free producer for the existing reviewedBundle reader. It consumes
// explicit visual decisions, never manufactures them or user preferences.
export async function prepareChatHandoff(input,{get,decode,at=new Date().toISOString()}){
 if(input?.schema!=='animal-stickers-chat-handoff/v1'||!/^[-\w]{1,100}$/.test(input.characterId||'')||!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[-\w]+\/edit$/.test(input.masterReference||'')||!input.masterSheet||!input.masterModifiedTime)throw Error('対象キャラと取得済み最新マスター情報が必要です');
 if(!Array.isArray(input.master)||!input.master.length||input.master.length>130||!Array.isArray(input.entries)||input.entries.length!==input.master.length)throw Error('対象マスター全候補の処理記録が必要です');
 const masters=new Map(input.master.map(m=>[m.candidateId,m]));if(masters.size!==input.master.length)throw Error('マスター候補ID重複');
 const candidates=new Set(),images=new Set(),names=new Set(),accepted=[],excluded=[];let total=0;
 for(const entry of input.entries){
  const r=entry?.record,m=masters.get(r?.candidateId);
  if(!r||!m||r.phrase!==m.phrase||r.pose!==m.pose||m.textless===true&&r.textless!==true||!/^[-\w]{1,100}$/.test(r.imageId||'')||!/^[-\w]+\.png$/.test(r.filename||'')||candidates.has(r.candidateId)||images.has(r.imageId)||names.has(r.filename))throw Error('候補・画像・ファイルの対応が不正または重複');
  candidates.add(r.candidateId);images.add(r.imageId);names.add(r.filename);
  if(r.decision!=='pass'){
   const reason=entry.reason||r.reviewReason||r.inspection?.comment||r.inspection?.unresolved?.join('／')||'';
   if(!reason.trim())throw Error('未合格候補には未完了・不良の理由が必要です');
   excluded.push({candidateId:r.candidateId,imageId:r.imageId,filename:r.filename,status:['fail','review'].includes(r.decision)?r.decision:'unknown',reason});continue;
  }
  if(gate(r)!=='pass'||r.crossing!==false||r.inspection?.scope!=='actual-source'||!Number.isFinite(Date.parse(r.inspection.at))||!r.inspection.at||!(r.inspection.method||r.inspection.visualReviewBasis||r.inspection.audit?.reviewer)||!/^[-\w]+$/.test(r.sourceId||'')||!/^[-\w]+$/.test(r.attemptId||'')||!/^[a-f0-9]{64}$/.test(entry.sha256||''))throw Error('画像別の目視検品・元画像・試行・ハッシュ証拠が未完了');
  const blob=await get(entry);if(!blob||blob.type!=='image/png'||blob.size<24||blob.size>15000000||await pngHash(blob)!==entry.sha256)throw Error('検品した実PNGとハッシュが不一致');
  total+=blob.size;if(total>150000000)throw Error('一括処理のPNG容量は150MB以下にしてください');
  const decoded=await decode(blob),qa=inspect(decoded,false);
  if(decoded.width!==370||decoded.height!==320||qa.automatic!=='pass')throw Error('PNG実画素の検査に失敗：'+r.imageId);
  accepted.push({record:structuredClone({...r,qa,pngSha256:entry.sha256,masterReference:input.masterReference}),sha256:entry.sha256,png:await blob.arrayBuffer()});
 }
 const manifest={schema:'animal-stickers-reviewed-crops/v1',characterId:input.characterId,masterReference:input.masterReference,masterSheet:input.masterSheet,masterModifiedTime:input.masterModifiedTime,createdAt:at,entries:accepted.map(({record,sha256})=>({record,sha256}))};
 return {manifest,accepted,excluded,summary:{total:input.entries.length,passed:accepted.length,failed:excluded.filter(e=>e.status==='fail').length,review:excluded.filter(e=>e.status==='review').length,unknown:excluded.filter(e=>e.status==='unknown').length,driveSaved:false,userReadbackVerified:false}};
}
