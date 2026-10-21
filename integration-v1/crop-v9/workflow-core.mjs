import {gate} from './core.mjs?v=20261021-flow2';
export const MAX_BATCH=20;
export function sameDriveVersion(a,b){
 const id=a?.fileId||a?.id,other=b?.fileId||b?.id;
 if(!id||id!==other)return false;
 if(a.version&&b.version)return String(a.version)===String(b.version);
 return !!a.modifiedTime&&!!b.modifiedTime&&a.modifiedTime===b.modifiedTime&&a.md5Checksum===b.md5Checksum;
}
export function sourceRecords(source,records){
 const relevant=new Map(records.filter(r=>r.sourceId===source.id||r.originSourceId===source.id).map(r=>[r.imageId,r]));
 let changed=true;while(changed){changed=false;for(const r of records)if(!relevant.has(r.imageId)&&r.history?.some(h=>relevant.has(h.previousImageId))){relevant.set(r.imageId,r);changed=true;}}
 const superseded=new Set([...relevant.values()].flatMap(r=>(r.history||[]).map(h=>h.previousImageId).filter(Boolean)));
 return [...relevant.values()].filter(r=>!superseded.has(r.imageId));
}
export function driveProgress(file,sources,records){
 const matching=sources.filter(s=>sameDriveVersion(s.driveSource,file));
 if(!matching.length)return {status:'new',label:'未処理'};
 for(const source of matching){const latest=sourceRecords(source,records);if(latest.length>0&&(!source.expectedCount||latest.length>=source.expectedCount)&&latest.every(r=>gate(r)==='pass'))return {status:'reviewed',label:'検品完了'};}
 return {status:'cropped',label:'切り出し済み・検品待ち'};
}
export function splitState(value){
 const assets=[];
 const sources=value.sources.map(({image,...s})=>{if(image)assets.push({key:'source:'+s.id,value:image});return s;});
 const records=value.records.map(({pixels,...r})=>{if(pixels)assets.push({key:'record:'+r.imageId,value:pixels});return {...r,hasPixels:!!pixels||!!r.hasPixels};});
 return {state:{version:2,sources,records,queue:(value.queue||[]).map(({file,read,...q})=>({...q,state:q.state==='processing'?'queued':q.state}))},assets};
}
export async function runSerial(queue,{process,persist,onProgress=()=>{},shouldPause=()=>false}){
 let done=0,failed=0;
 for(const item of queue){if(item.state==='done')continue;if(shouldPause())break;
  item.state='processing';item.error='';onProgress(item);
  try{await process(item);item.state='done';await persist(item);done++;}
  catch(e){item.state='error';item.error=e.message;failed++;if(e.storageFailure||e.reconnectRequired)break;await persist(item);}
  onProgress(item);
 }
 return {done,failed,remaining:queue.filter(q=>q.state!=='done').length};
}
