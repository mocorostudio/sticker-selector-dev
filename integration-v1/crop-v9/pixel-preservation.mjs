// Explicit operator review, in this image's integer pixel coordinates.
export function regionMask(image,spec,kind){
 const {width:w,height:h}=image,n=w*h,mask=new Uint8Array(n);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||n>16000000||image.data?.length!==n*4)throw Error('保護対象の画像が不正です');
 if(spec==null)return mask;
 if(spec.kind!==kind||!Array.isArray(spec.regions)||!spec.regions.length||typeof spec.reason!=='string'||!spec.reason.trim())throw Error('確認領域の種類・範囲・理由が必要です');
 for(const b of spec.regions){
  if(!Array.isArray(b)||b.length!==4||b.some(x=>!Number.isInteger(x))||b[0]<0||b[1]<0||b[2]>w||b[3]>h||b[2]<=b[0]||b[3]<=b[1])throw Error('確認領域が画像の範囲外または不正です');
  for(let y=b[1];y<b[3];y++)mask.fill(1,y*w+b[0],y*w+b[2]);
 }
 return mask;
}

// Independent guard: never silently restore modified letters and claim success.
// With no regions, compare the entire image (including RGB under alpha zero).
export function assertPreservedPixels(before,after,{protectedForeground=null,reviewedBackground=null}={}){
 const fg=regionMask(before,protectedForeground,'protected-foreground-regions/v1'),bg=regionMask(before,reviewedBackground,'reviewed-background-regions/v1');
 if(before.width!==after?.width||before.height!==after?.height||before.data.length!==after?.data?.length)throw Error('画素保護検査の寸法が一致しません');
 let checkedPixels=0;
 for(let k=0;k<fg.length;k++)if(fg[k]||!bg[k]){
  checkedPixels++;
  for(let c=0;c<4;c++)if(before.data[k*4+c]!==after.data[k*4+c])throw Error('保護画素が変更されました：文字・白フチ・重なりの変更を停止します ('+(k%before.width)+','+Math.floor(k/before.width)+')');
 }
 return {status:'verified',checkedPixels,changedPixels:0};
}
