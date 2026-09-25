/* IndexedDB writes resolve on transaction completion, not request success. */
export const CORE_VERSION='mgba-wasm-0.1.1-sg1';
let database;
export function openStore(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('soulgold-play-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('games',{keyPath:'id'});r.result.createObjectStore('saves',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>{database=null;reject(r.error);};r.onblocked=()=>{database=null;reject(Error('กรุณาปิดหน้าเล่นเก่า แล้วเปิดใหม่'));};});}
async function transaction(store,mode,action){const db=await openStore();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let value;try{const req=action(tx.objectStore(store));req.onsuccess=()=>value=req.result;}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('บันทึกถูกยกเลิก'));});}
export const getGame=id=>transaction('games','readonly',s=>s.get(id));
export const games=()=>transaction('games','readonly',s=>s.getAll());
export const putGame=game=>transaction('games','readwrite',s=>s.put(game));
// Merge metadata inside one transaction so another tab cannot replace ROM or newer metadata.
export async function updateGame(id,patch){
 const allowed=['title','cover','favorite','lastPlayed','soulgold','symbols','cloudOwner','cloudRevision','cloudRom'];
 if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error('Invalid game metadata');
 const db=await openStore();return new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite'),s=tx.objectStore('games');let result;const r=s.get(id);r.onsuccess=()=>{if(!r.result){tx.abort();return;}result={...r.result,...patch};s.put(result);};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('ไม่พบเกมในคลัง'));});
}
export const getSave=id=>transaction('saves','readonly',s=>s.get(id));
export async function putSave(save){
 const db=await openStore();return new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves');const req=store.get(save.id);req.onsuccess=()=>{const old=req.result;store.put({...save,localVersion:crypto.randomUUID(),cloud:save.cloud??old?.cloud??null,toolBackup:save.toolBackup??old?.toolBackup??null,previous:old?{...old,previous:undefined,toolBackup:undefined}:null});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('บันทึกไม่สำเร็จ'));});
}
export async function acknowledgeCloud(id,user,revision,version){
 const db=await openStore();return new Promise((resolve,reject)=>{const tx=db.transaction('saves','readwrite'),s=tx.objectStore('saves'),r=s.get(id);r.onsuccess=()=>{if(r.result)s.put({...r.result,cloud:{user,revision,syncedVersion:version}});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Cloud acknowledgement failed'));});
}
export const markSynced=save=>transaction('saves','readwrite',s=>s.put(save));
export function toBase64(bytes){if(!bytes)return null;let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function fromBase64(s){return s?Uint8Array.from(atob(s),c=>c.charCodeAt(0)):null;}
export const encodeSave=save=>({schema:1,id:save.id,core:save.core,name:save.name,updatedAt:save.updatedAt,state:toBase64(save.state),battery:toBase64(save.battery)});
export function decodeSave(data,id){
 if(data?.schema!==1||data.id!==id||data.core!==CORE_VERSION||typeof data.state!=='string'||data.state.length>800000||data.battery&&(![684,10924,43692,87384,174764].includes(data.battery.length)))throw Error('ชุดเซฟไม่ตรงเกม / รุ่น emulator / ขนาด');
 const state=fromBase64(data.state),battery=fromBase64(data.battery);if(state.length!==0x61000)throw Error('ขนาดจุดเล่นต่อไม่ถูกต้อง');
 return {id,core:data.core,name:String(data.name||'Game').slice(0,200),updatedAt:Number(data.updatedAt)||Date.now(),state,battery};
}
