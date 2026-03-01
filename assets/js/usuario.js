/* =============================================================
   assets/js/usuario.js
   Perfil público de otro usuario — Winnet
   Requiere: firebase-init.js, header.js cargados antes
   ============================================================= */

const LOGROS_DEF = [
  { id: 'primera_apuesta',   icon: '🎯', nombre: 'Primera apuesta',   desc: 'Realiza tu primera apuesta',              color: '#3b82f6', check: ({ total })              => total >= 1 },
  { id: 'diez_apuestas',     icon: '📋', nombre: '10 apuestas',       desc: 'Realiza 10 apuestas en total',            color: '#8b5cf6', check: ({ total })              => total >= 10 },
  { id: 'cincuenta_apuestas',icon: '📚', nombre: '50 apuestas',       desc: 'Realiza 50 apuestas en total',            color: '#6366f1', check: ({ total })              => total >= 50 },
  { id: 'primera_combinada', icon: '🔗', nombre: 'Combinadora',       desc: 'Gana tu primera apuesta combinada',       color: '#0ea5e9', check: ({ combinadasGanadas }) => combinadasGanadas >= 1 },
  { id: 'racha_5',           icon: '🔥', nombre: 'En racha',          desc: 'Gana 5 apuestas seguidas',               color: '#f97316', check: ({ rachaMax })          => rachaMax >= 5 },
  { id: 'allin_ganado',      icon: '💎', nombre: 'All-in ganado',     desc: 'Gana una apuesta apostando casi todo',    color: '#ec4899', check: ({ allInGanado })       => allInGanado },
  { id: 'cien_ganados',      icon: '💰', nombre: '100€ ganados',      desc: 'Acumula 100€ en ganancias totales',       color: '#22c55e', check: ({ totalCobrado })      => totalCobrado >= 100 },
  { id: 'quinientos_ganados',icon: '🤑', nombre: '500€ ganados',      desc: 'Acumula 500€ en ganancias totales',       color: '#f5c518', check: ({ totalCobrado })      => totalCobrado >= 500 },
  { id: 'saldo_x2',          icon: '📈', nombre: 'Saldo x2',          desc: 'Dobla el saldo inicial de 1.000€',        color: '#14b8a6', check: ({ saldo })             => saldo >= 2000 },
  { id: 'top_ranking',       icon: '👑', nombre: 'Top del ranking',   desc: 'Aparece en el top 3 del ranking',         color: '#f5c518', check: ({ enTopRanking })      => enTopRanking },
];

