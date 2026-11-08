import {prepareTransparency} from './crop-v9/transparency.mjs?v=20261108-fringe3';
async function browserEncode(pixels){
 const canvas=document.createElement('canvas');canvas.width=pixels.width;canvas.height=pixels.height;
 canvas.getContext('2d').putImageData(new ImageData(pixels.data,pixels.width,pixels.height),0,0);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('透過PNGの保存に失敗しました')),'image/png'));
}
// A derivative only: never mutate the selected source or its inspection record.
export async function finalizeTransparency(blob,decode,encode=browserEncode){
 const source=await decode(blob),clean=prepareTransparency(source);
 if(clean.report.issues.length)throw Error(clean.report.issues.join(' ／ '));
 if(!clean.report.removed)return {blob,report:{...clean.report,stage:'final-output'}};
 const output=await encode(clean),actual=await decode(output),check=prepareTransparency(actual);
 if(actual.width!==source.width||actual.height!==source.height||check.report.removed||check.report.issues.length)throw Error('最終PNGの透過再検査に失敗しました');
 for(let p=0;p<source.data.length;p+=4)if(source.data[p+3]>128){
  // Canvas may round RGB during premultiplication. Alpha and visible colors must remain close.
  if(actual.data[p+3]!==source.data[p+3]||[0,1,2].some(c=>Math.abs(actual.data[p+c]-source.data[p+c])>2))throw Error('透過処理で本体の画素が変化しました');
 }
 return {blob:output,report:{...clean.report,stage:'final-output',visualReviewRequired:true}};
}
