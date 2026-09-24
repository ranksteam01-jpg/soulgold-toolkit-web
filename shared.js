/* Local-only shared state and accessible feedback. No save or ROM is uploaded. */
(() => {
  const prefix = 'soulgold.v2.';
  const memory = new Map();
  const SG = window.SG = {
    key: name => prefix + name,
    read(name) { try { return JSON.parse(localStorage.getItem(prefix + name)) || null; } catch { return memory.get(name) || null; } },
    write(name, value) {
      memory.set(name, value);
      try { localStorage.setItem(prefix + name, JSON.stringify(value)); window.dispatchEvent(new CustomEvent('sg-state', {detail:name})); return true; }
      catch { SG.toast('พื้นที่บันทึกในเบราว์เซอร์ไม่พร้อม กรุณาดาวน์โหลดสำรอง'); return false; }
    },
    remove(name) { memory.delete(name); try { localStorage.removeItem(prefix + name); } catch {} },
    download(name, data, type='application/octet-stream') {
      const url=URL.createObjectURL(data instanceof Blob ? data : new Blob([data], {type}));
      const a=document.createElement('a'); a.href=url; a.download=name.replace(/[\\/:*?"<>|]/g,'_');
      document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000);
    },
    normalize: s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'f').replace(/♂/g,'m').toLowerCase().replace(/[^a-z0-9]/g,''),
    asset(name, kind='front') {
      const all=window.SG_ASSETS?.pokemon||{}, key=SG.normalize(name);
      const aliases={castformnormal:'castform',burmyplant:'burmy',wormadamplant:'wormadam',mothimplant:'mothim',nidoranf:'nidoranf',nidoranm:'nidoranm'};
      const p=all[key]||all[aliases[key]];return p?.[kind] || (kind==='front'?p?.icon:null) || null;
    },
    toast(message) {
      let box=document.getElementById('sg-toast');
      if(!box){box=document.createElement('div');box.id='sg-toast';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:999999;background:#142b3b;color:white;padding:14px 22px;border:1px solid #74d9c1;border-radius:14px;max-width:90vw;box-shadow:0 12px 45px #0006;pointer-events:none;font:14px system-ui';document.body.append(box);}
      box.textContent=message;box.hidden=false;clearTimeout(SG.toastTimer);SG.toastTimer=setTimeout(()=>box.hidden=true,4500);
    },
    async hash(buffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(n=>n.toString(16).padStart(2,'0')).join(''); }
  };
  window.addEventListener('storage',e=>{if(e.key?.startsWith(prefix))window.dispatchEvent(new CustomEvent('sg-state',{detail:e.key.slice(prefix.length)}));});
})();
