export function selectionView(items,{workflowLocal=false,shownIds=null}={}){
 const replaced=new Set(workflowLocal?items.flatMap(x=>(x.crop?.history||[]).map(h=>h.previousImageId).filter(Boolean)):[]);
 return items.filter(x=>(shownIds===null||shownIds.includes(x.id))&&!replaced.has(x.imageId));
}
