export function selectionView(items,{workflowLocal=false,shownIds=null,characterId=null}={}){
 const replaced=new Set(workflowLocal?items.flatMap(x=>(x.crop?.history||[]).map(h=>h.previousImageId).filter(Boolean)):[]);
 return items.filter(x=>(!characterId||(x.characterId||x.crop?.pendingDrive?.characterId)===characterId)&&(shownIds===null||shownIds.includes(x.id))&&!replaced.has(x.imageId));
}
