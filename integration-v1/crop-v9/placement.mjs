export const PLACEMENT_VERSION='source-fit-10px/v1';
export const FINAL_MARGIN=10;
export const UPSCALE_ISSUE='元画像の実体解像度不足：拡大せず保留。高解像度の元画像から切り出してください';
export function placementPlan(contentWidth,contentHeight,{size=100,offsetX=0,offsetY=0}={}){
 if(!Number.isInteger(contentWidth)||!Number.isInteger(contentHeight)||contentWidth<1||contentHeight<1||contentWidth*contentHeight>16000000)throw Error('描画範囲が不正です');
 if(![size,offsetX,offsetY].every(Number.isFinite)||size<50||size>105)throw Error('大きさは50〜105%で指定してください');
 const width=370,height=320,fitScale=Math.min((width-FINAL_MARGIN*2)/contentWidth,(height-FINAL_MARGIN*2)/contentHeight);
 // Fit from original content once. A small source stays at native resolution and
 // remains held; a size control must never force enlargement or clip the margin.
 const scale=Math.min(1,fitScale,fitScale*(size/100));
 const drawWidth=Math.max(1,Math.floor(contentWidth*scale)),drawHeight=Math.max(1,Math.floor(contentHeight*scale));
 const centerX=Math.floor((width-drawWidth)/2),centerY=Math.floor((height-drawHeight)/2);
 const minOffsetX=FINAL_MARGIN-centerX,maxOffsetX=width-FINAL_MARGIN-drawWidth-centerX,minOffsetY=FINAL_MARGIN-centerY,maxOffsetY=height-FINAL_MARGIN-drawHeight-centerY;
 const xOffset=Math.max(minOffsetX,Math.min(maxOffsetX,Math.round(offsetX))),yOffset=Math.max(minOffsetY,Math.min(maxOffsetY,Math.round(offsetY)));
 return {version:PLACEMENT_VERSION,width,height,sourceWidth:contentWidth,sourceHeight:contentHeight,scale,fitScale,upscaleRequired:fitScale>1,issues:fitScale>1?[UPSCALE_ISSUE]:[],drawWidth,drawHeight,x:centerX+xOffset,y:centerY+yOffset,minOffsetX,maxOffsetX,minOffsetY,maxOffsetY,settings:{size:Math.min(size,100),offsetX:xOffset,offsetY:yOffset}};
}
export function placementQA(qa,plan){const issues=[...new Set([...qa.issues,...plan.issues])];return {...qa,issues,...(issues.length?{automatic:'fail',status:'fail'}:{})};}
export function placementRecord(previous,pixels,settings,{imageId,filename,qa,placement,at=new Date().toISOString()}){
 if(!imageId||imageId===previous.imageId)throw Error('新しい画像IDが必要です');
 const {boundaryReview,technicalStatus,decision,...rest}=previous;
 return {...rest,imageId,filename,pixels,hasPixels:true,layout:structuredClone(settings),...(placement?{placement:structuredClone(placement)}:{}),qa,review:[],saveState:'local',attempt:(previous.attempt||1)+1,
  history:[...structuredClone(previous.history||[]),{action:'placement',at,previousImageId:previous.imageId,layout:structuredClone(settings)}]};
}
