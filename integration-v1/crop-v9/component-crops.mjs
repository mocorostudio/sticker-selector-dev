import {validateImage,cleanTransparency,components,cropPixels} from './core.mjs';

// Grid positions only assign whole connected shapes to candidates. They never
// clip a hand, letter or boot at a fixed grid line. Low-alpha edge pixels grow
// from their opaque shape, so a faint bridge cannot join neighboring stickers.
export function isolateComponents(image,rows=3,cols=3){
 validateImage(image);
 if(![2,3,4].includes(rows)||![2,3,4].includes(cols))throw Error('区画数が不正');
 const im=cleanTransparency(image),{width:w,height:h,data}=im;
 const seedData=new Uint8ClampedArray(data);
 for(let i=0;i<w*h;i++)if(seedData[i*4+3]<=128)seedData[i*4+3]=0;
 const seeds=components({width:w,height:h,data:seedData},true),owner=new Int16Array(w*h).fill(-1),queue=new Int32Array(w*h),seen=new Uint8Array(w*h);
 let head=0,tail=0;const groups=Array.from({length:rows*cols},()=>({parts:[],unresolved:false}));
 for(const part of seeds){
  // Tiny detached components without an opaque body are noise; punctuation and
  // garment detail connected to a real shape are retained in the growth pass.
  if(part.area<16)continue;
  const col=Math.min(cols-1,Math.floor((part.x0+part.x1)/2/w*cols)),row=Math.min(rows-1,Math.floor((part.y0+part.y1)/2/h*rows)),slot=row*cols+col;
  groups[slot].parts.push(part);
  if(part.x1-part.x0>w/cols*1.7||part.y1-part.y0>h/rows*1.7)groups[slot].unresolved=true;
  // Recover this seed's exact pixels, never its rectangular bounding box.
  const start=part.startIndex;
  if(start<0)throw Error('連結成分の照合失敗');
  const local=[start];seen[start]=1;
  for(let j=0;j<local.length;j++){
   const k=local[j],x=k%w,y=Math.floor(k/w);owner[k]=slot;queue[tail++]=k;
   for(const n of [x?k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1])if(n>=0&&!seen[n]&&seedData[n*4+3]){seen[n]=1;local.push(n);}
  }
 }
 while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w);for(const n of [x?k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1])if(n>=0&&owner[n]<0&&data[n*4+3]){owner[n]=owner[k];queue[tail++]=n;}}
 return groups.map((g,slot)=>{
  const pixels=new Uint8ClampedArray(data.length);let x0=w,y0=h,x1=0,y1=0,area=0;
  for(let k=0;k<w*h;k++)if(owner[k]===slot){pixels.set(data.subarray(k*4,k*4+4),k*4);const x=k%w,y=Math.floor(k/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);area++;}
  if(!area)throw Error('候補の画像がありません');
  const bounds={x0,y0,x1,y1};
  return {pixels:cropPixels({width:w,height:h,data:pixels},bounds),bounds,parts:g.parts,crossing:g.unresolved,sourceTouchesEdge:x0===0||y0===0||x1===w||y1===h,cleanup:{alphaThreshold:8,seedAlpha:128,minimumSeedArea:16,removed:im.removed}};
 });
}
