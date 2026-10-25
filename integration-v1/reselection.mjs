export function savedEvaluation(document,record,characterId){
 if(document?.schema!=='animal-stickers-selection-export/v1'||!Array.isArray(document.results))throw Error('保存済み評価の形式が不正です。');
 const matches=document.results.filter(x=>x.imageId===record.imageId);if(matches.length>1)throw Error('同じ画像の評価が重複しています。');const r=matches[0];if(!r)return null;
 const sha=r.sourceProof?.sha256||r.sha256;if(!sha)return null;if(r.candidateId!==record.candidateId||r.phrase!==record.phrase||sha!==record.pendingDrive.sha256||r.sourceProof&&r.sourceProof.characterId!==characterId)throw Error('保存済み評価と画像の対応が一致しません。');
 if(r.confirmed!==true||!['o','h','x'].includes(r.rating)||!r.revision)return null;
 return {rating:r.rating,comment:r.comment||'',revision:r.revision,selectionHistory:structuredClone(r.selectionHistory||[])};
}
export function restoreEvaluation(item,evaluation){
 if(!evaluation||item.touched)return false;item.rating=evaluation.rating;item.comment=evaluation.comment;item.revision=evaluation.revision;item.touched=true;item.selectionHistory=structuredClone(evaluation.selectionHistory);return true;
}
