/* =============================================================
   assets/js/push-notifications.js  — v4
   · Chrome Android: Web Push nativo
   · iOS Safari PWA (≥16.4): Web Push nativo si está instalada
   · iOS Safari navegador: aviso de "instala la PWA"
   · Panel de diagnóstico visual (sin consola) para debug móvil
   · Feedback visual en TODOS los estados y errores

   FIX v4:
   · Registro explícito del SW antes de pedir permisos, pasando
     el serviceWorkerRegistration a getToken para que FCM use
     el SW correcto y no quede esperando indefinidamente.
   · Race condition corregida en init(): si header-ready se
     disparó antes de que DOMContentLoaded ejecute init(),
     el fallback ahora funciona de forma fiable.
   ============================================================= */

window.PushNotifications = (function () {

  const VAPID_PUBLIC_KEY = 'BI_IEiyt6NI7ByCOogEOW_Vu2-Yq9jLXX1YIMAJ0ryZAXiZEcybhkyLYdJaiqi7LLBWgUvoJAluRnFoqjE5_QM0';

  // ── Nombre real del Service Worker ──────────────────────────
  // Asegúrate de que coincide con el nombre del archivo en /public
  const SW_PATH = '/espana/service-worker.js';

  /* ── Detección de plataforma ── */
  const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid    = /android/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;
  const supportsPush = 'serviceWorker' in navigator && 'PushManager' in window;

  /* ── Logs visuales ── */
  const _logs = [];
  let _panelEl = null;

  function _log(msg, tipo = 'info') {
    const ts    = new Date().toLocaleTimeString('es-ES');
    const entry = `[${ts}] ${tipo.toUpperCase()}: ${msg}`;
    _logs.push(entry);
    console.log('[push]', entry);
    if (_panelEl) _renderPanel();
  }

  function _renderPanel() {
    if (!_panelEl) return;
    _panelEl.innerHTML = _logs.slice(-12).map(l => {
      const color = l.includes('ERROR') ? '#ff8080'
                  : l.includes('OK')    ? '#22c55e'
                  : l.includes('WARN')  ? '#f5c518' : '#8a8f9e';
      return `<div style="color:${color};margin-bottom:3px;word-break:break-all;">${l}</div>`;
    }).join('');
    _panelEl.scrollTop = _panelEl.scrollHeight;
  }

  function mostrarDiagnostico() {
    if (_panelEl) { _panelEl.parentElement?.remove(); _panelEl = null; return; }

    _log(`isIOS=${isIOS} isAndroid=${isAndroid} isStandalone=${isStandalone}`);
    _log(`supportsPush=${supportsPush}`);
    _log(`Notification.permission=${typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}`);
    _log(`SW in navigator=${('serviceWorker' in navigator)}`);
    _log(`PushManager in window=${('PushManager' in window)}`);
    _log(`iOS version=${_getIOSVersion()}`);

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position:fixed; bottom:calc(var(--bn-h,64px) + 70px); right:16px;
      z-index:99999; width:min(340px, calc(100vw - 32px));
      background:#0e0f14; border:1px solid #252830; border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,0.7); font-family:Barlow,monospace;
      font-size:0.72rem; overflow:hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#16181d;border-bottom:1px solid #252830;';
    header.innerHTML = `<span style="color:#f5c518;font-weight:700;font-size:0.78rem;">🔍 Diagnóstico Push</span>
      <button onclick="this.closest('div').parentElement.remove()" style="background:none;border:none;color:#8a8f9e;cursor:pointer;font-size:1rem;">✕</button>`;

    _panelEl = document.createElement('div');
    _panelEl.style.cssText = 'padding:10px 12px;max-height:220px;overflow-y:auto;';

    const footer = document.createElement('button');
    footer.textContent = '🔄 Actualizar estado';
    footer.style.cssText = 'width:100%;padding:8px;background:#16181d;border:none;border-top:1px solid #252830;color:#f5c518;cursor:pointer;font-family:Barlow,sans-serif;font-size:0.78rem;font-weight:700;';
    footer.onclick = async () => {
      _log('--- Actualizando estado ---');
      await _logEstadoCompleto();
      _renderPanel();
    };

    wrap.appendChild(header);
    wrap.appendChild(_panelEl);
    wrap.appendChild(footer);
    document.body.appendChild(wrap);
    _renderPanel();
  }

  async function _logEstadoCompleto() {
    _log(`permission=${typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}`);
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        _log(`SW registrations=${regs.length}`);
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        _log(`SW state=${reg.active?.state || 'N/A'} OK`);
        const sub = await reg.pushManager.getSubscription();
        _log(`Push subscription=${sub ? 'ACTIVA' : 'NINGUNA'} OK`);
        if (sub) _log(`endpoint=${sub.endpoint.slice(-30)}`);
      } catch (e) {
        _log(`SW/Push error: ${e.message}`, 'error');
      }
    }
  }

  function _getIOSVersion() {
    if (!isIOS) return 'N/A';
    const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    return m ? `${m[1]}.${m[2]}` : 'desconocida';
  }

  /* ── Toast ── */
  function _toast(msg, tipo = 'ok', duracion = 4000) {
    let el = document.getElementById('bet-toast') || document.getElementById('_push-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '_push-toast';
      el.style.cssText = `
        position:fixed;bottom:calc(var(--bn-h,64px) + 16px);left:50%;
        transform:translateX(-50%) translateY(20px);
        background:#16181d;border:1px solid #252830;color:#e8e8ea;
        padding:10px 20px;border-radius:20px;font-size:0.85rem;font-weight:600;
        opacity:0;transition:opacity 0.3s,transform 0.3s;
        z-index:9999;pointer-events:none;
        font-family:Barlow,sans-serif;max-width:90vw;text-align:center;
        line-height:1.5;
      `;
      document.body.appendChild(el);
    }
    el.innerHTML = msg;
    el.style.borderColor = tipo === 'error' ? '#e63030' : tipo === 'warn' ? '#f5c518' : '#22c55e';
    el.style.color       = tipo === 'error' ? '#ff8080' : tipo === 'warn' ? '#f5c518' : '#22c55e';
    el.style.opacity     = '1';
    el.style.transform   = 'translateX(-50%) translateY(0)';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.opacity   = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, duracion);
  }

  /* ── Modal "instala la PWA" (iOS navegador) ── */
  function _mostrarModalInstalaPWA() {
    if (document.getElementById('_pwa-install-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = '_pwa-install-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);
      z-index:99998;display:flex;align-items:flex-end;
      backdrop-filter:blur(4px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      width:100%;background:#16181d;
      border-radius:20px 20px 0 0;
      border-top:1px solid #252830;
      padding:24px 20px calc(var(--bn-h,64px) + 24px);
      font-family:Barlow,sans-serif;
    `;
    box.innerHTML = `
      <div style="width:40px;height:4px;background:#2e3242;border-radius:2px;margin:0 auto 20px;"></div>
      <div style="font-size:2rem;text-align:center;margin-bottom:12px;">📲</div>
      <h3 style="color:#e8e8ea;font-family:'Barlow Condensed',sans-serif;font-size:1.15rem;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;text-align:center;margin:0 0 10px;">
        Instala Winnet para activar notificaciones
      </h3>
      <p style="color:#8a8f9e;font-size:0.88rem;text-align:center;line-height:1.6;margin:0 0 20px;">
        En iOS, las notificaciones solo funcionan desde la app instalada.<br>
        Es gratis y tarda menos de 10 segundos.
      </p>
      <div style="background:#111215;border:1px solid #252830;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="font-size:1.3rem;">1️⃣</span>
          <span style="color:#e8e8ea;font-size:0.88rem;">Pulsa el botón <strong style="color:#f5c518;">Compartir</strong>
          <svg style="display:inline;vertical-align:middle;margin:0 3px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5c518" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          en Safari</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.3rem;">2️⃣</span>
          <span style="color:#e8e8ea;font-size:0.88rem;">Selecciona <strong style="color:#f5c518;">"Añadir a pantalla de inicio"</strong></span>
        </div>
      </div>
      <button id="_pwa-install-close" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#e63030,#c02020);
        color:#fff;border:none;border-radius:12px;
        font-family:'Barlow Condensed',sans-serif;font-size:1rem;
        font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;
      ">Entendido</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cerrar = () => overlay.remove();
    document.getElementById('_pwa-install-close')?.addEventListener('click', cerrar);
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
  }

  /* ── Helpers VAPID ── */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = atob(base64);
    return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
  }

  /* ── Firestore ── */
  async function guardarSuscripcion(uid, sub) {
    try {
      await firebase.firestore().collection('usuarios').doc(uid).set({
        pushSubs: firebase.firestore.FieldValue.arrayUnion(JSON.stringify(sub.toJSON()))
      }, { merge: true });
      _log('Suscripción guardada en Firestore OK');
    } catch (e) {
      _log(`Error guardando en Firestore: ${e.message}`, 'error');
      throw e;
    }
  }

  async function eliminarSuscripcion(uid, sub) {
    try {
      await firebase.firestore().collection('usuarios').doc(uid).set({
        pushSubs: firebase.firestore.FieldValue.arrayRemove(JSON.stringify(sub.toJSON()))
      }, { merge: true });
      _log('Suscripción eliminada de Firestore OK');
    } catch (e) {
      _log(`Error eliminando de Firestore: ${e.message}`, 'error');
    }
  }

  /* ── Estado actual ── */
  async function estadoActual() {
    if (!supportsPush)                             return 'no-soportado';
    if (isIOS && !isStandalone)                    return 'ios-navegador';
    if (typeof Notification === 'undefined')       return 'no-soportado';
    if (Notification.permission === 'denied')      return 'denegado';
    if (Notification.permission === 'default')     return 'sin-pedir';
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? 'activo' : 'inactivo';
    } catch (e) {
      _log(`estadoActual error: ${e.message}`, 'error');
      return 'error';
    }
  }

  /* ── Suscribir ── */
  async function suscribir(uid) {
    _log(`Iniciando suscripción para uid=${uid ? uid.slice(0,8) : 'null'}`);

    if (!supportsPush) { _log('Push no soportado', 'warn'); return false; }
    if (isIOS && !isStandalone) { _log('iOS sin PWA instalada', 'warn'); return false; }

    // ── FIX: registrar el SW explícitamente antes de cualquier otra cosa ──
    // Sin esto, navigator.serviceWorker.ready puede quedarse esperando
    // indefinidamente si el SW no fue registrado previamente por otro script.
    let swReg;
    try {
      swReg = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/espana/'
      });
      _log(`SW registrado OK (state=${swReg.active?.state || 'installing'})`);
    } catch (e) {
      _log(`Error registrando SW: ${e.message}`, 'error');
      _toast(`Error al registrar el Service Worker:<br>${e.message}`, 'error', 6000);
      return false;
    }

    // Solicitar permiso — DEBE hacerse desde un gesto del usuario (click)
    _log('Pidiendo permiso Notification...');
    let permiso;
    try {
      permiso = await Notification.requestPermission();
    } catch (e) {
      permiso = await new Promise(resolve => Notification.requestPermission(resolve));
    }
    _log(`Permiso resultado: ${permiso}`);
    if (permiso !== 'granted') {
      _toast('Permiso de notificaciones denegado', 'error');
      return false;
    }

    try {
      _log('Esperando SW ready...');
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('SW ready timeout 10s')), 10000))
      ]);
      _log(`SW listo: state=${reg.active?.state} OK`);

      // Eliminar suscripción anterior para evitar tokens inválidos
      const subAnterior = await reg.pushManager.getSubscription();
      if (subAnterior) {
        _log('Eliminando suscripción anterior...');
        await subAnterior.unsubscribe();
        _log('Suscripción anterior eliminada OK');
      }

      _log('Creando nueva suscripción push...');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      _log(`Suscripción creada OK endpoint=...${sub.endpoint.slice(-20)}`);

      await guardarSuscripcion(uid, sub);
      return true;
    } catch (e) {
      _log(`Error en suscripción: ${e.message}`, 'error');
      _toast(`Error al activar notificaciones:<br>${e.message}`, 'error', 6000);
      return false;
    }
  }

  /* ── Desuscribir ── */
  async function desuscribir(uid) {
    _log('Desuscribiendo...');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await eliminarSuscripcion(uid, sub);
        await sub.unsubscribe();
        _log('Desuscrito OK');
      } else {
        _log('No había suscripción activa', 'warn');
      }
      return true;
    } catch (e) {
      _log(`Error al desuscribir: ${e.message}`, 'error');
      return false;
    }
  }

  /* ── Renovar suscripción si el SW la rota ── */
  function _escucharSW(uid) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', async event => {
      if (event.data?.type !== 'push-subscription-changed') return;
      _log('SW notificó cambio de suscripción');
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
        _log('Suscripción renovada OK');
      } catch {}
    });
  }

  /* ── Actualizar estado visual del botón ── */
  function _actualizarBtn(btn, estado) {
    if (!btn) return;
    const configs = {
      'activo':        { icon: '🔔', title: 'Notificaciones activadas — pulsa para desactivar', cls: 'activo' },
      'sin-pedir':     { icon: '🔕', title: 'Activar notificaciones push', cls: '' },
      'inactivo':      { icon: '🔕', title: 'Activar notificaciones push', cls: '' },
      'denegado':      { icon: '🚫', title: 'Notificaciones bloqueadas en el navegador', cls: '' },
      'ios-navegador': { icon: '📲', title: 'Instala la app para recibir notificaciones', cls: '' },
      'no-soportado':  { icon: '🔕', title: 'Notificaciones no disponibles en este navegador', cls: '' },
      'error':         { icon: '⚠️', title: 'Error con las notificaciones', cls: '' },
    };
    const cfg = configs[estado] || configs['inactivo'];
    btn.textContent = cfg.icon;
    btn.title       = cfg.title;
    btn.className   = btn.className.replace(/\bactivo\b/, '').trim();
    if (cfg.cls) btn.classList.add(cfg.cls);
  }

  /* ── Conectar botón del header ── */
  async function _conectarBoton(uid) {
    let btn = null;
    for (let i = 0; i < 20; i++) {
      btn = document.getElementById('_notif-btn-placeholder') ||
            document.getElementById('_notif-btn');
      if (btn) break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (!btn) { _log('Botón notificaciones no encontrado en DOM', 'warn'); return; }
    btn.id = '_notif-btn';
    _log('Botón notificaciones encontrado OK');

    const estado = await estadoActual();
    _log(`Estado inicial: ${estado}`);
    _actualizarBtn(btn, estado);

    btn.addEventListener('click', async () => {
      _log('Click en botón notificaciones');

      const est = await estadoActual();
      _log(`Estado al click: ${est}`);

      if (est === 'ios-navegador') {
        _mostrarModalInstalaPWA();
        return;
      }

      if (est === 'denegado') {
        _toast(
          isIOS
            ? 'Ve a Ajustes → Winnet → Notificaciones y actívalas'
            : 'Notificaciones bloqueadas.<br>Pulsa el candado en la barra de dirección para activarlas.',
          'error', 6000
        );
        return;
      }

      if (est === 'no-soportado') {
        _toast('Tu navegador no soporta notificaciones push', 'error');
        return;
      }

      if (est === 'activo') {
        _toast('Desactivando notificaciones...', 'warn', 2000);
        const ok = await desuscribir(uid);
        if (ok) {
          _actualizarBtn(btn, 'inactivo');
          _toast('Notificaciones desactivadas');
        } else {
          _toast('Error al desactivar notificaciones', 'error');
        }
        return;
      }

      _toast('Activando notificaciones...', 'warn', 3000);
      _actualizarBtn(btn, 'sin-pedir');
      const ok = await suscribir(uid);
      if (ok) {
        _actualizarBtn(btn, 'activo');
        _toast('¡Notificaciones activadas! 🎉<br>Te avisaremos de tus partidos favoritos.');
      } else {
        const nuevoEstado = await estadoActual();
        _actualizarBtn(btn, nuevoEstado);
        if (nuevoEstado !== 'denegado') {
          _toast('No se pudieron activar las notificaciones.<br>Pulsa 🔍 para ver el diagnóstico.', 'error', 6000);
        }
      }
    });

    let _holdTimer = null;
    btn.addEventListener('pointerdown', () => {
      _holdTimer = setTimeout(() => { mostrarDiagnostico(); }, 800);
    });
    btn.addEventListener('pointerup',     () => clearTimeout(_holdTimer));
    btn.addEventListener('pointercancel', () => clearTimeout(_holdTimer));
  }

  /* ── Init ──
     FIX race condition: comprobamos primero si header-ready ya se disparó
     antes de registrar el listener, evitando que el evento se pierda
     si ocurrió entre la carga del script y DOMContentLoaded.
  ── */
  async function init() {
    _log('PushNotifications init');

    // ── FIX: comprobar primero si ya tenemos uid disponible ──
    const uidDisponible = window._headerReadyUid;
    if (uidDisponible) {
      _log(`uid ya disponible en window._headerReadyUid=${uidDisponible.slice(0,8)}`);
      _escucharSW(uidDisponible);
      await _conectarBoton(uidDisponible);
      return;
    }

    // Si todavía no se ha disparado, registrar el listener
    window.addEventListener('header-ready', async (e) => {
      const uid = e.detail?.uid;
      _log(`header-ready recibido uid=${uid ? uid.slice(0,8) : 'null'}`);
      if (!uid) return;
      _escucharSW(uid);
      await _conectarBoton(uid);
    }, { once: true });
  }

  return { init, suscribir, desuscribir, estadoActual, mostrarDiagnostico };

})();

document.addEventListener('DOMContentLoaded', () => PushNotifications.init());