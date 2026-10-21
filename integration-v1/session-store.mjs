export function storageKeys({driveTest=false,workflowLocal=false,pathname='/'}={}) {
 const scope=pathname.replace(/index\.html$/, '');
 const store=workflowLocal?'sticker-selector-v9:crop-workflow:'+scope:driveTest?'sticker-selector-v9:drive-test:'+scope:'sticker-selector-v9';
 return {store,view:store+'-visible-ids',db:workflowLocal?'sticker-selector-images-v9:crop-workflow:'+scope:driveTest?'sticker-selector-images-v9:drive-test:'+scope:'sticker-selector-images-v9'};
}

// Copy only an unambiguous draft already linked to the exact registered test attempt.
// Reading/copying never updates the original storage or invents a remote identity.
export function recoverDraft(items,record) {
 const matches=(items||[]).filter(x=>x.id===record.imageId&&x.imageId===record.imageId);
 if(matches.length!==1)return null;
 const draft=matches[0];
 if(draft.candidate!==record.candidate||draft.attemptId!==record.attemptId||draft.driveFileId!==record.driveFileId||draft.name!==record.filename)return null;
 return structuredClone(draft);
}
