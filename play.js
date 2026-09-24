import {load} from './vendor/mgba/mgba.sdk.js';
import {CORE_VERSION,getGame,updateGame,getSave,putSave,encodeSave,decodeSave} from './play-store.js';
const $=id=>document.getElementById(id);
import {installBagTools} from './bag-ui.js';
import {ask} from './confirm-ui.js';
let engine=null,game=null,paused=false,busy=false,saving=null,releaseLock=null,baseline=null,oldJourney=null,lastBatteryHash='',timer;
const pointers=new Map();
function status(text){$('playStatus').textContent=text;}
function fail(error){console.error(error);status(error.message||String(error));}
function activeButtons(enabled){for(const id of ['pauseBtn','saveNow','exportBundle','exportSav','restorePrevious','editSave','speedSelect','backLibrary','exitGame','importQuick','captureCover'])$(id).disabled=!enabled;}
async function guard(fn){if(busy)return;busy=true;try{if(saving)await saving;await fn();}catch(e){fail(e);}finally{busy=false;}}
function releaseInput(){pointers.clear();engine?.releaseButtons();document.querySelectorAll('[data-bit]').forEach(b=>b.classList.remove('pressed'));}
function setPaused(value){if(!engine)return;paused=value;releaseInput();value?engine.pause():engine.resume();$('pauseBtn').textContent=value?'เล่นต่อ':'พักเกม';}
async function stopGame(){
 if(engine){
  setPaused(true);
  if(saving)await saving;
  // Failure leaves the game paused and recoverable; never leave before IDB commits.
  await saveNow(false);
  engine.destroy();engine=null;
 }
 clearInterval(timer);timer=null;releaseLock?.();releaseLock=null;
 game=null;baseline=null;oldJourney=null;lastBatteryHash='';paused=false;
 releaseInput();activeButtons(false);$('screenCover').hidden=false;$('gameName').textContent='GAME BOY ADVANCE';$('fps').textContent='● READY';$('pauseBtn').textContent='พักเกม';$('speedSelect').value='1';$('soulgoldMode').checked=false;
 renderJourney(null);status('บันทึกแล้วและปิดเกมแล้ว • เลือกเกมในคลังเพื่อเล่นต่อ');
 if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}
}
async function lockGame(id){
 if(!navigator.locks)throw Error('เบราว์เซอร์นี้ไม่รองรับการล็อกเซฟ กรุณาใช้ Chrome/Safari/Firefox รุ่นปัจจุบันผ่าน HTTPS หรือ localhost');
 return new Promise((resolve,reject)=>{navigator.locks.request('soulgold-game-'+id,{ifAvailable:true},async lock=>{if(!lock){reject(Error('เกมนี้เปิดอยู่ในอีกแท็บ ปิดแท็บนั้นก่อนเพื่อป้องกันเซฟทับกัน'));return;}await new Promise(release=>resolve(release));}).catch(reject);});
}
async function boot(g){
 if(location.protocol==='file:'||!window.isSecureContext)throw Error('เปิดผ่านเว็บ HTTPS หรือ localhost ก่อนใช้ตัวเล่น');
 if(engine)await stopGame();
 activeButtons(false);status('กำลังเปิด '+g.name+'…');
 releaseLock=await lockGame(g.id);
 try{
  game=g;baseline=null;oldJourney=null;lastBatteryHash='';$('soulgoldMode').checked=!!g.soulgold;$('gameName').textContent=g.title||g.name;
  const local=await getSave(g.id);
  engine=await load({canvasEl:$('gameCanvas'),assets:{rom:new Uint8Array(g.rom)},storageNamespace:g.id,persist:null,options:{system:'gba',volume:+$('volume').value,gamepads:true},onEvent:e=>{if(e.type==='frame')$('fps').textContent=Math.round(e.fps)+' FPS';}});
  if(local){if(local.core!==CORE_VERSION)throw Error('จุดเล่นต่อมาจาก emulator คนละรุ่น กรุณานำเข้า .sav แทน');if(local.battery)engine.loadBatterySave(new Uint8Array(local.battery));await engine.loadState(new Uint8Array(local.state));}
  engine.setSpeed(1);$('speedSelect').value='1';engine.start();paused=false;$('pauseBtn').textContent='พักเกม';$('screenCover').hidden=true;activeButtons(true);
  renderJourney(null);if(local?.battery)await updateJourney(new Uint8Array(local.battery),local.state);
  $('saveStatus').textContent=local?'เล่นต่อจาก '+new Date(local.updatedAt).toLocaleString('th-TH'):'เริ่มเกมใหม่ • จะบันทึกจุดเล่นต่อใน 8 วินาที';
  timer=setInterval(()=>{if(engine&&!paused&&!busy)saveNow(false).catch(fail);},8000);
  game=await updateGame(g.id,{lastPlayed:Date.now()});SG.write('last-game',g.id);
  status('พร้อมเล่น • เซฟจุดเล่นต่ออัตโนมัติในเครื่อง • ใช้เมนู Save ในเกมด้วยเพื่อสร้าง .sav');$('gameCanvas').focus();
 }catch(e){engine?.destroy();engine=null;clearInterval(timer);activeButtons(false);releaseLock?.();releaseLock=null;throw e;}
}
async function saveNow(notify=true){
 if(!engine||!game)return;if(saving)return saving;
 const current=engine,id=game.id,name=game.name;
 saving=(async()=>{
  const statePromise=current.saveState(),battery=current.getBatterySave(),state=await statePromise;
  const record={id,name,core:CORE_VERSION,updatedAt:Date.now(),state,battery};
  await putSave(record);$('saveStatus').textContent='บันทึกในเครื่องแล้ว · '+new Date(record.updatedAt).toLocaleTimeString('th-TH');
  await updateJourney(battery,state);if(notify)SG.toast('บันทึกจุดเล่นต่อแล้ว');return record;
 })();try{return await saving;}finally{saving=null;}
}
function renderJourney(j){
 $('taskList').replaceChildren();$('locationName').textContent=j?j.mapName:'การเดินทางของคุณ';
 $('journeyStatus').textContent=j?(j.mode==='live'?'อ่านจากหน่วยความจำสด':'อ่านจากการบันทึกในเมนูเกม')+' · ตรวจได้ '+j.tasks.length+' เหตุการณ์ ไม่ใช่ทุกภารกิจ':game?.soulgold?'รอเซฟ SoulGold ที่สมบูรณ์ • บันทึกด้วยเมนู Save ในเกมก่อน':'เกมทั่วไป • ไม่ตรวจเนื้อเรื่อง SoulGold';
 $('nextTask').textContent=j?'ลำดับหลักที่ยังไม่พบหลักฐาน: '+j.next:'ภารกิจจะยังไม่ถูกติ๊กจนกว่าจะพบ flag ที่ยืนยันว่าทำแล้ว';
 if(j?.hints?.length){const details=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('ol');title.textContent='ที่นี่ทำอะไรได้บ้าง · คำแนะนำจากคู่มือ';for(const hint of j.hints){const li=document.createElement('li');li.textContent=hint;list.append(li);}const note=document.createElement('p');note.textContent='รายการแนะนำเหล่านี้ยังไม่มีตัวตรวจความสำเร็จ จึงไม่แสดงเช็คพอยต์อัตโนมัติ';details.append(title,list,note);$('nextTask').append(details);}
 if(j)for(const t of j.tasks){const li=document.createElement('li');li.className=t.complete?'done':'';li.textContent=(t.complete?'✓ ':'○ ')+t.label;$('taskList').append(li);}
}
async function updateJourney(battery,state){
 if(!game?.soulgold){renderJourney(null);return;}
 try{
  if(battery){const hash=await SG.hash(battery);if(hash!==lastBatteryHash){baseline=SGJourney.readSave(battery);lastBatteryHash=hash;}}
  if(!baseline)throw Error('รอเซฟในเกม');
  let blocks=baseline,mode='battery';
  if(game.symbols&&state){try{blocks=SGJourney.liveBlocks(new Uint8Array(state),game.symbols,baseline);mode='live';}catch(e){$('journeyStatus').textContent=e.message;}}
  const j={...SGJourney.snapshot(blocks,SG_SOURCE,SG_MAPS,mode),romId:game.id,gameName:game.name};
  if(oldJourney){const fresh=j.tasks.filter(t=>t.complete&&!oldJourney.tasks.find(o=>o.id===t.id)?.complete);if(fresh.length)SG.toast('สำเร็จ: '+fresh.map(t=>t.label).join(' · '));else if(j.mapKey!==oldJourney.mapKey)SG.toast('ถึง '+j.mapName+' · ต่อไป: '+j.next);}
  oldJourney=j;renderJourney(j);SG.write('journey',j);
 }catch(e){$('journeyStatus').textContent='ยังไม่ยืนยันความคืบหน้า: '+e.message;}
}
async function applyRecord(record){setPaused(true);if(saving)await saving;if(record.battery)engine.loadBatterySave(new Uint8Array(record.battery));await engine.loadState(new Uint8Array(record.state));baseline=null;oldJourney=null;lastBatteryHash='';await saveNow(false);status('โหลดจุดเล่นต่อแล้ว กด “เล่นต่อ” เมื่อพร้อม');}
$('pauseBtn').onclick=()=>guard(async()=>{setPaused(!paused);if(paused)await saveNow(false);});
$('saveNow').onclick=()=>guard(()=>saveNow());
$('importQuick').onclick=()=>{if(!busy&&engine)$('saveInput').click();};
$('speedSelect').onchange=e=>{if(!engine)return;try{engine.setSpeed(Number(e.target.value));SG.toast(engine.getSpeed()===1?'ความเร็วปกติ • เปิดเสียงตามระดับเดิม':'เร่ง '+engine.getSpeed()+'× • ปิดเสียงชั่วคราว');$('gameCanvas').focus();}catch(error){e.target.value=String(engine.getSpeed());fail(error);}};
$('backLibrary').onclick=()=>guard(async()=>{await stopGame();location.href='index.html';});
$('exitGame').onclick=()=>guard(async()=>{await stopGame();location.href='index.html';});
document.addEventListener('click',e=>{
 const link=e.target.closest?.('a[href]');if(!engine||!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
 const target=new URL(link.href,location.href);if(target.origin!==location.origin)return;
 if(target.pathname===location.pathname){e.preventDefault();return;}
 e.preventDefault();guard(async()=>{await stopGame();location.href=target.href;});
});
$('fullBtn').onclick=()=>guard(async()=>{const el=document.querySelector('.console');if(document.fullscreenElement)await document.exitFullscreen();else if(el.requestFullscreen)await el.requestFullscreen();else SG.toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ ใช้แนวนอนหรือเพิ่มไปหน้าจอหลัก');});
$('volume').oninput=e=>engine?.config.write('volume',+e.target.value);
document.querySelectorAll('[data-bit]').forEach(button=>{
 button.oncontextmenu=e=>e.preventDefault();
 button.onpointerdown=e=>{if(!engine||paused)return;e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,Number(button.dataset.bit));button.classList.add('pressed');engine.setButtons([...pointers.values()].reduce((m,b)=>m|(1<<b),0));};
 const up=e=>{pointers.delete(e.pointerId);button.classList.remove('pressed');engine?.setButtons([...pointers.values()].reduce((m,b)=>m|(1<<b),0));};button.onpointerup=button.onpointercancel=button.onlostpointercapture=up;
});
$('exportBundle').onclick=()=>guard(async()=>{setPaused(true);const r=await saveNow(false);SG.download(game.name+'.sgsave',JSON.stringify(encodeSave(r)),'application/json');});
$('exportSav').onclick=()=>guard(async()=>{const r=await saveNow(false);if(!r.battery)throw Error('ยังไม่มี battery save ให้ใช้เมนู Save ในเกมก่อน');SG.download(game.name.replace(/\.gba$/i,'')+'.sav',r.battery);});
$('saveInput').onchange=e=>guard(async()=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;if(!engine)throw Error('เปิดเกมที่ต้องการนำเข้าเซฟก่อน');if(f.size>1100000)throw Error('ไฟล์เซฟใหญ่เกินขอบเขต');
 if(!await ask('แทนที่จุดเล่นปัจจุบันด้วยไฟล์นี้? ระบบเก็บเซฟก่อนหน้าไว้ แต่แนะนำให้สำรองด้วย'))return;
 setPaused(true);await saveNow(false);
 if(/\.sgsave$/i.test(f.name)){const record=decodeSave(JSON.parse(await f.text()),game.id);await applyRecord(record);}
 else{const battery=new Uint8Array(await f.arrayBuffer());if(game.soulgold)SGJourney.readSave(battery);engine.loadBatterySave(battery);engine.reset();baseline=null;oldJourney=null;lastBatteryHash='';await saveNow(false);status('นำเข้า .sav แล้ว กดเล่นต่อและเลือก Continue ในเกม');}
});
$('restorePrevious').onclick=()=>guard(async()=>{const r=await getSave(game.id);if(!r?.previous)throw Error('ยังไม่มีเซฟก่อนหน้า');if(!await ask('ย้อนกลับไปเซฟก่อนหน้า?'))return;await applyRecord(r.previous);});
$('soulgoldMode').onchange=e=>guard(async()=>{if(!game){e.target.checked=false;throw Error('เปิดเกมก่อน');}game=await updateGame(game.id,{soulgold:e.target.checked});oldJourney=null;await updateJourney(engine.getBatterySave(),await engine.saveState());});
$('symbolsInput').onchange=e=>guard(async()=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(!game?.soulgold)throw Error('เปิดเกม SoulGold และยืนยันรุ่นก่อน');if(f.size>8*1048576)throw Error('Symbol file ใหญ่เกินไป');const symbols=SGJourney.parseSymbols(await f.text());if(!await ask('ยืนยันว่า symbol นี้ build มาจาก ROM ไฟล์เดียวกัน? ใช้ไฟล์คนละรุ่นอาจอ่านค่าผิด'))return;game=await updateGame(game.id,{symbols});await updateJourney(engine.getBatterySave(),await engine.saveState());});
$('clearSymbols').onclick=()=>guard(async()=>{if(!game)return;game=await updateGame(game.id,{symbols:null});SG.toast('ปิดตัวอ่านสดแล้ว');});
window.addEventListener('blur',releaseInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine){setPaused(true);saveNow(false).catch(fail);}});
window.addEventListener('pagehide',()=>{releaseInput();if(engine){engine.pause();saveNow(false).catch(()=>{});}});
window.addEventListener('beforeunload',e=>{if(saving){e.preventDefault();e.returnValue='';}});
// Live checks use the same read-only adapter. No disk or cloud writes each tick.
setInterval(()=>{if(engine&&!paused&&game?.soulgold&&game.symbols&&!saving&&!busy)engine.saveState().then(s=>updateJourney(null,s)).catch(()=>{});},2000);

