import {regionMask,assertPreservedPixels} from './pixel-preservation.mjs';
// Conservative preprocessing of NEW crops. Never rekeys opaque white artwork.
// A processed image still requires the normal visual inspection.
export function prepareTransparency(im,{backgroundReference=im,reviewedBackground=null,protectedForeground=null}={}){
 const {width:w,height:h}=im||{},src=im?.data,n=w*h;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||n>16000000||src?.length!==n*4)throw Error('透過処理の画像が不正です');
 const foreground=regionMask(im,protectedForeground,'protected-foreground-regions/v1'),background=regionMask(im,reviewedBackground,'reviewed-background-regions/v1');
 const allowed=k=>background[k]&&!foreground[k];
 const retained=new Uint8Array(n);
 const erase=k=>{if(allowed(k)){data.fill(0,k*4,k*4+4);return true;}if(!foreground[k]&&data[k*4+3])retained[k]=1;return false;};
 const data=new Uint8ClampedArray(src),distance=new Uint16Array(n);distance.fill(65535);
 let weakRemoved=0,hazeRemoved=0,weakIslandRemoved=0,reviewedHazeRemoved=0;
 for(let k=0;k<n;k++){
  const p=k*4,a=data[p+3];
  if(a>192)distance[k]=0;

 }
 // Protect antialiased white fur and text rims around the opaque artwork.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x;distance[k]=Math.min(distance[k],x?distance[k-1]+1:65535,y?distance[k-w]+1:65535);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const k=y*w+x;distance[k]=Math.min(distance[k],x<w-1?distance[k+1]+1:65535,y<h-1?distance[k+w]+1:65535);}
 // Explicit, source-bound operator review only. Keep opaque artwork and its
 // three-pixel watercolor/antialias fringe, including white bodies and text.
 // No color key and no global alpha cutoff; unreviewed regions are unchanged.
 if(reviewedBackground)for(let k=0;k<n;k++){
  const a=data[k*4+3];if(background[k]&&a>0&&a<=192&&distance[k]>3&&erase(k))reviewedHazeRemoved++;
 }
 for(let k=0;k<n;k++){const p=k*4;if(data[p+3]<=8&&distance[k]>3){const a=data[p+3];if(erase(k)&&a)weakRemoved++;}}
 const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0,border=0,opaqueBorder=0;
 const candidate=k=>{const p=k*4,a=data[p+3];if(!a)return true;return distance[k]>3&&a<=128&&Math.min(data[p],data[p+1],data[p+2])>=180&&Math.max(data[p],data[p+1],data[p+2])-Math.min(data[p],data[p+1],data[p+2])<=24;};
 const add=k=>{if(!seen[k]&&candidate(k)){seen[k]=1;queue[tail++]=k;}};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1){const k=y*w+x;border++;if(data[k*4+3]>192)opaqueBorder++;add(k);}
 while(head<tail){const k=queue[head++],x=k%w,y=Math.floor(k/w),p=k*4;if(data[p+3]){if(erase(k))hazeRemoved++;}if(x)add(k-1);if(x<w-1)add(k+1);if(y)add(k-w);if(y<h-1)add(k+w);}
 const issues=[],alphaHistogram=Array(256).fill(0),residualComponents=[],removedIslands=[];
 const visited=new Uint8Array(n);
 // Color alone cannot distinguish a watercolor decoration from background.
 // Retain ambiguous detached components, but block automatic acceptance.
 // Label complete alpha components, not just the low-alpha fringe of a leaf or tail.
 // Diagonal antialiasing belongs to the same watercolor edge.
 const attached=new Uint8Array(n);head=0;tail=0;
 for(let k=0;k<n;k++)if(data[k*4+3]>192){attached[k]=1;queue[tail++]=k;}
 while(head<tail){const j=queue[head++],x=j%w,y=Math.floor(j/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const k=yy*w+xx;if(!attached[k]&&data[k*4+3]){attached[k]=1;queue[tail++]=k;}}}
 const suspect=k=>!foreground[k]&&data[k*4+3]>0&&data[k*4+3]<255&&distance[k]>3&&!attached[k];
 for(let k=0;k<n;k++)if(!visited[k]&&suspect(k)){
  head=0;tail=0;queue[tail++]=k;visited[k]=1;
  let x0=w,y0=h,x1=0,y1=0,minAlpha=255,maxAlpha=0;
  while(head<tail){const j=queue[head++],x=j%w,y=Math.floor(j/w),a=data[j*4+3];x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);minAlpha=Math.min(minAlpha,a);maxAlpha=Math.max(maxAlpha,a);
   for(const next of [x?j-1:-1,x<w-1?j+1:-1,y?j-w:-1,y<h-1?j+w:-1])if(next>=0&&!visited[next]&&suspect(next)){visited[next]=1;queue[tail++]=next;}
  }
  const component={pixels:tail,bounds:[x0,y0,x1+1,y1+1],minAlpha,maxAlpha};
  // A tiny faint component can be punctuation: remove only reviewed background.
  // Larger patches and stronger colored decorations remain unresolved.
  if(tail<=32&&maxAlpha<=32){let removed=0;for(let j=0;j<tail;j++)if(erase(queue[j]))removed++;weakIslandRemoved+=removed;if(removed)removedIslands.push({...component,pixels:removed});if(removed<tail)residualComponents.push(component);}else residualComponents.push(component);
 }
 // A connected wash spanning much of the canvas remains ambiguous, even when
 // it has a thin bridge to opaque artwork. Connectivity alone is not approval.
 let diffusePixels=0,dx0=w,dy0=h,dx1=-1,dy1=-1;
 for(let k=0;k<n;k++)if(!foreground[k]&&attached[k]&&data[k*4+3]>0&&data[k*4+3]<=192&&distance[k]>3){diffusePixels++;const x=k%w,y=Math.floor(k/w);dx0=Math.min(dx0,x);dy0=Math.min(dy0,y);dx1=Math.max(dx1,x);dy1=Math.max(dy1,y);}
 if(diffusePixels>n*.05&&(dx1-dx0>=w*.5||dy1-dy0>=h*.5))issues.push('背景残留の疑い：本体につながる広い半透明領域を個別確認してください');
 for(let k=0;k<n;k++)alphaHistogram[data[k*4+3]]++;
 if(residualComponents.length)issues.push('背景残留の疑い：本体から離れた半透明成分を個別確認・追加除去してください');

 // Component isolation can tightly bound opaque artwork. Judge an opaque background
 // against the pre-isolation source, never that artificial component boundary.
 if(backgroundReference!==im){const r=backgroundReference;if(!Number.isInteger(r?.width)||!Number.isInteger(r?.height)||r.width<1||r.height<1||r.data?.length!==r.width*r.height*4)throw Error('透過判定の元画像が不正です');border=0;opaqueBorder=0;for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(x===0||y===0||x===r.width-1||y===r.height-1){border++;if(r.data[(y*r.width+x)*4+3]>192)opaqueBorder++;}}
 if(opaqueBorder/border>.9)issues.push('不透明な背景の可能性：白い本体・文字の白フチを保護し、自動の色抜きは保留');
 const retainedPixels=retained.reduce((sum,v)=>sum+v,0);
 if(retainedPixels)issues.push('背景か文字・白フチか判別できない画素を保持しました。選抜前に元画像と個別確認してください');
 const preservation=assertPreservedPixels(im,{width:w,height:h,data},{protectedForeground,reviewedBackground});
 return {width:w,height:h,data,report:{version:'safe-transparency/v4-preserve-lettering',preservation,retainedPixels,protectedForeground:protectedForeground?structuredClone(protectedForeground):null,alphaHistogram,residualComponents,visualReviewRequired:true,stage:'before-normalization',weakRemoved,hazeRemoved,weakIslandRemoved,reviewedHazeRemoved,reviewedBackground:reviewedBackground?structuredClone(reviewedBackground):null,removedIslands,diffusePixels,removed:weakRemoved+hazeRemoved+weakIslandRemoved+reviewedHazeRemoved,status:issues.length?'hold':weakRemoved+hazeRemoved+weakIslandRemoved+reviewedHazeRemoved?'processed-needs-visual-review':'checked',issues,opaqueColorKeyApplied:false}};
}
