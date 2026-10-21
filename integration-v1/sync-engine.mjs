import {planSelection} from './selection-core.mjs';
export function assertIdentity(record,file){
 if(!record.imageId||!record.candidate||!record.attemptId||!record.driveFileId)throw Error('画像・候補・試行ID不足');
 if(record.technicalPassed!==true&&!(record.testFixture===true&&record.scope==='isolated-test'))throw Error('技術検品未合格');
 if(file.id!==record.driveFileId||file.name!==record.filename||file.mimeType!=='image/png'||file.trashed)throw Error('実PNG不一致');
 if(!['pending','adopt','hold','reject'].includes(file.folder))throw Error('保存先不一致');
}
export async function operationId(choice){
 const data=new TextEncoder().encode(JSON.stringify([choice.imageId,choice.candidate,choice.attemptId,choice.rating,choice.comment||'',choice.revision]));
 const hash=await crypto.subtle.digest('SHA-256',data);
 return 'v9-'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function syncSelections(adapter,choices,{confirmed=false,testReject=false,onProgress}={}){
 if(!confirmed)throw Error('選抜確定操作が必要です');
 if(testReject && adapter.mode!=='mock')throw Error('没フォルダは模擬テスト専用です');
 const progress=(stage,index=0,choice={})=>onProgress?.({stage,index,total:choices.length,imageId:choice.imageId,candidate:choice.candidate});
 progress('starting');
 const records=await adapter.list(),result={saved:[],unchanged:[],errors:[],ignored:[]};
 // Refuse every ambiguous identity, while allowing unrelated images to proceed.
 const imageCounts=new Map(),fileCounts=new Map();
 for(const r of records){imageCounts.set(r.imageId,(imageCounts.get(r.imageId)||0)+1);fileCounts.set(r.driveFileId,(fileCounts.get(r.driveFileId)||0)+1)}
 const seen=new Set();
 let index=0;
 for(const choice of choices){
  index++;progress('checking',index,choice);
  try{
   if(seen.has(choice.imageId))throw Error('重複する選抜');seen.add(choice.imageId);
   const record=records.find(r=>r.imageId===choice.imageId);
   if(!record)throw Error('画像ID未登録');
   if(imageCounts.get(record.imageId)!==1||fileCounts.get(record.driveFileId)!==1)throw Error('画像ID・Drive ID重複');
   if(record.candidate!==choice.candidate||record.attemptId!==choice.attemptId)throw Error('候補・試行ID不一致');
   if(!choice.revision||choice.touched!==true)throw Error('未選抜・変更ID不足');
   const file=await adapter.metadata(record.driveFileId);assertIdentity(record,file);
   const plan=planSelection({...record,folder:file.folder},choice,{testReject});
   if(plan.action==='ignore'){result.ignored.push(choice.imageId);continue}
   if(plan.action==='error')throw Error(plan.reason);
   const id=await operationId(choice),event=await adapter.event(id);
   if(event?.status==='complete' && record.operationId===id && plan.action==='unchanged'){
    result.unchanged.push(choice.imageId);progress('unchanged',index,choice);continue;
   }
   // Stable event ID + put-if-absent journal tolerates lost responses and reloads.
   progress('recording',index,choice);
   await adapter.begin({id,imageId:record.imageId,candidate:record.candidate,attemptId:record.attemptId,
    driveFileId:record.driveFileId,createdAt:new Date().toISOString(),evaluatedAt:choice.evaluatedAt||null,previousComment:record.comment||'',previousFolder:file.folder,previousRating:record.rating||null,rating:choice.rating,comment:choice.comment||'',destination:plan.destination});
   if(!await adapter.event(id))throw Error('開始履歴未確認');
   if(file.folder!==plan.destination){progress('moving',index,choice);await adapter.move(record.driveFileId,file.folder,plan.destination)}
   const after=await adapter.metadata(record.driveFileId);assertIdentity(record,after);
   if(after.folder!==plan.destination)throw Error('移動後照合失敗');
   progress('saving',index,choice);
   await adapter.save(record.imageId,{rating:choice.rating,comment:choice.comment||'',folder:plan.destination,confirmed:true,operationId:id});
   const saved=(await adapter.list()).filter(r=>r.imageId===record.imageId);
   if(saved.length!==1||saved[0].operationId!==id||saved[0].rating!==choice.rating||saved[0].folder!==plan.destination||saved[0].comment!==(choice.comment||'')||saved[0].confirmed!==true)throw Error('評価保存照合失敗');
   await adapter.complete(id);
   if((await adapter.event(id))?.status!=='complete')throw Error('完了履歴未確認');
   result.saved.push(choice.imageId);
   progress('complete',index,choice);
  }catch(error){result.errors.push({imageId:choice.imageId,message:error.message});progress('error',index,choice)}
 }
 return result;
}
