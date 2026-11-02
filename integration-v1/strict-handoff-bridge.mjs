import {buildNineCellManifestFromDrive} from './explicit-nine-manifest.mjs';
export async function prepareNineCellHandoff({pending,characterId,entries,assignments}){
 if(typeof pending?.masterForCharacter!=='function')throw Error('実Drive接続が必要です');
 const current=await pending.masterForCharacter(characterId);
 if(current?.characterId!==characterId||!current?.modifiedTime)throw Error('対象キャラの最新マスター情報がありません');
 const manifest=await buildNineCellManifestFromDrive({
  drive:{masterForCharacter:async()=>current},characterId,entries,assignments
 });
 return {master:current.master,manifest};
}
