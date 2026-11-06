// Product membership is separate from preferences and technical approval.
// All fields are additive; legacy one-product drafts keep their existing key.
export function productFiles(draft, files, setId, scope = 'all') {
  if (scope === 'unused') return files.filter(f => !draft.assignments[f.id] && !f.fromHold);
  if (scope === 'current') return files.filter(f => draft.assignments[f.id] === setId);
  return files;
}

export function productDraft(draft, setId) {
  if (draft.sets.length <= 1) return draft;
  if (!draft.sets.some(s => s.id === setId)) throw Error('保存する商品を選んでください。');
  const next = structuredClone(draft);
  delete next.productSaves;
  next.sets = next.sets.filter(s => s.id === setId);
  next.assignments = Object.fromEntries(Object.entries(next.assignments).filter(([, id]) => id === setId));
  return next;
}

// Retain exact image IDs explicitly added by the user; never infer a pass or
// replace an assigned older attempt with a newer image for the same candidate.
export function additionalCircles(items, current, characterId) {
  const ids = new Set(current.map(f => f.id));
  const candidates = new Set(current.map(f => f.candidateId).filter(Boolean));
  const added = [];
  for (const item of items) {
    const character = item.characterId || item.crop?.pendingDrive?.characterId;
    if (character !== characterId || item.origin !== 'crop-local' || !item.touched || item.rating !== 'o' || !item.imageId || ids.has(item.imageId)) continue;
    if (item.candidate && candidates.has(item.candidate)) continue;
    ids.add(item.imageId);
    if (item.candidate) candidates.add(item.candidate);
    added.push(item);
  }
  return added;
}

export function retainedProductItems(current, items, draft, characterId) {
  const belongs = x => (x.characterId || x.crop?.pendingDrive?.characterId) === characterId;
  const retained = new Set(draft.retainedCandidateIds || []);
  const available = [...current.filter(belongs), ...items.filter(x => belongs(x) && retained.has(x.imageId))];
  const chosen = new Map();
  // In-use versions win over a different attempt currently visible in step ②.
  for (const item of [...available.filter(x => draft.assignments[x.imageId]), ...available]) {
    const identity = item.candidate ? 'candidate:' + item.candidate : 'image:' + item.imageId;
    if (!chosen.has(identity)) chosen.set(identity, item);
  }
  return [...chosen.values()];
}

export function recordProductSave(draft, plan, result, snapshot) {
  const previous = draft.productSaves || [];
  if (previous.some(s => s.operationId === plan.id)) return draft;
  const next = structuredClone(draft);
  next.productSaves = [...previous, {
    operationId: plan.id, characterId: plan.characterId, at: new Date().toISOString(),
    sets: structuredClone(plan.sets), entries: structuredClone(plan.entries),
    snapshot: structuredClone(snapshot), archives: structuredClone(result.archives || []),
    status: 'archive-saved', // A saved archive is not a submitted/approved product.
  }];
  return next;
}
