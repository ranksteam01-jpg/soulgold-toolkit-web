// Non-blocking confirmation keeps file import and browser controls responsive.
export function ask(message){return new Promise(resolve=>{
 const d=document.createElement('dialog');d.className='dialog';d.setAttribute('aria-label','ยืนยันการเปลี่ยนแปลง');
 const h=document.createElement('h2');h.textContent='ยืนยันก่อนดำเนินการ';const p=document.createElement('p');p.textContent=message;const actions=document.createElement('div');actions.className='actions';
 const no=document.createElement('button');no.textContent='ยกเลิก';const yes=document.createElement('button');yes.textContent='ยืนยัน';yes.className='primary';
 const finish=value=>{d.close();d.remove();resolve(value);};no.onclick=()=>finish(false);yes.onclick=()=>finish(true);d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});actions.append(no,yes);d.append(h,p,actions);document.body.append(d);d.showModal();no.focus();
});}
