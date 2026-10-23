export const SET_COUNTS=[8,16,24,32,40];
const validId=id=>typeof id==='string'&&/^[-\w]{1,256}$/.test(id);
export function setCounts(draft){return draft.sets.map(s=>({...s,count:Object.values(draft.assignments).filter(id=>id===s.id).length}));}
export function assignImage(draft,fileId,setId){if(!validId(fileId)||!draft.sets.some(s=>s.id===setId))throw Error('画像またはセットが不正です。');const next=structuredClone(draft);if(next.assignments[fileId]===setId)delete next.assignments[fileId];else next.assignments[fileId]=setId;return next;}
export function prepareSubmission(draft,files,{characterId,id,at=new Date().toISOString()}){
 if(!validId(characterId)||!validId(id)||!Array.isArray(draft.sets)||!draft.sets.length||draft.sets.length>20)throw Error('セットを作成してください。');
 const sets=setCounts(draft),setIds=new Set(sets.map(s=>s.id));if(setIds.size!==sets.length||sets.some(s=>!validId(s.id)||!SET_COUNTS.includes(s.target)||!s.name?.trim()||s.name.length>60))throw Error('セット名・目標枚数を確認してください。');
 const selected=sets.filter(s=>s.count>0);if(!selected.length)throw Error('申請用に移動する画像を選んでください。');if(selected.some(s=>s.count!==s.target))throw Error('選択したセットの枚数を目標枚数に合わせてください。');
 const byId=new Map(files.map(f=>[f.id,f]));if(byId.size!==files.length)throw Error('画像IDが重複しています。');
 const entries=Object.entries(draft.assignments).map(([fileId,setId])=>{const f=byId.get(fileId);if(f?.appProperties?.technicalStatus!=='pass')throw Error('技術検品の合格記録がない画像は申請用へ移動できません。');if(!setIds.has(setId)||!f||f.mimeType!=='image/png'||!validId(fileId)||f.parents?.length!==1||!f.size||!f.md5Checksum&&!f.sha256Checksum)throw Error('画像の場所または内容が不明です。再読み込みしてください。');return {fileId,setId,name:f.name,size:String(f.size),md5Checksum:f.md5Checksum||null,sha256Checksum:f.sha256Checksum||null,sourceParent:f.parents[0],version:f.version||null};});
 return {schema:'animal-stickers-submission/v1',id,characterId,at,sets:selected.map(({id,name,target})=>({id,name:name.trim(),target})),entries};
}
export function validateSubmission(operation){
 if(operation?.schema!=='animal-stickers-submission/v1'||!validId(operation.id)||!validId(operation.characterId)||!Array.isArray(operation.sets)||!operation.sets.length||operation.sets.length>20||!Array.isArray(operation.entries))throw Error('移動計画が不正です。');
 const ids=new Set();for(const s of operation.sets){if(!validId(s.id)||ids.has(s.id)||!SET_COUNTS.includes(s.target)||typeof s.name!=='string'||!s.name.trim()||s.name.length>60||operation.entries.filter(e=>e.setId===s.id).length!==s.target)throw Error('セットの枚数・名前が不正です。');ids.add(s.id);}
 const files=new Set();for(const e of operation.entries){if(!validId(e.fileId)||files.has(e.fileId)||!ids.has(e.setId)||!validId(e.sourceParent)||!e.name||!(Number(e.size)>0)||!e.md5Checksum&&!e.sha256Checksum)throw Error('画像の割り当てが不正です。');files.add(e.fileId);}return operation;
}
