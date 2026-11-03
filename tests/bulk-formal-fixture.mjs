import {deflateSync} from 'node:zlib';
import {automaticInspection,inspectionDecision,stageCandidateAssignments,visualChecks} from '../integration-v1/inspection-core.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
function chunk(tag,bytes){const t=Buffer.from(tag),data=Buffer.concat([t,bytes]);let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}const len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([len,data,crc]);}
const pixels=validPixels(),header=Buffer.alloc(13);header.writeUInt32BE(370,0);header.writeUInt32BE(320,4);header[8]=8;header[9]=6;
const raw=Buffer.alloc(320*(370*4+1));for(let y=0;y<320;y++)raw.set(pixels.data.subarray(y*1480,(y+1)*1480),y*1481+1);
const blob=new Blob([Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])],{type:'image/png'});
async function setup(){
 const master=Array.from({length:9},(_,i)=>({candidateId:'C'+i,phrase:'文字'+i,pose:'構図'+i}));
 const records=master.map((m,i)=>({imageId:'img'+i,filename:'img'+i+'.png',crossing:false,qa:{automatic:'pass'},history:[],review:[]}));
 const assignments=records.map((r,i)=>({...master[i],imageId:r.imageId,batchId:'B03',slot:i+1}));
 let items=records.map(r=>({id:'crop:'+r.imageId,imageId:r.imageId,origin:'crop-local',name:r.filename,candidate:'',phrase:'',pose:'',crop:r,rating:'h',touched:true,comment:'keep',selectionHistory:[{revision:'keep'}],edit:{keep:true}}));
 items=stageCandidateAssignments(items,assignments,master).map(s=>s.next);
 for(const item of items)item.inspectionAudit=inspectionDecision(await automaticInspection(item,blob,async()=>pixels),'pass',Array(visualChecks.length).fill(true),'test fixture visual evidence');
 return {records,pngs:await Promise.all(records.map(()=>blob.arrayBuffer())),items,assignments,master,characterId:'char'};
}

export {setup,blob,pixels};
