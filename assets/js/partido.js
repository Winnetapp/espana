/* =============================================================
   assets/js/partido.js
   · Hero del partido con actualización en tiempo real (onSnapshot)
   · Header con auth
   · Carga partido desde Firestore (partidos → historial)
   · El carrito lo gestiona betslip-core.js completamente
   ============================================================= */

const params    = new URLSearchParams(location.search);
const partidoId = params.get('partidoId');

/* Exponer para betslip-core */
window._partidoId   = partidoId || '';
window._partidoData = null;

/* Ticker del minuto en tiempo real (solo en vivo) */
let _minutoTicker = null;

const ESTADOS_VIVO = ['1H', 'HT', '2H', 'ET', 'P'];

if (!partidoId) {
  const el = document.getElementById('hero-contenido');
  if (el) el.innerHTML = '<p style="text-align:center;color:var(--texto-dim);padding:20px 0;">Partido no encontrado.</p>';
}

/* ── Calcular minuto estimado (igual que en main.js) ─────────── */
function calcularMinuto(p) {
  if (p.minuto != null) return p.minuto;
  let fecha = null;
  if (p.timestamp?.toDate) fecha = p.timestamp.toDate();
  else if (p.fecha)         fecha = new Date(p.fecha);
  if (!fecha) return null;
  const t = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (p.estado === '1H') return Math.min(Math.max(t, 1), 45);
  if (p.estado === 'HT') return 'HT';
  if (p.estado === '2H') return Math.min(Math.max(t - 50, 46), 90);
  if (p.estado === 'ET') return 'ET+';
  if (p.estado === 'P')  return 'PEN';
  return null;
}

/* ── Render hero ─────────────────────────────────────────────── */
function renderHero(p) {
  const enVivo    = ESTADOS_VIVO.includes(p.estado);
  const terminado = p.estado === 'FT';

  let fecha = null;
  if (p.timestamp?.toDate) fecha = p.timestamp.toDate();
  else if (p.fecha)         fecha = new Date(p.fecha);

  const horaStr  = fecha ? fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const fechaStr = fecha ? fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

  /* Badge dinámico */
  function getBadgeHTML() {
    if (enVivo) {
      const min = calcularMinuto(p);
      const minStr = min === 'HT'  ? 'DESCANSO'
                   : min === 'ET+' ? 'PRÓRROGA'
                   : min === 'PEN' ? 'PENALTIS'
                   : min != null   ? `${min}'`
                   : 'EN VIVO';
      return `<span class="badge-vivo" id="hero-badge-vivo">${minStr}</span>`;
    }
    if (terminado) return `<span class="badge-programado">FINALIZADO</span>`;
    return `<span class="badge-programado"><i class="far fa-clock" style="margin-right:4px;"></i>${horaStr} · ${fechaStr}</span>`;
  }

  const marcador = (enVivo || terminado)
    ? `<div class="hero-marcador" id="hero-marcador">
         <span id="hero-gl">${p.golesLocal ?? 0}</span>
         <span style="opacity:0.4;margin:0 6px;">-</span>
         <span id="hero-gv">${p.golesVisitante ?? 0}</span>
       </div>`
    : `<div class="hero-vs">VS</div>`;

  const el = document.getElementById('hero-contenido');
  if (!el) return;
  el.innerHTML = `
    <div class="hero-liga">
      <img src="${p.ligaLogo || ''}" onerror="this.style.display='none'" alt="">
      ${p.liga || ''} ${p.jornada ? `· Jornada ${p.jornada}` : ''}
    </div>
    <div class="hero-equipos">
      <div class="hero-equipo local">
        <div class="hero-escudo">
          <img src="${p.localLogo || ''}" alt="${p.local}"
               onerror="this.parentElement.innerHTML='<span class=sin-escudo>⚽</span>'">
        </div>
        <div class="hero-equipo-nombre">${p.local}</div>
      </div>
      <div class="hero-centro">
        ${getBadgeHTML()}
        ${marcador}
      </div>
      <div class="hero-equipo visitante">
        <div class="hero-escudo">
          <img src="${p.visitanteLogo || ''}" alt="${p.visitante}"
               onerror="this.parentElement.innerHTML='<span class=sin-escudo>⚽</span>'">
        </div>
        <div class="hero-equipo-nombre">${p.visitante}</div>
      </div>
    </div>`;

  document.title = `${p.local} vs ${p.visitante} — Winnet`;

  /* Iniciar/detener ticker del minuto */
  if (enVivo) {
    iniciarMinutoTicker(p);
  } else {
    detenerMinutoTicker();
  }
}

