// adminpartidos.js
// Lógica completa del panel de administración de Winnet

import { importar_partidos, actualizar_cuotas, archivar_partidos, actualizar_en_vivo } from "./admin_api.js";
import { actualizar_cuotas_completas, actualizar_cuotas_apifootball, actualizar_cuotas_extras } from "./admin_cuotas.js";
import { resolver_apuestas }  from "./admin_resolver.js";
import { rescatar_partidos }  from "./admin_rescatar.js";

/* ── Firebase ── */
const firebaseConfig = {
  apiKey:            "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
  authDomain:        "winnet-708db.firebaseapp.com",
  projectId:         "winnet-708db",
  storageBucket:     "winnet-708db.appspot.com",
  messagingSenderId: "869401097323",
  appId:             "1:869401097323:web:fddb5e44af9d27a7cfed2e",
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();

const LIGAS_IDS = [39, 140, 78, 135, 61, 2001, 88, 40, 94, 71, 2000, 2016];

// ── Activar para diagnosticar "No encontrado" en el log ──────────────────────
const DEBUG_NOMBRES = false;

/* ═══════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════ */
async function esAdmin(user) {
  try {
    const doc = await db.collection('usuarios').doc(user.uid).get();
    return doc.exists && doc.data()?.rol === 'admin';
  } catch { return false; }
}

function mostrarAdmin(user) {
  document.getElementById('pantalla-acceso').classList.add('oculto');
  document.getElementById('contenido-admin').style.display = 'block';
  document.getElementById('admin-email').textContent = user.email;
  cargarStats();
  actualizarBadgeWorker();
}

function mostrarLogin(msg = '') {
  document.getElementById('pantalla-acceso').classList.remove('oculto');
  document.getElementById('contenido-admin').style.display = 'none';
  const err = document.getElementById('login-error');
  if (msg) { err.textContent = msg; err.classList.add('visible'); }
  else err.classList.remove('visible');
}

auth.onAuthStateChanged(async user => {
  if (user) {
    if (await esAdmin(user)) mostrarAdmin(user);
    else { await auth.signOut(); mostrarLogin('⛔ Sin permisos de administrador.'); }
  } else {
    mostrarLogin();
  }
});

/* ── Login ── */
const btnLogin = document.getElementById('btn-login');
btnLogin.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  document.getElementById('login-error').classList.remove('visible');
  if (!email || !pass) {
    document.getElementById('login-error').textContent = 'Introduce email y contraseña.';
    document.getElementById('login-error').classList.add('visible');
    return;
  }
  btnLogin.disabled = true;
  btnLogin.classList.add('loading');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    const msgs = {
      'auth/user-not-found':    'Usuario no encontrado.',
      'auth/wrong-password':    'Contraseña incorrecta.',
      'auth/invalid-email':     'Email no válido.',
      'auth/too-many-requests': 'Demasiados intentos.',
    };
    document.getElementById('login-error').textContent = msgs[err.code] || 'Error al iniciar sesión.';
    document.getElementById('login-error').classList.add('visible');
  } finally {
    btnLogin.disabled = false;
    btnLogin.classList.remove('loading');
  }
});

['login-email', 'login-password'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') btnLogin.click();
  })
);

document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

/* ═══════════════════════════════════════════════════════
   BADGE WORKER
═══════════════════════════════════════════════════════ */
function actualizarBadgeWorker() {
  const badge = document.getElementById('scheduler-badge');
  if (!badge) return;
  badge.textContent       = '☁ Auto · Cloudflare Worker';
  badge.style.background  = 'rgba(34,197,94,0.12)';
  badge.style.color       = 'var(--verde)';
  badge.style.borderColor = 'rgba(34,197,94,0.25)';
}

/* ═══════════════════════════════════════════════════════
   LOG
═══════════════════════════════════════════════════════ */
function log(msg, tipo = 'info') {
  const logEl = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${tipo}`;
  entry.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString('es-ES')}</span><span class="log-msg">${msg}</span>`;
  const placeholder = logEl.querySelector('.log-entry.info:only-child');
  if (placeholder?.querySelector('.log-msg')?.textContent === 'Esperando acciones...') placeholder.remove();
  logEl.prepend(entry);
}

/* ═══════════════════════════════════════════════════════
   BADGES DE LIGA
═══════════════════════════════════════════════════════ */
function setLigaBadge(id, texto, tipo) {
  const el = document.getElementById(`badge-${id}`);
  if (!el) return;
  el.textContent = texto;
  el.className = `liga-badge ${tipo}`;
}

function resetLigaBadges() {
  LIGAS_IDS.forEach(id => setLigaBadge(id, '—', 'pending'));
}

