import {ITEM_DATA} from './item-data.js';
export {ITEM_DATA};
const view=a=>new DataView(a.buffer,a.byteOffset,a.byteLength);
const u16=(a,o)=>view(a).getUint16(o,true),u32=(a,o)=>view(a).getUint32(o,true);
const items=new Map(ITEM_DATA.items.map(i=>[i.id,i]));
export const PRESETS=[
 {id:'money',label:'เงิน 999,999',note:'ตั้งเงินเป็น 999,999 ไม่แก้ภารกิจ',operations:[{type:'money',value:999999}]},
 {id:'recovery',label:'ชุดฟื้นฟู ×20',note:'Potion / Antidote / Revive อย่างละ 20',names:['Potion','Antidote','Revive']},
 {id:'balls',label:'ชุดโปเกบอล ×30',note:'Poké Ball / Great Ball / Ultra Ball อย่างละ 30',names:['Poké Ball','Great Ball','Ultra Ball']}
].map(p=>p.operations?p:{...p,operations:p.names.map(name=>{const item=ITEM_DATA.items.find(i=>i.name===name);if(!item)throw Error('Preset item missing: '+name);return{type:'item',id:item.id,quantity:p.id==='balls'?30:20};})});
function integer(n,min,max,label){if(!Number.isInteger(n)||n<min||n>max)throw Error(label+' ต้องเป็นจำนวนเต็ม '+min+'–'+max);}
export function inventory(blocks){
 const {sb1,sb2}=blocks,key=u32(sb2,0xB4),rows=[];
 for(const pocket of ITEM_DATA.pockets)for(let i=0;i<pocket.capacity;i++){const o=pocket.offset+i*4,id=u16(sb1,o);if(id)rows.push({id,name:items.get(id)?.name||'Item #'+id,pocket:pocket.key,quantity:u16(sb1,o+2)^(key&65535)});}
 return {rows,money:(u32(sb1,0x478)^key)>>>0};
}
// Pure, copy-on-write: all operations succeed together or no source bytes change.
export function editBlocks(blocks,operations){
 if(!Array.isArray(operations)||!operations.length||operations.length>100)throw Error('รายการแก้ไขไม่ถูกต้อง');
 if(blocks.sb1.length!==0x3C54||blocks.sb2.length!==0xB30)throw Error('Save block ไม่ตรงโปรไฟล์');
 const sb1=blocks.sb1.slice(),key=u32(blocks.sb2,0xB4);
 for(const op of operations){
  if(op.type==='money'){integer(op.value,0,999999,'เงิน');view(sb1).setUint32(0x478,(op.value^key)>>>0,true);continue;}
  if(op.type!=='item')throw Error('ไม่รองรับสูตรนี้');
  integer(op.quantity,1,999,'จำนวน');const item=items.get(op.id);if(!item)throw Error('ไม่มีไอเทมนี้ในโปรไฟล์ SoulGold');
  const pocket=ITEM_DATA.pockets.find(p=>p.key===item.pocket);let found=-1,empty=-1;
  for(let i=0;i<pocket.capacity;i++){const o=pocket.offset+i*4,id=u16(sb1,o);if(!id&&empty<0)empty=o;if(id===item.id){if(found>=0)throw Error('พบไอเทมซ้ำในกระเป๋า กรุณาตรวจเซฟก่อน');found=o;}}
  const o=found>=0?found:empty;if(o<0)throw Error('กระเป๋า '+pocket.label+' เต็มแล้ว');
  const old=found>=0?(u16(sb1,o+2)^(key&65535)):0;if(old>999)throw Error('จำนวนไอเทมเดิมผิดช่วง อาจเป็นเซฟคนละรุ่น');
  const quantity=Math.min(999,old+op.quantity);view(sb1).setUint16(o,item.id,true);view(sb1).setUint16(o+2,quantity^(key&65535),true);
 }
 return {sb1,sb2:blocks.sb2.slice()};
}
export function patchBattery(bytes,operations){
 const parsed=SGJourney.readSave(bytes),patched=editBlocks(parsed,operations),out=bytes.slice();let sector=-1;
 // Money and every bag pocket fit in section 1. Other sections and backup slot stay byte-identical.
 for(let p=parsed.slot*14;p<parsed.slot*14+14;p++)if(u16(bytes,p*4096+4084)===1)sector=p*4096;
 if(sector<0)throw Error('ไม่พบ section กระเป๋า');
 out.set(patched.sb1.subarray(0,3968),sector);view(out).setUint16(sector+4086,SGJourney.checksum(out.subarray(sector,sector+3968)),true);
 SGJourney.readSave(out);return out;
}
function ramOffset(address,size){
 if(address>=0x02000000&&address+size<=0x02040000)return 0x21000+address-0x02000000;
 if(address>=0x03000000&&address+size<=0x03008000)return 0x19000+address-0x03000000;
 throw Error('ตำแหน่ง RAM อยู่นอกขอบเขต');
}
export function patchLive(state,symbols,baseline,operations){
 if(!symbols)throw Error('ต้องแนบ .map/.sym จาก ROM นี้ก่อนใช้โหมดสด');
 const current=SGJourney.liveBlocks(state,symbols,baseline),patched=editBlocks(current,operations);
 const ptr=u32(state,ramOffset(symbols.gSaveBlock1Ptr,4)),offset=ramOffset(ptr,0x3C54),out=state.slice();
 // Restrict writes to changed money/bag bytes, never touch flags, team, or unrelated state.
 for(let i=0x478;i<0xF0C;i++)if(patched.sb1[i]!==current.sb1[i])out[offset+i]=patched.sb1[i];
 return out;
}
