// Service worker Turni e Ferie · Ergotech
// Aumentare REV insieme ad APP_REV (index.html) e a version.json a ogni pubblicazione.
const REV = 10;
const CACHE = "turni-ergotech-r" + REV;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192-v2.png", "./icon-512-v2.png", "./apple-touch-icon-v2.png", "./favicon-v2.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// L'app chiede di attivare subito la nuova versione quando l'utente preme "Aggiorna ora"
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // Firebase e altre API: sempre dalla rete, mai in cache
  if (/firestore|googleapis\.com\/identitytoolkit|securetoken|firebaseinstallations/.test(url.href)) return;
  // version.json: sempre dalla rete (serve per capire se c'è un aggiornamento)
  if (url.pathname.endsWith("version.json")) { e.respondWith(fetch(req, { cache: "no-store" })); return; }
  // Pagina: apertura immediata dalla copia salvata, che intanto si aggiorna dalla rete in sottofondo.
  // Con "Aggiorna ora" (?v=…) o senza copia salvata si va prima in rete.
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    const net = fetch(url.href, { cache: "no-store", credentials: "same-origin" }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put("./index.html", c)); } return r; });
    if (url.searchParams.has("v")) { e.respondWith(net.catch(() => caches.match("./index.html"))); return; }
    e.respondWith(caches.match("./index.html").then(hit => { if (hit) { e.waitUntil(net.catch(() => {})); return hit; } return net; }));
    return;
  }
  // Librerie, font, icone: prima la cache, poi la rete
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.origin === location.origin || /cdnjs|gstatic|fonts\.googleapis/.test(url.host))) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
    return r;
  })));
});
