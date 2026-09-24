import {ITEM_DATA,PRESETS,inventory,patchBattery,patchLive} from './bag-core.js';
import {getSave,putSave,encodeSave} from './play-store.js';
import {ask} from './confirm-ui.js';
export function installBagTools(host){
 const $=id=>document.getElementById(id);let tab='items',preset=PRESETS[0],applying=false;
 const message=text=>$('bagStatus').textContent=text;
 async function action(fn){await host.guard(async()=>{try{await fn();}catch(e){message(e.message||String(e));throw e;}});}
 for(const p of ITEM_DATA.pockets){const o=document.createElement('option');o.value=p.key;o.textContent=p.label;$('pocketSelect').append(o);}
 $('pocketSelect').value='Medicine';
 function filter(){const q=$('itemSearch').value.toLowerCase().trim(),previous=$('itemSelect').value;const list=ITEM_DATA.items.filter(i=>(q?i.name.toLowerCase().includes(q)||String(i.id)===q:i.pocket===$('pocketSelect').value));$('itemSelect').replaceChildren();for(const item of list){const o=document.createElement('option');o.value=item.id;o.textContent='#'+item.id+' · '+item.name;$('itemSelect').append(o);}if(list.some(i=>String(i.id)===previous))$('itemSelect').value=previous;else if(list.length)$('itemSelect').selectedIndex=0;preview();}
 function operations(){if(tab==='presets')return preset.operations;return[{type:'item',id:Number($('itemSelect').value),quantity:Number($('itemQuantity').value)}];}
 function preview(){const item=ITEM_DATA.items.find(i=>i.id===Number($('itemSelect').value));$('operationPreview').textContent=tab==='presets'?preset.label:item?item.name+' +'+$('itemQuantity').value:'ไม่พบไอเทม';$('applyBag').disabled=applying||!host.context().game?.soulgold||!$('bagConfirm').checked||(tab==='items'&&(!item||!$('itemQuantity').checkValidity()));}
 for(const p of PRESETS){const b=document.createElement('button');b.textContent=p.label;b.classList.toggle('selected',p===preset);b.setAttribute('aria-pressed',p===preset);const small=document.createElement('small');small.textContent=p.note;b.append(small);b.onclick=()=>{preset=p;$('presetList').querySelectorAll('button').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',el===b);});preview();};$('presetList').append(b);}
 function setTab(value){tab=value;$('itemPanel').hidden=value!=='items';$('presetPanel').hidden=value!=='presets';for(const [id,name]of[['itemsTab','items'],['presetsTab','presets']]){$(id).classList.toggle('selected',value===name);$(id).setAttribute('aria-pressed',value===name);}preview();}
 $('itemsTab').onclick=()=>setTab('items');$('presetsTab').onclick=()=>setTab('presets');
 $('itemSearch').oninput=filter;$('pocketSelect').onchange=()=>{$('itemSearch').value='';filter();};$('itemSelect').onchange=preview;$('itemQuantity').oninput=preview;$('bagConfirm').onchange=preview;
 function mode(){const live=$('bagMode').value==='live';$('bagModeNote').textContent=live?'โหมดสด: อยู่บนแผนที่และปิดกระเป๋า / ร้านค้า / การต่อสู้ในเกมก่อนใช้สูตร แล้วเปิดกระเป๋าอีกครั้งเพื่อดูของ กด Save ในเกมหลังใช้สูตรเพื่อให้ติดใน .sav':'เซฟแล้วในเมนูเกมก่อนใช้สูตรหรือยัง? วิธีนี้เริ่มเกมใหม่จาก .sav ล่าสุด การเดินหลังเซฟนั้นจะไม่ตามไปด้วย';$('bagConfirmText').textContent=live?'ฉันใช้ symbol ตรงกับ ROM นี้ และอยู่บนแผนที่โดยปิดเมนูกระเป๋า / ร้านค้า / การต่อสู้แล้ว':'ฉันบันทึกในเมนูเกมแล้ว และยอมรับให้เริ่มเกมใหม่จากเซฟนั้น';$('applyBag').textContent=live?'ส่งของ / สูตรเข้าเกมสด':'ใช้กับเซฟและเริ่มเกมใหม่';$('bagConfirm').checked=false;preview();}
 async function renderInventory(){const {engine,game}=host.context(),battery=engine?.getBatterySave();if(!battery)throw Error('ยังไม่มี .sav กรุณาบันทึกจากเมนูในเกมก่อน');const base=SGJourney.readSave(battery);let blocks=base;if($('bagMode').value==='live')blocks=SGJourney.liveBlocks(await engine.saveState(),game.symbols,base);const inv=inventory(blocks);$('bagInventory').replaceChildren();const money=document.createElement('div');money.textContent='เงิน: '+inv.money.toLocaleString();$('bagInventory').append(money);for(const row of inv.rows){const el=document.createElement('div');el.textContent=row.name+' ×'+row.quantity+' · '+row.pocket;$('bagInventory').append(el);}}
 $('bagMode').onchange=()=>{mode();action(renderInventory);};
 async function open(){const {engine,game}=host.context();if(!engine)throw Error('เปิดเกมจากคลังก่อน');host.pause();$('bagDialog').showModal();$('bagConfirm').checked=false;const live=$('bagMode').querySelector('option[value=live]');live.disabled=!game.soulgold||!game.symbols;$('bagMode').value=live.disabled?'battery':'live';mode();$('undoBag').disabled=!(await getSave(game.id))?.toolBackup;message('เกมพักอยู่ • เลือกของ แล้วตรวจวิธีส่งเข้าเกมก่อนยืนยัน');if(!game.soulgold){$('applyBag').disabled=true;message('เกมนี้ยังไม่ยืนยันโปรไฟล์ SoulGold ปิดหน้าต่าง แล้วตรวจรุ่นเกมใน Journey Link ก่อน ไม่ใช้สูตรนี้กับ GBA เกมอื่น');return;}try{await renderInventory();}catch(e){message(e.message+' • ปิดหน้าต่างแล้วบันทึกในเมนูเกมก่อน');}}
 function close(){if(applying)return;$('bagDialog').close();host.status('เกมพักอยู่ • กดเล่นต่อเมื่อพร้อม');}
 $('closeBag').onclick=close;$('bagDialog').addEventListener('cancel',e=>{e.preventDefault();close();});
 $('backupBag').onclick=()=>action(async()=>{const r=await host.save();if(!r)throw Error('ยังไม่มีเกม');SG.download(r.name+'-before-tools.sgsave',JSON.stringify(encodeSave(r)),'application/json');message('ดาวน์โหลดสำรองแล้ว เก็บไฟล์นี้ไว้ก่อนใช้สูตร');});
 $('undoBag').onclick=()=>action(async()=>{const {game}=host.context(),backup=(await getSave(game.id))?.toolBackup;if(!backup)throw Error('ยังไม่มีจุดสำรองก่อนใช้สูตร');if(!await ask('ย้อนกลับไปจุดก่อนใช้สูตรครั้งล่าสุด? ความคืบหน้าหลังจากนั้นจะถูกแทนที่'))return;host.pause();await host.restore(backup);message('ย้อนกลับก่อนใช้สูตรแล้ว • ปิดหน้าต่างและเล่นต่อ');await renderInventory();});
 $('applyBag').onclick=()=>action(async()=>{
  const {engine,game}=host.context();if(!engine||!game?.soulgold)throw Error('ต้องยืนยัน ROM SoulGold รุ่นตรงซอร์สก่อน');if(!$('bagConfirm').checked)throw Error('อ่านและยืนยันวิธีส่งเข้าเกมก่อน');
  applying=true;preview();$('closeBag').disabled=true;
  let backup=null,changed=false;
  try{
   host.pause();backup=await host.save();if(!backup?.battery)throw Error('ต้อง Save ในเกมก่อนใช้สูตร');
   const ops=operations(),isLive=$('bagMode').value==='live';
   // Validate complete edit before making either a save-store or emulator mutation.
   const replacement=isLive?patchLive(backup.state,game.symbols,SGJourney.readSave(backup.battery),ops):patchBattery(backup.battery,ops);
   await putSave({...backup,toolBackup:{...backup,toolBackup:undefined,previous:undefined}});
   changed=true;
   if(isLive)await engine.loadState(replacement);else{engine.loadBatterySave(replacement);engine.reset();}
   host.resetJourney();await host.save();$('undoBag').disabled=false;$('bagConfirm').checked=false;
   await renderInventory();
   // Only dismiss and resume after the edited save has committed successfully.
   // Do not synthesize Start/A: the ROM's title/Continue screen is not verified.
   $('bagDialog').close();const running=host.resume();
   const text=isLive
    ?(running?'ส่งของเข้าเกมและเล่นต่อแล้ว':'ส่งของแล้ว • เกมพักอยู่เพราะแท็บไม่แสดง')+' • เปิดกระเป๋าใหม่และ Save ในเกมเพื่อเก็บลง .sav'
    :(running?'แก้เซฟแล้ว • รีและเปิดตัวเกมให้อัตโนมัติแล้ว':'แก้เซฟและรีแล้ว • เกมพักอยู่เพราะแท็บไม่แสดง')+' • ยังต้องผ่านหน้าไตเติลและเลือก Continue ในเกม';
   message(text);host.status(text);SG.toast(text);
  }catch(error){
   if(changed&&backup){try{host.pause();engine.loadBatterySave(backup.battery);await engine.loadState(backup.state);await putSave(backup);host.resetJourney();if(!$('bagDialog').open)$('bagDialog').showModal();}catch(rollback){SG.download('recovery-before-tools.sgsave',JSON.stringify(encodeSave(backup)),'application/json');throw Error('กู้คืนอัตโนมัติไม่สำเร็จ กรุณาเก็บไฟล์ recovery ที่ดาวน์โหลด: '+rollback.message);}}
   throw error;
  }finally{applying=false;$('closeBag').disabled=false;preview();}
 });
 filter();return{open};
}
