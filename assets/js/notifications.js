/* ══════════════════════════════════════════════════════════════
   WINNET — CENTRO DE NOTIFICACIONES INTERNO
   Archivo: assets/js/notifications.js
══════════════════════════════════════════════════════════════ */

window.WinnetNotifications = (function () {

  const MAX_NOTIFS       = 60;
  const TOAST_DURATION   = 5000;

  let _db          = null;
  let _auth        = null;
  let _uid         = null;
  let _notifs      = [];
  let _tabActual   = 'todas';
  let _unsubscribe = null;
  let _toastQueue  = [];
  let _toastBusy   = false;

  /* ══════════════════════════════════════════════════════
     1 · INICIALIZACIÓN
  ══════════════════════════════════════════════════════ */
  function init(db, auth) {
    _db   = db;
    _auth = auth;

    _inyectarHTML();
    _bindUI();

    auth.onAuthStateChanged(function (user) {
      if (user) {
        _uid = user.uid;
        _iniciarListener();
        _saludo();
      } else {
        _uid = null;
        _notifs = [];
        if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
        _renderLista();
        _actualizarBadge();
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     2 · HTML del panel
  ══════════════════════════════════════════════════════ */
  function _inyectarHTML() {
    if (document.getElementById('notif-panel')) return;

    document.head.insertAdjacentHTML('beforeend',
      '<link rel="stylesheet" href="assets/css/notifications.css">');

    document.body.insertAdjacentHTML('beforeend', `
      <div id="notif-overlay"></div>

      <div id="notif-panel" role="dialog" aria-label="Centro de notificaciones">
        <div class="notif-panel-header">
          <span class="notif-panel-title">
            <i class="fas fa-bell"></i> Notificaciones
          </span>
          <div class="notif-panel-actions">
            <button class="notif-mark-all-btn" id="notif-mark-all">Marcar leídas</button>
            <button class="notif-close-btn" id="notif-close" aria-label="Cerrar">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="notif-tabs">
          <button class="notif-tab active" data-tab="todas">Todas</button>
          <button class="notif-tab" data-tab="sinleer">Sin leer</button>
          <button class="notif-tab" data-tab="apuestas">Apuestas</button>
          <button class="notif-tab" data-tab="partidos">Partidos</button>
        </div>

        <div class="notif-list" id="notif-list"></div>

        <div class="notif-panel-footer">
          <button class="notif-clear-all-btn" id="notif-clear-all">
            <i class="fas fa-trash-alt"></i> Limpiar todas las notificaciones
          </button>
        </div>
      </div>

      <div id="notif-toast">
        <span class="toast-icon" id="toast-icon"></span>
        <div class="toast-body">
          <div class="toast-title" id="toast-title"></div>
          <div class="toast-desc"  id="toast-desc"></div>
        </div>
      </div>
    `);
    // El botón #notif-bell-trigger lo crea header.js
  }

  /* ══════════════════════════════════════════════════════
     3 · BIND DE EVENTOS UI
  ══════════════════════════════════════════════════════ */
  function _bindUI() {
    document.addEventListener('click', function (e) {
      const bell = e.target.closest('#notif-bell-trigger');
      if (bell) { _abrirPanel(); return; }

      if (e.target.id === 'notif-close' || e.target.id === 'notif-overlay') {
        _cerrarPanel(); return;
      }

      const tab = e.target.closest('.notif-tab');
      if (tab && tab.dataset.tab) { _cambiarTab(tab.dataset.tab); return; }

      if (e.target.id === 'notif-mark-all') { _marcarTodasLeidas(); return; }
      if (e.target.id === 'notif-clear-all') { _limpiarTodas(); return; }

      const delBtn = e.target.closest('.notif-delete-btn');
      if (delBtn) {
        e.stopPropagation();
        _eliminarNotif(delBtn.dataset.id); return;
      }

      const item = e.target.closest('.notif-item');
      if (item && item.dataset.id) {
        _marcarLeida(item.dataset.id);
        const url = item.dataset.url;
        if (url) {
          _cerrarPanel();
          setTimeout(() => { window.location.href = url; }, 180);
        }
        return;
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     4 · PANEL OPEN / CLOSE
  ══════════════════════════════════════════════════════ */
  function _abrirPanel() {
    document.getElementById('notif-overlay')?.classList.add('active');
    document.getElementById('notif-panel')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function _cerrarPanel() {
    document.getElementById('notif-overlay')?.classList.remove('active');
    document.getElementById('notif-panel')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ══════════════════════════════════════════════════════
     5 · FIRESTORE — Listener en tiempo real
  ══════════════════════════════════════════════════════ */
  function _iniciarListener() {
    if (!_db || !_uid) return;
    if (_unsubscribe) _unsubscribe();

    _unsubscribe = _db
      .collection('usuarios')
      .doc(_uid)
      .collection('notificaciones')
      .orderBy('ts', 'desc')
      .limit(MAX_NOTIFS)
      .onSnapshot(function (snap) {
        const prevCount = _notifs.filter(n => !n.leida).length;
        _notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const newCount = _notifs.filter(n => !n.leida).length;

        _renderLista();
        _actualizarBadge();

        if (newCount > prevCount) {
          const nuevas = _notifs.filter(n => !n.leida).slice(0, newCount - prevCount);
          nuevas.forEach(n => _mostrarToast(n));
        }
      }, function (err) {
        console.warn('[Winnet Notif] Error listener:', err);
      });
  }

  /* ══════════════════════════════════════════════════════
     6 · RENDER DE LA LISTA
  ══════════════════════════════════════════════════════ */
  function _cambiarTab(tab) {
    _tabActual = tab;
    document.querySelectorAll('.notif-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    _renderLista();
  }

  function _filtradas() {
    switch (_tabActual) {
      case 'sinleer':  return _notifs.filter(n => !n.leida);
      case 'apuestas': return _notifs.filter(n => n.categoria === 'apuesta');
      case 'partidos': return _notifs.filter(n => n.categoria === 'partido');
      default:         return _notifs;
    }
  }

  function _renderLista() {
    const lista = document.getElementById('notif-list');
    if (!lista) return;

    const items = _filtradas();
    if (items.length === 0) {
      lista.innerHTML = `
        <div class="notif-empty">
          <i class="fas fa-bell-slash"></i>
          <span class="notif-empty-title">Sin notificaciones</span>
          <span class="notif-empty-sub">
            Aquí verás avisos sobre tus partidos favoritos,<br>
            resultados de apuestas y mucho más.
          </span>
        </div>`;
      return;
    }

    const grupos = {};
    items.forEach(n => {
      const key = _labelFecha(n.ts?.toDate ? n.ts.toDate() : new Date(n.ts));
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(n);
    });

    let html = '';
    Object.entries(grupos).forEach(([fecha, notifs]) => {
      html += `<div class="notif-date-sep">${fecha}</div>`;
      notifs.forEach(n => { html += _templateItem(n); });
    });

    lista.innerHTML = html;
  }

  function _urlDeNotif(n) {
    if (['gol', 'partido', 'inicio'].includes(n.tipo) && n.partidoId) {
      return 'partido.html?partidoId=' + n.partidoId;
    }
    if (['apuesta', 'ganada', 'perdida', 'empate'].includes(n.tipo) || n.categoria === 'apuesta') {
      return 'apuestas.html';
    }
    if (n.categoria === 'partido') {
      return 'index.html';
    }
    return null;
  }

  function _templateItem(n) {
    const tiempoRel = _tiempoRelativo(n.ts?.toDate ? n.ts.toDate() : new Date(n.ts));
    const url       = _urlDeNotif(n);
    const clicable  = url ? 'notif-item--link' : '';
    return `
      <div class="notif-item ${n.leida ? '' : 'unread'} ${clicable}"
           data-id="${n.id}"
           data-url="${url || ''}"
           ${url ? 'style="cursor:pointer;"' : ''}>
        <div class="notif-icon tipo-${n.tipo || 'sistema'}">
          <i class="${_iconoTipo(n.tipo)}"></i>
        </div>
        <div class="notif-body">
          <div class="notif-title">${_esc(n.titulo)}</div>
          <div class="notif-desc">${_esc(n.desc)}</div>
          <div class="notif-time">
            ${tiempoRel}
            ${url ? '<span class="notif-item-arrow"><i class="fas fa-chevron-right"></i></span>' : ''}
          </div>
        </div>
        <button class="notif-delete-btn" data-id="${n.id}" title="Eliminar">
          <i class="fas fa-times"></i>
        </button>
      </div>`;
  }

  function _iconoTipo(tipo) {
    const mapa = {
      partido: 'fas fa-futbol',
      gol:     'fas fa-futbol',
      apuesta: 'fas fa-ticket-alt',
      ganada:  'fas fa-check-circle',
      perdida: 'fas fa-times-circle',
      empate:  'fas fa-minus-circle',
      inicio:  'fas fa-play-circle',
      sistema: 'fas fa-bell',
    };
    return mapa[tipo] || 'fas fa-bell';
  }

  /* ══════════════════════════════════════════════════════
     7 · BADGE
  ══════════════════════════════════════════════════════ */
  function _actualizarBadge() {
    const badge = document.getElementById('notif-badge');
    const bell  = document.getElementById('notif-bell-trigger');
    if (!badge) return;

    const noLeidas = _notifs.filter(n => !n.leida).length;
    badge.textContent = noLeidas > 99 ? '99+' : noLeidas;
    badge.classList.toggle('visible', noLeidas > 0);
    bell?.classList.toggle('has-unread', noLeidas > 0);
  }

  /* ══════════════════════════════════════════════════════
     8 · ACCIONES
  ══════════════════════════════════════════════════════ */
  function _marcarLeida(id) {
    if (!_db || !_uid) return;
    _db.collection('usuarios').doc(_uid)
      .collection('notificaciones').doc(id)
      .update({ leida: true })
      .catch(e => console.warn('[Winnet Notif] marcarLeida:', e));
  }

  function _eliminarNotif(id) {
    if (!_db || !_uid) return;
    _db.collection('usuarios').doc(_uid)
      .collection('notificaciones').doc(id)
      .delete()
      .catch(e => console.warn('[Winnet Notif] eliminar:', e));
  }

  function _marcarTodasLeidas() {
    if (!_db || !_uid) return;
    const noLeidas = _notifs.filter(n => !n.leida);
    const batch = _db.batch();
    noLeidas.forEach(n => {
      const ref = _db.collection('usuarios').doc(_uid)
        .collection('notificaciones').doc(n.id);
      batch.update(ref, { leida: true });
    });
    batch.commit().catch(e => console.warn('[Winnet Notif] marcarTodas:', e));
  }

  function _limpiarTodas() {
    if (!_db || !_uid || _notifs.length === 0) return;
    const batch = _db.batch();
    _notifs.forEach(n => {
      const ref = _db.collection('usuarios').doc(_uid)
        .collection('notificaciones').doc(n.id);
      batch.delete(ref);
    });
    batch.commit().catch(e => console.warn('[Winnet Notif] limpiarTodas:', e));
  }

  /* ══════════════════════════════════════════════════════
     9 · CREAR NOTIFICACIÓN (frontend — solo apuestas)
     Goles, partidos y demás los crea el Worker.
  ══════════════════════════════════════════════════════ */
  function crear(opts) {
    if (!_db || !_uid) return Promise.resolve();

    const { titulo, desc, tipo, categoria, dedupeKey } = opts;

    if (dedupeKey) {
      const hoy = _hoyStr();
      const yaExiste = _notifs.some(n =>
        n.dedupeKey === dedupeKey &&
        _fechaStr(n.ts?.toDate ? n.ts.toDate() : new Date(n.ts)) === hoy
      );
      if (yaExiste) return Promise.resolve();
    }

    return _db.collection('usuarios').doc(_uid)
      .collection('notificaciones')
      .add({
        titulo,
        desc,
        tipo:      tipo || 'sistema',
        categoria: categoria || 'sistema',
        leida:     false,
        ts:        firebase.firestore.FieldValue.serverTimestamp(),
        dedupeKey: dedupeKey || null,
      })
      .catch(e => console.warn('[Winnet Notif] crear:', e));
  }

  /* ══════════════════════════════════════════════════════
     10 · TOAST
  ══════════════════════════════════════════════════════ */
  function _mostrarToast(notif) {
    _toastQueue.push(notif);
    if (!_toastBusy) _procesarToastQueue();
  }

  function _procesarToastQueue() {
    if (_toastQueue.length === 0) { _toastBusy = false; return; }
    _toastBusy = true;

    const n          = _toastQueue.shift();
    const toast      = document.getElementById('notif-toast');
    const toastIcon  = document.getElementById('toast-icon');
    const toastTitle = document.getElementById('toast-title');
    const toastDesc  = document.getElementById('toast-desc');
    if (!toast) { _toastBusy = false; return; }

    const emojis = { partido:'⏰', gol:'⚽', ganada:'✅', perdida:'❌', empate:'🤝', inicio:'🟢', apuesta:'🎫', sistema:'🔔' };
    toastIcon.textContent  = emojis[n.tipo] || '🔔';
    toastTitle.textContent = n.titulo;
    toastDesc.textContent  = n.desc;

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(_procesarToastQueue, 400);
    }, TOAST_DURATION);
  }

  /* ══════════════════════════════════════════════════════
     11 · NOTIFICACIONES DE APUESTAS (desde betslip-core)
     WinnetNotifications.apuestaResuelta(apuesta)
  ══════════════════════════════════════════════════════ */
  function apuestaResuelta(apuesta) {
    if (!apuesta) return;
    const { resultado, cuotaTotal, ganancia, selecciones } = apuesta;
    const resumen = selecciones?.map(s => s.partido).join(', ') || 'tu apuesta';

    if (resultado === 'ganada') {
      crear({
        titulo:    `✅ ¡Apuesta ganada! +${_formatEur(ganancia)}`,
        desc:      `Has ganado ${_formatEur(ganancia)} con cuota ${cuotaTotal}. ${resumen}`,
        tipo:      'ganada',
        categoria: 'apuesta',
      });
      if (parseFloat(cuotaTotal) >= 5) {
        crear({
          titulo:    `🏆 ¡Logro desbloqueado! Cuota alta ganada`,
          desc:      `Ganaste una apuesta con cuota ${cuotaTotal}. ¡Increíble!`,
          tipo:      'sistema',
          categoria: 'sistema',
          dedupeKey: `logro_cuota_alta_${Date.now()}`,
        });
      }
    } else if (resultado === 'perdida') {
      crear({
        titulo:    `❌ Apuesta perdida`,
        desc:      `No hubo suerte esta vez en: ${resumen}. ¡Sigue intentándolo!`,
        tipo:      'perdida',
        categoria: 'apuesta',
      });
      // Racha de pérdidas: se detecta en el array local, sin query a Firestore
      _comprobarRachaLocal();
    } else if (resultado === 'empate') {
      crear({
        titulo:    `🤝 Apuesta devuelta (empate)`,
        desc:      `La selección terminó en empate y se te devuelve el importe.`,
        tipo:      'empate',
        categoria: 'apuesta',
      });
    }
  }

  /* Comprueba racha de pérdidas usando el array local (_notifs),
     sin hacer ninguna query adicional a Firestore             */
  function _comprobarRachaLocal() {
    const apuestas = _notifs
      .filter(n => n.categoria === 'apuesta' && ['ganada','perdida','empate'].includes(n.tipo))
      .slice(0, 3);

    if (apuestas.length === 3 && apuestas.every(n => n.tipo === 'perdida')) {
      crear({
        titulo:    `💡 Consejo: llevas 3 pérdidas seguidas`,
        desc:      `Recuerda gestionar tu bankroll. Nunca apuestes más del 5% de tu saldo en una sola apuesta.`,
        tipo:      'sistema',
        categoria: 'sistema',
        dedupeKey: `racha_perdidas_${_hoyStr()}`,
      });
    }
  }

  /* ══════════════════════════════════════════════════════
     12 · SALUDO DEL DÍA
  ══════════════════════════════════════════════════════ */
  function _saludo() {
    // Usa el array local — sin queries extra a Firestore
    // El listener ya habrá cargado _notifs antes de que se llame
    // Se retrasa 2s para dar tiempo al onSnapshot inicial
    setTimeout(() => {
      crear({
        titulo:    `👋 ¡Bienvenido de nuevo a Winnet!`,
        desc:      `Tienes nuevos partidos disponibles. ¡Revisa tus favoritos y haz tus apuestas del día!`,
        tipo:      'sistema',
        categoria: 'sistema',
        dedupeKey: `saludo_${_hoyStr()}`,
      });
    }, 2000);
  }

  /* ══════════════════════════════════════════════════════
     13 · UTILIDADES
  ══════════════════════════════════════════════════════ */
  function _tiempoRelativo(fecha) {
    if (!fecha || isNaN(fecha)) return '';
    const diff = Date.now() - fecha.getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(min / 60);
    const d    = Math.floor(h / 24);
    if (min < 1)  return 'Ahora mismo';
    if (min < 60) return `Hace ${min} min`;
    if (h   < 24) return `Hace ${h} h`;
    if (d   < 7)  return `Hace ${d} día${d > 1 ? 's' : ''}`;
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  function _labelFecha(fecha) {
    if (!fecha || isNaN(fecha)) return 'Sin fecha';
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const f    = new Date(fecha); f.setHours(0,0,0,0);
    if (f.getTime() === hoy.getTime())  return 'Hoy';
    if (f.getTime() === ayer.getTime()) return 'Ayer';
    return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function _fechaStr(fecha) {
    if (!fecha || isNaN(fecha)) return '';
    return fecha.toISOString().slice(0, 10);
  }

  function _hoyStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function _formatEur(val) {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── API pública ── */
  return { init, crear, apuestaResuelta };

})();