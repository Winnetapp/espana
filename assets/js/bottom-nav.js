/* =============================================================
   assets/js/bottom-nav.js
   Barra de navegación inferior — Winnet PWA

   Uso: incluir en TODAS las páginas después de firebase-init.js
   No necesita HTML previo, se inyecta solo.
   ============================================================= */

(function () {

  /* ── Detectar página actual ── */
  const path = window.location.pathname.split('/').pop() || 'index.html';

  const PAGINAS = {
    'index.html':     'partidos',
    '':               'partidos',
    'partido.html':   'partidos',
    'apuestas.html':  'apuestas',
    'perfil.html':    'perfil',
    'ranking.html':   'ranking',
  };

  const paginaActual = PAGINAS[path] || '';

  /* ── Inyectar HTML ── */
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  nav.innerHTML = `
    <a href="index.html" class="bn-item ${paginaActual === 'partidos' ? 'activo' : ''}" aria-label="Partidos">
      <div class="bn-icon">
        <i class="fas fa-futbol"></i>
      </div>
      <span class="bn-label">Partidos</span>
    </a>

    <a href="index.html#envivo" class="bn-item" id="bn-envivo" aria-label="En Vivo">
      <div class="bn-icon">
        <i class="fas fa-circle" style="font-size:0.75rem;color:var(--bn-rojo);"></i>
        <div class="bn-vivo-dot" id="bn-vivo-dot"></div>
      </div>
      <span class="bn-label">En Vivo</span>
    </a>

    <a href="ranking.html" class="bn-item ${paginaActual === 'ranking' ? 'activo' : ''}" aria-label="Ranking">
      <div class="bn-icon">
        <i class="fas fa-trophy"></i>
      </div>
      <span class="bn-label">Ranking</span>
    </a>

    <a href="apuestas.html" class="bn-item ${paginaActual === 'apuestas' ? 'activo' : ''}" aria-label="Mis Apuestas">
      <div class="bn-icon">
        <i class="fas fa-ticket-alt"></i>
        <span class="bn-badge" id="bn-badge-apuestas"></span>
      </div>
      <span class="bn-label">Apuestas</span>
    </a>

    <a href="perfil.html" class="bn-item ${paginaActual === 'perfil' ? 'activo' : ''}" aria-label="Mi Perfil" id="bn-perfil">
      <div class="bn-icon">
        <i class="fas fa-user"></i>
      </div>
      <span class="bn-label">Perfil</span>
    </a>
  `;

  document.body.appendChild(nav);

  /* ── En Vivo: navega a index y activa la pestaña en vivo ── */
  document.getElementById('bn-envivo')?.addEventListener('click', e => {
    if (path === 'index.html' || path === '') {
      e.preventDefault();
      // Si estamos en index, activar tab en vivo directamente
      const tabVivo = document.querySelector('.p-tab[data-tab="envivo"]');
      if (tabVivo) tabVivo.click();
    }
    // Si estamos en otra página, navega a index.html y el hash lo maneja
  });

  /* ── Badge apuestas pendientes (si el usuario está logueado) ── */
  function cargarBadgeApuestas(uid) {
    if (!uid || !window.db) return;
    db.collection('apuestas')
      .where('usuarioId', '==', uid)
      .where('estado', '==', 'pendiente')
      .onSnapshot(snap => {
        const badge = document.getElementById('bn-badge-apuestas');
        if (!badge) return;
        const n = snap.size;
        badge.textContent = n > 9 ? '9+' : n;
        badge.classList.toggle('visible', n > 0);
      }, () => {});
  }

  /* ── Punto En Vivo: comprueba si hay partidos en vivo ── */
  function cargarPuntoVivo() {
    if (!window.db) return;
    const ESTADOS_VIVO = ['1H', 'HT', '2H', 'ET', 'P'];
    db.collection('partidos')
      .where('estado', 'in', ESTADOS_VIVO)
      .onSnapshot(snap => {
        const dot = document.getElementById('bn-vivo-dot');
        if (!dot) return;
        dot.classList.toggle('visible', snap.size > 0);
      }, () => {});
  }

  /* ── Esperar a que Firebase esté listo ── */
  window.addEventListener('header-ready', e => {
    const uid = e.detail?.uid;
    if (uid) cargarBadgeApuestas(uid);
    cargarPuntoVivo();
  });

  /* ── Fallback: si header-ready ya disparó antes ── */
  if (window.auth) {
    window.auth.onAuthStateChanged(user => {
      if (user) cargarBadgeApuestas(user.uid);
      cargarPuntoVivo();
    });
  }

  /* ── En index.html: manejar el hash #envivo al cargar ── */
  if ((path === 'index.html' || path === '') && window.location.hash === '#envivo') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const tabVivo = document.querySelector('.p-tab[data-tab="envivo"]');
        if (tabVivo) tabVivo.click();
      }, 300);
    });
  }

})();