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
   DEFINICIÓN DE LOGROS
════════════════════════════════ */
const LOGROS = [
  {
    id: 'primera_apuesta',
    icon: '🎯',
    nombre: 'Primera apuesta',
    desc: 'Realiza tu primera apuesta',
    color: '#3b82f6',
    check: ({ total }) => total >= 1,
  },
  {
    id: 'diez_apuestas',
    icon: '📋',
    nombre: '10 apuestas',
    desc: 'Realiza 10 apuestas en total',
    color: '#8b5cf6',
    check: ({ total }) => total >= 10,
  },
  {
    id: 'cincuenta_apuestas',
    icon: '📚',
    nombre: '50 apuestas',
    desc: 'Realiza 50 apuestas en total',
    color: '#6366f1',
    check: ({ total }) => total >= 50,
  },
  {
    id: 'primera_combinada',
    icon: '🔗',
    nombre: 'Combinadora',
    desc: 'Gana tu primera apuesta combinada',
    color: '#0ea5e9',
    check: ({ combinadasGanadas }) => combinadasGanadas >= 1,
  },
  {
    id: 'racha_5',
    icon: '🔥',
    nombre: 'En racha',
    desc: 'Gana 5 apuestas seguidas',
    color: '#f97316',
    check: ({ rachaMax }) => rachaMax >= 5,
  },
  {
    id: 'allin_ganado',
    icon: '💎',
    nombre: 'All-in ganado',
    desc: 'Gana una apuesta apostando todo tu saldo',
    color: '#ec4899',
    check: ({ allInGanado }) => allInGanado,
  },
  {
    id: 'cien_ganados',
    icon: '💰',
    nombre: '100€ ganados',
    desc: 'Acumula 100€ en ganancias totales',
    color: '#22c55e',
    check: ({ totalCobrado }) => totalCobrado >= 100,
  },
  {
    id: 'quinientos_ganados',
    icon: '🤑',
    nombre: '500€ ganados',
    desc: 'Acumula 500€ en ganancias totales',
    color: '#f5c518',
    check: ({ totalCobrado }) => totalCobrado >= 500,
  },
  {
    id: 'saldo_x2',
    icon: '📈',
    nombre: 'Saldo x2',
    desc: 'Dobla el saldo inicial de 1.000€',
    color: '#14b8a6',
    check: ({ saldo }) => saldo >= 2000,
  },
  {
    id: 'top_ranking',
    icon: '👑',
    nombre: 'Top del ranking',
    desc: 'Aparece en el top 3 del ranking de saldo',
    color: '#f5c518',
    check: ({ enTopRanking }) => enTopRanking,
  },
];

/* ════════════════════════════════
   CALCULAR LOGROS
════════════════════════════════ */
async function calcularLogros(uid, saldo, apuestas) {
  // Datos básicos
  const total     = apuestas.length;
  const ganadas   = apuestas.filter(a => a.estado === 'ganada');
  const totalCobrado = ganadas.reduce((s, a) => s + (a.ganancia || a.potentialWin || 0), 0);

  // Combinadas ganadas
  const combinadasGanadas = ganadas.filter(a => a.tipo === 'combinada' && (a.bets?.length || 0) > 1).length;

  // Racha máxima
  const resueltas = apuestas
    .filter(a => a.estado === 'ganada' || a.estado === 'perdida')
    .sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
  let rachaMax = 0, rachaActual = 0;
  for (const a of resueltas) {
    if (a.estado === 'ganada') { rachaActual++; rachaMax = Math.max(rachaMax, rachaActual); }
    else rachaActual = 0;
  }

  // All-in ganado: apuesta cuyo stake era >= 90% del saldo en ese momento
  // Como no guardamos el saldo previo, detectamos si stake >= 90% del saldo actual
  // como aproximación razonable
  const allInGanado = ganadas.some(a => {
    const stakePct = (a.stake || 0) / ((saldo || 1000));
    return stakePct >= 0.85;
  });

  // Top ranking: comprobar si está en top 3 por saldo
  let enTopRanking = false;
  try {
    const snap = await db.collection('usuarios').orderBy('saldo', 'desc').limit(3).get();
    enTopRanking = snap.docs.some(d => d.id === uid);
  } catch { enTopRanking = false; }

  return { total, totalCobrado, combinadasGanadas, rachaMax, allInGanado, saldo, enTopRanking };
}

