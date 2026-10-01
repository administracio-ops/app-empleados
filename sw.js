const CACHE = 'app-empleados-v8';
const ARCHIVOS = ['./index.html', './manifest.json', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const habiaVersionAnterior = keys.some(k => k !== CACHE);
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // Si el móvil tenía una versión anterior, la app que sigue abierta con ella se recarga sola
    // (los trabajadores nunca cierran la app, y la versión vieja no sabe actualizarse por sí misma)
    if (habiaVersionAnterior) {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      ventanas.forEach(v => { if (v.navigate) v.navigate(v.url).catch(() => {}); });
    }
  })());
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Servidor (Apps Script), QR y buscador de direcciones: siempre a la red, nunca de la caché
  if (url.includes('script.google.com') || url.includes('googleusercontent.com') ||
      url.includes('api.qrserver.com') || url.includes('nominatim.openstreetmap.org') ||
      url.includes('version.json')) return;

  // Librerías (jsQR, pdf-lib) y la letra Inter: no cambian nunca,
  // así que se guardan la primera vez y después se sirven desde el móvil sin gastar datos
  if (url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com') ||
      url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        // Las etiquetas <script> de otro dominio llegan como respuesta "opaque" (status 0): también se guardan
        if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return res;
      }))
    );
    return;
  }

  // La app en sí: primero la red (versión publicada); sin conexión, la copia guardada
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
