// ── Firebase Messaging (necesario para generar endpoints FCM v1) ──
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
  authDomain: "winnet-708db.firebaseapp.com",
  projectId: "winnet-708db",
  messagingSenderId: "869401097323",
  appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e"
});

const messaging = firebase.messaging();

// Cambia CACHE_NAME cada vez que actualices archivos
const CACHE_NAME = "winnet-cache-v6";

const STATIC_ASSETS = [
  "./index.html",
  "./admin.html",
  "./admin1.html",
  "./adminhub.html",
  "./apuestas.html",
  "./editar.html",
  "./login.html",
  "./partido.html",
  "./register.html",

  "./assets/css/style.css",
  "./assets/css/admin.css",
  "./assets/css/admin1.css",
  "./assets/css/apuestas.css",
  "./assets/css/auth.css",
  "./assets/css/editar.css",
  "./assets/css/partido.css",
  "./assets/css/favoritos.css",

  "./assets/js/main.js",
  "./assets/js/admin.js",
  "./assets/js/admin1.js",
  "./assets/js/apuestas.js",
  "./assets/js/auth.js",
  "./assets/js/editar.js",
  "./assets/js/partido.js",
  "./assets/js/favoritos.js",
  "./assets/js/push-notifications.js",

  "./icono-192.png",
  "./icono-512.png"
];

// ── Instalación ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn("[SW] Algunos archivos no se pudieron cachear:", err);
        return self.skipWaiting();
      })
  );
});

// ── Activación: borrar caches antiguos ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: red primero, cache como fallback ──
self.addEventListener("fetch", event => {
  const url = event.request.url;

  if (
    url.includes("firestore.googleapis.com")       ||
    url.includes("firebase.googleapis.com")        ||
    url.includes("identitytoolkit.googleapis.com") ||
    url.includes("securetoken.googleapis.com")     ||
    url.includes("football-data.org")              ||
    url.includes("the-odds-api.com")               ||
    url.includes("api-sports.io")                  ||
    url.includes("fcm.googleapis.com")             ||
    url.includes("oauth2.googleapis.com")          ||
    url.includes("gstatic.com")
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (event.request.method === "GET" && response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS
//
//  El worker de Cloudflare envía mensajes FCM v1 usando solo
//  webpush.data (sin campo notification) para que el SW
//  intercepte siempre el evento push y controle la notificación.
// ════════════════════════════════════════════════════════════

self.addEventListener("push", event => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Winnet", body: event.data.text() };
  }

  const title = payload.title
    || payload.notification?.title
    || payload.data?.title
    || "Winnet";

  const body  = payload.body
    || payload.notification?.body
    || payload.data?.body
    || "";

  const tag   = payload.tag   || payload.data?.tag  || "winnet-notif";
  const url   = payload.url   || payload.data?.url  || payload.fcm_options?.link || "./index.html";
  const tipo  = payload.tipo  || payload.data?.tipo || "general";

  const vibrate = tipo === "gol" ? [100,50,100,50,200] : [100,50,100];

  const actions = tipo === "apuesta"
    ? [{ action: "ver-apuestas", title: "🎫 Mis apuestas" }, { action: "cerrar", title: "Cerrar" }]
    : [{ action: "ver-partido",  title: "⚽ Ver partido"  }, { action: "cerrar", title: "Cerrar" }];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     "./icono-192.png",
      badge:    "./icono-192.png",
      tag,
      renotify: true,
      vibrate,
      data:     { url, tipo },
      actions,
    })
  );
});

// ── Click en notificación ──
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "cerrar") return;

  const { url, tipo } = event.notification.data || {};
  const destino = (event.action === "ver-apuestas" || tipo === "apuesta")
    ? "./apuestas.html"
    : (url || "./index.html");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("navigate" in client) { client.navigate(destino); client.focus(); return; }
      }
      return clients.openWindow(destino);
    })
  );
});

// ── Renovación automática de suscripción ──
self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then(newSub => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({
          type:   "push-subscription-changed",
          newSub: newSub.toJSON(),
          oldSub: event.oldSubscription?.toJSON(),
        }));
      });
    }).catch(err => console.error("[SW] Error renovando suscripción:", err))
  );
});