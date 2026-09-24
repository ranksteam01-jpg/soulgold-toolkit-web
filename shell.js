(() => {
 const id=window.SG?.read('last-game');
 if(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id))document.querySelectorAll('[data-resume]').forEach(a=>a.href='play.html?game='+id);
 if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});
 if(location.protocol==='file:'){const n=document.createElement('p');n.className='warning';n.textContent='เปิดผ่านเว็บ HTTPS หรือเซิร์ฟเวอร์ localhost ก่อนใช้งาน ตัวเล่นและคลังเกมไม่ทำงานเมื่อดับเบิลคลิกไฟล์ HTML';document.querySelector('main')?.prepend(n);}
})();
