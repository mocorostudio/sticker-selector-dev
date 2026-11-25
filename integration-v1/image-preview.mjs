export function byteCache(limit,weight=entry=>entry.blob.size) {
 const entries=new Map();
 let bytes=0;
 function remove(key){
  const entry=entries.get(key);
  if(!entry)return;
  entries.delete(key);
  bytes-=weight(entry);
 }
 return {
  get(key){
   const entry=entries.get(key);
   if(!entry)return;
   entries.delete(key);
   entries.set(key,entry);
   return entry;
  },
  set(key,entry){
   remove(key);
   const size=weight(entry);
   if(size>limit)return;
   while(bytes+size>limit)remove(entries.keys().next().value);
   entries.set(key,entry);
   bytes+=size;
  },
  clear(){entries.clear();bytes=0;},
  get bytes(){return bytes;}
 };
}

export async function thumbnail(blob){
 const image=await createImageBitmap(blob);
 try{
  const scale=Math.min(1,160/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.width*scale));
  canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/webp',0.78);
 }finally{image.close();}
}
