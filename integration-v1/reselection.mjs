import {inspectionIdentity} from './inspection-core.mjs?v=20261030-reviewlabels1';
export function savedEvaluation(document,record,characterId){
 if(document?.schema!=='animal-stickers-selection-export/v1'||!Array.isArray(document.results))throw Error('保存済み評価の形式が不正です。');
 const matches=document.results.filter(x=>x.imageId===record.imageId);if(matches.length>1)throw Error('同じ画像の評価が重複しています。');const r=matches[0];if(!r)return null;
 const sha=r.sourceProof?.sha256||r.sha256;if(!sha)return null;if(r.candidateId!==record.candidateId||r.phrase!==record.phrase||sha!==record.pendingDrive.sha256||r.sourceProof&&r.sourceProof.characterId!==characterId)throw Error('保存済み評価と画像の対応が一致しません。');
 const expected=inspectionIdentity({imageId:record.imageId,candidate:record.candidateId,phrase:record.phrase,pose:record.pose,crop:{crossing:record.crossing===true}}),a=r.inspectionAudit;
 const inspection=a&&a.imageId===record.imageId&&a.identity===expected&&a.sha256===sha?{inspectionAudit:structuredClone(a),inspectionHistory:structuredClone(r.inspectionHistory||[])}:{};
 if(r.confirmed!==true||!['o','h','x'].includes(r.rating)||!r.revision)return inspection.inspectionAudit?inspection:null;
 return {rating:r.rating,comment:r.comment||'',revision:r.revision,selectionHistory:structuredClone(r.selectionHistory||[]),...inspection};
}
export function restoreEvaluation(item,evaluation){
 if(!evaluation)return false;
 const incoming=evaluation.inspectionAudit,local=item.inspectionAudit;
 // Source bytes and identity were checked by savedEvaluation. Do not replace a
 // newer local inspection, or any of the user's unsaved preference changes.
 if(incoming&&incoming.imageId===item.imageId&&incoming.identity===inspectionIdentity(item)&&(!local||Date.parse(incoming.reviewedAt||incoming.at)>Date.parse(local.reviewedAt||local.at))){
  item.inspectionAudit=structuredClone(incoming);item.inspectionHistory=structuredClone(evaluation.inspectionHistory||[]);
 }
 if(item.touched||!['o','h','x'].includes(evaluation.rating))return false;
 item.rating=evaluation.rating;item.comment=evaluation.comment;item.revision=evaluation.revision;item.touched=true;item.selectionHistory=structuredClone(evaluation.selectionHistory);return true;
}
