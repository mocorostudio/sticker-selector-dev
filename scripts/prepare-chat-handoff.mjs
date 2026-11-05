// Operator command: node scripts/prepare-chat-handoff.mjs INPUT.json NEW_OUTPUT_DIR
// Pillow decodes pixels; the application's existing JS inspector decides QA.
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import JSZip from 'jszip';
import {prepareChatHandoff} from '../integration-v1/chat-handoff.mjs';
import {reviewedBundle} from '../integration-v1/reviewed-bundle.mjs';
const [inputPath,outputPath]=process.argv.slice(2);if(!inputPath||!outputPath)throw Error('INPUT.json NEW_OUTPUT_DIR が必要です');
const root=path.dirname(path.resolve(inputPath)),input=JSON.parse(await fs.readFile(inputPath,'utf8'));
const decode=async blob=>{
 const python=process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3';
 const bytes=execFileSync(python,['-c',"import sys,io,struct\nfrom PIL import Image\nim=Image.open(io.BytesIO(sys.stdin.buffer.read()))\nif im.format!='PNG' or im.mode!='RGBA' or im.size!=(370,320) or getattr(im,'n_frames',1)!=1: raise ValueError('370x320 RGBAの静止PNGが必要です')\nsys.stdout.buffer.write(struct.pack('>II',*im.size)+im.tobytes())"],{input:Buffer.from(await blob.arrayBuffer()),maxBuffer:2000000});
 return {width:bytes.readUInt32BE(0),height:bytes.readUInt32BE(4),data:new Uint8ClampedArray(bytes.subarray(8))};
};
const result=await prepareChatHandoff(input,{get:async entry=>{const file=path.resolve(root,entry.path||'');if(!file.startsWith(root+path.sep))throw Error('PNGは入力JSONと同じフォルダ内に置いてください');return new Blob([await fs.readFile(file)],{type:'image/png'});},decode});
if(!result.accepted.length)throw Error('合格PNGがありません。検品結果を保持して残りを確認してください');
const zip=new JSZip();zip.file('technical-review.json',JSON.stringify(result.manifest,null,2));for(const e of result.accepted)zip.file(e.record.filename,e.png);
const packed=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),reopened=await JSZip.loadAsync(packed,{checkCRC32:true});
const checked=await reviewedBundle(reopened,input.master,{decode});if(checked.length!==result.accepted.length)throw Error('ZIP再読込の件数不一致');
// Never overwrite any previous attempt, and do not publish private PNGs to Git.
await fs.mkdir(path.resolve(outputPath),{recursive:false});
await fs.writeFile(path.join(outputPath,'selection-reviewed.zip'),packed,{flag:'wx'});
await fs.writeFile(path.join(outputPath,'handoff-result.json'),JSON.stringify({schema:'animal-stickers-chat-handoff-result/v1',...result.summary,excluded:result.excluded,masterReference:input.masterReference},null,2),{flag:'wx'});
console.log(JSON.stringify({...result.summary,zip:path.resolve(outputPath,'selection-reviewed.zip'),next:'Driveへ保存・再取得照合後、ユーザーが検品済みZIPを読み込みます。'}));
