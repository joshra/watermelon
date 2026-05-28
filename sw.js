"use strict";

const CACHE_NAME = "suika-game-pwa-v12";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./vendor/matter.min.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/fruits/cherry.png",
  "./assets/fruits/strawberry.png",
  "./assets/fruits/grape.png",
  "./assets/fruits/orange.png",
  "./assets/fruits/apple.png",
  "./assets/fruits/pear.png",
  "./assets/fruits/peach.png",
  "./assets/fruits/pineapple.png",
  "./assets/fruits/cantaloupe.png",
  "./assets/fruits/coconut.png",
  "./assets/fruits/watermelon.png",
];
const NETWORK_FIRST_ASSET_PATHS = [
  "/",
  "/index.html",
  "/styles.css",
  "/game.js",
  "/manifest.webmanifest",
  "/sw.js",
];

function shouldUseNetworkFirst(requestUrl) {
  const scopePath = new URL(self.registration.scope).pathname;
  if (requestUrl.pathname === scopePath) return true;
  return NETWORK_FIRST_ASSET_PATHS.some((path) => requestUrl.pathname.endsWith(path));
}

async function cacheFreshResponse(request) {
  const response = await fetch(request, { cache: "reload" });
  if (response && response.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheFreshResponse(request);
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  if (shouldUseNetworkFirst(requestUrl)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    }),
  );
});
