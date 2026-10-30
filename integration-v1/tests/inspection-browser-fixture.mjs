import {storageKeys} from '../session-store.mjs';
import {automaticInspection,inspectionDecision,visualChecks} from '../inspection-core.mjs?v=20261030-reviewlabels1';
// Isolated, reproducible browser fixture: no private PNGs or Google writes.
const keys=storageKeys({workflowLocal:true,driveTest:false,pathname:location.pathname});
if(!localStorage.getItem(keys.store)){
 const canvas=document.createElement('canvas');canvas.width=370;canvas.height=320;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#d6a96b';ctx.fillRect(80,60,210,200);ctx.fillStyle='#233d30';ctx.font='30px sans-serif';ctx.fillText('TEST',145,170);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(keys.db,1);q.onupgradeneeded=()=>q.result.createObjectStore('images');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 const decode=async()=>ctx.getImageData(0,0,370,320),items=[];
 for(let i=0;i<8;i++){
  const imageId='review_fixture_'+i,item={id:'crop:'+imageId,imageId,candidate:'FIXTURE'+i,attemptId:imageId,characterId:'review-fixture',name:imageId+'.png',phrase:['ありがとう','了解です','おやすみ','おはよう'][i%4],pose:'テスト図形',sequenceLabel:String(i+1).padStart(2,'0'),origin:'crop-local',technicalPassed:false,rating:'h',touched:i===0,revision:i===0?'keep-user-vote':null,comment:i===0?'自分の選択を保持':'',selectionHistory:[],crop:{crossing:false,draftSelection:true}};
  if(i%4!==2){const audit=await automaticInspection(item,blob,decode);item.inspectionAudit=inspectionDecision(audit,['fail','review','','pass'][i%4],i%4===3?Array(visualChecks.length).fill(true):[],['耳が1本欠けています','文字の一部が薄い','',''][i%4]);item.inspectionHistory=[structuredClone(item.inspectionAudit)];}
  const bytes=await blob.arrayBuffer();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put({bytes,type:'image/png'},item.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});items.push(item);
 }
 db.close();localStorage.setItem(keys.store,JSON.stringify({items,background:'checker'}));
}
await import('../app.mjs?v=20261030-reviewlabels1');
