/* Read-only SoulGold adapter. Source layout is explicit; never detect by filename. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.SGJourney=api;})(globalThis,()=>{
 'use strict';
 const u16=(a,o)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint16(o,true);
 const u32=(a,o)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint32(o,true);
 function checksum(a){let n=0;for(let i=0;i+3<a.length;i+=4)n=(n+u32(a,i))>>>0;return(n+(n>>>16))&65535;}
 function readSave(a){
  if(!(a instanceof Uint8Array)||a.length!==131072)throw Error('Journey รองรับเซฟ SoulGold GBA 128 KiB ที่ตรงซอร์สเท่านั้น');
  const candidates=[];
  for(let slot=0;slot<2;slot++){
   const sections=new Map();let counter=null,valid=true;
   for(let p=slot*14;p<slot*14+14;p++){
    const o=p*4096,id=u16(a,o+4084),n=u32(a,o+4092),size=id===0?0xB30:id===4?0x3C54-3*3968:3968;
    if(id>13||sections.has(id)||u32(a,o+4088)!==0x08012025||(counter!==null&&counter!==n)||checksum(a.subarray(o,o+size))!==u16(a,o+4086)){valid=false;break;}
    counter=n;sections.set(id,a.slice(o,o+size));
   }
   if(valid&&sections.size===14){const sb1=new Uint8Array(0x3C54);for(let i=1;i<=4;i++)sb1.set(sections.get(i),(i-1)*3968);candidates.push({sb1,sb2:sections.get(0),counter,slot});}
  }
  if(!candidates.length)throw Error('ยังไม่มีเซฟในเกมที่สมบูรณ์ หรือเซฟไม่ตรงรูปแบบ');
  return candidates.sort((a,b)=>-((a.counter-b.counter)|0))[0];
 }
 const badgeNames=['Zephyr · Falkner','Hive · Bugsy','Plain · Whitney','Fog · Morty','Storm · Chuck','Mineral · Jasmine','Glacier · Pryce','Rising · Clair','Boulder · Brock','Cascade · Misty','Thunder · Lt. Surge','Rainbow · Erika','Soul · Janine','Marsh · Sabrina','Volcano · Blaine','Earth · Blue'];
 function snapshot(blocks,source,maps,mode='battery'){
  const {sb1,sb2}=blocks;if(sb1.length<0x3C54||sb2.length<0xB30)throw Error('Save blocks truncated');
  const flag=id=>!!(sb1[source.flagsOffset+(id>>3)]&(1<<(id&7)));
  const eventRules=source.events.map(e=>({id:e.key,label:e.label,flag:e.id})),badgeRules=source.badges.map((id,i)=>({id:'badge-'+i,label:badgeNames[i],flag:id}));
  const rules=[...eventRules.slice(0,2),...badgeRules.slice(0,8),...eventRules.slice(2),...badgeRules.slice(8)];
  const tasks=rules.map(rule=>({...rule,complete:flag(rule.flag)}));
  const mapKey=sb1[4]+':'+sb1[5],map=maps[mapKey];
  const name=map?map.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'):'ยังระบุแผนที่ไม่ได้ ('+mapKey+')';
  // Recommendations are an ordering aid; completion always requires its own flag.
  const next=tasks.find(t=>!t.complete);
  // Advice copied/summarized from the existing Companion, not completion evidence.
  const cityHints={
   NewBarkTown:['คุยกับแม่และไปแล็บ Elm เพื่อเริ่มเรื่อง','ทำธุระที่บ้าน Mr. Pokémon แล้วกลับแล็บ'],
   CherrygroveCity:['เดินต่อ Route 30 ไปบ้าน Mr. Pokémon','กลับแล็บ Elm หลังเหตุการณ์คู่ปรับ'],
   VioletCity:['ขึ้น Sprout Tower ก่อนเข้ายิม Falkner','หลังยิม แวะ PokéMart คุยกับผู้ช่วย Elm'],
   AzaleaTown:['จัดการเหตุการณ์ Slowpoke Well ก่อนยิม Bugsy','หลังยิม เดินต่อไปป่า Ilex และภารกิจ Farfetch’d'],
   GoldenrodCity:['ช่วงแรก: ตอบควิซชั้น 1 หอวิทยุก่อนยิม Whitney','หลังชนะยิม รับ Squirtbottle ที่ร้านดอกไม้','กลับมาภายหลังเมื่อเนื้อเรื่องหอวิทยุเริ่มขึ้น'],
   EcruteakCity:['ทำเหตุการณ์ Burned Tower ก่อนยิม Morty','หลังยิม ไปโรงละครสาวคิโมโนเพื่อปลดล็อก Surf','ช่วงยิม Chuck / Jasmine / Pryce เลือกลำดับเล่นได้'],
   CianwoodCity:['รับ Secret Potion จากร้านขายยา','ท้าทาย Chuck แล้วกลับไปรักษา Amphy ที่ Olivine'],
   OlivineCity:['ตรวจเหตุการณ์ประภาคาร Amphy ก่อน','นำ Secret Potion จาก Cianwood กลับมา แล้วยิม Jasmine จึงเปิด'],
   Mahoganytown:['ไป Lake of Rage แล้วพบ Lance','ทำเหตุการณ์ฐานลับใต้ร้านของฝากก่อนเข้ายิม Pryce'],
   BlackthornCity:['ท้าทาย Clair หลังผ่าน Ice Path','ชนะการต่อสู้ยังไม่พอ ต้องทำบททดสอบ Dragon’s Den จึงได้ตรายิม']
  };
  const city=map?.split('_')[0],hints=cityHints[city]||[];
  return {schema:1,source:source.id,mode,mapKey,mapName:name,tasks,hints,next:next?.label||'ครบเหตุการณ์ที่ตัวเชื่อมรุ่นนี้ตรวจได้แล้ว',trainerId:u32(sb2,10),updatedAt:Date.now()};
 }
 function parseSymbols(text){
  if(text.length>8*1024*1024)throw Error('Symbol file too large');
  const result={};
  for(const name of ['gSaveBlock1Ptr','gSaveBlock2Ptr']){
   const m=text.match(new RegExp('(?:0x)?([0-9a-fA-F]{8})\\s+(?:[a-zA-Z]\\s+)?(?:[0-9a-fA-F]{8}\\s+)?'+name+'\\b'));
   if(!m)throw Error('ไม่พบ '+name+' ใน .map/.sym');
   const address=parseInt(m[1],16);if(!((address>=0x02000000&&address<=0x0203fffc)||(address>=0x03000000&&address<=0x03007ffc)))throw Error('Symbol ไม่ได้อยู่ใน RAM');result[name]=address;
  }return result;
 }
 function liveBlocks(state,symbols,baseline){
  // Upstream mGBA GBA serialized-state v11. Reject other layouts, never guess.
  if(state.length!==0x61000||u32(state,0)!==0x0100000B)throw Error('mGBA state layout ไม่ตรงกับตัวอ่านสด');
  const offset=(address,size)=>{if(address>=0x02000000&&address+size<=0x02040000)return 0x21000+address-0x02000000;if(address>=0x03000000&&address+size<=0x03008000)return 0x19000+address-0x03000000;throw Error('Save pointer ยังไม่พร้อม');};
  const block=(name,size)=>{const ptr=u32(state,offset(symbols[name],4));const o=offset(ptr,size);return state.slice(o,o+size);};
  const sb1=block('gSaveBlock1Ptr',0x3C54),sb2=block('gSaveBlock2Ptr',0xB30);
  // Prevent title-screen garbage, a mismatched symbol map or another trainer.
  if(!baseline||!sb2.slice(0,14).every((v,i)=>v===baseline.sb2[i])||u32(sb2,0xB4)!==u32(baseline.sb2,0xB4)||sb1[0x234]>6)throw Error('รอโหลดเซฟของผู้เล่นที่ตรงกัน');
  return {sb1,sb2};
 }
 return {readSave,snapshot,parseSymbols,liveBlocks,checksum};
});
