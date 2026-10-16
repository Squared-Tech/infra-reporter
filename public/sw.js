// FixZed service worker: installable shell, offline fallback, no stale data.
const CACHE = "fixzed-v3";
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Hashed build assets and icons never change under a given URL, so serve them from cache.
const IMMUTABLE = [/^\/_next\/static\//, /^\/icons\//, /^\/img\//, /^\/manifest\.webmanifest$/];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Supabase, Overpass, Nominatim and the alert API must always hit the network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Keep the offline page warm even though pages themselves are not cached.
          caches.open(CACHE).then((c) => c.add("/offline")).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match("/offline").then((r) => r ?? Response.error())
        )
    );
    return;
  }

  if (IMMUTABLE.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
    return;
  }

  // Reports, API routes and app pages: network only, so a council queue is never stale.
});