function resumeAfterTools(){
 if(!engine||document.hidden)return false;
 setPaused(false);$('gameCanvas').focus({preventScroll:true});return true;
}
const bagTools=installBagTools({context:()=>({engine,game}),pause:()=>setPaused(true),resume:resumeAfterTools,save:()=>saveNow(false),restore:applyRecord,guard,status,resetJourney:()=>{baseline=null;oldJourney=null;lastBatteryHash='';}});
$('editSave').onclick=()=>guard(()=>bagTools.open());
$('captureCover').onclick=()=>guard(async()=>{if(!engine||!game)return;const blob=await engine.screenshot();const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});game=await updateGame(game.id,{cover:data});SG.toast('เก็บภาพนี้เป็นปกในคลังแล้ว');});
await guard(async()=>{
 const params=new URLSearchParams(location.search),id=params.get('game')||SG.read('last-game');
 if(!id){status('เลือกเกมจากคลัง แล้วระบบจะเปิดเกมให้โดยอัตโนมัติ');return;}
 if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('ลิงก์เกมไม่ถูกต้อง กลับไปเลือกจากคลัง');
 const g=await getGame(id);if(!g)throw Error('ไม่พบ ROM ในเบราว์เซอร์เครื่องนี้ กรุณาเพิ่มเกมในคลังก่อน');
 await boot(g);if(params.get('bag')==='1')await bagTools.open();
});
