// Archive complete metadata before shrinking the synchronous selection index.
// PNGs, submission drafts, and unknown/legacy identities are never deleted here.
export async function archiveOtherCharacters(state,characterId,{archive,save}){
 if(!characterId||!Array.isArray(state?.items))throw Error('対象キャラを確認してから整理してください。');
 const owner=item=>item.characterId||item.crop?.pendingDrive?.characterId;
 const removed=state.items.filter(item=>owner(item)&&owner(item)!==characterId);
 if(!removed.length)return {state,count:0};
 const next={...state,items:state.items.filter(item=>!removed.includes(item))};
 // This snapshot includes current unsaved votes and edits as well as old metadata.
 const record={schema:'animal-stickers-selection-archive/v1',at:new Date().toISOString(),characterId,state:structuredClone(state)};
 await archive(record);
 await save(next);
 return {state:next,count:removed.length};
}
