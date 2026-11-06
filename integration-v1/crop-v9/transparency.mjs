// Conservative preprocessing of NEW crops. Never rekeys opaque white artwork.
// A processed image still requires the normal visual inspection.
export function prepareTransparency(im){
 const {width:w,height:h}=im||{},src=im?.data,n=w*h;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||n>16000000||src?.length!==n*4)throw Error('透過処理の画像が不正です');
 const data=new Uint8ClampedArray(src),distance=new Uint16Array(n);distance.fill(65535);
 let weakRemoved=0,hazeRemoved=0;
 for(let k=0;k<n;k++){
  const p=k*4,a=data[p+3];
  if(a>192)distance[k]=0;
  if(a<=8){if(a)weakRemoved++;data.fill(0,p,p+4);}
 }
 // Protect antialiased white fur and text rims around the opaque artwork.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x;distance[k]=Math.min(distance[k],x?distance[k-1]+1:65535,y?distance[k-w]+1:65535);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const k=y*w+x;distance[k]=Math.min(distance[k],x<w-1?distance[k+1]+1:65535,y<h-1?distance[k+w]+1:65535);}
 const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0,border=0,opaqueBorder=0;
 const candidate=k=>{const p=k*4,a=data[p+3];if(!a)return true;return distance[k]>3&&a<=128&&Math.min(data[p],data[p+1],data[p+2])>=180&&Math.max(data[p],data[p+1],data[p+2])-Math.min(data[p],data[p+1],data[p+2])<=24;};
 const add=k=>{if(!seen[k]&&candidate(k)){seen[k]=1;queue[tail++]=k;}};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1){const k=y*w+x;border++;if(data[k*4+3]>192)opaqueBorder++;add(k);}
 while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w),p=k*4;if(data[p+3]){hazeRemoved++;data.fill(0,p,p+4);}if(x)add(k-1);if(x<w-1)add(k+1);if(y)add(k-w);if(y<h-1)add(k+w);}
 const issues=[];
 if(opaqueBorder/border>.9)issues.push('不透明な背景の可能性：白い本体・文字の白フチを保護し、自動の色抜きは保留');
 return {width:w,height:h,data,report:{version:'safe-transparency/v1',stage:'before-normalization',weakRemoved,hazeRemoved,removed:weakRemoved+hazeRemoved,status:issues.length?'hold':weakRemoved+hazeRemoved?'processed-needs-visual-review':'checked',issues,opaqueColorKeyApplied:false}};
}
