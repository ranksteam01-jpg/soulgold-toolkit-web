export function syncDecision(local,remote,owner,baseRevision=0){
 if(local?.cloud?.user&&local.cloud.user!==owner)throw Error('เซฟในเครื่องเป็นของอีกบัญชี');
 const base=local?.cloud?.revision??baseRevision;
 const dirty=!!local&&(!local.cloud||!local.localVersion||local.localVersion!==local.cloud.syncedVersion);
 if(!remote)return base===0?'push':'conflict';
 if(remote.revision===base)return dirty?'push':'same';
 return dirty?'conflict':'pull';
}
export function safeMetadata(m={}){
 return {name:String(m.name||'Game.gba').slice(0,200),title:String(m.title||m.name||'Game').slice(0,80),
 cover:typeof m.cover==='string'&&m.cover.length<=350000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(m.cover)?m.cover:null,
 favorite:!!m.favorite,soulgold:!!m.soulgold,lastPlayed:Number(m.lastPlayed)||0,romBytes:Math.min(33554432,Math.max(0,Number(m.romBytes)||0)),hasRom:!!m.hasRom};
}
