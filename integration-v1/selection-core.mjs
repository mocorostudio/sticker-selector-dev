// Image identities belong to attempts, not candidates. Pure rules shared by UI/tests.
export const RATING_FOLDER = Object.freeze({o:'adopt',h:'hold',x:'pending'});
export function planSelection(record, choice, {testReject=false}={}) {
 if(!record) return {action:'ignore',reason:'unregistered'};
 if(!choice || !Object.hasOwn(RATING_FOLDER,choice.rating))return {action:'ignore',reason:'unrated'};
 if(record.imageId!==choice.imageId || (choice.candidate && record.candidate!==choice.candidate))return {action:'error',reason:'image-id mismatch'};
 const destination=choice.rating==='x' ? (testReject?'reject':record.folder||'pending') : RATING_FOLDER[choice.rating];
 if(record.rating===choice.rating && record.folder===destination && record.confirmed===true && (record.comment||'')===(choice.comment||''))return {action:'unchanged',destination};
 return {action:'sync',destination};
}
