// Shared Work/chat entry: reuse the app's component and transparency algorithms.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {prepareCropBatch} from '../integration-v1/crop-v9/component-crops.mjs';
import {prepareTransparency} from '../integration-v1/crop-v9/transparency.mjs';
import {inspectTransparencyCheckpoint} from '../integration-v1/transparency-checkpoint.mjs';
import {trim,inspect} from '../integration-v1/crop-v9/core.mjs';
import {placementPlan} from '../integration-v1/crop-v9/placement.mjs';
const [inputFile,outputDir]=process.argv.slice(2);
if(!inputFile||!outputDir)throw Error('INPUT.json NEW_OUTPUT_DIR が必要です');
const python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON||process.env.PYTHON||'python3',codec=fileURLToPath(new URL('./crop-pixels.py',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const invoke=(mode,bytes,args=[])=>execFileSync(python,[codec,mode,...args.map(String)],{input:bytes,maxBuffer:70000000,timeout:120000});
function decode(bytes){const raw=invoke('decode',bytes);return {width:raw.readUInt32BE(0),height:raw.readUInt32BE(4),data:new Uint8ClampedArray(raw.subarray(8))};}
const input=JSON.parse(await fs.readFile(inputFile,'utf8')),root=await fs.realpath(path.dirname(path.resolve(inputFile)));
if(input.schema!=='animal-stickers-crop-input/v1'||!/^[-\w]{1,256}$/.test(input.characterId||'')||!input.masterReference?.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[-\w]+\/edit$/)||!input.masterSheet||!input.masterModifiedTime||!Array.isArray(input.master)||!Array.isArray(input.batches)||!input.batches.length)throw Error('取得済みマスター・対象バッチの記録が必要です');
const candidates=new Map(),batchIds=new Set(),used=new Set(),staged=[];
for(const m of input.master){if(!m.candidateId||typeof m.phrase!=='string'||typeof m.pose!=='string'||candidates.has(m.candidateId))throw Error('マスターの候補・文言・ポーズが不正です');candidates.set(m.candidateId,m);}
for(const b of input.batches){
 if(!/^[-\w]+$/.test(b.batchId||'')||batchIds.has(b.batchId)||!Array.isArray(b.candidateIds)||b.candidateIds.length!==9||!b.sourceFileId||!/^[a-f0-9]{64}$/.test(b.sha256||''))throw Error('各3×3バッチの取得元ID・ハッシュ・9候補が必要です');batchIds.add(b.batchId);
 for(const id of b.candidateIds){if(!candidates.has(id)||used.has(id))throw Error('バッチとマスターの候補が欠落・重複しています');used.add(id);}
 if(typeof b.path!=='string'||path.isAbsolute(b.path))throw Error('元PNGは入力JSON配下の相対パスで指定してください');
 const sourcePath=await fs.realpath(path.resolve(root,b.path));if(!sourcePath.startsWith(root+path.sep))throw Error('元PNGが入力フォルダの外にあります');
 const bytes=await fs.readFile(sourcePath);if(hash(bytes)!==b.sha256)throw Error('元PNGのハッシュが取得記録と一致しません');staged.push({batch:b,bytes});
}
if(used.size!==candidates.size)throw Error('対象マスター全候補とバッチ対応の件数が一致しません');
// Probe dependencies and inputs before reserving a new, never-overwritten attempt.
execFileSync(python,['-c','from PIL import Image; print(Image.__version__)'],{timeout:10000});
await fs.mkdir(path.resolve(outputDir),{recursive:false});
const attemptId='CROP_'+new Date().toISOString().slice(0,10).replaceAll('-','')+'_'+randomUUID().slice(0,8),entries=[],log=[];
try{
 for(const {batch:b,bytes} of staged){
  const source=decode(bytes),prepared=prepareCropBatch(source,3,3);log.push({batchId:b.batchId,sourceSha256:b.sha256,transparencyCleanup:prepared.transparencyCleanup});
  for(const [index,cell] of prepared.cells.entries()){
   const m=candidates.get(b.candidateIds[index]),cleaned=prepareTransparency(cell.pixels,{backgroundReference:source}),content=trim(cleaned),p=placementPlan(content.width,content.height),resized=invoke('normalize',Buffer.from(content.data),[content.width,content.height,p.drawWidth,p.drawHeight,p.x,p.y]),final=prepareTransparency(decode(resized)),png=invoke('encode',Buffer.from(final.data),[final.width,final.height]),pixels=decode(png),qa=inspect(pixels,cell.crossing||cell.sourceTouchesEdge);
   const issues=[...new Set([...prepared.transparencyCleanup.issues,...cleaned.report.issues,...final.report.issues,...qa.issues])];qa.issues=issues;if(issues.length){qa.automatic='fail';qa.status='fail';}
   const filename=m.candidateId+'_'+attemptId+'.png',imageId=m.candidateId+'_'+attemptId,sha256=hash(png);
   const record={imageId,candidateId:m.candidateId,phrase:m.phrase,pose:m.pose,filename,sourceId:b.sourceFileId,sourceBatchId:b.batchId,sourceSha256:b.sha256,attemptId,decision:'review',review:[],crossing:cell.crossing||cell.sourceTouchesEdge,qa,transparencyCleanup:{source:prepared.transparencyCleanup,cell:cleaned.report,final:final.report},inspection:{scope:'numerical-only',visualReviewRequired:true},bounds:cell.bounds};
   await fs.writeFile(path.join(outputDir,filename),png,{flag:'wx'});
   const saved=await fs.readFile(path.join(outputDir,filename));if(hash(saved)!==sha256)throw Error('保存PNGのハッシュ不一致');
   const savedPixels=decode(saved),checkpoint=inspectTransparencyCheckpoint(savedPixels,{sha256,stage:'preselection'});record.transparencyCheckpoint=checkpoint;record.transparencyCleanup.saved=checkpoint;
   if(checkpoint.status!=='verified'){issues.push(...checkpoint.issues);qa.issues=[...new Set(issues)];qa.automatic='fail';qa.status='fail';}
   record.inspection.backgroundReadbackVerified=checkpoint.status==='verified';
   const previewFilename=imageId+'_background-review.png';
   await fs.writeFile(path.join(outputDir,previewFilename),invoke('preview',Buffer.from(pixels.data),[pixels.width,pixels.height]),{flag:'wx'});
   record.inspection.previewFilename=previewFilename;
   entries.push({record,path:filename,sha256,technicalStatus:'hold',reason:issues.join(' ／ ')||'切り出し・透過前処理済み。元画像との個別目視検品は未実施。'});
  }
 }
 const result={schema:'animal-stickers-crop-result/v1',characterId:input.characterId,attemptId,masterReference:input.masterReference,masterSheet:input.masterSheet,masterModifiedTime:input.masterModifiedTime,master:input.master,candidateCount:entries.length,formalApproval:false,summary:{pass:0,hold:entries.length,fail:0},entries,log,transparencySummary:{verified:entries.filter(e=>e.record.transparencyCheckpoint?.status==='verified').length,needsRepair:entries.filter(e=>e.record.transparencyCheckpoint?.status!=='verified').length},next:'背景残留は選抜登録前に追加除去・新試行保存・再検査を完了。チャットで元画像と1枚ずつ照合して技術判定。判定確定後に既存Drive引き渡し経路を使用。選抜中の画像は差し替えない。'};
 await fs.writeFile(path.join(outputDir,'crop-result.json'),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({attemptId,count:entries.length,outputDir:path.resolve(outputDir),formalApproval:false}));
}catch(e){await fs.writeFile(path.join(outputDir,'execution-failed.json'),JSON.stringify({attemptId,error:e.message,completedEntries:entries,log,formalApproval:false},null,2),{flag:'wx'});throw e;}
