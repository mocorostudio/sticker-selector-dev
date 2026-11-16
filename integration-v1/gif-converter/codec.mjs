import {parseGIF,decompressFrames, zlibSync, zipSync,strToU8} from './vendor.mjs';
export {zipSync,strToU8};
const be=n=>new Uint8Array([n>>>24,n>>>16,n>>>8,n]);
const join=arr=>{let out=new Uint8Array(arr.reduce((n,a)=>n+a.length,0)),p=0;for(let a of arr){out.set(a,p);p+=a.length}return out};
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
export function crc32(a){let n=0xffffffff;for(let b of a)n=table[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0}
function chunk(type,data){let body=join([strToU8(type),data]);return join([be(data.length),body,be(crc32(body))])}
export function encodeAPNG(frames,w,h,duration,loops=1){
 if(!frames.length||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||frames.some(f=>f.length!==w*h*4))throw Error('フレーム寸法が不正です');
 let ihdr=join([be(w),be(h),new Uint8Array([8,6,0,0,0])]);let parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr)];let seq=0;
 if(frames.length>1)parts.push(chunk('acTL',join([be(frames.length),be(loops)])));
 frames.forEach((rgba,i)=>{if(frames.length>1){let delay=new Uint8Array(4);let dv=new DataView(delay.buffer);dv.setUint16(0,duration);dv.setUint16(2,frames.length);parts.push(chunk('fcTL',join([be(seq++),be(w),be(h),be(0),be(0),delay,new Uint8Array([0,0])])))}
 let raw=new Uint8Array((w*4+1)*h);for(let y=0;y<h;y++)raw.set(rgba.subarray(y*w*4,(y+1)*w*4),y*(w*4+1)+1);let compressed=zlibSync(raw,{level:9});parts.push(i===0?chunk('IDAT',compressed):chunk('fdAT',join([be(seq++),compressed])))});parts.push(chunk('IEND',new Uint8Array()));return join(parts);
}
export function inspectAPNG(bytes,kind='sticker'){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=8,w=0,h=0,n=0,loops=0,seconds=0,controls=0,sequence=0;let errors=[];
 if(bytes.slice(0,8).join()!=[137,80,78,71,13,10,26,10].join())throw Error('PNGシグネチャ不正');
 while(p+12<=bytes.length){let l=dv.getUint32(p),type=String.fromCharCode(...bytes.slice(p+4,p+8)),d=p+8;if(p+l+12>bytes.length)throw Error('PNG破損');if(crc32(bytes.subarray(p+4,p+8+l))!==dv.getUint32(p+8+l))errors.push('CRC不一致');if(type==='IHDR'){w=dv.getUint32(d);h=dv.getUint32(d+4);if(bytes[d+9]!==6)errors.push('RGBA形式ではありません')}
 if(type==='acTL'){n=dv.getUint32(d);loops=dv.getUint32(d+4)}if(type==='fcTL'){controls++;if(dv.getUint32(d)!==sequence++)errors.push('コマ順序不正');seconds+=dv.getUint16(d+20)/(dv.getUint16(d+22)||100)}if(type==='fdAT'&&dv.getUint32(d)!==sequence++)errors.push('データ順序不正');p+=l+12;if(type==='IEND')break;}
 if(kind==='sticker'&&(w>320||h>270||Math.max(w,h)<270))errors.push('寸法が規格外');if(kind==='main'&&(w!==240||h!==240))errors.push('メイン寸法不正');if(kind==='tab'&&(w!==96||h!==74))errors.push('タブ寸法不正');
 if(kind!=='tab'){if(n<5||n>20||controls!==n)errors.push('コマ数が規格外');if(loops<1||loops>4||seconds*loops>4.00001||Math.abs(seconds-Math.round(seconds))>.00001)errors.push('再生時間が規格外')}
 if(bytes.length>1000000)errors.push('1MBを超えています');return {w,h,frames:n,loops,seconds,totalSeconds:seconds*loops,bytes:bytes.length,errors};
}
export function decodeGIF(buffer){
 const b=new Uint8Array(buffer);if(String.fromCharCode(...b.slice(0,3))!=='GIF')throw Error('GIFファイルを選んでください');const gif=parseGIF(buffer),w=gif.lsd.width,h=gif.lsd.height;const count=gif.frames.filter(f=>f.image).length;
 if(w*h>2250000||count>500||w*h*count>32000000)throw Error('GIFが大きすぎます。解像度かコマ数を減らしてください（最大3200万画素分）。');if(count<2)throw Error('動きのあるGIFが必要です');
 const patches=decompressFrames(gif,true),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d',{willReadFrequently:true});const bg=gif.gct?.[gif.lsd.backgroundColorIndex]||[0,0,0];function clear(d,transparent){ctx.clearRect(d.left,d.top,d.width,d.height);if(!transparent){ctx.fillStyle=`rgb(${bg.join(',')})`;ctx.fillRect(d.left,d.top,d.width,d.height)}}clear({left:0,top:0,width:w,height:h},patches[0].transparentIndex!==undefined);let previous=null,restore=null,frames=[],delays=[];
 for(const f of patches){if(previous?.disposalType===2)clear(previous.dims,previous.transparentIndex!==undefined);if(previous?.disposalType===3&&restore)ctx.putImageData(restore,0,0);restore=f.disposalType===3?ctx.getImageData(0,0,w,h):null;
 const part=document.createElement('canvas');part.width=f.dims.width;part.height=f.dims.height;part.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.patch),f.dims.width,f.dims.height),0,0);ctx.drawImage(part,f.dims.left,f.dims.top);frames.push(ctx.getImageData(0,0,w,h).data);delays.push(Math.max(10,f.delay||100));previous=f;}
 return {w,h,frames,delays,duration:delays.reduce((a,b)=>a+b,0)};
}
export function sampleIndices(delays,count){let total=delays.reduce((a,b)=>a+b,0),out=[];for(let i=0;i<count;i++){let target=i*total/count,sum=0,k=0;while(k<delays.length-1&&sum+delays[k]<=target)sum+=delays[k++];out.push(k)}return out}
export function fitFrames(source,count,w=320,h=270,first=0){let indices=sampleIndices(source.delays,count);indices=indices.slice(first).concat(indices.slice(0,first));let out=[];let c=document.createElement('canvas');c.width=w;c.height=h;let ctx=c.getContext('2d',{willReadFrequently:true}),s=document.createElement('canvas');s.width=source.w;s.height=source.h;let sc=s.getContext('2d');let scale=Math.min((w-16)/source.w,(h-16)/source.h),dw=source.w*scale,dh=source.h*scale;
 for(let k of indices){sc.putImageData(new ImageData(new Uint8ClampedArray(source.frames[k]),source.w,source.h),0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(s,(w-dw)/2,(h-dh)/2,dw,dh);out.push(new Uint8Array(ctx.getImageData(0,0,w,h).data))}return out}
export function analyzeFrames(frames,w,h){let unique=new Set(),opaqueEdge=false,visible=false,sourceTransparent=false;for(let frame of frames){unique.add(crc32(frame));for(let i=3;i<frame.length;i+=4){if(frame[i]===0)sourceTransparent=true;if(frame[i])visible=true;let p=(i-3)/4,x=p%w,y=Math.floor(p/w);if((x===0||y===0||x===w-1||y===h-1)&&frame[i])opaqueEdge=true}}return{unique:unique.size,opaqueEdge,visible,sourceTransparent}}
