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
 for(let i=0;i<81;i++){
  const imageId='review_fixture_'+i,item={id:'crop:'+imageId,imageId,candidate:'FIXTURE'+i,attemptId:imageId,characterId:'review-fixture',name:imageId+'.png',phrase:['ありがとう','了解です','おやすみ','おはよう'][i%4],pose:'テスト図形',sequenceLabel:String(i+1).padStart(2,'0'),origin:'crop-local',technicalPassed:false,rating:'h',touched:i===0,revision:i===0?'keep-user-vote':null,comment:i===0?'自分の選択を保持':'',selectionHistory:[],crop:{crossing:false,draftSelection:true}};
  if(i%4!==2){const audit=await automaticInspection(item,blob,decode);item.inspectionAudit=inspectionDecision(audit,['fail','review','','pass'][i%4],i%4===3?Array(visualChecks.length).fill(true):[],['耳が1本欠けています','文字の一部が薄い','',''][i%4]);item.inspectionHistory=[structuredClone(item.inspectionAudit)];}
  const bytes=await blob.arrayBuffer();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put({bytes,type:'image/png'},item.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});items.push(item);
 }
 db.close();localStorage.setItem(keys.store,JSON.stringify({items,background:'checker'}));
}
await import('../app.mjs?v=20261030-reviewlabels1');

const result=document.createElement('p');result.id='regressionResult';result.setAttribute('role','status');document.body.prepend(result);result.textContent='81候補の隔離テスト実行中';
const wait=async predicate=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,30));}throw Error('待機タイムアウト');};
const check=(ok,label)=>{if(!ok)throw Error(label);};
try{
 await wait(()=>document.querySelectorAll('.card').length===81&&document.querySelectorAll('[data-inspection-status=pass]').length===20);
 const cards=[...document.querySelectorAll('.card')],card=cards[40],img=card.querySelector('img');
 card.scrollIntoView({block:'center',behavior:'instant'});const top=card.getBoundingClientRect().top;
 for(const vote of ['o','h','x','o','x','h']){card.querySelector('input[value='+vote+']').click();await new Promise(r=>requestAnimationFrame(r));check(document.querySelectorAll('.card')[40]===card&&card.querySelector('img')===img,'カード再生成');check(Math.abs(card.getBoundingClientRect().top-top)<2,'スクロール跳び');}
 const comment=card.querySelector('.comment');comment.value='保持テスト';comment.dispatchEvent(new Event('input',{bubbles:true}));
 check(cards[0].textContent.includes('不合格')&&cards[0].textContent.includes('耳が1本欠け'),'不合格理由');check(cards[1].textContent.includes('要確認'),'保留表示');
 const saved=JSON.parse(localStorage.getItem(keys.store));check(saved.items.length===81&&saved.items[40].rating==='h'&&saved.items[40].comment==='保持テスト','保存結果');check(saved.items.every((x,i)=>x.imageId==='review_fixture_'+i),'順番');
 result.textContent='PASS：81候補・連続6評価・同一カード／画像保持・位置誤差2px未満・理由表示・評価／コメント／順番の保存。実機Safariと実Driveは未確認。';
 result.style.cssText='position:fixed;top:0;left:0;right:0;z-index:100;background:#d9f4df;padding:12px';
}catch(e){result.textContent='FAIL：'+e.message;result.style.cssText='position:fixed;top:0;z-index:100;background:#fcc;padding:12px';}
