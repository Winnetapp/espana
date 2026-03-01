/* =============================================================
   assets/js/favoritos.js
   · Gestión de partidos favoritos con Firebase Firestore
   · Guarda en usuarios/{uid}/favoritos (array de partidoIds)
   · Si no hay usuario logueado, usa localStorage como fallback
   ============================================================= */

window.Favoritos = (function () {

  const STORAGE_KEY = 'winnet_favoritos';
  let _favSet = new Set();
  let _uid = null;
  let _listeners = [];

  /* ── Inicializar ── */
  async function init() {
    return new Promise(resolve => {
      firebase.auth().onAuthStateChanged(async user => {
        if (user) {
          _uid = user.uid;
          await _cargarDesdeFirestore();
        } else {
          _uid = null;
          _cargarDesdeLocal();
        }
        _notificar();
        resolve();
      });
    });
  }

  async function _cargarDesdeFirestore() {
    try {
      const doc = await firebase.firestore()
        .collection('usuarios').doc(_uid).get();
      const data = doc.data();
      _favSet = new Set(data?.favoritos || []);
    } catch (e) {
      _cargarDesdeLocal();
    }
  }

  function _cargarDesdeLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      _favSet = new Set(raw ? JSON.parse(raw) : []);
    } catch {
      _favSet = new Set();
    }
  }

  async function _guardar() {
    const arr = [..._favSet];
    if (_uid) {
      try {
        await firebase.firestore()
          .collection('usuarios').doc(_uid)
          .set({ favoritos: arr }, { merge: true });
      } catch (e) {
        console.warn('Favoritos: error guardando en Firestore', e);
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
  }

  /* ── Toggle ── */
  async function toggle(partidoId) {
    if (!partidoId) return;
    if (_favSet.has(partidoId)) {
      _favSet.delete(partidoId);
    } else {
      _favSet.add(partidoId);
    }
    await _guardar();
    _notificar();
    _actualizarBotones();
    return _favSet.has(partidoId);
  }

  function esFavorito(partidoId) {
    return _favSet.has(partidoId);
  }

  function getAll() {
    return [..._favSet];
  }

  /* ── Listeners ── */
  function onChange(fn) {
    _listeners.push(fn);
  }

  function _notificar() {
    _listeners.forEach(fn => fn([..._favSet]));
  }

  /* ── Actualizar todos los botones corazón en el DOM ── */
  function _actualizarBotones() {
    document.querySelectorAll('.fav-btn[data-partidoid]').forEach(btn => {
      const id = btn.dataset.partidoid;
      const activo = _favSet.has(id);
      btn.classList.toggle('fav-activo', activo);
      btn.title = activo ? 'Quitar de favoritos' : 'Añadir a favoritos';
      btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
  }

  /* ── Generar HTML del botón corazón ── */
  function btnHtml(partidoId) {
    const activo = _favSet.has(partidoId);
    return `<button
      class="fav-btn${activo ? ' fav-activo' : ''}"
      data-partidoid="${partidoId}"
      title="${activo ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
      aria-pressed="${activo}"
      aria-label="Favorito"
      onclick="event.stopPropagation(); Favoritos.toggle('${partidoId}').then(() => {})"
    ><svg class="fav-heart" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg></button>`;
  }

  return { init, toggle, esFavorito, getAll, onChange, btnHtml, _actualizarBotones };

})();