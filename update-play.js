(() => {
 const ready=document.getElementById('ready'),button=document.getElementById('update'),status=document.getElementById('updateStatus');
 ready.onchange=()=>{button.disabled=!ready.checked;};
 button.onclick=async()=>{
  if(!ready.checked)return;
  button.disabled=true;ready.disabled=true;
  try{
   status.textContent='กำลังอัปเดตเฉพาะไฟล์หน้าเว็บ…';
   const scope=new URL('./',location.href).href;
   if('serviceWorker' in navigator){
    const registrations=await navigator.serviceWorker.getRegistrations();
    for(const registration of registrations)if(registration.scope===scope)await registration.unregister();
   }
   if('caches' in window){
    for(const name of await caches.keys()){
     if(!name.startsWith('soulgold-shell-'))continue;
     const cache=await caches.open(name);
     // Match this installation only. Delete cached app resources, never user storage.
     for(const request of await cache.keys())if(request.url.startsWith(scope))await cache.delete(request);
    }
   }
   status.textContent='อัปเดตแล้ว เซฟเดิมยังอยู่ กำลังเปิดหน้าเล่น…';
   location.replace('index.html?release=4');
  }catch(error){status.textContent='ยังอัปเดตไม่สำเร็จ: '+error.message+'\nตรวจว่าเซิร์ฟเวอร์ยังเปิดอยู่ แล้วลองใหม่ ไม่ต้องล้างข้อมูลเว็บไซต์';button.disabled=false;ready.disabled=false;}
 };
})();
