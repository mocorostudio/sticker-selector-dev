// Selection drafts deliberately do not claim technical or visual approval.
export function latestRecords(records){const old=new Set(records.flatMap(r=>(r.history||[]).map(h=>h.previousImageId).filter(Boolean)));return records.filter(r=>!old.has(r.imageId));}
export function numberedRecords(sources,records){
 const byId=new Map(records.map(r=>[r.imageId,r]));
 return records.map(r=>{let root=r,seen=new Set();while(!seen.has(root.imageId)){seen.add(root.imageId);const previous=[...(root.history||[])].reverse().find(h=>h.previousImageId&&byId.has(h.previousImageId));if(!previous)break;root=byId.get(previous.previousImageId);}
  const sourceId=root.originSourceId||root.sourceId,sourceIndex=sources.findIndex(s=>s.id===sourceId),roots=records.filter(x=>(x.originSourceId||x.sourceId)===sourceId&&!(x.history||[]).some(h=>h.previousImageId));
  return {...r,sequenceLabel:r.sequenceLabel||String(sourceIndex+1).padStart(3,'0')+'-'+String(roots.findIndex(x=>x.imageId===root.imageId)+1).padStart(2,'0')};});
}
export function selectionDraft(record){if(!record.hasPixels&&!record.pixels)throw Error('画像がない番号は切り出し直してください');return {...record,cropReview:{imageId:record.imageId,confirmed:true},technicalStatus:'review'};}
export function handoffRecords(sources,records){return latestRecords(numberedRecords(sources,records));}

// Queue batch IDs persist with the work, preserving old sources without mixing them into a new batch.
export function currentBatchSources(queue){const latest=queue.reduce((a,q)=>!a||(q.batchOrder||0)>=(a.batchOrder||0)?q:a,null),batch=latest?.batchId;return batch?new Set(queue.filter(q=>q.batchId===batch&&q.sourceId).map(q=>q.sourceId)):null;}
