// Counts represent files whose upload AND hash readback have completed.
export function archiveSaveProgress(p){
 const total=Number.isInteger(p.total)&&p.total>0?p.total:0,done=total&&Number.isInteger(p.done)?Math.max(0,Math.min(total,p.done)):0;
 const names={readback:'DriveからZIPを再取得・展開検品中…',destination:'保存先を確認中…',validating:'ZIP・PNGの内容を確認中…',recording:'順番・判定理由の記録を保存・照合中…'};
 const message=p.stage==='components'?'PNGの保存・照合：'+done+'／'+total+'枚完了':p.stage==='uploading'?'ZIPの保存・照合：'+done+'／'+total+'個完了':names[p.stage]||'Driveへ保存・照合中…';
 return {message,done,total};
}
