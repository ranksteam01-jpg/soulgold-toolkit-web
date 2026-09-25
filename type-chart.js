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
    <div><h2>ตารางธาตุ</h2><p>เปิดดูได้ทันที ไม่ต้องเลือกทีละธาตุ</p></div>
    <span class="type-chart-badge">18 TYPES</span>
  </div>
  <div class="type-chart-legend" aria-label="คำอธิบายตารางธาตุ">
    <span><i class="type-dot strong"></i><b>ชนะ</b> ตี 2×</span>
    <span><i class="type-dot weak"></i><b>แพ้</b> โดน 2×</span>
    <span><i class="type-dot resist"></i><b>ต้าน</b> โดน ½×</span>
    <span><i class="type-dot immune"></i><b>กัน</b> โดน 0×</span>
  </div>
  <div class="type-overview-wrap">
    <table class="type-overview-table">
      <thead><tr><th>ธาตุ</th><th>ชนะ / ตีแรงใส่</th><th>แพ้ / โดนแรงจาก</th><th>ต้าน / กัน</th></tr></thead>
      <tbody id="typeOverviewRows"></tbody>
    </table>
  </div>
  <p class="fine type-note">ตารางหลักเป็นธาตุเดี่ยว • ถ้าโปเกมอนมี 2 ธาตุ ตัวคูณจะนำมาคูณกัน เช่น 2× × 2× = 4×</p>
  <details class="type-calculator">
    <summary>คำนวณคู่ธาตุแบบละเอียด</summary>
    <div class="type-calculator-grid">
      <label>ธาตุท่าโจมตี<select id="attackType"></select></label>
      <label>ธาตุเป้าหมาย<select id="defendType"></select></label>
      <label>ธาตุที่สอง (ถ้ามี)<select id="defendType2"><option value="">ไม่มี</option></select></label>
    </div>
    <output id="typeMultiplier" aria-live="polite"></output>
  </details>
  <p class="fine">อ้างอิงซอร์ส SoulGold ที่แนบ • ไม่รวม Ability, ไอเทม และสภาพสนาม • เกมเก่า/แฮ็กอื่นอาจต่างกัน</p>
</section>`;
layout.prepend(aside);

function badge(type,modifier=''){
  const meta=typeMeta[type];
  return `<span class="type-pill type-${type.toLowerCase()} ${modifier}" title="${type}">${meta.name}</span>`;
}
function emptyText(text='—'){return `<span class="type-empty">${text}</span>`;}
function incoming(defender,predicate){
  const di=typeMeta[defender].index;
  return TYPES.filter(attack=>predicate(MATCHUPS[attack][di]));
}
function renderOverview(){
  const body=aside.querySelector('#typeOverviewRows');
  body.replaceChildren();
  for(const type of TYPES){
    const meta=typeMeta[type];
    const strong=TYPES.filter(def=>MATCHUPS[type][typeMeta[def].index]>1);
    const weak=incoming(type,value=>value>1);
    const resist=incoming(type,value=>value>0&&value<1);
    const immune=incoming(type,value=>value===0);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <th scope="row"><span class="type-main">${badge(type)}<small>${type}</small></span></th>
      <td data-label="ชนะ">${strong.length?strong.map(t=>badge(t,'strong')).join(''):emptyText('ไม่มี')}</td>
      <td data-label="แพ้">${weak.length?weak.map(t=>badge(t,'weak')).join(''):emptyText('ไม่มี')}</td>
      <td data-label="ต้าน / กัน">
        <div class="type-defense-groups">
          ${resist.length?`<span class="type-defense-label">½×</span>${resist.map(t=>badge(t,'resist')).join('')}`:''}
          ${immune.length?`<span class="type-defense-label immune-label">0×</span>${immune.map(t=>badge(t,'immune')).join('')}`:''}
          ${!resist.length&&!immune.length?emptyText('ไม่มี'):''}
        </div>
      </td>`;
    body.append(tr);
  }
}

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

renderOverview();
renderCalculator();
