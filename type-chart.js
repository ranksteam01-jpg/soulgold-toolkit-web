import {TYPES,MATCHUPS} from './type-chart-data.js';

const names=['ปกติ','ต่อสู้','บิน','พิษ','ดิน','หิน','แมลง','ผี','เหล็ก','ไฟ','น้ำ','หญ้า','ไฟฟ้า','พลังจิต','น้ำแข็ง','มังกร','มืด','แฟรี่'];
const typeMeta=Object.fromEntries(TYPES.map((type,index)=>[type,{name:names[index],index}]));
const layout=document.querySelector('.play-layout');
layout.querySelector('aside').classList.add('journey-side');

const aside=document.createElement('aside');
aside.className='battle-reference';
aside.innerHTML=`
<section class="play-card type-reference-card">
  <div class="eyebrow">BATTLE REFERENCE</div>
  <div class="type-reference-title">
    <div><h2>ตารางธาตุ</h2><p>แตะธาตุเพื่อดูว่าได้เปรียบหรือเสียเปรียบกับอะไร</p></div>
    <span class="type-chart-badge">18 TYPES</span>
  </div>
  <div id="typePicker" class="type-picker-grid" aria-label="เลือกธาตุ"></div>
  <p class="fine type-note">แตะธาตุแล้วข้อมูลจะเปิดในหน้าต่างด้านบน • ตารางอ้างอิงเป็นธาตุเดี่ยว</p>
  <details class="type-calculator">
    <summary>คำนวณโปเกมอน 2 ธาตุแบบละเอียด</summary>
    <div class="type-calculator-grid">
      <label>ธาตุท่าโจมตี<select id="attackType"></select></label>
      <label>ธาตุเป้าหมาย<select id="defendType"></select></label>
      <label>ธาตุที่สอง (ถ้ามี)<select id="defendType2"><option value="">ไม่มี</option></select></label>
    </div>
    <output id="typeMultiplier" aria-live="polite"></output>
  </details>
  <p class="fine">ไม่รวม Ability, ไอเทม และสภาพสนาม • เกมเก่า/แฮ็กอื่นอาจมีตารางต่างกัน</p>
</section>
<dialog id="typePopup" class="type-popup" aria-labelledby="typePopupTitle">
  <div class="type-popup-panel">
    <div class="type-popup-head">
      <div class="type-popup-identity">
        <span id="typePopupBadge" class="type-pill"></span>
        <div><h3 id="typePopupTitle"></h3><small id="typePopupEnglish"></small></div>
      </div>
      <button id="typePopupClose" class="type-popup-close" type="button" aria-label="ปิด">✕</button>
    </div>
    <div class="type-popup-section attack">
      <div class="type-popup-section-title"><b>เวลาใช้ธาตุนี้โจมตี</b><span>ATTACK</span></div>
      <div class="type-popup-stat strong"><span>แรง 2×</span><div id="typePopupStrong"></div></div>
      <div class="type-popup-stat resist"><span>เบา ½×</span><div id="typePopupNotVery"></div></div>
      <div class="type-popup-stat immune"><span>ไม่เข้า 0×</span><div id="typePopupNoEffect"></div></div>
    </div>
    <div class="type-popup-section defend">
      <div class="type-popup-section-title"><b>เมื่อโปเกมอนเป็นธาตุนี้</b><span>DEFENSE</span></div>
      <div class="type-popup-stat weak"><span>แพ้ 2×</span><div id="typePopupWeak"></div></div>
      <div class="type-popup-stat resist"><span>ต้าน ½×</span><div id="typePopupResist"></div></div>
      <div class="type-popup-stat immune"><span>กัน 0×</span><div id="typePopupImmune"></div></div>
    </div>
    <button id="typePopupDone" class="type-popup-done" type="button">ปิด</button>
  </div>
</dialog>`;
layout.prepend(aside);

function badge(type,modifier=''){
  const meta=typeMeta[type];
  return `<span class="type-pill type-${type.toLowerCase()} ${modifier}" title="${type}">${meta.name}</span>`;
}
function emptyText(){return '<span class="type-empty">ไม่มี</span>';}
function incoming(defender,predicate){
  const di=typeMeta[defender].index;
  return TYPES.filter(attack=>predicate(MATCHUPS[attack][di]));
}
function outgoing(attacker,predicate){
  return TYPES.filter(defender=>predicate(MATCHUPS[attacker][typeMeta[defender].index]));
}
function fill(id,types,modifier){
  aside.querySelector('#'+id).innerHTML=types.length?types.map(type=>badge(type,modifier)).join(''):emptyText();
}

const picker=aside.querySelector('#typePicker');
for(const type of TYPES){
  const meta=typeMeta[type];
  const button=document.createElement('button');
  button.type='button';
  button.className=`type-choice type-${type.toLowerCase()}`;
  button.dataset.type=type;
  button.innerHTML=`<span>${meta.name}</span><small>${type}</small>`;
  button.addEventListener('click',()=>openType(type));
  picker.append(button);
}

const popup=aside.querySelector('#typePopup');
function openType(type){
  const meta=typeMeta[type];
  const badgeEl=aside.querySelector('#typePopupBadge');
  badgeEl.className=`type-pill type-${type.toLowerCase()}`;
  badgeEl.textContent=meta.name;
  aside.querySelector('#typePopupTitle').textContent='ธาตุ'+meta.name;
  aside.querySelector('#typePopupEnglish').textContent=type;
  fill('typePopupStrong',outgoing(type,value=>value>1),'strong');
  fill('typePopupNotVery',outgoing(type,value=>value>0&&value<1),'resist');
  fill('typePopupNoEffect',outgoing(type,value=>value===0),'immune');
  fill('typePopupWeak',incoming(type,value=>value>1),'weak');
  fill('typePopupResist',incoming(type,value=>value>0&&value<1),'resist');
  fill('typePopupImmune',incoming(type,value=>value===0),'immune');
  if(typeof popup.showModal==='function')popup.showModal();
  else popup.setAttribute('open','');
}
function closePopup(){if(typeof popup.close==='function'&&popup.open)popup.close();else popup.removeAttribute('open');}
aside.querySelector('#typePopupClose').onclick=closePopup;
aside.querySelector('#typePopupDone').onclick=closePopup;
popup.addEventListener('click',event=>{if(event.target===popup)closePopup();});

for(const id of ['attackType','defendType','defendType2']){
  const select=aside.querySelector('#'+id);
  TYPES.forEach((type,index)=>{
    const option=document.createElement('option');
    option.value=type;
    option.textContent=names[index]+' · '+type;
    select.append(option);
  });
  select.onchange=renderCalculator;
}
aside.querySelector('#attackType').value='FIRE';
aside.querySelector('#defendType').value='GRASS';

function renderCalculator(){
  const attack=aside.querySelector('#attackType').value;
  const first=aside.querySelector('#defendType').value;
  const second=aside.querySelector('#defendType2').value;
  const multiplier=MATCHUPS[attack][TYPES.indexOf(first)]*(second&&second!==first?MATCHUPS[attack][TYPES.indexOf(second)]:1);
  const out=aside.querySelector('#typeMultiplier');
  out.textContent=multiplier+'× '+(multiplier===0?'ไม่มีผล':multiplier>1?'ได้เปรียบ':multiplier<1?'เสียเปรียบ':'ปกติ');
  out.dataset.effect=multiplier>1?'strong':multiplier<1?'weak':'normal';
}
renderCalculator();
