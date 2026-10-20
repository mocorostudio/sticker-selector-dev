export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAA30lEQVR4nO2Y0Q2CQAyGq0PhLDqMBIfBWXApfSIxpO21vbYK6fdEQvr3o8cBAaAoCpaTR8hwv76pc6/Hs6uHuZiTorDIqgssYls0omdNsIecNkcs6CWnzRMJestpcpuCUXLSfFYwWk7SR7VJVpZphmWaw2sAGEHqqr6bSBtKaqh+pglmoha8jDf02LtmBX2iZ20OjO1b5nhLnE0J9lKCvaCCvZ/pVrC++5zgP0EKZi8z1W+/EwTImyLXpznBaMlWvmiJoyQlueJ70FtSmqfaJF6Smpzj/ZvBiPy7VRS/5gO3v1/hZ4NavQAAAABJRU5ErkJggg==','base64');
export function fixture(count=3){return Array.from({length:count},(_,i)=>({candidate:'D'+String(i+1).padStart(2,'0'),imageId:'image-'+i,attemptId:'attempt-1',driveFileId:'file-'+i,filename:'TEST'+i+'.png',phrase:'テスト'+i,technicalPassed:true,folder:'pending',rating:null,confirmed:false,comment:''}))}
export class MemoryDrive {
 mode='mock';events=new Map();calls=[];fail=null;
 constructor(rows=fixture()){this.rows=structuredClone(rows);this.files=new Map(rows.map(r=>[r.driveFileId,{id:r.driveFileId,name:r.filename,mimeType:'image/png',folder:r.folder,trashed:false}]))}
 async step(stage,fn){this.calls.push(stage);if(this.fail===stage){this.fail=null;throw Error('network '+stage)}const out=fn();if(this.fail===stage+':after'){this.fail=null;throw Error('lost response '+stage)}return structuredClone(out)}
 list(){return this.step('list',()=>this.rows)}
 metadata(id){return this.step('metadata:'+id,()=>this.files.get(id))}
 event(id){return this.step('event',()=>this.events.get(id)||null)}
 begin(e){return this.step('begin',()=>{if(!this.events.has(e.id))this.events.set(e.id,{...e,status:'started'});return this.events.get(e.id)})}
 move(id,from,to){return this.step('move:'+id,()=>{const f=this.files.get(id);if(f.folder!==from)throw Error('concurrent move');f.folder=to;return f})}
 save(id,patch){return this.step('save:'+id,()=>{Object.assign(this.rows.find(r=>r.imageId===id),patch);return {ok:true}})}
 complete(id){return this.step('complete',()=>{this.events.get(id).status='complete';this.events.get(id).completedAt=new Date().toISOString();return {ok:true}})}
}