/* ════════════════════════════════
   RENDER LOGROS (hero)
════════════════════════════════ */
function renderLogros(stats) {
  const logrosDesbloqueados = LOGROS.filter(l => l.check(stats));
  const logrosBloqueados    = LOGROS.filter(l => !l.check(stats));
  const total               = LOGROS.length;
  const conseguidos         = logrosDesbloqueados.length;

  // Chips de logros desbloqueados (máx 4 visibles + "ver todos")
  const visibles = logrosDesbloqueados.slice(0, 4);
  const extras   = logrosDesbloqueados.length - visibles.length;

  const chipsHTML = visibles.map(l => `
    <div class="logro-chip desbloqueado" title="${l.desc}" style="--logro-color:${l.color}">
      <span class="logro-chip-icon">${l.icon}</span>
      <span class="logro-chip-nombre">${l.nombre}</span>
    </div>
  `).join('');

  const extrasHTML = extras > 0
    ? `<div class="logro-chip-extra">+${extras} más</div>`
    : '';

  // Barra de progreso
  const pct = Math.round((conseguidos / total) * 100);

  return `
    <div class="perfil-logros-wrap" id="perfil-logros-wrap">
      <div class="logros-header">
        <span class="logros-titulo">
          <i class="fas fa-medal"></i> Logros
        </span>
        <span class="logros-progreso-txt">${conseguidos}/${total}</span>
      </div>

      <div class="logros-barra-wrap">
        <div class="logros-barra">
          <div class="logros-barra-fill" style="width:${pct}%"></div>
        </div>
      </div>

      ${conseguidos > 0 ? `
        <div class="logros-chips">
          ${chipsHTML}
          ${extrasHTML}
          <button class="logros-ver-todos" id="btn-ver-logros">
            Ver todos <i class="fas fa-chevron-down" style="font-size:0.6rem;"></i>
          </button>
        </div>
      ` : `
        <div class="logros-vacio">
          Aún no has desbloqueado ningún logro. ¡Empieza a apostar!
        </div>
      `}

      <!-- Panel expandible con todos los logros -->
      <div class="logros-panel" id="logros-panel" style="display:none;">
        <div class="logros-grid">
          ${LOGROS.map(l => {
            const ok = l.check(stats);
            return `
              <div class="logro-item ${ok ? 'ok' : 'bloqueado'}" style="--logro-color:${l.color}">
                <div class="logro-item-icon">${l.icon}</div>
                <div class="logro-item-info">
                  <div class="logro-item-nombre">${l.nombre}</div>
                  <div class="logro-item-desc">${l.desc}</div>
                </div>
                <div class="logro-item-estado">
                  ${ok
                    ? `<i class="fas fa-check-circle" style="color:${l.color};font-size:1rem;"></i>`
                    : `<i class="fas fa-lock" style="color:#3a3f52;font-size:0.85rem;"></i>`}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

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

    /* ── Cargar apuestas para logros ── */
    const snapAp = await db.collection('apuestas')
      .where('usuarioId', '==', user.uid)
      .orderBy('fecha', 'desc')
      .limit(200)
      .get();
    const apuestas = snapAp.docs.map(d => d.data());
    const statsLogros = await calcularLogros(user.uid, saldo, apuestas);

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
        ${renderLogros(statsLogros)}
      </div>`;

    /* ── Toggle ver todos los logros ── */
    document.getElementById('btn-ver-logros')?.addEventListener('click', () => {
      const panel = document.getElementById('logros-panel');
      const btn   = document.getElementById('btn-ver-logros');
      const abierto = panel.style.display !== 'none';
      panel.style.display = abierto ? 'none' : 'block';
      btn.innerHTML = abierto
        ? `Ver todos <i class="fas fa-chevron-down" style="font-size:0.6rem;"></i>`
        : `Cerrar <i class="fas fa-chevron-up" style="font-size:0.6rem;"></i>`;
    });

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
    await renderOverview(user.uid, apuestas);

  } catch (err) {
    console.error('[perfil] Error cargando datos:', err);
    showToast('Error al cargar el perfil', 'error');
  }
}

/* ════════════════════════════════
   PANEL RESUMEN
════════════════════════════════ */
async function renderOverview(uid, apuestasParam) {
  const panel = document.getElementById('panel-overview');
  panel.innerHTML = `<div class="perfil-loading"><div class="spinner-ring"></div>Cargando estadísticas...</div>`;

  try {
    // Reusar las apuestas ya cargadas si se pasan como parámetro
    let apuestas = apuestasParam;
    if (!apuestas) {
      const snap = await db.collection('apuestas')
        .where('usuarioId', '==', uid)
        .orderBy('fecha', 'desc')
        .limit(100)
        .get();
      apuestas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

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
          const tipo = a.bets?.length === 1
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
    btn.innerHTML = '<i class="fas fa-check"></i> Guardar cambios';
    btn.disabled  = !_usernameEditando;
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

  btn.disabled    = true;
  btn.textContent = 'Restableciendo...';

  try {
    await db.collection('usuarios').doc(_uid).update({ saldo: 1000 });
    _userData.saldo = 1000;

    const fmt          = '1.000,00 €';
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