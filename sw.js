const CACHE='herbier-v2-3';
const ASSETS=['./','index.html','styles.css','app.js','recipes.json','manifest.webmanifest','icon.svg','version.json'];

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

  if(request.mode==='navigate' || url.pathname.endsWith('/version.json')){
    event.respondWith(
      fetch(request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>{
      const network=fetch(request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
        return response;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});

self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING') self.skipWaiting();
});