/* ═══════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════ */
async function cargarStats() {
  try {
    const [proxSnap, vivoSnap, histSnap, apuestasSnap] = await Promise.all([
      db.collection('partidos').where('estado', '==', 'NS').get(),
      db.collection('partidos').where('estado', 'in', ['1H','HT','2H','ET','P']).get(),
      db.collection('historial').get(),
      db.collection('apuestas').where('estado', '==', 'pendiente').get(),
    ]);

    const conCuotas = proxSnap.docs.filter(d => d.data().cuotas).length;
    document.getElementById('stat-proximos').textContent  = proxSnap.size;
    document.getElementById('stat-vivo').textContent      = vivoSnap.size;
    document.getElementById('stat-historial').textContent = histSnap.size;
    document.getElementById('stat-cuotas').textContent    = conCuotas;
    document.getElementById('stat-apuestas').textContent  = apuestasSnap.size;

    const porLiga = {};
    proxSnap.docs.forEach(d => {
      const lid = d.data().ligaId;
      if (!porLiga[lid]) porLiga[lid] = { total: 0, cuotas: 0 };
      porLiga[lid].total++;
      if (d.data().cuotas) porLiga[lid].cuotas++;
    });
    LIGAS_IDS.forEach(id => {
      if (porLiga[id]) {
        const { total, cuotas } = porLiga[id];
        setLigaBadge(id, `${total} · ${cuotas}💰`, cuotas === total ? 'ok' : cuotas > 0 ? 'loading' : 'pending');
      } else {
        setLigaBadge(id, 'Sin datos', 'pending');
      }
    });
  } catch (err) {
    log('Error cargando estadísticas: ' + err.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════
   PROGRESS BAR
═══════════════════════════════════════════════════════ */
let _progressInterval = null;

function startProgress(totalSecs, label) {
  const wrap = document.getElementById('progress-bar-wrap');
  const bar  = document.getElementById('progress-bar');
  wrap.style.display = 'block';
  document.getElementById('progress-label').textContent = label;
  bar.style.width = '0%';
  bar.style.background = 'linear-gradient(90deg,var(--rojo),var(--amarillo))';
  let elapsed = 0;
  clearInterval(_progressInterval);
  _progressInterval = setInterval(() => {
    elapsed++;
    document.getElementById('progress-timer').textContent = `${elapsed}s`;
    bar.style.width = Math.min(98, Math.round((elapsed / totalSecs) * 100)) + '%';
  }, 1000);
}

function stopProgress(success = true) {
  clearInterval(_progressInterval);
  const wrap = document.getElementById('progress-bar-wrap');
  const bar  = document.getElementById('progress-bar');
  bar.style.width = '100%';
  bar.style.background = success
    ? 'linear-gradient(90deg,var(--verde),#4ade80)'
    : 'linear-gradient(90deg,var(--rojo),#ff6b6b)';
  setTimeout(() => {
    wrap.style.display = 'none';
    bar.style.background = 'linear-gradient(90deg,var(--rojo),var(--amarillo))';
  }, 1800);
}

/* ═══════════════════════════════════════════════════════
   HELPER — deshabilitar/habilitar todos los botones de cuotas
═══════════════════════════════════════════════════════ */
// ── MODIFICADO: añadido 'btn-cuotas-extras' al array ──
const BTN_CUOTAS_IDS = ['btn-cuotas', 'btn-cuotas-full', 'btn-cuotas-afb', 'btn-cuotas-extras'];

function bloquearBotonesCuotas() {
  BTN_CUOTAS_IDS.forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = true;
  });
}

function desbloquearBotonesCuotas() {
  BTN_CUOTAS_IDS.forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = false;
  });
}