function showToast(msg, tipo = 'ok') {
  const t = document.getElementById('perfil-toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `visible ${tipo}`;
  setTimeout(() => { t.className = ''; }, 3000);
}

/* ── Leer ?uid= de la URL ── */
const params     = new URLSearchParams(window.location.search);
const targetUid  = params.get('uid');

let miUid = null;

if (!targetUid) {
  document.getElementById('usuario-root').innerHTML = `
    <div style="text-align:center;padding:80px 20px;color:#8a8f9e;">
      <div style="font-size:2rem;margin-bottom:12px;">🔍</div>
      <div style="font-size:1rem;font-weight:700;color:#e8e8ea;">Usuario no encontrado</div>
      <a href="ranking.html" style="color:#e63030;font-size:0.85rem;margin-top:12px;display:inline-block;">← Volver al ranking</a>
    </div>`;
} else {
  auth.onAuthStateChanged(async user => {
    miUid = user?.uid || null;

    /* Si intenta ver su propio perfil, redirige */
    if (miUid && miUid === targetUid) {
      window.location.href = 'perfil.html';
      return;
    }

    await cargarPerfilPublico(targetUid);
  });
}

/* ════════════════════════════════
   CARGAR PERFIL PÚBLICO
════════════════════════════════ */
async function cargarPerfilPublico(uid) {
  try {
    /* 1. Datos del usuario */
    const snapUser = await db.collection('usuarios').doc(uid).get();
    if (!snapUser.exists) {
      document.getElementById('usuario-root').innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:#8a8f9e;">
          <div style="font-size:2rem;margin-bottom:12px;">👤</div>
          <div style="font-weight:700;color:#e8e8ea;">Este usuario no existe</div>
          <a href="ranking.html" style="color:#e63030;font-size:0.85rem;margin-top:12px;display:inline-block;">← Volver al ranking</a>
        </div>`;
      return;
    }
    const ud       = snapUser.data();
    const username = ud.username || 'Usuario';
    const saldo    = parseFloat(ud.saldo || 0);
    const esAdmin  = ud.rol === 'admin';
    const inicial  = username.charAt(0).toUpperCase();

    /* 2. Apuestas para stats y logros */
    const snapAp = await db.collection('apuestas')
      .where('usuarioId', '==', uid)
      .where('estado', 'in', ['ganada', 'perdida', 'devuelta'])
      .get();
    const apuestas = snapAp.docs.map(d => d.data());

    const ganadas        = apuestas.filter(a => a.estado === 'ganada');
    const perdidas       = apuestas.filter(a => a.estado === 'perdida');
    const resueltas      = ganadas.length + perdidas.length;
    const totalApostado  = apuestas.reduce((s, a) => s + (a.stake || 0), 0);
    const totalCobrado   = ganadas.reduce((s, a) => s + (a.ganancia || a.potentialWin || 0), 0);
    const beneficio      = totalCobrado - totalApostado;
    const pct            = resueltas > 0 ? Math.round((ganadas.length / resueltas) * 100) : null;

    /* 3. Racha máxima */
    const ordenadas = [...apuestas].sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
    let rachaMax = 0, rachaActual = 0;
    for (const a of ordenadas) {
      if (a.estado === 'ganada') { rachaActual++; rachaMax = Math.max(rachaMax, rachaActual); }
      else if (a.estado === 'perdida') rachaActual = 0;
    }

    /* 4. All-in ganado */
    const allInGanado = ganadas.some(a => (a.stake || 0) / (saldo || 1000) >= 0.85);

    /* 5. Combinadas ganadas */
    const combinadasGanadas = ganadas.filter(a => a.tipo === 'combinada' && (a.bets?.length || 0) > 1).length;

    /* 6. Top ranking */
    let enTopRanking = false;
    try {
      const snapTop = await db.collection('usuarios').orderBy('saldo', 'desc').limit(3).get();
      enTopRanking = snapTop.docs.some(d => d.id === uid);
    } catch {}

    const statsLogros = { total: apuestas.length, totalCobrado, combinadasGanadas, rachaMax, allInGanado, saldo, enTopRanking };

    /* 7. Seguidores: cuántos le siguen */
    const snapSeg = await db.collection('seguidores')
      .where('siguiendoA', '==', uid)
      .get();
    const numSeguidores = snapSeg.size;

    /* 8. ¿Yo le sigo? */
    let yoLeSigo = false;
    if (miUid) {
      const snapYo = await db.collection('seguidores')
        .where('seguidor', '==', miUid)
        .where('siguiendoA', '==', uid)
        .limit(1)
        .get();
      yoLeSigo = !snapYo.empty;
    }

    /* 9. Logros desbloqueados */
    const logrosOk      = LOGROS_DEF.filter(l => l.check(statsLogros));
    const logrosBloq    = LOGROS_DEF.filter(l => !l.check(statsLogros));
    const logroPct      = Math.round((logrosOk.length / LOGROS_DEF.length) * 100);

    /* ── Render ── */
    document.title = `${username} — Winnet`;

    document.getElementById('usuario-root').innerHTML = `

      <!-- HERO -->
      <div class="perfil-hero">
        <div class="perfil-hero-inner">
          <div class="perfil-identity">
            <div class="perfil-avatar-wrap">
              <div class="perfil-avatar">${inicial}</div>
              ${esAdmin ? `<div class="perfil-avatar-badge" style="background:#f5c518;"><i class="fas fa-star" style="font-size:0.4rem;color:#000;"></i></div>` : `<div class="perfil-avatar-badge"><i class="fas fa-check" style="font-size:0.5rem;"></i></div>`}
            </div>
            <div class="perfil-info">
              <div class="perfil-nombre">
                ${username}
                <span class="perfil-rol-badge ${esAdmin ? 'admin' : ''}">${esAdmin ? 'Admin' : 'Usuario'}</span>
              </div>

              <!-- Seguidores + botón seguir -->
              <div class="usuario-social-row">
                <span class="usuario-seguidores" id="seguidores-count">
                  <i class="fas fa-users"></i>
                  <strong id="num-seguidores">${numSeguidores}</strong>
                  seguidor${numSeguidores !== 1 ? 'es' : ''}
                </span>
                ${miUid ? `
                  <button class="btn-seguir ${yoLeSigo ? 'siguiendo' : ''}" id="btn-seguir">
                    ${yoLeSigo
                      ? `<i class="fas fa-user-check"></i> Siguiendo`
                      : `<i class="fas fa-user-plus"></i> Seguir`}
                  </button>` : `
                  <a href="login.html" class="btn-seguir">
                    <i class="fas fa-user-plus"></i> Seguir
                  </a>`}
              </div>

              <!-- Saldo -->
              <div class="perfil-saldo-chip">
                <span class="perfil-saldo-chip-label">Saldo</span>
                <span class="perfil-saldo-chip-val">${saldo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
              </div>

              <!-- Logros -->
              <div class="perfil-logros-wrap">
                <div class="logros-header">
                  <span class="logros-titulo"><i class="fas fa-medal"></i> Logros</span>
                  <span class="logros-progreso-txt">${logrosOk.length}/${LOGROS_DEF.length}</span>
                </div>
                <div class="logros-barra-wrap">
                  <div class="logros-barra">
                    <div class="logros-barra-fill" style="width:${logroPct}%"></div>
                  </div>
                </div>
                ${logrosOk.length > 0 ? `
                  <div class="logros-chips">
                    ${logrosOk.slice(0, 4).map(l => `
                      <div class="logro-chip desbloqueado" title="${l.desc}" style="--logro-color:${l.color}">
                        <span class="logro-chip-icon">${l.icon}</span>
                        <span class="logro-chip-nombre">${l.nombre}</span>
                      </div>`).join('')}
                    ${logrosOk.length > 4 ? `<div class="logro-chip-extra">+${logrosOk.length - 4} más</div>` : ''}
                    <button class="logros-ver-todos" id="btn-ver-logros">
                      Ver todos <i class="fas fa-chevron-down" style="font-size:0.6rem;"></i>
                    </button>
                  </div>` : `<div class="logros-vacio">Sin logros desbloqueados aún.</div>`}

                <div class="logros-panel" id="logros-panel" style="display:none;">
                  <div class="logros-grid">
                    ${LOGROS_DEF.map(l => {
                      const ok = l.check(statsLogros);
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STATS -->
      <div class="perfil-main">
        <p class="section-title"><i class="fas fa-chart-bar" style="opacity:.5;font-size:.7rem;"></i> Estadísticas</p>
        <div class="stats-grid">
          <div class="stat-card azul">
            <span class="stat-card-label">Apuestas</span>
            <span class="stat-card-val">${apuestas.length}</span>
            <div class="stat-card-sub">${resueltas} resueltas</div>
          </div>
          <div class="stat-card verde">
            <span class="stat-card-label">Acierto</span>
            <span class="stat-card-val">${pct !== null ? pct + '%' : '—'}</span>
            <div class="stat-card-sub">${ganadas.length}G · ${perdidas.length}P</div>
          </div>
          <div class="stat-card amarillo">
            <span class="stat-card-label">Total apostado</span>
            <span class="stat-card-val">${totalApostado.toFixed(0)} €</span>
            <div class="stat-card-sub">acumulado</div>
          </div>
          <div class="stat-card ${beneficio >= 0 ? 'verde' : 'rojo'}">
            <span class="stat-card-label">Beneficio</span>
            <span class="stat-card-val">${beneficio >= 0 ? '+' : ''}${beneficio.toFixed(0)} €</span>
            <div class="stat-card-sub">${totalCobrado.toFixed(2)} € cobrado</div>
          </div>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="ranking.html" style="color:#e63030;font-size:0.82rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
            <i class="fas fa-arrow-left" style="font-size:0.7rem;"></i> Volver al ranking
          </a>
        </div>
      </div>`;

    /* ── Toggle logros ── */
    document.getElementById('btn-ver-logros')?.addEventListener('click', () => {
      const panel = document.getElementById('logros-panel');
      const btn   = document.getElementById('btn-ver-logros');
      const open  = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      btn.innerHTML = open
        ? `Ver todos <i class="fas fa-chevron-down" style="font-size:0.6rem;"></i>`
        : `Cerrar <i class="fas fa-chevron-up" style="font-size:0.6rem;"></i>`;
    });

    /* ── Seguir / Dejar de seguir ── */
    document.getElementById('btn-seguir')?.addEventListener('click', () => toggleSeguir(uid, yoLeSigo, numSeguidores, (nuevoEstado, nuevoNum) => {
      yoLeSigo    = nuevoEstado;
      numSeguidores = nuevoNum;
    }));

  } catch (err) {
    console.error('[usuario] Error:', err);
    document.getElementById('usuario-root').innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:#8a8f9e;">
        <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
        <div style="font-weight:700;color:#e8e8ea;">Error al cargar el perfil</div>
      </div>`;
  }
}

/* ════════════════════════════════
   SEGUIR / DEJAR DE SEGUIR
════════════════════════════════ */
async function toggleSeguir(uid, yoLeSigo, numActual, cb) {
  if (!miUid) { window.location.href = 'login.html'; return; }

  const btn     = document.getElementById('btn-seguir');
  const numEl   = document.getElementById('num-seguidores');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  try {
    const segRef = db.collection('seguidores');

    if (yoLeSigo) {
      /* Dejar de seguir: borrar documento */
      const snap = await segRef
        .where('seguidor', '==', miUid)
        .where('siguiendoA', '==', uid)
        .limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();

      const nuevoNum = Math.max(0, numActual - 1);
      if (numEl) numEl.textContent = nuevoNum;
      if (btn) btn.innerHTML = `<i class="fas fa-user-plus"></i> Seguir`;
      btn?.classList.remove('siguiendo');
      cb(false, nuevoNum);
      showToast('Has dejado de seguir a este usuario', 'ok');
    } else {
      /* Seguir: crear documento */
      await segRef.add({
        seguidor:    miUid,
        siguiendoA:  uid,
        fecha:       firebase.firestore.FieldValue.serverTimestamp(),
      });

      const nuevoNum = numActual + 1;
      if (numEl) numEl.textContent = nuevoNum;
      if (btn) btn.innerHTML = `<i class="fas fa-user-check"></i> Siguiendo`;
      btn?.classList.add('siguiendo');
      cb(true, nuevoNum);
      showToast('¡Ahora sigues a este usuario!', 'ok');
    }
  } catch (err) {
    console.error('[seguir] Error:', err);
    showToast('Error al actualizar. Inténtalo de nuevo.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}