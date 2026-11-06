import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {PendingFixture} from './pending-drive-fixture.mjs';
import {createPendingDrive,pngHash} from '../integration-v1/drive-pending.mjs';
import {REVIEW_DISPLAY_SCHEMA} from '../integration-v1/review-display.mjs';
import {importCrops} from '../integration-v1/crop-handoff.mjs';
import {inspectionSummary} from '../integration-v1/inspection-summary.mjs';
import {gate} from '../integration-v1/crop-v9/core.mjs';
import {prepareExport} from '../integration-v1/drive-export.mjs';
import {confirmLocal} from '../integration-v1/crop-handoff.mjs';
import {savedEvaluation,restoreEvaluation} from '../integration-v1/reselection.mjs';
import {prepareSelectionZip} from '../integration-v1/submission-zip.mjs';
import {validPixels} from './candidate-export-fixture.mjs';
globalThis.JSZip=JSZip;
const png=new Uint8Array([137,80,78,71,13,10,26,10,...Array(30).fill(0)]);
const decode=async()=>validPixels();
async function fixture(){
 const f=await new PendingFixture().setup(png,81),entries=f.manifest.entries.map((e,i)=>({...e.record,review:undefined,inspection:undefined,sha256:e.sha256,technicalReview:{status:i<60?'pass':i<63?'hold':'fail',reason:'候補'+(i+1)+(i<60?'：文字と本体を保持':i<63?'：後ろびれの構造を確認':'：半透明背景が残る'),recordVersion:'R02'}}));
 const z=new JSZip();for(const e of entries)z.file(e.filename,png);const bytes=await z.generateAsync({type:'uint8array'});f.put('reviewArchive','review81.zip','history','application/zip',bytes);
 f.review={schema:REVIEW_DISPLAY_SCHEMA,characterId:'char',pendingFolderId:'pending',historyFolderId:'history',approval:'display-only',candidateCount:81,masterReference:'https://docs.google.com/spreadsheets/d/master/edit',masterSheet:'116候補マスター',archive:{fileId:'reviewArchive',sha256:await pngHash(bytes)},entries};
 f.saveReview=()=>f.put('review','selection-review_fixture.json','history','application/json',new TextEncoder().encode(JSON.stringify(f.review)));f.saveReview();return f;
}
const read=f=>createPendingDrive({getToken:()=> 'fixture',fetchImpl:f.fetch.bind(f)}).load('char',{allCandidates:true,decode});
test('all 81 review images supersede the view of old approved entries without mutating approval or votes',async()=>{
 const f=await fixture(),r=await read(f);assert.equal(r.reviewDisplay,true);assert.equal(r.entries.length,81);
 const old={id:'old',imageId:'old',rating:'h',touched:true,comment:'未保存を残す',revision:'local'},items=[structuredClone(old)],blobs=new Map();const adapter={items:()=>items,decode,get:async id=>blobs.get(id),write:async(i,b)=>{items.push(i);blobs.set(i.id,b);}};
 const imported=await importCrops(r.entries,adapter,r.master,{forSelection:true});assert.equal(imported.errors.length,0);assert.deepEqual(items[0],old);
 const counts={pass:0,review:0,fail:0};
 for(const item of items.slice(1)){const s=await inspectionSummary(item,blobs.get(item.id));counts[s.status]++;assert.match(s.reasons[0],/候補/);assert.equal(item.technicalPassed,false);assert.notEqual(gate(item.crop),'pass');}
 assert.deepEqual(counts,{pass:60,review:3,fail:18});
 items[62].rating='x';items[62].touched=true;items[62].comment='好みの評価';const snapshot=JSON.parse(JSON.stringify(items));
 const again=await importCrops(r.entries,adapter,r.master,{forSelection:true});assert.equal(again.existing,81);assert.deepEqual(items,snapshot);
 assert.equal((await inspectionSummary(items[62],blobs.get(items[62].id))).status,'review');
 const stale=structuredClone(items[1]);stale.phrase='changed';assert.equal((await inspectionSummary(stale,blobs.get(stale.id))).status,'unknown');
 assert.ok(f.calls.every(c=>c.method==='GET'));
});
test('review preferences save and restore all reasons without PNG promotion; failed display images cannot enter a submission ZIP',async()=>{
 const f=await fixture(),r=await read(f),items=[],blobs=new Map();
 await importCrops(r.entries,{items:()=>items,decode,get:async id=>blobs.get(id),write:async(i,b)=>{i.characterId='char';items.push(i);blobs.set(i.id,b);}},r.master,{forSelection:true});
 for(const [i,item] of items.entries()){item.touched=true;item.rating=i%3===0?'o':i%3===1?'h':'x';item.revision='vote'+i;item.comment='好み'+i;}
 confirmLocal(items);
 const plan=await prepareExport(items,{get:async id=>blobs.get(id),decode});const document=JSON.parse(await plan.manifest.blob.text());
 assert.equal(plan.images.length,0);assert.equal(document.results.length,81);assert.ok(document.results.every(x=>x.formalApproval===false&&x.technicalReview.reason));
 const fresh=structuredClone(items[62]);fresh.touched=false;fresh.rating='o';fresh.comment='';restoreEvaluation(fresh,savedEvaluation(document,r.entries[62].record,'char'));
 assert.equal(fresh.rating,items[62].rating);assert.equal(fresh.comment,items[62].comment);assert.equal((await inspectionSummary(fresh,blobs.get(fresh.id))).status,'review');
 const changed=structuredClone(items);changed[0].crop.displayReview.sha256='0'.repeat(64);await assert.rejects(prepareExport(changed,{get:async id=>blobs.get(id),decode}),/対応が一致/);
 const failed=items.slice(63,71);for(const item of failed){item.rating='o';item.touched=true;}
 const zipPlan={schema:'animal-stickers-submission-trial/v1',technicalApproval:false,purpose:'selection-test-only',characterId:'char',sets:[{id:'set',target:8,name:'test'}],entries:failed.map(i=>({setId:'set',fileId:i.imageId,imageId:i.imageId,localItemId:i.id}))};
 await assert.rejects(prepareSelectionZip(zipPlan,{items,get:async id=>blobs.get(id),decode}),/技術検品・試用許可|正式な技術検品/);
});
for(const [name,mutate] of [
 ['count mismatch',f=>f.review.candidateCount=80],['missing reason',f=>f.review.entries[62].technicalReview.reason=''],
 ['different character',f=>f.review.characterId='other'],['duplicate candidate',f=>f.review.entries[1].candidateId=f.review.entries[0].candidateId],
 ['live text changed',f=>f.rows[1][2]='changed'],['live candidate missing',f=>f.rows.pop()],
 ['PNG hash changed',f=>f.review.entries[0].sha256='0'.repeat(64)],['archive hash changed',f=>f.review.archive.sha256='0'.repeat(64)],
 ['wrong archive parent',f=>f.files.get('reviewArchive').parents=['other']],['approval spoof',f=>f.review.approval='approved']
])test('all-candidate reader rejects '+name,async()=>{const f=await fixture();mutate(f);f.saveReview();await assert.rejects(read(f));});