/* ═══════════════════════════════════════════════════════
   WRAPPER GENÉRICO
═══════════════════════════════════════════════════════ */
async function ejecutar(btnId, fn, msgInicio, msgFin, trackLigas = false, estimatedSecs = 10) {
  const btn = document.getElementById(btnId);
  btn.disabled = true;
  btn.classList.add('loading');
  log(msgInicio, 'info');
  startProgress(estimatedSecs, msgInicio);

  if (trackLigas) {
    resetLigaBadges();
    LIGAS_IDS.forEach(id => setLigaBadge(id, 'En cola...', 'loading'));
  }

  try {
    const result = await fn(
      db,
      trackLigas
        ? (ligaId, txt, tipo) => {
            setLigaBadge(ligaId, txt, tipo);
            log(`[Liga ${ligaId}] ${txt}`, tipo === 'error' ? 'error' : 'info');
          }
        : (msg, tipo) => log(msg, tipo)
    );
    stopProgress(true);
    log(`${msgFin} → ${JSON.stringify(result)}`, 'ok');
    document.getElementById('last-update').textContent = `Última acción: ${new Date().toLocaleString('es-ES')}`;
    await cargarStats();
  } catch (err) {
    stopProgress(false);
    log('❌ Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

/* ═══════════════════════════════════════════════════════
   WRAPPER CUOTAS
═══════════════════════════════════════════════════════ */
async function ejecutarCuotas(btnActivoId, fn, msgInicio, estimatedSecs = 30) {
  const btnActivo = document.getElementById(btnActivoId);
  bloquearBotonesCuotas();
  btnActivo.classList.add('loading');
  log(msgInicio, 'info');
  resetLigaBadges();
  startProgress(estimatedSecs, msgInicio);

  try {
    const result = await fn(db, (tipo, msg, ligaId) => {
      if (ligaId) {
        const badgeTipo = tipo === 'ok' ? 'ok' : tipo === 'error' ? 'error' : 'loading';
        setLigaBadge(ligaId, msg.slice(0, 25), badgeTipo);
      }
      log(msg, tipo);
    });

    stopProgress(true);
    log(`✅ ${result.totalActualizados} partidos actualizados`, 'ok');
    if (result.totalSinCuotas > 0) log(`⚠ ${result.totalSinCuotas} sin cuotas`, 'warn');
    if (result.errores?.length)    log(`❌ Errores en ligas: ${result.errores.join(', ')}`, 'error');
    document.getElementById('last-update').textContent = `Última acción: ${new Date().toLocaleString('es-ES')}`;
    await cargarStats();
  } catch (err) {
    stopProgress(false);
    log('❌ Error: ' + err.message, 'error');
  } finally {
    desbloquearBotonesCuotas();
    btnActivo.classList.remove('loading');
  }
}

/* ═══════════════════════════════════════════════════════
   EVENTOS DE BOTONES
═══════════════════════════════════════════════════════ */

// Importar partidos
document.getElementById('btn-importar').addEventListener('click', () =>
  ejecutar('btn-importar', importar_partidos, '📥 Importando 12 ligas...', '✅ Importación completada', true, 80)
);

// Cuotas top 5 — The Odds API
document.getElementById('btn-cuotas').addEventListener('click', () =>
  ejecutarCuotas(
    'btn-cuotas',
    (db, onProgress) => actualizar_cuotas_completas(db, onProgress, { soloOddsAPI: true, debugNombres: DEBUG_NOMBRES }),
    '💰 Actualizando cuotas top 5 (The Odds API)...',
    20
  )
);

// Cuotas completas — todas las ligas
document.getElementById('btn-cuotas-full').addEventListener('click', () =>
  ejecutarCuotas(
    'btn-cuotas-full',
    (db, onProgress) => actualizar_cuotas_completas(db, onProgress, { debugNombres: DEBUG_NOMBRES }),
    '🎯 Actualizando todas las cuotas (The Odds API)...',
    35
  )
);

// Cuotas ligas secundarias — legacy, muestra aviso
document.getElementById('btn-cuotas-afb').addEventListener('click', () =>
  ejecutarCuotas(
    'btn-cuotas-afb',
    actualizar_cuotas_apifootball,
    '🌍 Cuotas ligas secundarias...',
    5
  )
);

// ── NUEVO — Cuotas extras Bet365 (odds-api.io via worker) ──
document.getElementById('btn-cuotas-extras').addEventListener('click', () =>
  ejecutarCuotas(
    'btn-cuotas-extras',
    actualizar_cuotas_extras,
    '🎲 Actualizando cuotas extras (BTTS · DC · DNB · O/U)...',
    90  // puede tardar porque el worker hace pausas de 500ms entre requests
  )
);

// En vivo
document.getElementById('btn-vivo').addEventListener('click', () =>
  ejecutar('btn-vivo', actualizar_en_vivo, '🔴 Actualizando en vivo...', '✅ En vivo actualizado', false, 80)
);

// Resolver apuestas
document.getElementById('btn-resolver').addEventListener('click', () =>
  ejecutar('btn-resolver', resolver_apuestas, '✅ Resolviendo apuestas pendientes...', '✅ Resolución completada', false, 15)
);

// Archivar
document.getElementById('btn-archivar').addEventListener('click', () =>
  ejecutar('btn-archivar', archivar_partidos, '📦 Archivando partidos...', '✅ Archivado completado', false, 10)
);

// Rescatar
document.getElementById('btn-rescatar').addEventListener('click', () =>
  ejecutar('btn-rescatar', rescatar_partidos, '🚑 Rescatando partidos NS pasados...', '✅ Rescate completado', false, 90)
);