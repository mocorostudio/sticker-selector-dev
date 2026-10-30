export const ARTWORK_SPECS={main:{width:240,height:240,padding:10},tab:{width:96,height:74,padding:10}};
export function selectedArtwork(draft,setId){return draft.artwork?.[setId]||{mainId:null,tabId:null,strokes:[],sourceSha:null};}
export function chooseArtwork(draft,setId,kind,imageId,files){
 if(!['main','tab'].includes(kind)||!draft.sets.some(s=>s.id===setId)||!files.some(f=>f.id===imageId&&draft.assignments[f.id]===setId))throw Error('選んだセットの画像を指定してください。');
 const next=structuredClone(draft),before=selectedArtwork(next,setId),after={...before,[kind+'Id']:imageId};if(before[kind+'Id']===imageId)return draft;
 if(kind==='tab'){after.strokes=[];after.crop=null;after.sourceSha=null;}next.artwork={...next.artwork,[setId]:after};next.artworkHistory=[...(next.artworkHistory||[]),{setId,action:'choose-'+kind,before,after:structuredClone(after),at:new Date().toISOString()}];return next;
}
export function validateStroke(stroke){if(!stroke||!Number.isFinite(stroke.radius)||stroke.radius<1||stroke.radius>80||!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>4000||stroke.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('消しゴムの記録が不正です。');return stroke;}
export function editArtwork(draft,setId,action,{stroke,sourceSha,crop}={}){
 const before=selectedArtwork(draft,setId);if(!before.tabId)throw Error('先にタブ画像を選んでください。');if(before.sourceSha&&sourceSha&&before.sourceSha!==sourceSha)throw Error('元画像が変わっています。タブ画像を選び直してください。');
 const after=structuredClone(before);after.strokes=after.strokes||[];
 if(action==='crop'){validateCrop(crop);after.crop=structuredClone(crop);}else if(action==='reset-crop'){after.crop=null;}else if(action==='erase'){validateStroke(stroke);if(after.strokes.reduce((n,s)=>n+s.points.length,0)+stroke.points.length>30000)throw Error('編集が多くなっています。元に戻すか別の画像を選んでください。');after.strokes.push(structuredClone(stroke));}else if(action==='undo')after.strokes.pop();else if(action==='reset'){after.strokes=[];after.crop=null;}else throw Error('編集操作が不正です。');after.sourceSha=sourceSha||before.sourceSha||null;
 const next=structuredClone(draft);next.artwork={...next.artwork,[setId]:after};next.artworkHistory=[...(next.artworkHistory||[]),{setId,action,before:action==='reset'?before:undefined,crop:after.crop,previousCrop:before.crop,stroke:action==='undo'?before.strokes?.at(-1):stroke,at:new Date().toISOString()}];return next;
}
export function alphaBounds(image){let left=image.width,top=image.height,right=-1,bottom=-1;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};}
export function fitArtwork(bounds,kind){const spec=ARTWORK_SPECS[kind];if(!bounds||!spec)throw Error('画像がすべて透明です。編集を戻してください。');const scale=Math.min((spec.width-spec.padding*2)/bounds.width,(spec.height-spec.padding*2)/bounds.height),width=bounds.width*scale,height=bounds.height*scale;return {...spec,x:(spec.width-width)/2,y:(spec.height-height)/2,drawWidth:width,drawHeight:height};}

export function validateCrop(crop){if(!crop||!['x','y','width','height'].every(k=>Number.isFinite(crop[k]))||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>1.000001||crop.y+crop.height>1.000001)throw Error('切り抜き範囲が不正です。');return crop;}
export function cropArtwork(image,crop){if(!crop)return image;validateCrop(crop);const x=Math.floor(crop.x*image.width),y=Math.floor(crop.y*image.height),right=Math.min(image.width,Math.ceil((crop.x+crop.width)*image.width)),bottom=Math.min(image.height,Math.ceil((crop.y+crop.height)*image.height)),width=right-x,height=bottom-y,data=new Uint8ClampedArray(width*height*4);for(let row=0;row<height;row++)data.set(image.data.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+right)*4),row*width*4);return {width,height,data};}
export function resizeArtwork(image,kind,crop=null){
 image=cropArtwork(image,crop);
 const bounds=alphaBounds(image),f=fitArtwork(bounds,kind),data=new Uint8ClampedArray(f.width*f.height*4);
 for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){if(x+.5<f.x||y+.5<f.y||x+.5>=f.x+f.drawWidth||y+.5>=f.y+f.drawHeight)continue;const sx=bounds.x+(x+.5-f.x)*bounds.width/f.drawWidth-.5,sy=bounds.y+(y+.5-f.y)*bounds.height/f.drawHeight-.5,x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;let a=0,r=0,g=0,b=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const xx=x0+dx,yy=y0+dy;if(xx<0||yy<0||xx>=image.width||yy>=image.height)continue;const index=(yy*image.width+xx)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy),alpha=image.data[index+3]*weight;a+=alpha;r+=image.data[index]*alpha;g+=image.data[index+1]*alpha;b+=image.data[index+2]*alpha;}const dest=(y*f.width+x)*4;data[dest+3]=Math.round(a);if(data[dest+3]){data[dest]=Math.round(r/a);data[dest+1]=Math.round(g/a);data[dest+2]=Math.round(b/a);}
 }
 return {width:f.width,height:f.height,data};
}
