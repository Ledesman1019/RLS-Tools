/* Service worker de RLS Tools (almacén móvil, funciona sin señal).
 *
 * - Archivos estáticos con huella (JS, CSS, íconos): de caché.
 * - Pantallas: de la red; si no hay señal, la última copia de esa pantalla.
 *   Los datos de trabajo (catálogo y cola de operaciones) viven en IndexedDB,
 *   así que la app sigue contando y registrando movimientos sin conexión.
 * - Al cerrar sesión la app pide borrar todas las copias (mensaje "clear").
 */
const VERSION = "rls-tools-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))));
  }
});

const PUBLIC = ["/login", "/actualizar", "/sin-acceso", "/adios"];

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pantallas (y sus datos RSC de navegación interna): red primero, copia guardada sin señal
  const isPage = request.mode === "navigate" || request.headers.get("RSC") === "1";
  if (isPage && !PUBLIC.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("/offline.html") : Response.error())),
        ),
    );
  }
});
