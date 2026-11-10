import {assertPreservedPixels} from './crop-v9/pixel-preservation.mjs';
import {prepareTransparency} from './crop-v9/transparency.mjs?v=20261110-lettering1';
async function browserEncode(pixels){
 const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;
 canvas.getContext('2d').putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('透過PNGの保存に失敗しました')),'image/png'));
}
// A derivative only: never mutate the selected source or its inspection record.
export async function finalizeTransparency(blob,decode,encode=browserEncode,options={}){
 const source=await decode(blob),clean=prepareTransparency(source,options);
 if(clean.report.issues.length)throw Error(clean.report.issues.join(' ／ '));
 if(!clean.report.removed)return {blob,report:{...clean.report,stage:'final-output'}};
 const output=await encode(clean),actual=await decode(output),check=prepareTransparency(actual,{protectedForeground:options.protectedForeground});
 if(actual.width!==source.width||actual.height!==source.height||check.report.removed||check.report.issues.length)throw Error('最終PNGの透過再検査に失敗しました');
 const preservation=assertPreservedPixels(clean,actual);
 return {blob:output,report:{...clean.report,pngReadbackPreservation:preservation,stage:'final-output',visualReviewRequired:true}};
}
