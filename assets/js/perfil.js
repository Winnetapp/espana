/* =============================================================
   assets/js/perfil.js
   Lógica de la página Mi Perfil — Winnet
   Requiere: firebase-init.js, header.js cargados antes
   ============================================================= */

let _uid = null;
let _userData = null;
let _usernameEditando = false;

/* ════════════════════════════════
   TOAST
════════════════════════════════ */
function showToast(msg, tipo = 'ok') {
  const t = document.getElementById('perfil-toast');
  t.textContent = msg;
  t.className = `visible ${tipo}`;
  setTimeout(() => { t.className = ''; }, 3000);
}

/* ════════════════════════════════
   TABS
════════════════════════════════ */
document.querySelectorAll('.perfil-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.perfil-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.perfil-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel)?.classList.add('active');
  });
});

/* ════════════════════════════════
   AUTH — redirige si no logueado
════════════════════════════════ */
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  _uid = user.uid;
  await cargarPerfil(user);
});

/* ════════════════════════════════
   CARGAR DATOS DEL PERFIL
════════════════════════════════ */
async function cargarPerfil(user) {
  try {
    const snap = await db.collection('usuarios').doc(user.uid).get();
    _userData = snap.data() || {};
    const saldo    = parseFloat(_userData.saldo || 0);
    const username = _userData.username || user.email || 'Usuario';
    const email    = user.email || '';
    const esAdmin  = _userData.rol === 'admin';

    /* ── Hero identity ── */
    const inicial = username.charAt(0).toUpperCase();
    const miembro = user.metadata?.creationTime
      ? `Miembro desde ${new Date(user.metadata.creationTime).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
      : '';

    document.getElementById('perfil-identity').innerHTML = `
      <div class="perfil-avatar-wrap">
        <div class="perfil-avatar">${inicial}</div>
        <div class="perfil-avatar-badge"><i class="fas fa-check" style="font-size:0.5rem;"></i></div>
      </div>
      <div class="perfil-info">
        <div class="perfil-nombre">
          ${username}
          <span class="perfil-rol-badge ${esAdmin ? 'admin' : ''}">${esAdmin ? 'Admin' : 'Usuario'}</span>
        </div>
        <div class="perfil-email">${email}</div>
        ${miembro ? `<div class="perfil-miembro"><i class="far fa-calendar-alt"></i>${miembro}</div>` : ''}
        <div class="perfil-saldo-chip">
          <span class="perfil-saldo-chip-label">Saldo</span>
          <span class="perfil-saldo-chip-val" id="hero-saldo-val">${saldo.toFixed(2)} €</span>
        </div>
      </div>`;

    /* ── Panel cuenta ── */
    const inputUsername = document.getElementById('input-username');
    const inputEmail    = document.getElementById('input-email');
    const saldoDisplay  = document.getElementById('saldo-display');
    const btnReset      = document.getElementById('btn-reset-saldo');

    if (inputUsername) { inputUsername.value = username; inputUsername.disabled = true; }
    if (inputEmail)    inputEmail.value = email;
    if (saldoDisplay)  saldoDisplay.textContent = `${saldo.toFixed(2)} €`;
    if (btnReset)      btnReset.disabled = saldo >= 100;

    /* ── Panel overview ── */
    await renderOverview(user.uid);

  } catch (err) {
    console.error('[perfil] Error cargando datos:', err);
    showToast('Error al cargar el perfil', 'error');
  }
}

/* ════════════════════════════════
   PANEL RESUMEN
════════════════════════════════ */
async function renderOverview(uid) {
  const panel = document.getElementById('panel-overview');
  panel.innerHTML = `<div class="perfil-loading"><div class="spinner-ring"></div>Cargando estadísticas...</div>`;

  try {
    const snap = await db.collection('apuestas')
      .where('usuarioId', '==', uid)
      .orderBy('fecha', 'desc')
      .limit(100)
      .get();

    const apuestas  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total     = apuestas.length;
    const ganadas   = apuestas.filter(a => a.estado === 'ganada');
    const perdidas  = apuestas.filter(a => a.estado === 'perdida');
    const pend      = apuestas.filter(a => a.estado === 'pendiente');
    const resueltas = ganadas.length + perdidas.length;
    const pct       = resueltas > 0 ? Math.round((ganadas.length / resueltas) * 100) : null;

    const totalApostado = apuestas.reduce((s, a) => s + (a.stake || 0), 0);
    const totalCobrado  = ganadas.reduce((s, a) => s + (a.ganancia || a.potentialWin || 0), 0);
    const beneficio     = totalCobrado - totalApostado;

    /* ── Últimas 5 apuestas ── */
    const ultimas     = apuestas.slice(0, 5);
    const ultimasHTML = ultimas.length
      ? ultimas.map(a => {
          const importe = a.estado === 'ganada'
            ? `+${(a.ganancia || a.potentialWin || 0).toFixed(2)} €`
            : a.estado === 'perdida'
              ? `-${(a.stake || 0).toFixed(2)} €`
              : `${(a.stake || 0).toFixed(2)} €`;
          const fecha = a.fecha?.toDate
            ? a.fecha.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            : '—';
          const tipo  = a.bets?.length === 1
            ? (a.bets[0]?.tipo || 'Apuesta')
            : `Combinada · ${a.bets?.length || 0} sel.`;

          return `<div class="apuesta-mini">
            <div class="apuesta-mini-dot ${a.estado}"></div>
            <div class="apuesta-mini-info">
              <div class="apuesta-mini-tipo">${tipo}</div>
              <div class="apuesta-mini-fecha">${fecha}</div>
            </div>
            <div class="apuesta-mini-importe ${a.estado}">${importe}</div>
          </div>`;
        }).join('')
      : `<div style="padding:20px 18px;color:var(--texto-dim);font-size:0.82rem;text-align:center;">
           Aún no has realizado ninguna apuesta.
         </div>`;

    panel.innerHTML = `
      <p class="section-title"><i class="fas fa-chart-bar" style="opacity:.5;font-size:.7rem;"></i> Estadísticas</p>
      <div class="stats-grid">
        <div class="stat-card azul">
          <span class="stat-card-label">Total apuestas</span>
          <span class="stat-card-val">${total}</span>
          <div class="stat-card-sub">${pend.length} pendiente${pend.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card verde">
          <span class="stat-card-label">Acierto</span>
          <span class="stat-card-val">${pct !== null ? pct + '%' : '—'}</span>
          <div class="stat-card-sub">${ganadas.length} ganadas de ${resueltas}</div>
        </div>
        <div class="stat-card amarillo">
          <span class="stat-card-label">Total apostado</span>
          <span class="stat-card-val">${totalApostado.toFixed(0)} €</span>
          <div class="stat-card-sub">en ${total} apuesta${total !== 1 ? 's' : ''}</div>
        </div>
        <div class="stat-card ${beneficio >= 0 ? 'verde' : 'rojo'}">
          <span class="stat-card-label">Beneficio neto</span>
          <span class="stat-card-val">${beneficio >= 0 ? '+' : ''}${beneficio.toFixed(2)} €</span>
          <div class="stat-card-sub">${totalCobrado.toFixed(2)} € cobrado</div>
        </div>
      </div>

      <p class="section-title" style="margin-top:28px;">
        <i class="fas fa-history" style="opacity:.5;font-size:.7rem;"></i> Últimas apuestas
      </p>
      <div class="p-card">
        ${ultimasHTML}
        ${ultimas.length > 0 ? `
          <div style="padding:10px 18px;border-top:1px solid var(--borde);">
            <a href="apuestas.html" style="font-size:0.78rem;font-weight:700;color:var(--rojo);text-decoration:none;display:flex;align-items:center;gap:5px;">
              Ver todas mis apuestas <i class="fas fa-arrow-right" style="font-size:0.65rem;"></i>
            </a>
          </div>` : ''}
      </div>`;

  } catch (err) {
    console.error('[perfil] Error overview:', err);
    panel.innerHTML = `<div style="text-align:center;padding:40px;color:var(--texto-dim);">Error al cargar estadísticas.</div>`;
  }
}

/* ════════════════════════════════
   EDITAR NOMBRE DE USUARIO
════════════════════════════════ */
document.getElementById('btn-edit-username')?.addEventListener('click', () => {
  const input      = document.getElementById('input-username');
  const btnGuardar = document.getElementById('btn-guardar-nombre');
  _usernameEditando = true;
  input.disabled    = false;
  input.focus();
  input.select();
  btnGuardar.disabled = false;
});

document.getElementById('input-username')?.addEventListener('input', () => {
  document.getElementById('err-username')?.classList.remove('visible');
  document.getElementById('ok-username')?.classList.remove('visible');
});

document.getElementById('btn-guardar-nombre')?.addEventListener('click', async () => {
  const input       = document.getElementById('input-username');
  const btn         = document.getElementById('btn-guardar-nombre');
  const errEl       = document.getElementById('err-username');
  const okEl        = document.getElementById('ok-username');
  const nuevoNombre = input.value.trim();

  errEl.classList.remove('visible');
  okEl.classList.remove('visible');

  if (!nuevoNombre) {
    errEl.textContent = 'El nombre no puede estar vacío.';
    errEl.classList.add('visible');
    return;
  }
  if (nuevoNombre.length < 3) {
    errEl.textContent = 'Mínimo 3 caracteres.';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  try {
    await db.collection('usuarios').doc(_uid).update({ username: nuevoNombre });
    _userData.username = nuevoNombre;

    input.disabled    = true;
    _usernameEditando = false;

    /* Actualizar hero en tiempo real */
    const heroNombre = document.querySelector('.perfil-nombre');
    if (heroNombre) heroNombre.childNodes[0].textContent = nuevoNombre + ' ';
    const heroAvatar = document.querySelector('.perfil-avatar');
    if (heroAvatar) heroAvatar.textContent = nuevoNombre.charAt(0).toUpperCase();

    okEl.textContent = '✓ Nombre actualizado correctamente.';
    okEl.classList.add('visible');
    showToast('Nombre actualizado', 'ok');
  } catch (err) {
    errEl.textContent = 'Error al guardar. Inténtalo de nuevo.';
    errEl.classList.add('visible');
    showToast('Error al guardar', 'error');
  } finally {
    btn.innerHTML   = '<i class="fas fa-check"></i> Guardar cambios';
    btn.disabled    = !_usernameEditando;
  }
});

/* ════════════════════════════════
   RESTABLECER SALDO
════════════════════════════════ */
document.getElementById('btn-reset-saldo')?.addEventListener('click', async () => {
  const btn         = document.getElementById('btn-reset-saldo');
  const saldoActual = parseFloat(_userData?.saldo || 0);

  if (saldoActual >= 100) {
    showToast('Solo puedes restablecer si tienes menos de 100 €', 'error');
    return;
  }

  btn.disabled     = true;
  btn.textContent  = 'Restableciendo...';

  try {
    await db.collection('usuarios').doc(_uid).update({ saldo: 1000 });
    _userData.saldo = 1000;

    const fmt = '1.000,00 €';
    const saldoDisplay = document.getElementById('saldo-display');
    const heroSaldo    = document.getElementById('hero-saldo-val');
    const hdrSaldo     = document.getElementById('hdr-saldo-val');

    if (saldoDisplay) saldoDisplay.textContent = fmt;
    if (heroSaldo)    heroSaldo.textContent    = fmt;
    if (hdrSaldo)     hdrSaldo.textContent     = '1000.00 €';

    showToast('Saldo restablecido a 1.000 €', 'ok');
  } catch (err) {
    showToast('Error al restablecer el saldo', 'error');
    btn.disabled    = false;
    btn.textContent = 'Restablecer';
  }
});

/* ════════════════════════════════
   CAMBIAR CONTRASEÑA
════════════════════════════════ */
document.getElementById('btn-cambiar-password')?.addEventListener('click', async () => {
  const actual    = document.getElementById('input-pass-actual').value;
  const nueva     = document.getElementById('input-pass-nueva').value;
  const confirmar = document.getElementById('input-pass-confirmar').value;
  const errEl     = document.getElementById('err-password');
  const okEl      = document.getElementById('ok-password');
  const btn       = document.getElementById('btn-cambiar-password');

  errEl.classList.remove('visible');
  okEl.classList.remove('visible');

  if (!actual || !nueva || !confirmar) {
    errEl.textContent = 'Rellena todos los campos.';
    errEl.classList.add('visible');
    return;
  }
  if (nueva.length < 6) {
    errEl.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
    errEl.classList.add('visible');
    return;
  }
  if (nueva !== confirmar) {
    errEl.textContent = 'Las contraseñas no coinciden.';
    errEl.classList.add('visible');
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cambiando...';

  try {
    const user       = auth.currentUser;
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, actual);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(nueva);

    document.getElementById('input-pass-actual').value    = '';
    document.getElementById('input-pass-nueva').value     = '';
    document.getElementById('input-pass-confirmar').value = '';

    okEl.textContent = '✓ Contraseña cambiada correctamente.';
    okEl.classList.add('visible');
    showToast('Contraseña actualizada', 'ok');
  } catch (err) {
    const msg = err.code === 'auth/wrong-password'
      ? 'La contraseña actual es incorrecta.'
      : err.code === 'auth/too-many-requests'
        ? 'Demasiados intentos. Espera un momento.'
        : 'Error al cambiar la contraseña.';
    errEl.textContent = msg;
    errEl.classList.add('visible');
    showToast('Error al cambiar contraseña', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-lock"></i> Cambiar contraseña';
  }
});

/* ════════════════════════════════
   CERRAR SESIÓN
════════════════════════════════ */
document.getElementById('btn-logout-perfil')?.addEventListener('click', async () => {
  await auth.signOut();
  localStorage.removeItem('carritoApuestas');
  window.location.href = 'login.html';
});