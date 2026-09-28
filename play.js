import {load} from './vendor/mgba/mgba.sdk.js';
import {CORE_VERSION,getGame,updateGame,getSave,putSave,encodeSave,decodeSave} from './play-store.js';
const $=id=>document.getElementById(id);
import {installBagTools} from './bag-ui.js';
import {ask} from './confirm-ui.js';
import * as cloud from './cloud.js';
import './type-chart.js';
let cloudTimer;
const cloudIndicator=document.createElement('p');cloudIndicator.className='cloud-indicator';document.querySelector('.journey-side .play-card').prepend(cloudIndicator);
async function syncCloudNow(){if(!game?.cloudOwner)return;cloudIndicator.textContent='กำลังส่งเซฟขึ้น Cloud…';try{await cloud.pushGame(game.id);cloudIndicator.textContent='✓ ซิงค์ Cloud แล้ว · '+new Date().toLocaleTimeString('th-TH');}catch(e){cloudIndicator.textContent='ยังไม่ซิงค์ • '+e.message;throw e;}}
let engine=null,game=null,paused=false,busy=false,saving=null,releaseLock=null,baseline=null,oldJourney=null,lastBatteryHash='',timer;
const pointers=new Map();
function inputMask(){let mask=0;for(const bit of pointers.values())mask|=1<<bit;return mask;}
function syncInput(){if(engine)engine.setButtons(inputMask());updateInputDebug();}
function releasePointer(pointerId){if(!pointers.has(pointerId))return;const bit=pointers.get(pointerId);pointers.delete(pointerId);const stillPressed=[...pointers.values()].includes(bit);document.querySelectorAll(`[data-bit="${bit}"]`).forEach(button=>button.classList.toggle('pressed',stillPressed));syncInput();}
function status(text){$('playStatus').textContent=text;}
function fail(error){console.error(error);const message=error.message||String(error);status(message);SG.toast(message);}
function activeButtons(enabled){for(const id of ['pauseBtn','saveNow','exportBundle','exportSav','restorePrevious','editSave','speedSelect','backLibrary','exitGame','importQuick','captureCover'])$(id).disabled=!enabled; $('editSave').hidden=!enabled||!game?.soulgold;}
activeButtons(false);
async function guard(fn){if(busy)return;busy=true;try{if(saving)await saving;await fn();}catch(e){fail(e);}finally{busy=false;}}
function releaseInput(){pointers.clear();engine?.releaseButtons();document.querySelectorAll('[data-bit]').forEach(b=>b.classList.remove('pressed'));updateInputDebug();}
function setPaused(value){if(!engine)return;if(!value)cloud.requireOwner(game);paused=value;releaseInput();value?engine.pause():engine.resume();$('pauseBtn').textContent=value?'เล่นต่อ':'พักเกม';}
async function stopGame(){
 if(engine){
  setPaused(true);
  if(saving)await saving;
  // Failure leaves the game paused and recoverable; never leave before IDB commits.
  await saveNow(false);
  try{await syncCloudNow();}catch(e){if(!await ask('เซฟอยู่ในเครื่องแล้ว แต่ Cloud ยังไม่สำเร็จ: '+e.message+' • ออกจากเกมโดยเก็บเซฟไว้ในเครื่องก่อนหรือไม่? อย่าเพิ่งสลับไปเล่นอีกเครื่อง'))throw e;}
  engine.destroy();engine=null;document.body.classList.remove('game-loaded');focusMode(false);
 }
 clearInterval(timer);clearInterval(cloudTimer);timer=null;releaseLock?.();releaseLock=null;
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
  await cloud.ready;cloud.requireOwner(g);
  try{g=await cloud.prepareGame(g);}catch(e){if(!await ask('ตรวจเซฟ Cloud ไม่สำเร็จ: '+e.message+' • เล่นต่อจากเซฟในเครื่องแบบออฟไลน์หรือไม่? อาจไม่ใช่เซฟล่าสุด'))throw e;}
  game=g;baseline=null;oldJourney=null;lastBatteryHash='';$('soulgoldMode').checked=!!g.soulgold;$('gameName').textContent=g.title||g.name;
  const local=await getSave(g.id);
  engine=await load({canvasEl:$('gameCanvas'),assets:{rom:new Uint8Array(g.rom)},storageNamespace:g.id,persist:null,options:{system:'gba',volume:+$('volume').value,gamepads:true},onEvent:e=>{if(e.type==='frame')$('fps').textContent=Math.round(e.fps)+' FPS';}});
  if(local){if(local.core!==CORE_VERSION)throw Error('จุดเล่นต่อมาจาก emulator คนละรุ่น กรุณานำเข้า .sav แทน');if(local.battery)engine.loadBatterySave(new Uint8Array(local.battery));await engine.loadState(new Uint8Array(local.state));}
  engine.setSpeed(1);engine.setFastAudio($('fastAudio').checked);$('speedSelect').value='1';engine.start();paused=false;$('pauseBtn').textContent='พักเกม';$('screenCover').hidden=true;activeButtons(true);document.body.classList.add('game-loaded');
  renderJourney(null);if(local?.battery)await updateJourney(new Uint8Array(local.battery),local.state);
  $('saveStatus').textContent=local?'เล่นต่อจาก '+new Date(local.updatedAt).toLocaleString('th-TH'):'เริ่มเกมใหม่ • จะบันทึกจุดเล่นต่อใน 8 วินาที';
  timer=setInterval(()=>{if(engine&&!paused&&!busy)saveNow(false).catch(fail);},8000);
  cloudIndicator.textContent=g.cloudOwner?'เชื่อม Cloud • ส่งเซฟทุก 60 วินาทีและตอนบันทึกออก':'ยังไม่เชื่อมเกมนี้กับ Cloud • เปิดบัญชีที่หน้าคลังเกม';
  cloudTimer=setInterval(()=>{if(engine&&game?.cloudOwner&&!busy)syncCloudNow().catch(()=>{});},60000);
  game=await updateGame(g.id,{lastPlayed:Date.now()});SG.write('last-game',g.id);
  status('พร้อมเล่น • เซฟจุดเล่นต่ออัตโนมัติในเครื่อง • ใช้เมนู Save ในเกมด้วยเพื่อสร้าง .sav');$('gameCanvas').focus({preventScroll:true});
 }catch(e){engine?.destroy();engine=null;clearInterval(timer);clearInterval(cloudTimer);activeButtons(false);releaseLock?.();releaseLock=null;throw e;}
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
 if(j?.hints?.length){const details=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('ol');details.open=true;title.textContent='ที่นี่ทำอะไรได้บ้าง · คำแนะนำจากคู่มือ';for(const hint of j.hints){const li=document.createElement('li');li.textContent=hint;list.append(li);}const note=document.createElement('p');note.textContent='รายการแนะนำเหล่านี้ยังไม่มีตัวตรวจความสำเร็จ จึงไม่แสดงเช็คพอยต์อัตโนมัติ';details.append(title,list,note);$('nextTask').append(details);}
 if(j)for(const t of j.tasks){const li=document.createElement('li');li.className=t.complete?'done':'';li.textContent=(t.complete?'✓ ':'○ ')+t.label;$('taskList').append(li);}
}
async function updateJourney(battery,state){
 if(!game?.soulgold){renderJourney(null);return;}
 try{
  if(battery){const hash=await SG.hash(battery);if(hash!==lastBatteryHash){baseline=SGJourney.readSave(battery);lastBatteryHash=hash;}}
  if(!baseline)throw Error('รอเซฟในเกม');
  let blocks=baseline,mode='battery',liveWarning='';
  if(game.symbols&&state){try{blocks=SGJourney.liveBlocks(new Uint8Array(state),game.symbols,baseline);mode='live';}catch(e){liveWarning=' · อ่านสดไม่ได้: '+e.message+' — แสดงเซฟในเกมล่าสุดแทน';}}
  const j={...SGJourney.snapshot(blocks,SG_SOURCE,SG_MAPS,mode),romId:game.id,gameName:game.name};
  if(oldJourney){const fresh=j.tasks.filter(t=>t.complete&&!oldJourney.tasks.find(o=>o.id===t.id)?.complete);if(fresh.length)SG.toast('สำเร็จ: '+fresh.map(t=>t.label).join(' · '));else if(j.mapKey!==oldJourney.mapKey)SG.toast('ถึง '+j.mapName+' · ต่อไป: '+j.next);}
  oldJourney=j;renderJourney(j);$('journeyStatus').textContent+=liveWarning;SG.write('journey',j);
 }catch(e){baseline=null;oldJourney=null;lastBatteryHash='';renderJourney(null);$('journeyStatus').textContent='ยังไม่ยืนยันความคืบหน้า: '+e.message;}
}
async function applyRecord(record){setPaused(true);if(saving)await saving;if(record.battery)engine.loadBatterySave(new Uint8Array(record.battery));await engine.loadState(new Uint8Array(record.state));baseline=null;oldJourney=null;lastBatteryHash='';await saveNow(false);status('โหลดจุดเล่นต่อแล้ว กด “เล่นต่อ” เมื่อพร้อม');}
$('pauseBtn').onclick=()=>guard(async()=>{setPaused(!paused);if(paused)await saveNow(false);});
$('saveNow').onclick=()=>guard(async()=>{await saveNow();await syncCloudNow();});
$('importQuick').onclick=()=>{if(!busy&&engine)$('saveInput').click();};
$('speedSelect').onchange=e=>{if(!engine)return;try{engine.setSpeed(Number(e.target.value));SG.toast(engine.getSpeed()===1?'ความเร็วปกติ':'เร่ง '+engine.getSpeed()+'× • '+($('fastAudio').checked?'เปิดเสียง':'ปิดเสียง'));$('gameCanvas').focus({preventScroll:true});}catch(error){e.target.value=String(engine.getSpeed());fail(error);}};
$('fastAudio').checked=SG.read('fast-audio',false)===true;
$('fastAudio').onchange=e=>{engine?.setFastAudio(e.target.checked);SG.write('fast-audio',e.target.checked);};
$('settingsBtn').onclick=()=>{const open=$('playSettings').hidden;$('playSettings').hidden=!open;$('settingsBtn').setAttribute('aria-expanded',String(open));};
$('backLibrary').onclick=()=>guard(async()=>{await stopGame();location.href='index.html';});
$('exitGame').onclick=()=>guard(async()=>{await stopGame();location.href='index.html';});
document.addEventListener('click',e=>{
 const link=e.target.closest?.('a[href]');if(!engine||!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
 const target=new URL(link.href,location.href);if(target.origin!==location.origin)return;
 if(target.pathname===location.pathname){e.preventDefault();return;}
 e.preventDefault();guard(async()=>{await stopGame();location.href=target.href;});
});
const PLAY_STATES=Object.freeze({
 IDLE:'IDLE',ENTER_PREP:'ENTER_PREP',DEVICE_CLOSED:'DEVICE_CLOSED',DEVICE_OPENING:'DEVICE_OPENING',DEVICE_POWERING:'DEVICE_POWERING',DEVICE_MERGING:'DEVICE_MERGING',PLAY_ACTIVE:'PLAY_ACTIVE',EXITING:'EXITING'
});
let focusScrollY=0,viewportFrame=0,nativeFullscreenOwned=false,nativeFullscreenTarget=null,playState=PLAY_STATES.IDLE,transitionEpoch=0;
let heroRaf=0,heroResolve=null,heroRunning=false,pendingViewportRefresh=false,lastHeroPerf=null;
const mobilePlayQuery=matchMedia('(max-width: 950px) and (hover: none) and (pointer: coarse)');
const reduceMotionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const orientationQuery=matchMedia('(orientation: landscape)');
const queryParams=new URLSearchParams(location.search);
const inputDebugEnabled=queryParams.get('inputDebug')==='1';
const perfDebugEnabled=queryParams.get('perfDebug')==='1';
let inputDebugEl=null,perfDebugEl=null;
function isMobileHandheld(){return mobilePlayQuery.matches;}
function isPlayTransitioning(){return ![PLAY_STATES.IDLE,PLAY_STATES.PLAY_ACTIVE].includes(playState);}
function gameplayInputBlocked(){return isPlayTransitioning();}
function setPlayState(next){
 if(playState===next)return;
 playState=next;document.body.dataset.playState=next;updateInputDebug();updatePerfDebug();
}
function updatePlayerViewport(){
 const viewport=window.visualViewport;
 const height=Math.round(viewport?.height||window.innerHeight),width=Math.round(viewport?.width||window.innerWidth);
 const top=Math.round(viewport?.offsetTop||0),left=Math.round(viewport?.offsetLeft||0);
 document.documentElement.style.setProperty('--player-height',height+'px');
 document.documentElement.style.setProperty('--player-width',width+'px');
 document.documentElement.style.setProperty('--player-top',top+'px');
 document.documentElement.style.setProperty('--player-left',left+'px');
 document.documentElement.style.setProperty('--player-center-x',(left+width/2)+'px');
 document.documentElement.style.setProperty('--player-center-y',(top+height/2)+'px');
 updateInputDebug();updatePerfDebug();
}
function queuePlayerViewport(){
 if(heroRunning){pendingViewportRefresh=true;return;}
 cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(updatePlayerViewport);
}
function fullscreenTarget(){return !isMobileHandheld()&&matchMedia('(min-width: 921px)').matches?document.querySelector('.play-layout'):document.querySelector('.console');}
function nextFrame(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
function runAnimation(element,keyframes,options){
 if(!element||reduceMotionQuery.matches)return Promise.resolve(null);
 const animation=element.animate(keyframes,{fill:'forwards',...options});
 return animation.finished.then(()=>animation).catch(()=>animation);
}
function setFocusLayout(active,{restoreScroll=true}={}){
 const wasActive=document.body.classList.contains('play-focus');
 if(active&&!wasActive)focusScrollY=window.scrollY;
 document.body.classList.toggle('play-focus',active);document.body.classList.toggle('is-play-mode',active);
 document.documentElement.classList.toggle('player-fullscreen',active);document.documentElement.classList.toggle('is-play-mode',active);
 $('fullBtn').textContent=active?'✕ ออกจากเต็มจอ':'เต็มจอ';$('fullBtn').setAttribute('aria-pressed',String(active));
 if(active){updatePlayerViewport();document.querySelector('.play-layout').scrollTop=0;releaseInput();}
 else if(wasActive){releaseInput();if(restoreScroll)requestAnimationFrame(()=>window.scrollTo({top:focusScrollY,left:0,behavior:'instant'}));}
}
function heroElements(){
 return {
  consoleEl:document.querySelector('.console'),lid:document.querySelector('.mobbyboy-lid'),screen:document.querySelector('.screen'),
  powerLayer:document.querySelector('.screen-power-layer'),stage:$('mobbyTransitionStage'),controls:document.querySelector('.touch-controls'),led:$('fps')
 };
}
function prepareAnimationLayers(){
 document.body.classList.add('hero-compositing');document.documentElement.classList.add('hero-compositing');
}
function cleanupAnimationLayers(){
 document.body.classList.remove('hero-compositing');document.documentElement.classList.remove('hero-compositing');
}
function clearHeroInlineStyles(){
 const {consoleEl,lid,screen,powerLayer,stage,controls,led}=heroElements();
 for(const el of [consoleEl,lid,screen,powerLayer,stage,controls,led]){
  if(!el)continue;
  for(const prop of ['transform','opacity','filter','transform-origin','will-change'])el.style.removeProperty(prop);
 }
}
function cancelHeroTimeline(result=false){
 if(heroRaf){cancelAnimationFrame(heroRaf);heroRaf=0;}
 heroRunning=false;
 const resolve=heroResolve;heroResolve=null;
 if(resolve)resolve(result);
}
function clearTransitionPresentation(){
 cancelHeroTimeline(false);
 document.body.classList.remove('play-transitioning','play-merging');document.documentElement.classList.remove('player-transitioning');
 cleanupAnimationLayers();clearHeroInlineStyles();
 const {consoleEl,lid,screen}=heroElements();
 for(const el of [consoleEl,lid,screen])el?.getAnimations().forEach(animation=>animation.cancel());
}
function focusMode(active){
 transitionEpoch++;clearTransitionPresentation();setFocusLayout(active);setPlayState(active?PLAY_STATES.PLAY_ACTIVE:PLAY_STATES.IDLE);
}
async function tryNativeFullscreen({quiet=false}={}){
 const target=fullscreenTarget();nativeFullscreenTarget=target;
 if(typeof target?.requestFullscreen!=='function'){nativeFullscreenTarget=null;if(!quiet)SG.toast('ใช้โหมดเต็มจอของหน้าเว็บ');return false;}
 try{await target.requestFullscreen({navigationUI:'hide'});nativeFullscreenOwned=document.fullscreenElement===target;if(!nativeFullscreenOwned)nativeFullscreenTarget=null;return nativeFullscreenOwned;}
 catch{nativeFullscreenOwned=false;nativeFullscreenTarget=null;if(!quiet)SG.toast('ใช้โหมดเต็มจอของหน้าเว็บ');return false;}
}
const clamp01=value=>Math.max(0,Math.min(1,value));
const range=(value,start,end)=>clamp01((value-start)/(end-start));
const lerp=(from,to,t)=>from+(to-from)*t;
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutQuint=t=>1-Math.pow(1-t,5);
function heroStateForProgress(progress){
 if(progress<.12)return PLAY_STATES.DEVICE_CLOSED;
 if(progress<.38)return PLAY_STATES.DEVICE_OPENING;
 if(progress<.46)return PLAY_STATES.DEVICE_POWERING;
 return PLAY_STATES.DEVICE_MERGING;
}
function createHeroPerf(){return {startedAt:performance.now(),frames:0,totalInterval:0,worstInterval:0,over20:0,over34:0,previous:null,progress:0};}
function recordHeroFrame(perf,now,progress){
 if(perf.previous!==null){const delta=now-perf.previous;perf.frames++;perf.totalInterval+=delta;perf.worstInterval=Math.max(perf.worstInterval,delta);if(delta>20)perf.over20++;if(delta>34)perf.over34++;}
 perf.previous=now;perf.progress=progress;
 if(perfDebugEnabled&&perf.frames%6===0)updatePerfDebug(perf);
}
function summarizeHeroPerf(perf,duration){
 const avg=perf.frames?perf.totalInterval/perf.frames:0;
 return {duration:Math.round(duration),sampledFrames:perf.frames,averageFrameIntervalMs:+avg.toFixed(2),cadenceEstimateHz:avg?+(1000/avg).toFixed(1):0,worstFrameIntervalMs:+perf.worstInterval.toFixed(2),framesOver20ms:perf.over20,framesOver34ms:perf.over34};
}
function applyHeroFrame(progress,reduced=false){
 const {consoleEl,lid,powerLayer,stage,controls,led}=heroElements();
 if(!consoleEl||!lid)return;
 if(reduced){
  const t=easeOutCubic(progress),scale=lerp(.94,1,t);
  consoleEl.style.opacity=String(t);consoleEl.style.transform=`translate(-50%,-50%) translate3d(0,${lerp(7,0,t).toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
  lid.style.transform='translateZ(0) rotateX(0deg)';
  if(stage)stage.style.opacity=String(.5*(1-t));
  if(powerLayer)powerLayer.style.opacity=String(1-t);
  if(controls){controls.style.opacity=String(t);controls.style.transform='translate3d(0,0,0)';}
  if(led)led.style.opacity=String(.35+.65*t);
  return;
 }
 const summon=easeOutQuint(range(progress,0,.18));
 const approach=easeInOutCubic(range(progress,.44,.94));
 const settle=easeOutCubic(range(progress,.94,1));
 let scale=lerp(.43,.53,summon);
 if(progress>=.44)scale=lerp(.53,1.018,approach);
 if(progress>=.94)scale=lerp(1.018,1,settle);
 const y=lerp(18,0,summon);
 const deviceOpacity=easeOutCubic(range(progress,0,.14));
 const open=easeOutQuint(range(progress,.12,.70));
 const hingeSettle=easeOutCubic(range(progress,.70,.80));
 const lidAngle=progress<.70?lerp(-84,3,open):lerp(3,0,hingeSettle);
 const power=easeOutCubic(range(progress,.38,.70));
 const controlsIn=easeOutCubic(range(progress,.54,.82));
 const dimIn=easeOutCubic(range(progress,0,.18)),dimOut=easeInOutCubic(range(progress,.82,1));
 const stageOpacity=.72*dimIn*(1-dimOut);
 consoleEl.style.opacity=String(deviceOpacity);
 consoleEl.style.transform=`translate(-50%,-50%) translate3d(0,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
 lid.style.transform=`translateZ(0) rotateX(${lidAngle.toFixed(3)}deg)`;
 if(powerLayer)powerLayer.style.opacity=String(1-power);
 if(stage)stage.style.opacity=String(stageOpacity);
 if(controls){controls.style.opacity=String(controlsIn);controls.style.transform=`translate3d(0,${lerp(10,0,controlsIn).toFixed(2)}px,0)`;}
 if(led)led.style.opacity=String(.28+.72*power);
}
function runHeroTimeline(epoch){
 const duration=reduceMotionQuery.matches?240:1180;
 const perf=createHeroPerf();
 heroRunning=true;prepareAnimationLayers();
 return new Promise(resolve=>{
  heroResolve=resolve;
  const start=performance.now();
  const frame=now=>{
   if(epoch!==transitionEpoch){cancelHeroTimeline(false);return;}
   const progress=clamp01((now-start)/duration);
   recordHeroFrame(perf,now,progress);
   const desiredState=reduceMotionQuery.matches?(progress<.35?PLAY_STATES.DEVICE_CLOSED:PLAY_STATES.DEVICE_MERGING):heroStateForProgress(progress);
   setPlayState(desiredState);
   applyHeroFrame(progress,reduceMotionQuery.matches);
   if(progress<1){heroRaf=requestAnimationFrame(frame);return;}
   heroRaf=0;heroRunning=false;lastHeroPerf=summarizeHeroPerf(perf,now-start);window.__mobbyMotionStats=lastHeroPerf;updatePerfDebug(perf);
   const done=heroResolve;heroResolve=null;if(done)done(true);
  };
  heroRaf=requestAnimationFrame(frame);
 });
}
function finishInterruptedMobileTransition(reason='interrupted'){
 if(!heroRunning&&!document.body.classList.contains('play-transitioning'))return;
 transitionEpoch++;cancelHeroTimeline(false);releaseInput();
 const {consoleEl,lid,powerLayer,stage,controls}=heroElements();
 if(consoleEl)consoleEl.style.transform='none';if(lid)lid.style.transform='none';if(powerLayer)powerLayer.style.opacity='0';if(stage)stage.style.opacity='0';if(controls){controls.style.opacity='1';controls.style.transform='none';}
 document.body.classList.remove('play-transitioning','play-merging');document.documentElement.classList.remove('player-transitioning');
 setFocusLayout(true,{restoreScroll:false});clearHeroInlineStyles();cleanupAnimationLayers();setPlayState(PLAY_STATES.PLAY_ACTIVE);updatePlayerViewport();pendingViewportRefresh=false;
 if(perfDebugEnabled){lastHeroPerf={...(lastHeroPerf||{}),interruptedBy:reason};updatePerfDebug();}
}
async function enterMobileImmersive(){
 if(playState!==PLAY_STATES.IDLE)return;
 const epoch=++transitionEpoch;
 focusScrollY=window.scrollY;updatePlayerViewport();releaseInput();
 document.body.classList.add('play-transitioning');document.documentElement.classList.add('player-transitioning');
 setPlayState(PLAY_STATES.ENTER_PREP);await nextFrame();if(epoch!==transitionEpoch)return;
 const completed=await runHeroTimeline(epoch);if(!completed||epoch!==transitionEpoch)return;
 // Switch from the transition shell to the active shell in one render turn.
 const {consoleEl,lid,powerLayer,stage,controls}=heroElements();
 if(consoleEl)consoleEl.style.transform='none';if(lid)lid.style.transform='none';if(powerLayer)powerLayer.style.opacity='0';if(stage)stage.style.opacity='0';if(controls){controls.style.opacity='1';controls.style.transform='none';}
 document.body.classList.add('play-merging');
 setFocusLayout(true,{restoreScroll:false});
 document.body.classList.remove('play-transitioning');document.documentElement.classList.remove('player-transitioning');document.body.classList.remove('play-merging');
 clearHeroInlineStyles();cleanupAnimationLayers();setPlayState(PLAY_STATES.PLAY_ACTIVE);
 if(pendingViewportRefresh){pendingViewportRefresh=false;updatePlayerViewport();}
 try{if(typeof navigator.vibrate==='function')navigator.vibrate(8);}catch{}
 // Native fullscreen is deliberately requested only after the compositor merge so it cannot cut the hero motion in half.
 await tryNativeFullscreen({quiet:true});
}
async function enterDesktopImmersive(){
 if(playState!==PLAY_STATES.IDLE)return;
 focusScrollY=window.scrollY;releaseInput();setPlayState(PLAY_STATES.ENTER_PREP);setFocusLayout(true,{restoreScroll:false});setPlayState(PLAY_STATES.PLAY_ACTIVE);await tryNativeFullscreen({quiet:false});
}
async function leaveFullscreen(){
 if(playState===PLAY_STATES.IDLE&&!document.body.classList.contains('play-focus')&&!document.body.classList.contains('play-transitioning'))return;
 const epoch=++transitionEpoch;cancelHeroTimeline(false);setPlayState(PLAY_STATES.EXITING);releaseInput();
 const consoleEl=document.querySelector('.console');
 if(isMobileHandheld()&&document.body.classList.contains('play-focus')&&!reduceMotionQuery.matches){
  const exitAnim=await runAnimation(consoleEl,[{transform:'translate3d(0,0,0) scale(1)',opacity:1},{transform:'translate3d(0,4px,0) scale(.975)',opacity:.54}],{duration:150,easing:'cubic-bezier(.4,0,1,1)'});exitAnim?.cancel();
 }
 if(epoch!==transitionEpoch)return;
 if(nativeFullscreenOwned&&document.fullscreenElement){try{await document.exitFullscreen();}catch{}nativeFullscreenOwned=false;nativeFullscreenTarget=null;}
 clearTransitionPresentation();setFocusLayout(false);setPlayState(PLAY_STATES.IDLE);pendingViewportRefresh=false;
}
$('fullBtn').onclick=()=>guard(async()=>{
 if(playState===PLAY_STATES.PLAY_ACTIVE||document.body.classList.contains('play-focus')){await leaveFullscreen();return;}
 if(playState!==PLAY_STATES.IDLE)return;
 if(isMobileHandheld())await enterMobileImmersive();else await enterDesktopImmersive();
});
document.addEventListener('fullscreenchange',()=>{
 if(nativeFullscreenTarget&&document.fullscreenElement===nativeFullscreenTarget){nativeFullscreenOwned=true;if(!document.body.classList.contains('play-focus')){setFocusLayout(true,{restoreScroll:false});setPlayState(PLAY_STATES.PLAY_ACTIVE);}queuePlayerViewport();return;}
 if(nativeFullscreenOwned&&!document.fullscreenElement){nativeFullscreenOwned=false;nativeFullscreenTarget=null;if(document.body.classList.contains('play-focus')){transitionEpoch++;clearTransitionPresentation();setFocusLayout(false);setPlayState(PLAY_STATES.IDLE);}}
});
window.addEventListener('resize',()=>{if(document.body.classList.contains('play-focus')||document.body.classList.contains('play-transitioning'))queuePlayerViewport();},{passive:true});
window.visualViewport?.addEventListener('resize',()=>{if(document.body.classList.contains('play-focus')||document.body.classList.contains('play-transitioning'))queuePlayerViewport();},{passive:true});
window.visualViewport?.addEventListener('scroll',()=>{if(document.body.classList.contains('play-focus')||document.body.classList.contains('play-transitioning'))queuePlayerViewport();},{passive:true});
orientationQuery.addEventListener('change',()=>{
 releaseInput();
 if(heroRunning||document.body.classList.contains('play-transitioning')){finishInterruptedMobileTransition('orientationchange');return;}
 if(document.body.classList.contains('play-focus')){queuePlayerViewport();return;}
 if(engine&&!document.querySelector('dialog[open]'))requestAnimationFrame(()=>document.querySelector('.console').scrollIntoView({block:'start'}));
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'&&(heroRunning||document.body.classList.contains('play-transitioning')))finishInterruptedMobileTransition('visibility-hidden');
});
function ensureInputDebug(){
 if(!inputDebugEnabled||inputDebugEl)return;inputDebugEl=document.createElement('pre');inputDebugEl.id='inputDebug';inputDebugEl.setAttribute('aria-hidden','true');document.body.append(inputDebugEl);
}
function updateInputDebug(){
 if(!inputDebugEnabled)return;ensureInputDebug();if(!inputDebugEl)return;
 const vv=window.visualViewport;inputDebugEl.textContent=`state ${playState}\n${innerWidth}×${innerHeight} vv ${Math.round(vv?.width||innerWidth)}×${Math.round(vv?.height||innerHeight)}\n${orientationQuery.matches?'landscape':'portrait'} pointers ${[...pointers.keys()].join(',')||'-'}\nmask ${inputMask()}`;
}
function ensurePerfDebug(){
 if(!perfDebugEnabled||perfDebugEl)return;perfDebugEl=document.createElement('pre');perfDebugEl.id='perfDebug';perfDebugEl.setAttribute('aria-hidden','true');document.body.append(perfDebugEl);
}
function updatePerfDebug(livePerf=null){
 if(!perfDebugEnabled)return;ensurePerfDebug();if(!perfDebugEl)return;
 const vv=window.visualViewport,stats=livePerf||lastHeroPerf;
 const live=livePerf?`progress ${(livePerf.progress*100).toFixed(0)}%\nframes ${livePerf.frames} worst ${livePerf.worstInterval.toFixed(1)}ms >20 ${livePerf.over20} >34 ${livePerf.over34}`:stats?`avg ${stats.averageFrameIntervalMs??'-'}ms ~${stats.cadenceEstimateHz??'-'}Hz\nworst ${stats.worstFrameIntervalMs??'-'}ms >20 ${stats.framesOver20ms??'-'} >34 ${stats.framesOver34ms??'-'}`:'no transition sample yet';
 perfDebugEl.textContent=`MOBBY MOTION DEBUG\nstate ${playState}\nvv ${Math.round(vv?.width||innerWidth)}×${Math.round(vv?.height||innerHeight)}\n${live}`;
}
updateInputDebug();updatePerfDebug();
$('volume').oninput=e=>engine?.config.write('volume',+e.target.value);
document.querySelectorAll('[data-bit]').forEach(button=>{
 button.oncontextmenu=e=>e.preventDefault();
 button.onpointerdown=e=>{
  if(!engine||paused||gameplayInputBlocked())return;
  e.preventDefault();
  const bit=Number(button.dataset.bit);
  pointers.set(e.pointerId,bit);button.classList.add('pressed');syncInput();
  try{button.setPointerCapture?.(e.pointerId);}catch{}
  if(e.pointerType==='touch'&&typeof navigator.vibrate==='function')try{navigator.vibrate(8);}catch{}
 };
 const up=e=>releasePointer(e.pointerId);
 button.onpointerup=button.onpointercancel=button.onlostpointercapture=up;
});
window.addEventListener('pointerup',e=>releasePointer(e.pointerId));
window.addEventListener('pointercancel',e=>releasePointer(e.pointerId));
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
$('soulgoldMode').onchange=e=>guard(async()=>{if(!game){e.target.checked=false;throw Error('เปิดเกมก่อน');}game=await updateGame(game.id,{soulgold:e.target.checked});activeButtons(true);oldJourney=null;await updateJourney(engine.getBatterySave(),await engine.saveState());});
$('symbolsInput').onchange=e=>guard(async()=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(!game?.soulgold)throw Error('เปิดเกม SoulGold และยืนยันรุ่นก่อน');if(f.size>8*1048576)throw Error('Symbol file ใหญ่เกินไป');const symbols=SGJourney.parseSymbols(await f.text());if(!await ask('ยืนยันว่า symbol นี้ build มาจาก ROM ไฟล์เดียวกัน? ใช้ไฟล์คนละรุ่นอาจอ่านค่าผิด'))return;game=await updateGame(game.id,{symbols});await updateJourney(engine.getBatterySave(),await engine.saveState());});
$('clearSymbols').onclick=()=>guard(async()=>{if(!game)return;game=await updateGame(game.id,{symbols:null});SG.toast('ปิดตัวอ่านสดแล้ว');});
window.addEventListener('blur',releaseInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine){setPaused(true);saveNow(false).catch(fail);}});
window.addEventListener('sg-cloud-auth',()=>{if(engine&&game?.cloudOwner&&game.cloudOwner!==cloud.user()?.id){setPaused(true);saveNow(false).catch(fail);cloudIndicator.textContent='บัญชีหมดอายุหรือเปลี่ยนแล้ว • พักเกมไว้และเก็บเซฟในเครื่อง กรุณากลับคลังแล้วเข้าสู่ระบบเจ้าของเกม';}});
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
 await boot(g);if(params.get('bag')==='1'&&game.soulgold)await bagTools.open();
});
