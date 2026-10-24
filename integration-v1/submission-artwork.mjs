export const ARTWORK_SPECS={main:{width:240,height:240,padding:10},tab:{width:96,height:74,padding:10}};
export function selectedArtwork(draft,setId){return draft.artwork?.[setId]||{mainId:null,tabId:null,strokes:[],sourceSha:null};}
export function chooseArtwork(draft,setId,kind,imageId,files){
 if(!['main','tab'].includes(kind)||!draft.sets.some(s=>s.id===setId)||!files.some(f=>f.id===imageId&&draft.assignments[f.id]===setId))throw Error('選んだセットの画像を指定してください。');
 const next=structuredClone(draft),before=selectedArtwork(next,setId),after={...before,[kind+'Id']:imageId};if(before[kind+'Id']===imageId)return draft;
 if(kind==='tab'){after.strokes=[];after.sourceSha=null;}next.artwork={...next.artwork,[setId]:after};next.artworkHistory=[...(next.artworkHistory||[]),{setId,action:'choose-'+kind,before,after:structuredClone(after),at:new Date().toISOString()}];return next;
}
export function validateStroke(stroke){if(!stroke||!Number.isFinite(stroke.radius)||stroke.radius<1||stroke.radius>80||!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>4000||stroke.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('消しゴムの記録が不正です。');return stroke;}
export function editArtwork(draft,setId,action,{stroke,sourceSha}={}){
 const before=selectedArtwork(draft,setId);if(!before.tabId)throw Error('先にタブ画像を選んでください。');if(before.sourceSha&&sourceSha&&before.sourceSha!==sourceSha)throw Error('元画像が変わっています。タブ画像を選び直してください。');
 const after=structuredClone(before);after.strokes=after.strokes||[];
 if(action==='erase'){validateStroke(stroke);if(after.strokes.reduce((n,s)=>n+s.points.length,0)+stroke.points.length>30000)throw Error('編集が多くなっています。元に戻すか別の画像を選んでください。');after.strokes.push(structuredClone(stroke));}else if(action==='undo')after.strokes.pop();else if(action==='reset')after.strokes=[];else throw Error('編集操作が不正です。');after.sourceSha=sourceSha||before.sourceSha||null;
 const next=structuredClone(draft);next.artwork={...next.artwork,[setId]:after};next.artworkHistory=[...(next.artworkHistory||[]),{setId,action,before:action==='reset'?before:undefined,stroke:action==='undo'?before.strokes?.at(-1):stroke,at:new Date().toISOString()}];return next;
}
export function alphaBounds(image){let left=image.width,top=image.height,right=-1,bottom=-1;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<left?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};}
export function fitArtwork(bounds,kind){const spec=ARTWORK_SPECS[kind];if(!bounds||!spec)throw Error('画像がすべて透明です。編集を戻してください。');const scale=Math.min((spec.width-spec.padding*2)/bounds.width,(spec.height-spec.padding*2)/bounds.height),width=bounds.width*scale,height=bounds.height*scale;return {...spec,x:(spec.width-width)/2,y:(spec.height-height)/2,drawWidth:width,drawHeight:height};}
