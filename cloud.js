import {CLOUD_URL,CLOUD_KEY} from './cloud-config.js';
import {getGame,putGame,updateGame,getSave,putSave,acknowledgeCloud,encodeSave,decodeSave,toBase64,fromBase64} from './play-store.js';
import {syncDecision,safeMetadata} from './cloud-core.js';
export const client=window.supabase.createClient(CLOUD_URL,CLOUD_KEY,{auth:{storage:sessionStorage,storageKey:'sg-cloud-session-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},global:{fetch:(url,opts={})=>fetch(url,{...opts,signal:opts.signal||AbortSignal.timeout(25000)})}});
let current=null;
function sameOwner(owner){if(current?.id!==owner)throw Error('บัญชีเปลี่ยนระหว่างซิงค์ กรุณาลองใหม่');}
export const ready=client.auth.getSession().then(({data})=>{current=data.session?.user||null;return current;});
client.auth.onAuthStateChange((_event,session)=>{current=session?.user||null;setTimeout(()=>window.dispatchEvent(new Event('sg-cloud-auth')),0);});
export const user=()=>current;
export function requireOwner(g){if(g.cloudOwner&&g.cloudOwner!==current?.id)throw Error('กรุณาล็อกอินบัญชีเจ้าของเกมนี้ก่อน หรือใช้โปรไฟล์เบราว์เซอร์แยกสำหรับอีกบัญชี');}
function check(result){if(result.error){if(result.error.code==='40001'||result.error.message?.includes('SAVE_CONFLICT'))throw Error('เซฟ Cloud เปลี่ยนจากอีกเครื่องแล้ว ยังไม่อัปโหลดทับ • เลือกดึง Cloud หรือเก็บเซฟเครื่องนี้เป็นไฟล์ก่อน');throw Error(result.error.message||'เชื่อม Cloud ไม่สำเร็จ');}return result.data;}
export async function login(email,password){const data=check(await client.auth.signInWithPassword({email,password}));current=data.user;return current;}
export async function logout(){check(await client.auth.signOut({scope:'local'}));current=null;}
export async function listCloud(){await ready;if(!current)return [];return check(await client.from('sg_cloud_saves').select('game_id,revision,metadata,updated_at').order('updated_at',{ascending:false}));}
async function row(id){if(!current)throw Error('เข้าสู่ระบบ Cloud ก่อน');return check(await client.from('sg_cloud_saves').select('*').eq('game_id',id).maybeSingle());}
async function pack(save){if(!save)return null;const input=new Blob([JSON.stringify(encodeSave(save))]);const bytes=new Uint8Array(await new Response(input.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());return toBase64(bytes);}
async function unpack(payload,id){if(!payload)return null;if(typeof payload!=='string'||payload.length>900000)throw Error('ข้อมูล Cloud ใหญ่เกินขอบเขต');const stream=new Blob([fromBase64(payload)]).stream().pipeThrough(new DecompressionStream('gzip')),reader=stream.getReader(),chunks=[];let total=0;try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>1100000)throw Error('ข้อมูล Cloud หลังขยายใหญ่เกินขอบเขต');chunks.push(value);}}finally{await reader.cancel();}return decodeSave(JSON.parse(await new Blob(chunks).text()),id);}
async function adoptRemote(g,remote,owner){
 const save=await unpack(remote.payload,g.id);
 sameOwner(owner);
 if(save){await putSave(save);const written=await getSave(g.id);await acknowledgeCloud(g.id,owner,remote.revision,written.localVersion);}
 await updateGame(g.id,{cloudOwner:owner,cloudRevision:remote.revision,cloudRom:!!remote.metadata?.hasRom});
 window.dispatchEvent(new Event('sg-cloud-data'));return save;
}
function exclusive(id,fn){return navigator.locks.request('sg-cloud-sync-'+id,fn);}
export async function pushGame(id,options={}){return exclusive(id,()=>pushUnlocked(id,options));}
async function pushUnlocked(id,{includeRom=false,adopt=false}={}){
 await ready;if(!current)throw Error('เข้าสู่ระบบ Cloud ก่อน');const owner=current.id;
 const g=await getGame(id);if(!g)throw Error('ไม่พบเกมในเครื่อง');requireOwner(g);if(!g.cloudOwner&&!adopt)throw Error('เกมนี้ยังไม่เปิด Cloud • เชื่อมจากหน้าคลังเกมก่อน');
 const save=await getSave(id),remote=await row(id),decision=syncDecision(save,remote,owner,g.cloudRevision||0);
 if(decision==='conflict'||decision==='pull')throw Error('มีเซฟบน Cloud ที่ใหม่กว่าหรือยังไม่เคยเชื่อม • เลือกดึง Cloud ก่อน ไม่อัปโหลดทับให้อัตโนมัติ');
 let hasRom=!!remote?.metadata?.hasRom;
 if(includeRom&&!hasRom){const upload=await client.storage.from('sg-private-roms').upload(owner+'/'+id+'.gba',new Blob([g.rom],{type:'application/octet-stream'}),{contentType:'application/octet-stream',upsert:false});if(upload.error&&String(upload.error.statusCode)!=='409')check(upload);hasRom=true;}
 const metadata=safeMetadata({...g,romBytes:g.rom.byteLength,hasRom});
 sameOwner(owner);
 if(decision==='same'&&JSON.stringify(metadata)===JSON.stringify(safeMetadata(remote?.metadata)))return remote.revision;
 const payload=await pack(save),operation=crypto.randomUUID();
 sameOwner(owner);
 const args={p_game_id:id,p_expected:remote?.revision||0,p_payload:payload,p_metadata:metadata,p_operation:operation};
 let result=await client.rpc('sg_commit_save',args);
 // One idempotent retry for an uncertain network result; CAS still protects newer writes.
 if(result.error&&!result.error.code&&current?.id===owner)result=await client.rpc('sg_commit_save',args);
 const revision=check(result);
 await updateGame(id,{cloudOwner:owner,cloudRevision:revision,cloudRom:hasRom});
 if(save)await acknowledgeCloud(id,owner,revision,save.localVersion);
 window.dispatchEvent(new Event('sg-cloud-data'));return revision;
}
export async function prepareGame(g){
 await ready;requireOwner(g);if(!g.cloudOwner)return g;
 return exclusive(g.id,async()=>{
 const owner=current?.id;sameOwner(owner);g=await getGame(g.id);requireOwner(g);
 const remote=await row(g.id),local=await getSave(g.id),decision=syncDecision(local,remote,owner,g.cloudRevision||0);
 if(decision==='conflict')throw Error('เซฟสองเครื่องต่างกัน • กลับคลังเกมแล้วเลือกดึงเซฟ Cloud หรือสำรองเซฟเครื่องนี้ก่อน');
 if(decision==='pull'&&remote)await adoptRemote(g,remote,owner);
 if(decision==='push')await pushUnlocked(g.id);
 return await getGame(g.id);
 });
}
export async function restoreGame(id,{replace=false}={}){
 await ready;if(!current)throw Error('เข้าสู่ระบบก่อน');
 return navigator.locks.request('soulgold-game-'+id,{ifAvailable:true},async lock=>{
 if(!lock)throw Error('เกมเปิดอยู่อีกแท็บ กรุณาบันทึกและออกก่อนดึง Cloud');
 return exclusive(id,async()=>{
 const owner=current?.id;if(!owner)throw Error('เข้าสู่ระบบก่อน');
 const remote=await row(id);if(!remote)throw Error('ไม่มีเกมนี้บน Cloud');let g=await getGame(id);if(g)requireOwner(g);
 const local=await getSave(id);if(local&&!replace)throw Error('เครื่องนี้มีเซฟอยู่แล้ว ต้องยืนยันก่อนแทนที่');
 if(!g){if(!remote.metadata?.hasRom)throw Error('Cloud มีเฉพาะเซฟ • เพิ่มไฟล์ .gba เดิมในเครื่องนี้ก่อน แล้วดึง Cloud อีกครั้ง');
 const blob=check(await client.storage.from('sg-private-roms').download(owner+'/'+id+'.gba'));const rom=await blob.arrayBuffer();if(rom.byteLength>33554432||await SG.hash(new Uint8Array(rom))!==id)throw Error('ไฟล์เกม Cloud ไม่ตรงรหัสตรวจสอบ');
 sameOwner(owner);g={...safeMetadata(remote.metadata),id,rom,createdAt:Date.now(),symbols:null,cloudOwner:owner};await putGame(g);}
 if(local)SG.download(g.name+'.before-cloud.sgsave',JSON.stringify(encodeSave(local)),'application/json');
 await adoptRemote(g,remote,owner);return await getGame(id);
 });
 });
}
export async function downloadLocalSave(id){const g=await getGame(id);if(g)requireOwner(g);const save=await getSave(id);if(!save)throw Error('ยังไม่มีเซฟในเครื่อง');SG.download(save.name+'.sgsave',JSON.stringify(encodeSave(save)),'application/json');}
