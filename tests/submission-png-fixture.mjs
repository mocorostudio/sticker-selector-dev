import {deflateSync} from 'node:zlib';
import {crc32} from '../integration-v1/submission-validation.mjs';
export function pngFixture(width=370,height=320,{opaque=false,empty=false,color=120,margin=20}={}){
 const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);b.set(data,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const raw=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(width*4+1)+1+x*4;raw[i]=color;raw[i+1]=70;raw[i+2]=45;raw[i+3]=!empty&&(opaque||x>margin&&x<width-margin-1&&y>margin&&y<height-margin-1)?255:0;}
 return new Blob([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))],{type:'image/png'});
}
