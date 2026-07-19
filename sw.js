const CACHE='herbier-v2-7-1-fixed';
const ASSETS=['./','index.html','styles-v271-fixed.css','app-v271-fixed.js','recipes.json','manifest.webmanifest','icon.svg','version.json'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);

  // Toujours privilégier le réseau pour la page et les fichiers applicatifs.
  if(request.mode==='navigate' || /\.(?:js|css|json)$/.test(url.pathname)){
    event.respondWith(
      fetch(request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request,{ignoreSearch:true}).then(cached=>cached || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached || fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
      return response;
    }))
  );
});
