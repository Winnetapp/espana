/* =============================================================
   assets/js/header.js
   Header unificado para index.html, partido.html, apuestas.html
   ============================================================= */

(function () {

  /* ── Logo centrado (siempre) ── */
  const hCenter = document.getElementById('header-center');
  if (hCenter) {
    hCenter.innerHTML = `
      <a href="index.html" class="header-logo-link">
        <img src="logohead.png" alt="Winnet" class="logo" />
      </a>`;
  }

  /* ── Auth state ── */
  auth.onAuthStateChanged(async user => {
    const hLeft  = document.getElementById('header-left');
    const hRight = document.getElementById('header-right');
    if (!hLeft || !hRight) return;

    if (user) {
      try {
        const snap = await db.collection('usuarios').doc(user.uid).get();
        const ud   = snap.data() || {};
        const saldo = parseFloat(ud.saldo || 0);
        window._saldoUsuario = saldo;

        const uname  = ud.username || user.email || 'Usuario';
        const inicial = uname.charAt(0).toUpperCase();

        /* ── SALDO (izquierda) ── */
        hLeft.innerHTML = `
          <div class="hdr-saldo">
            <i class="fas fa-coins hdr-saldo-icon"></i>
            <span class="hdr-saldo-label">Saldo</span>
            <span class="hdr-saldo-val" id="hdr-saldo-val">${saldo.toFixed(2)} €</span>
          </div>`;

        /* ── USUARIO + NOTIFICACIONES (derecha) ── */
        hRight.innerHTML = `
          <div class="hdr-right-wrap">

            <!-- Botón campana — Centro de Notificaciones -->
            <button id="notif-bell-trigger" class="notif-bell-btn" title="Notificaciones" aria-label="Notificaciones">
              <i class="fas fa-bell"></i>
              <span class="notif-badge" id="notif-badge">0</span>
            </button>

            <div class="hdr-user-menu" id="_userMenuWrap">
              <button class="hdr-user-trigger" id="_userMenuTrigger" aria-haspopup="true" aria-expanded="false">
                <span class="hdr-avatar" aria-hidden="true">${inicial}</span>
                <span class="hdr-username">${uname}</span>
                <i class="fas fa-chevron-down hdr-chevron" aria-hidden="true"></i>
              </button>
              <div class="hdr-dropdown" id="_userDropdown" role="menu">
                <div class="hdr-dd-user">
                  <span class="hdr-dd-avatar">${inicial}</span>
                  <div>
                    <span class="hdr-dd-name">${uname}</span>
                    <span class="hdr-dd-saldo">${saldo.toFixed(2)} €</span>
                  </div>
                </div>
                <div class="hdr-dd-sep"></div>
                <a href="perfil.html" class="hdr-dd-item hdr-dd-perfil" role="menuitem">
                  <i class="fas fa-user-circle"></i> Mi Perfil
                </a>
                <div class="hdr-dd-sep"></div>
                <a href="index.html"    class="hdr-dd-item" role="menuitem"><i class="fas fa-futbol"></i> Partidos</a>
                <a href="apuestas.html" class="hdr-dd-item" role="menuitem"><i class="fas fa-ticket-alt"></i> Mis Apuestas</a>
                <a href="ranking.html"  class="hdr-dd-item" role="menuitem"><i class="fas fa-trophy"></i> Ranking</a>
                ${ud.rol === 'admin' ? `<a href="adminpartidos.html" class="hdr-dd-item hdr-dd-admin" role="menuitem"><i class="fas fa-shield-alt"></i> Panel Admin</a>` : ''}
                <div class="hdr-dd-sep"></div>
                <button class="hdr-dd-item hdr-dd-logout" id="_logoutBtn" role="menuitem">
                  <i class="fas fa-sign-out-alt"></i> Cerrar sesión
                </button>
              </div>
            </div>

          </div>`;

        /* ── Dropdown toggle ── */
        const trigger  = document.getElementById('_userMenuTrigger');
        const dropdown = document.getElementById('_userDropdown');
        let ddOpen = false;

        function openDD()  { ddOpen = true;  dropdown.classList.add('open');    trigger.setAttribute('aria-expanded', 'true');  trigger.classList.add('active'); }
        function closeDD() { ddOpen = false; dropdown.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); trigger.classList.remove('active'); }

        trigger.addEventListener('click', e => { e.stopPropagation(); ddOpen ? closeDD() : openDD(); });
        document.addEventListener('click', e => {
          if (ddOpen && !trigger.contains(e.target) && !dropdown.contains(e.target)) closeDD();
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && ddOpen) closeDD(); });

        /* ── Logout ── */
        document.getElementById('_logoutBtn')?.addEventListener('click', async () => {
          await auth.signOut();
          localStorage.removeItem('carritoApuestas');
          window.location.href = 'login.html';
        });

        /* ── Botón admin flotante (si existe en la página) ── */
        const btnAdmin = document.getElementById('btn-admin-panel');
        if (btnAdmin && ud.rol === 'admin') btnAdmin.style.display = 'flex';

        /* ── Inicializar Centro de Notificaciones ──────────────────
           WinnetNotifications.init() necesita db y auth.
           Lo llamamos aquí porque es el único sitio donde tenemos
           garantía de que el botón #notif-bell-trigger ya existe
           en el DOM y el usuario está autenticado.
           Si notifications.js no está cargado aún esperamos a que
           lo esté (puede pasar si los scripts cargan en paralelo).
        ────────────────────────────────────────────────────────── */
        if (window.WinnetNotifications) {
          window.WinnetNotifications.init(db, auth);
        } else {
          // Esperar a que notifications.js termine de cargar
          window.addEventListener('load', () => {
            if (window.WinnetNotifications) {
              window.WinnetNotifications.init(db, auth);
            }
          });
        }

        /* ── Avisar a otros scripts que el header está listo ── */
        window._headerReadyFired = true;
        window._headerReadyUid   = user.uid;
        window.dispatchEvent(new CustomEvent('header-ready', { detail: { uid: user.uid } }));

      } catch (err) {
        console.error('[header] Error:', err);
      }

    } else {
      /* ── No logueado ── */
      document.getElementById('header-left').innerHTML = '';

      document.getElementById('header-right').innerHTML = `
        <div class="hdr-auth-btns">
          <a href="register.html" class="hdr-btn hdr-btn-ghost">
            <i class="fas fa-user-plus"></i>
            <span class="hdr-btn-label">Registrarse</span>
          </a>
          <a href="login.html" class="hdr-btn hdr-btn-solid">
            <i class="fas fa-sign-in-alt"></i>
            <span class="hdr-btn-label">Iniciar sesión</span>
          </a>
        </div>`;

      window._headerReadyFired = true;
      window._headerReadyUid   = null;
      window.dispatchEvent(new CustomEvent('header-ready', { detail: { uid: null } }));
    }
  });

})();