/* ── Ticker: actualiza solo el minuto cada 30s sin re-renderizar ── */
function iniciarMinutoTicker(p) {
  detenerMinutoTicker();
  _minutoTicker = setInterval(() => {
    const badge = document.getElementById('hero-badge-vivo');
    if (!badge) return;
    const min = calcularMinuto(p);
    if (min === null) return;
    badge.textContent = min === 'HT'  ? 'DESCANSO'
                      : min === 'ET+' ? 'PRÓRROGA'
                      : min === 'PEN' ? 'PENALTIS'
                      : `${min}'`;
  }, 30_000);
}

function detenerMinutoTicker() {
  if (_minutoTicker) { clearInterval(_minutoTicker); _minutoTicker = null; }
}

/* ── Actualizar solo marcador y badge sin re-renderizar todo ──── */
function actualizarMarcadorEnVivo(p) {
  const glEl    = document.getElementById('hero-gl');
  const gvEl    = document.getElementById('hero-gv');
  const badgeEl = document.getElementById('hero-badge-vivo');

  if (glEl) glEl.textContent = p.golesLocal    ?? 0;
  if (gvEl) gvEl.textContent = p.golesVisitante ?? 0;

  if (badgeEl) {
    const min = calcularMinuto(p);
    badgeEl.textContent = min === 'HT'  ? 'DESCANSO'
                        : min === 'ET+' ? 'PRÓRROGA'
                        : min === 'PEN' ? 'PENALTIS'
                        : min != null   ? `${min}'`
                        : 'EN VIVO';
  }

  // Si el partido acaba de terminar, re-renderizar completo
  if (p.estado === 'FT') {
    detenerMinutoTicker();
    renderHero(p);
    window.renderMercados(p);
  }
}

/* ── Cargar partido con listener en tiempo real ──────────────── */
let _unsubPartido = null;

async function cargarPartido() {
  if (!partidoId) return;

  // Primero intentar en 'partidos' con onSnapshot (tiempo real)
  _unsubPartido = db.collection('partidos').doc(partidoId)
    .onSnapshot(snap => {
      if (snap.exists) {
        const data = snap.data();
        const esPrimeraCarga = window._partidoData === null;
        window._partidoData = data;

        if (esPrimeraCarga) {
          // Primera carga: renderizar todo
          renderHero(data);
          window.renderMercados(data);
          window.BetSlip?.render();
        } else {
          // Actualización en tiempo real: solo actualizar marcador si está en vivo
          if (ESTADOS_VIVO.includes(data.estado) || data.estado === 'FT') {
            actualizarMarcadorEnVivo(data);
          }
        }
      } else {
        // No está en 'partidos', buscar en 'historial' (lectura única, ya terminado)
        _unsubPartido && _unsubPartido();
        db.collection('historial').doc(partidoId).get().then(snapH => {
          if (snapH.exists) {
            const data = snapH.data();
            window._partidoData = data;
            renderHero(data);
            window.renderMercados(data);
            window.BetSlip?.render();
          } else {
            const hw = document.getElementById('hero-contenido');
            const mw = document.getElementById('mercados-wrap');
            if (hw) hw.innerHTML = '<p style="text-align:center;padding:20px 0;">Partido no encontrado.</p>';
            if (mw) mw.innerHTML = '<div class="sin-cuotas-aviso"><i class="fas fa-search"></i> No se encontró este partido.</div>';
          }
        });
      }
    }, err => {
      console.error('[partido] Error onSnapshot:', err);
      // Fallback: lectura única
      db.collection('partidos').doc(partidoId).get().then(snap => {
        if (!snap.exists) return db.collection('historial').doc(partidoId).get();
        return snap;
      }).then(snap => {
        if (snap?.exists) {
          const data = snap.data();
          window._partidoData = data;
          renderHero(data);
          window.renderMercados(data);
          window.BetSlip?.render();
        }
      });
    });
}

/* Limpiar listener al salir de la página */
window.addEventListener('beforeunload', () => {
  _unsubPartido && _unsubPartido();
  detenerMinutoTicker();
});

/* ── Arrancar ────────────────────────────────────────────────── */
cargarPartido();