// Read-only handoff validation. Never infers a technical approval from a crop.
const id = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(s);
const sha = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
export function validateCandidateManifest(manifest, master, records) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || !Array.isArray(master) || !Array.isArray(records)) throw Error('manifest形式不正');
  const errors=[], usedImages=new Set(), usedSlots=new Set(), usedFiles=new Set();
  const lookup=new Map(master.map(m=>[m.candidateId,m]));
  if (lookup.size!==master.length) errors.push({imageId:'',reasons:['マスター候補ID重複']});
  const images=new Map(records.map(r=>[r.imageId,r]));
  if (images.size!==records.length) errors.push({imageId:'',reasons:['実画像ID重複']});
  for (const e of manifest.entries) {
    const reasons=[], key=`${e?.batchId}:${e?.slot}`;
    const m=lookup.get(e?.candidateId), r=images.get(e?.imageId);
    if (!id(e?.imageId)||!id(e?.candidateId)||!id(e?.batchId)||!Number.isInteger(e?.slot)||e.slot<1||e.slot>9) reasons.push('ID・スロット不正');
    if (usedImages.has(e?.imageId)||usedSlots.has(key)||usedFiles.has(e?.filename)) reasons.push('重複');
    usedImages.add(e?.imageId);usedSlots.add(key);usedFiles.add(e?.filename);
    if (!m||m.phrase!==e?.phrase||m.pose!==e?.pose) reasons.push('最新マスター不一致');
    if (!r||r.candidateId!==e?.candidateId||r.imageId!==e?.imageId||r.phrase!==e?.phrase||r.pose!==e?.pose||r.filename!==e?.filename) reasons.push('実画像記録不一致');
    if (!sha(e?.pngSha256)||r?.pngSha256!==e?.pngSha256) reasons.push('PNGハッシュ未照合');
    if (r?.qa?.automatic!=='pass'||r?.inspection?.visualPassed!==true||r?.inspection?.phraseVerified!==true||r?.inspection?.anatomyVerified!==true||r?.inspection?.styleVerified!==true||r?.inspection?.alphaVerified!==true||r?.inspection?.scope!=='actual-source') reasons.push('技術検品未完了');
    if (r?.technicalStatus!=='pass') reasons.push('技術合格なし');
    if (reasons.length) errors.push({imageId:e?.imageId||'',reasons});
  }
  if (manifest.entries.length !== records.length) errors.push({imageId:'',reasons:['登録件数不一致']});
  return {ok:errors.length===0,ready:errors.length===0?manifest.entries.map(e=>e.imageId):[],errors};
}
