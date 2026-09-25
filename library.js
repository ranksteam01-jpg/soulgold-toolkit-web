import {games,getGame,putGame,updateGame} from './play-store.js';
import {installCloudPanel} from './cloud-ui.js';
import * as cloud from './cloud.js';
const $=id=>document.getElementById(id);let all=[],editing=null,queue=Promise.resolve();
const title=g=>g.title||g.name.replace(/\.gba$/i,'');
const message=t=>$('libraryStatus').textContent=t;
const url=g=>'play.html?game='+encodeURIComponent(g.id);
function run(fn){queue=queue.then(fn).catch(e=>{const text=e.message||String(e);message(text);if($('editGameDialog').open)$('coverStatus').textContent=text;});return queue;}
async function refresh(){await cloud.ready;all=(await games()).filter(g=>!g.cloudOwner||g.cloudOwner===cloud.user()?.id);render();}
function render(){
 $('gameCount').textContent=all.length;$('favoriteCount').textContent=all.filter(g=>g.favorite).length;
 const recent=[...all].filter(g=>g.lastPlayed).sort((a,b)=>b.lastPlayed-a.lastPlayed)[0];
 if(recent){$('heroTitle').textContent=title(recent);$('heroText').textContent='การผจญภัยครั้งล่าสุดกำลังรอคุณอยู่ • เล่นต่อจากจุดที่บันทึกในเครื่องนี้';$('resumeGame').hidden=false;$('resumeGame').href=url(recent);$('heroAdd').hidden=true;const art=$('heroArt');art.querySelector('img')?.remove();art.classList.toggle('has-cover',!!recent.cover);if(recent.cover){const img=new Image();img.src=recent.cover;img.alt='';art.append(img);}}
 if(!recent){$('heroTitle').textContent='ทุกการผจญภัย ในคอลเลกชันเดียว';$('heroText').textContent='เพิ่มเกมในเครื่อง หรือเข้าสู่ระบบเพื่อดูคอลเลกชัน Cloud ของคุณ';$('resumeGame').hidden=true;$('resumeGame').removeAttribute('href');$('heroAdd').hidden=false;$('heroArt').querySelector('img')?.remove();$('heroArt').classList.remove('has-cover');}
 const search=$('searchGames').value.toLocaleLowerCase();let list=all.filter(g=>title(g).toLocaleLowerCase().includes(search)&&($('filterGames').value!=='favorites'||g.favorite));
 list.sort($('sortGames').value==='name'?(a,b)=>title(a).localeCompare(title(b)):(a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0));
 const grid=$('libraryGrid');grid.replaceChildren();
 if(!list.length){const empty=document.createElement('div');empty.className='empty';const h=document.createElement('h2');h.textContent=all.length?'ยังไม่พบเกมที่ตรงกัน':'ชั้นวางนี้รอเกมโปรดของคุณ';const p=document.createElement('p');p.textContent=all.length?'ลองค้นหาชื่ออื่น หรือเปลี่ยนตัวกรอง':'เพิ่ม ROM .gba ที่คุณมีสิทธิ์ใช้งาน ปกและเซฟจะอยู่กับคุณในเครื่องนี้';empty.append(h,p);grid.append(empty);}
 for(const g of list){
  const card=document.createElement('article');card.className='game-card';card.style.setProperty('--hue',parseInt(g.id.slice(0,4),16)%360);
  const art=document.createElement('a');art.className='button game-art';art.href=url(g);art.setAttribute('aria-label','เล่น '+title(g));
  if(g.cover){const img=new Image();img.src=g.cover;img.alt='';img.loading='lazy';art.append(img);}else{const initials=document.createElement('span');initials.className='initials';initials.textContent=title(g).split(/\s+/).map(s=>[...s][0]).slice(0,2).join('').toUpperCase();art.append(initials);}
  const overlay=document.createElement('span');overlay.className='play-overlay';overlay.textContent='▷ PLAY';art.append(overlay);
  const fav=document.createElement('button');fav.className='favorite';fav.setAttribute('aria-label','รายการโปรด '+title(g));fav.setAttribute('aria-pressed',!!g.favorite);fav.textContent=g.favorite?'★':'☆';fav.onclick=()=>run(async()=>{const latest=await getGame(g.id);await updateGame(g.id,{favorite:!latest.favorite});await refresh();});
  const info=document.createElement('div');info.className='game-info';const meta=document.createElement('div');meta.className='game-meta';meta.textContent='GAME BOY ADVANCE · '+(g.rom.byteLength/1048576).toFixed(1)+' MB';const h=document.createElement('h3');h.textContent=title(g);h.title=title(g);const small=document.createElement('small');small.textContent=g.lastPlayed?'เล่นล่าสุด '+new Date(g.lastPlayed).toLocaleDateString('th-TH'):'พร้อมเริ่มการผจญภัย';const bottom=document.createElement('div');bottom.className='game-bottom';const play=document.createElement('a');play.href=url(g);play.textContent='▷ เล่นเกม';const edit=document.createElement('button');edit.textContent='จัดปก';edit.setAttribute('aria-label','จัดปก '+title(g));edit.onclick=()=>{editing=g;$('gameTitle').value=title(g);$('coverInput').value='';$('coverStatus').textContent='เลือกปกของคุณ หรือเก็บภาพเดิมไว้';$('editGameDialog').showModal();};bottom.append(play,edit);info.append(meta,h,small,bottom);card.append(art,fav,info);grid.append(card);
 }
}
async function importGames(files){
 let added=0,duplicates=0;const errors=[];
 for(const file of files){try{
  if(!/\.gba$/i.test(file.name)||file.size<192||file.size>32*1048576)throw Error('ต้องเป็น .gba ไม่เกิน 32 MiB');
  const rom=new Uint8Array(await file.arrayBuffer());let sum=0;for(let i=0xa0;i<=0xbc;i++)sum+=rom[i];if(rom[0xb2]!==0x96||(-(sum+0x19)&255)!==rom[0xbd])throw Error('ข้อมูลหัวไฟล์ GBA ไม่สมบูรณ์');
  const id=await SG.hash(rom);if(await getGame(id)){duplicates++;continue;}await putGame({id,name:file.name,rom:rom.buffer,soulgold:false,symbols:null,createdAt:Date.now()});added++;
 }catch(e){errors.push(file.name+': '+e.message);}}
 await refresh();message(`เพิ่ม ${added} เกม · มีอยู่แล้ว ${duplicates} เกม${errors.length?' · '+errors.join(' / '):' • กดปกเพื่อเข้าเกมได้เลย'}`);
}
for(const id of ['addGames','heroAdd'])$(id).onclick=()=>$('romInput').click();
$('romInput').onchange=e=>{const files=[...e.target.files];e.target.value='';run(()=>importGames(files));};
for(const id of ['searchGames','filterGames','sortGames'])$(id).addEventListener('input',render);
$('dropZone').ondragover=e=>{e.preventDefault();$('dropZone').classList.add('drop-active');};$('dropZone').ondragleave=()=>$('dropZone').classList.remove('drop-active');$('dropZone').ondrop=e=>{e.preventDefault();$('dropZone').classList.remove('drop-active');run(()=>importGames([...e.dataTransfer.files]));};
$('closeEdit').onclick=()=>$('editGameDialog').close();
async function coverData(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1048576)throw Error('เลือก PNG / JPG / WebP ไม่เกิน 8 MB');const bmp=await createImageBitmap(file);try{if(!bmp.width||!bmp.height)throw Error('ภาพไม่สมบูรณ์');const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d'),scale=Math.max(c.width/bmp.width,c.height/bmp.height);ctx.drawImage(bmp,(600-bmp.width*scale)/2,(400-bmp.height*scale)/2,bmp.width*scale,bmp.height*scale);return c.toDataURL('image/jpeg',.84);}finally{bmp.close();}}
$('editGameForm').onsubmit=e=>{e.preventDefault();run(async()=>{const name=$('gameTitle').value.trim();if(!name)throw Error('กรุณาตั้งชื่อเกม');const patch={title:name},file=$('coverInput').files[0];if(file)patch.cover=await coverData(file);await updateGame(editing.id,patch);$('editGameDialog').close();await refresh();message('บันทึกชื่อและปกแล้ว');});};
$('keepStorage').onclick=()=>run(async()=>{if(!navigator.storage?.persist)throw Error('เบราว์เซอร์นี้ไม่มีตัวเลือกเก็บข้อมูลถาวร กรุณาสำรองเซฟเป็นไฟล์');message(await navigator.storage.persist()?'เบราว์เซอร์อนุญาตให้เก็บข้อมูลถาวรแล้ว • ยังคงควรสำรองเซฟ':'เบราว์เซอร์ยังไม่อนุญาต • สำรองเซฟก่อนล้างข้อมูลหรือเมื่อพื้นที่ใกล้เต็ม');});
window.addEventListener('pageshow',()=>run(refresh));await run(refresh);await installCloudPanel(refresh);
