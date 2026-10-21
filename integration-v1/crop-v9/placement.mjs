export function placementPlan(contentWidth,contentHeight,{size=100,offsetX=0,offsetY=0}={}){
 if(!Number.isInteger(contentWidth)||!Number.isInteger(contentHeight)||contentWidth<1||contentHeight<1||contentWidth*contentHeight>16000000)throw Error('描画範囲が不正です');
 if(![size,offsetX,offsetY].every(Number.isFinite)||size<50||size>105)throw Error('大きさは50〜105%で指定してください');
 const width=370,height=320,scale=Math.min(width*.76/contentWidth,height*.76/contentHeight)*size/100;
 const drawWidth=Math.max(1,Math.round(contentWidth*scale)),drawHeight=Math.max(1,Math.round(contentHeight*scale));
 const centerX=Math.floor((width-drawWidth)/2),centerY=Math.floor((height-drawHeight)/2);
 const minOffsetX=37-centerX,maxOffsetX=width-37-drawWidth-centerX,minOffsetY=32-centerY,maxOffsetY=height-32-drawHeight-centerY;
 const xOffset=Math.max(minOffsetX,Math.min(maxOffsetX,Math.round(offsetX))),yOffset=Math.max(minOffsetY,Math.min(maxOffsetY,Math.round(offsetY)));
 return {width,height,drawWidth,drawHeight,x:centerX+xOffset,y:centerY+yOffset,minOffsetX,maxOffsetX,minOffsetY,maxOffsetY,settings:{size,offsetX:xOffset,offsetY:yOffset}};
}
export function placementRecord(previous,pixels,settings,{imageId,filename,qa,at=new Date().toISOString()}){
 if(!imageId||imageId===previous.imageId)throw Error('新しい画像IDが必要です');
 const {boundaryReview,technicalStatus,decision,...rest}=previous;
 return {...rest,imageId,filename,pixels,hasPixels:true,layout:structuredClone(settings),qa,review:[],saveState:'local',attempt:(previous.attempt||1)+1,
  history:[...structuredClone(previous.history||[]),{action:'placement',at,previousImageId:previous.imageId,layout:structuredClone(settings)}]};
}
