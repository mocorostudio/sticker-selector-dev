// Add physical resolution without decoding/recompressing any image pixels.
const signature=[137,80,78,71,13,10,26,10];
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return (crc^0xffffffff)>>>0;}
export async function withPngDpi(blob,dpi=72){
 if(!Number.isFinite(dpi)||dpi<72||dpi>1200)throw Error('PNGの解像度が不正です。');
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
 if(!signature.every((b,i)=>bytes[i]===b))throw Error('PNG形式を確認できません。');
 const chunk=new Uint8Array(21),v=new DataView(chunk.buffer),ppm=Math.ceil(dpi/0.0254);
 v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,ppm);v.setUint32(12,ppm);chunk[16]=1;v.setUint32(17,crc32(chunk.subarray(4,17)));
 const parts=[bytes.subarray(0,8)];let pos=8,inserted=false,ended=false;
 while(pos<bytes.length){if(pos+12>bytes.length)throw Error('PNGが途中で切れています。');const len=view.getUint32(pos),end=pos+12+len;if(end>bytes.length)throw Error('PNGが途中で切れています。');const type=String.fromCharCode(...bytes.subarray(pos+4,pos+8));
  if(!inserted&&type==='IDAT'){parts.push(chunk);inserted=true;}
  if(type!=='pHYs')parts.push(bytes.subarray(pos,end));pos=end;if(type==='IEND'){ended=true;break;}
 }
 if(!inserted||!ended||pos!==bytes.length)throw Error('PNG構造を確認できません。');
 return new Blob(parts,{type:'image/png'});
}
