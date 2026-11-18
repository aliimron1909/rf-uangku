const C='warmad-v3.3.0',F=['./','./index.html','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
let state={enabled:false,done:true};
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 if(/\/(admin|api)(\.|\/|$)/.test(new URL(e.request.url).pathname))return; // panel admin & API: selalu langsung ke jaringan, jangan di-cache
 const put=n=>{if(n.ok&&(e.request.url.startsWith(self.location.origin)||/cdn/.test(e.request.url))){const cp=n.clone();caches.open(C).then(c=>c.put(e.request,cp))}return n};
 if(e.request.mode==='navigate')return e.respondWith(fetch(e.request).then(put).catch(()=>caches.match('./index.html')));
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(put).catch(()=>caches.match('./index.html'))))});
const remind=()=>{const d=new Date();if(state.enabled&&!state.done&&d.getHours()>=9)return self.registration.showNotification('Pengingat Omset-WarMad',{body:'Omset hari ini belum dicatat, yuk input sekarang!',icon:'./icon.svg',tag:'omset-reminder'})};
self.addEventListener('message',e=>{const m=e.data||{};if(m.type==='state')state=m.state;if(m.type==='test')self.registration.showNotification('Tes Notifikasi',{body:'Pengingat Omset-WarMad: Omset hari ini belum dicatat, yuk input sekarang!',icon:'./icon.svg'});if(m.type==='check')remind()});
self.addEventListener('periodicsync',e=>{if(e.tag==='cek-omset')e.waitUntil(remind())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l.length?l[0].focus():clients.openWindow('./index.html')))});
