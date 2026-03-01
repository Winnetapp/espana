/* =============================================================
   assets/js/push-notifications.js
   · Solicita permiso de notificaciones al usuario
   · Crea suscripción Web Push con VAPID
   · Guarda la suscripción en Firestore bajo usuarios/{uid}.pushSubs
   · Se activa cuando header.js dispara el evento 'header-ready'
   ============================================================= */

window.PushNotifications = (function () {

  const VAPID_PUBLIC_KEY = 'BI_IEiyt6NI7ByCOogEOW_Vu2-Yq9jLXX1YIMAJ0ryZAXiZEcybhkyLYdJaiqi7LLBWgUvoJAluRnFoqjE5_QM0';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
  }

  async function guardarSuscripcion(uid, sub) {
    try {
      await firebase.firestore().collection('usuarios').doc(uid).set({
        pushSubs: firebase.firestore.FieldValue.arrayUnion(JSON.stringify(sub.toJSON()))
      }, { merge: true });
      console.log('[push] Suscripción guardada ✓');
    } catch (e) {
      console.warn('[push] Error guardando suscripción:', e);
    }
  }

  async function eliminarSuscripcion(uid, sub) {
    try {
      await firebase.firestore().collection('usuarios').doc(uid).set({
        pushSubs: firebase.firestore.FieldValue.arrayRemove(JSON.stringify(sub.toJSON()))
      }, { merge: true });
    } catch (e) {
      console.warn('[push] Error eliminando suscripción:', e);
    }
  }

  async function suscribir(uid) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[push] Push no soportado');
      return false;
    }
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { console.log('[push] Permiso denegado'); return false; }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await guardarSuscripcion(uid, sub);
      return true;
    } catch (e) {
      console.error('[push] Error al suscribir:', e);
      return false;
    }
  }

  async function estadoActual() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'no-soportado';
    if (Notification.permission === 'denied')  return 'denegado';
    if (Notification.permission === 'default') return 'sin-pedir';
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'activo' : 'inactivo';
  }

  async function desuscribir(uid) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await eliminarSuscripcion(uid, sub); await sub.unsubscribe(); }
      return true;
    } catch (e) {
      console.error('[push] Error al desuscribir:', e);
      return false;
    }
  }

  function _escucharSW(uid) {
    navigator.serviceWorker.addEventListener('message', async event => {
      if (event.data?.type !== 'push-subscription-changed') return;
      const { newSub, oldSub } = event.data;
      if (!newSub) return;
      if (oldSub) {
        try {
          await firebase.firestore().collection('usuarios').doc(uid).set({
            pushSubs: firebase.firestore.FieldValue.arrayRemove(JSON.stringify(oldSub))
          }, { merge: true });
        } catch {}
      }
      try {
        await firebase.firestore().collection('usuarios').doc(uid).set({
          pushSubs: firebase.firestore.FieldValue.arrayUnion(JSON.stringify(newSub))
        }, { merge: true });
        console.log('[push] Suscripción renovada ✓');
      } catch {}
    });
  }

  function _actualizarBtn(btn, activo) {
    if (!btn) return;
    if (activo) {
      btn.textContent = '🔔';
      btn.title       = 'Notificaciones activadas — pulsa para desactivar';
      btn.classList.add('activo');
    } else {
      btn.textContent = '🔕';
      btn.title       = 'Activar notificaciones';
      btn.classList.remove('activo');
    }
  }

  async function _conectarBoton(uid) {
    const btn = document.getElementById('_notif-btn-placeholder');
    if (!btn) return;
    btn.id = '_notif-btn';

    const estado = await estadoActual();
    _actualizarBtn(btn, estado === 'activo');

    btn.addEventListener('click', async () => {
      const est = await estadoActual();
      if (est === 'denegado') {
        _toast('Notificaciones bloqueadas. Actívalas en la configuración del navegador.', 'error');
        return;
      }
      if (est === 'activo') {
        const ok = await desuscribir(uid);
        if (ok) { _actualizarBtn(btn, false); _toast('Notificaciones desactivadas'); }
      } else {
        const ok = await suscribir(uid);
        if (ok) { _actualizarBtn(btn, true); _toast('¡Notificaciones activadas! Te avisaremos de tus partidos favoritos 🎉'); }
      }
    });
  }

  function _toast(msg, tipo = 'ok') {
    let toast = document.getElementById('bet-toast') || document.getElementById('_push-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '_push-toast';
      toast.style.cssText = `
        position:fixed;bottom:24px;left:50%;
        transform:translateX(-50%) translateY(20px);
        background:#16181d;border:1px solid #252830;color:#e8e8ea;
        padding:10px 20px;border-radius:20px;font-size:0.85rem;font-weight:600;
        opacity:0;transition:opacity 0.3s,transform 0.3s;
        z-index:9999;pointer-events:none;
        font-family:Barlow,sans-serif;max-width:90vw;text-align:center;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.borderColor = tipo === 'error' ? '#e63030' : '#22c55e';
    toast.style.color       = tipo === 'error' ? '#ff8080' : '#22c55e';
    toast.style.opacity     = '1';
    toast.style.transform   = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3500);
  }

  async function init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    window.addEventListener('header-ready', async (e) => {
      const uid = e.detail?.uid;
      if (!uid) return;
      _escucharSW(uid);
      await _conectarBoton(uid);
    }, { once: true });
  }

  return { init, suscribir, desuscribir, estadoActual };

})();

document.addEventListener('DOMContentLoaded', () => PushNotifications.init());