import {SourceFixture} from './source-save-fixture.mjs';
export class CandidateExportFixture extends SourceFixture{
 constructor(){super();this.calls=[];for(const [id,name] of [['adopt','01_採用予定'],['hold','02_保留'],['application','04_申請用']])this.files.set(id,{id,name,mimeType:'application/vnd.google-apps.folder',parents:['char']});}
 async fetch(url,options={}){this.calls.push({url,method:options.method||'GET'});const u=new URL(url),method=options.method||'GET';
  if(method==='PATCH'){const id=u.pathname.split('/').pop(),file=this.files.get(id);if(!file)return Response.json({}, {status:404});const body=JSON.parse(options.body);if(body.appProperties)file.appProperties=body.appProperties;if(body.name)file.name=body.name;if(u.searchParams.get('addParents'))file.parents=[u.searchParams.get('addParents')];return Response.json(file);}
  if(u.pathname.endsWith('/files')&&u.searchParams.get('q')?.includes(' or ')){return Response.json({files:[...this.files.values()].filter(f=>f.mimeType==='image/png'&&['adopt','hold'].includes(f.parents?.[0]))});}
  return super.fetch(url,options);
 }
}
export function candidateItems(count=72){return Array.from({length:count},(_,i)=>{const imageId='candidate_'+i,rating=i<9&&i!==3||i>=9&&i<42?'o':i>=42&&i<47?'h':'x',trial=i>=9;return {id:'crop:'+imageId,imageId,name:imageId+'.png',sequenceLabel:String(i+1).padStart(2,'0'),candidate:'D'+i,phrase:'テスト',origin:'crop-local',rating,touched:true,revision:imageId,comment:'',technicalPassed:!trial,selectionHistory:[{revision:imageId,rating,comment:''}],crop:{imageId,candidateId:'D'+i,phrase:'テスト',driveSource:{fileId:'source'},qa:{automatic:'pass'},review:Array(9).fill(!trial),decision:trial?'review':'pass',crossing:false,inspection:{scope:'actual-source',at:'2026-10-24T00:00:00Z',unresolved:trial?['外周線あり']:[]},cropReview:{imageId,confirmed:true},...(trial?{trialSelection:{explicitUser:true,exception:'outer-outline',purpose:'selection-test-only'}}:{})}};});}
export const validPixels=()=>{const data=new Uint8ClampedArray(370*320*4);for(let y=60;y<260;y++)for(let x=70;x<300;x++)data[(y*370+x)*4+3]=255;return {width:370,height:320,data};};
