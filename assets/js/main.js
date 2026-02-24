/* =========================================================
   1.  CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
   ========================================================= */
if (typeof firebaseConfig === "undefined") {
  var firebaseConfig = {
    apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
    authDomain: "winnet-708db.firebaseapp.com",
    projectId: "winnet-708db",
    storageBucket: "winnet-708db.appspot.com",
    messagingSenderId: "869401097323",
    appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
    measurementId: "G-12LH5QRVD0"
  };
}
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db   = firebase.firestore();
const auth = firebase.auth();

/* ========== ELEMENTOS GLOBALES ========== */
const betList       = document.getElementById('bet-list');
const totalOddsEl   = document.getElementById('total-odds');
const stakeInput    = document.getElementById('stake');
const winEl         = document.getElementById('potential-winnings');
const sidebar       = document.getElementById('userSidebar');
const mobileBtn     = document.getElementById('mobileMenuBtn');
const cartIcon      = document.getElementById('cartIcon');
const totalOddsText = document.getElementById('totalOddsText');
const betBadge      = mobileBtn ? mobileBtn.querySelector('.bet-badge') : null;
const qsButtons     = document.querySelectorAll('.qs');

/* ========== GLOBAL BETS ARRAY ========== */
let bets = [];

/* ========== LOCALSTORAGE ========== */
function guardarCarrito() {
  localStorage.setItem('carritoApuestas', JSON.stringify(bets));
}
function cargarCarrito() {
  try {
    const datos = localStorage.getItem('carritoApuestas');
    if (datos) {
      const arr = JSON.parse(datos);
      if (Array.isArray(arr)) bets = arr;
    }
  } catch {}
}

/* ========== UTILIDADES ========== */
function limpiaParentesisTarjetas(tipo) {
  return tipo.replace(/\s*\([^)]+\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}
function normalizaPeriodoCorners(tipo) {
  return tipo
    .replace(/\bencuentro\b/gi, "Encuentro")
    .replace(/\bprimera\b/gi, "1ª Mitad")
    .replace(/\bsegunda\b/gi, "2ª Mitad");
}
function removeTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function capitalizarPalabra(palabra) {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

/* =========================================================
   FUNCIÓN CENTRAL DE NORMALIZACIÓN DE MERCADO
   Quita espacios Y guiones → usado en todo el archivo
   ========================================================= */
function normM(m) {
  return (m || '').toLowerCase().replace(/[\s-]/g, '');
}

/* =========================================================
   2. SISTEMA DE CORRELACIONES Y CÁLCULO DE CUOTA
   ========================================================= */
function extraerSegmentoCorr(tipo) {
  const t = (tipo || '').toLowerCase();
  if (/encuentro/.test(t))        return 'encuentro';
  if (/1ª mitad|primera/.test(t)) return 'primera';
  if (/2ª mitad|segunda/.test(t)) return 'segunda';
  return 'encuentro';
}
function extraerValorNumerico(tipo) {
  const match = (tipo || '').match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
function extraerDireccion(tipo) {
  const t = (tipo || '').toLowerCase();
  if (/más de|mas de/.test(t)) return 'mas';
  if (/menos de/.test(t))      return 'menos';
  if (/exactamente/.test(t))   return 'exactamente';
  return null;
}
function extraerOpcionSiNo(tipo) {
  const t = (tipo || '').toLowerCase();
  if (/ - sí$| - si$/.test(t) || /^sí$|^si$/.test(t.split(' - ').pop())) return 'si';
  if (/ - no$/.test(t)         || /^no$/.test(t.split(' - ').pop()))        return 'no';
  return null;
}

function factorCorrelacion(betA, betB) {
  // Usamos normM para que ambosmarcan, ambos-marcan, ambos marcan → "ambosmarcan"
  const mA = normM(betA.mercado);
  const mB = normM(betB.mercado);
  const tA = (betA.tipo || '').toLowerCase();
  const tB = (betB.tipo || '').toLowerCase();

  const esResultadoA  = (mA === 'resultado' || mA === 'dobleoportunidad');
  const esResultadoB  = (mB === 'resultado' || mB === 'dobleoportunidad');
  const esAmbosMarcaA = (mA === 'ambosmarcan');
  const esAmbosMarcaB = (mB === 'ambosmarcan');
  const esImparParA   = (mA === 'golesimparpar');
  const esImparParB   = (mB === 'golesimparpar');

  // AMBOS MARCAN ↔ AMBOS MARCAN
  if (esAmbosMarcaA && esAmbosMarcaB) {
    const segA = extraerSegmentoCorr(tA);
    const segB = extraerSegmentoCorr(tB);
    const opA  = extraerOpcionSiNo(tA);
    const opB  = extraerOpcionSiNo(tB);
    if (opA === opB) {
      if ((segA === 'primera' || segA === 'segunda') && segB === 'encuentro') return 0;
      if ((segB === 'primera' || segB === 'segunda') && segA === 'encuentro') return 0;
      if (opA === 'no') return 0.5;
    }
    return 1;
  }

  // AMBOS MARCAN SÍ ↔ RESULTADO
  if (esAmbosMarcaA && esResultadoB && extraerOpcionSiNo(tA) === 'si') return 0.5;
  if (esAmbosMarcaB && esResultadoA && extraerOpcionSiNo(tB) === 'si') return 0.5;

  // GOLES IMPAR/PAR ↔ GOLES IMPAR/PAR
  if (esImparParA && esImparParB) {
    const segA  = extraerSegmentoCorr(tA);
    const segB  = extraerSegmentoCorr(tB);
    const tipoA = tA.split(' - ').pop().trim();
    const tipoB = tB.split(' - ').pop().trim();
    if (tipoA === tipoB) {
      if ((segA === 'primera' || segA === 'segunda') && segB === 'encuentro') return 0;
      if ((segB === 'primera' || segB === 'segunda') && segA === 'encuentro') return 0;
    }
    return 0.5;
  }

  // RESULTADO ↔ GOLES IMPAR/PAR
  if ((esResultadoA && esImparParB) || (esResultadoB && esImparParA)) return 0.5;

  // CORNERS ↔ CORNERS
  if (mA === 'corners' && mB === 'corners') {
    const segA = extraerSegmentoCorr(tA), segB = extraerSegmentoCorr(tB);
    const dirA = extraerDireccion(tA),    dirB = extraerDireccion(tB);
    const numA = extraerValorNumerico(tA), numB = extraerValorNumerico(tB);
    if (dirA === dirB && numA !== null && numB !== null) {
      if (dirA === 'mas') {
        if ((segA === 'primera' || segA === 'segunda') && segB === 'encuentro' && numA >= numB) return 0;
        if ((segB === 'primera' || segB === 'segunda') && segA === 'encuentro' && numB >= numA) return 0;
      }
      if (dirA === 'menos') {
        if (segA === 'encuentro' && (segB === 'primera' || segB === 'segunda') && numA <= numB) return 0;
        if (segB === 'encuentro' && (segA === 'primera' || segA === 'segunda') && numB <= numA) return 0;
      }
    }
    return 0.5;
  }

  // TARJETAS ↔ TARJETAS
  if (mA === 'tarjetas' && mB === 'tarjetas') {
    const segA = extraerSegmentoCorr(tA), segB = extraerSegmentoCorr(tB);
    const dirA = extraerDireccion(tA),    dirB = extraerDireccion(tB);
    const numA = extraerValorNumerico(tA), numB = extraerValorNumerico(tB);
    if (dirA === dirB && numA !== null && numB !== null) {
      if (dirA === 'mas') {
        if ((segA === 'primera' || segA === 'segunda') && segB === 'encuentro' && numA >= numB) return 0;
        if ((segB === 'primera' || segB === 'segunda') && segA === 'encuentro' && numB >= numA) return 0;
      }
      if (dirA === 'menos') {
        if (segA === 'encuentro' && (segB === 'primera' || segB === 'segunda') && numA <= numB) return 0;
        if (segB === 'encuentro' && (segA === 'primera' || segA === 'segunda') && numB <= numA) return 0;
      }
    }
    return 0.5;
  }

  return 1;
}

function calcularCuotaCorrelada(bets) {
  if (!bets || bets.length === 0) return 1;
  if (bets.length === 1) return parseFloat(bets[0].cuota) || 1;

  const porPartido = {};
  bets.forEach(b => {
    const pid = (b.partidoId || b.partido || '').toString().trim();
    if (!porPartido[pid]) porPartido[pid] = [];
    porPartido[pid].push(b);
  });

  let cuotaTotal = 1;
  Object.values(porPartido).forEach(grupo => {
    if (grupo.length === 1) { cuotaTotal *= parseFloat(grupo[0].cuota) || 1; return; }

    const absorbidas = new Set();
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        if (factorCorrelacion(grupo[i], grupo[j]) === 0) {
          const ci = parseFloat(grupo[i].cuota) || 1;
          const cj = parseFloat(grupo[j].cuota) || 1;
          absorbidas.add(ci <= cj ? i : j);
        }
      }
    }

    const activas = grupo.filter((_, idx) => !absorbidas.has(idx));
    if (!activas.length) return;
    if (activas.length === 1) { cuotaTotal *= parseFloat(activas[0].cuota) || 1; return; }

    let cuotaPartido = parseFloat(activas[0].cuota) || 1;
    for (let i = 1; i < activas.length; i++) {
      const cuotaNueva = parseFloat(activas[i].cuota) || 1;
      let factorMin = 1;
      for (let j = 0; j < i; j++) {
        const f = factorCorrelacion(activas[j], activas[i]);
        if (f < factorMin) factorMin = f;
      }
      cuotaPartido *= factorMin === 0.5 ? (1 + (cuotaNueva - 1) * 0.5) : cuotaNueva;
    }
    cuotaTotal *= cuotaPartido;
  });

  return Math.round(cuotaTotal * 100) / 100;
}

function detectarCorrelacionConOtras(bets, idx) {
  const b    = bets[idx];
  const pidB = (b.partidoId || b.partido || '').toString().trim();
  for (let i = 0; i < bets.length; i++) {
    if (i === idx) continue;
    const a    = bets[i];
    const pidA = (a.partidoId || a.partido || '').toString().trim();
    if (pidA !== pidB) continue;
    if (factorCorrelacion(a, b) < 1) return true;
  }
  return false;
}

/* =========================================================
   3. TOAST NOTIFICATION
   ========================================================= */
(function crearToast() {
  if (document.getElementById('bet-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'bet-toast';
  document.body.appendChild(toast);
})();

let _toastTimer = null;
function mostrarToast(msg, tipo = 'info') {
  const toast = document.getElementById('bet-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = '';
  if (tipo === 'error') toast.classList.add('toast-error');
  else if (tipo === 'ok') toast.classList.add('toast-ok');
  toast.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

/* =========================================================
   4. SISTEMA DE EXCLUSIÓN DE MERCADOS
   ========================================================= */
function extraerSegmento(tipo) {
  const t = (tipo || '').toLowerCase();
  if (/encuentro/.test(t))        return 'encuentro';
  if (/1ª mitad|primera/.test(t)) return 'primera';
  if (/2ª mitad|segunda/.test(t)) return 'segunda';
  return null;
}
function extraerEquipo(tipo) {
  const partes = (tipo || '').split(' - ').map(s => s.trim());
  for (let i = partes.length - 1; i >= 0; i--) {
    const p = partes[i].toLowerCase();
    if (!/(encuentro|1ª mitad|primera|2ª mitad|segunda|más de|menos de|exactamente|\d+)/.test(p)) {
      return p;
    }
  }
  return null;
}

function claveExclusion(mercado, tipo) {
  // normM ya recibe el mercado sin guiones ni espacios
  const m = normM(mercado);

  if (m === 'resultado' || m === 'dobleoportunidad') return 'resultado_o_doble';
  if (m === 'ambosmarcan')   return `ambosmarcan|${extraerSegmento(tipo) || 'encuentro'}`;
  if (m === 'golesimparpar') return `golesimparpar|${extraerSegmento(tipo) || 'encuentro'}`;
  if (m === 'tarjetas')      return `tarjetas|${extraerSegmento(tipo) || 'encuentro'}|${extraerEquipo(tipo) || 'ambos'}`;
  if (m === 'corners')       return `corners|${extraerSegmento(tipo) || 'encuentro'}|${extraerEquipo(tipo) || 'ambos'}`;
  if (m === 'goleadores')    return `goleadores|${(tipo || '').trim().toLowerCase()}`;
  return m;
}

/* =========================================================
   5. ADD BET TO SLIP
   ========================================================= */
window.addBetToSlip = function({ partido, tipo, cuota, partidoId, mercado }) {
  const normPartidoId = partidoId ? partidoId.toString().trim() : "";
  // normM quita espacios Y guiones → "doble-oportunidad" → "dobleoportunidad"
  const normMercado   = normM(mercado);
  const normCuota     = cuota ? cuota.toString().trim() : "";
  const nuevaClave    = claveExclusion(normMercado, tipo);

  const idxExistente = bets.findIndex(b => {
    const bPid = b.partidoId ? b.partidoId.toString().trim() : "";
    if (bPid !== normPartidoId) return false;
    // b.mercado ya está normalizado (guardado con normM), pero normM es idempotente
    return claveExclusion(normM(b.mercado), b.tipo) === nuevaClave;
  });

  if (idxExistente !== -1) {
    const anterior = bets[idxExistente];
    // Toggle: misma selección exacta → eliminar
    if (
      (anterior.tipo  || '').toLowerCase().replace(/\s/g,'') === (tipo  || '').toLowerCase().replace(/\s/g,'') &&
      (anterior.cuota || '').toString().trim() === normCuota
    ) {
      bets.splice(idxExistente, 1);
      guardarCarrito();
      refreshSlip();
      mostrarToast('Selección eliminada del carrito', 'info');
      return;
    }
    // Reemplazar
    bets[idxExistente] = { partido, tipo, cuota: normCuota, partidoId: normPartidoId, mercado: normMercado };
    guardarCarrito();
    refreshSlip();
    mostrarToast('Selección actualizada en el carrito', 'ok');
    return;
  }

  // Nueva apuesta
  bets.push({ partido, tipo, cuota: normCuota, partidoId: normPartidoId, mercado: normMercado });
  guardarCarrito();
  refreshSlip();
};

/* =========================================================
   6. LISTENERS GENERALES
   ========================================================= */
if (stakeInput) stakeInput.addEventListener('input', updatePotentialWinnings);

if (qsButtons && qsButtons.length) {
  qsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const valor = parseFloat(btn.textContent) || 0;
      stakeInput.value = valor;
      updatePotentialWinnings();
    });
  });
}

const clearBtn = document.getElementById('clear-bets');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    bets = [];
    localStorage.removeItem('carritoApuestas');
    refreshSlip();
    guardarCarrito();
    cambiarPestania('simple');
  });
}

/* =========================================================
   7. REFRESH SLIP
   ========================================================= */
function refreshSlip() {
  if (!betList) return;
  betList.innerHTML = '';

  if (bets && bets.length) {

    // Agrupar por partidoId guardando índice REAL del array bets
    const grupos = {};
    const orden  = [];
    bets.forEach((b, realIdx) => {
      const pid = (b.partidoId || b.partido || '').toString().trim();
      if (!grupos[pid]) { grupos[pid] = []; orden.push(pid); }
      grupos[pid].push({ ...b, _realIdx: realIdx });
    });

    orden.forEach(pid => {
      const grupo = grupos[pid];

      if (grupo.length === 1) {
        const { partido, tipo, cuota, mercado, _realIdx } = grupo[0];
        betList.insertAdjacentHTML('beforeend', `
          <li class="bs-item">
            <div class="bs-top">
              <span class="bs-deporte">⚽</span>
              <span class="bs-tipo">${formatearTipo(tipo, mercado)}</span>
              <span class="bs-cuota">${parseFloat(cuota).toFixed(2)}</span>
              <button class="bs-remove" data-real-idx="${_realIdx}">✕</button>
            </div>
            <div class="bs-info">${partido}</div>
          </li>
        `);

      } else {
        const cuotaGrupo    = calcularCuotaCorrelada(grupo);
        const nombrePartido = grupo[0].partido;

        betList.insertAdjacentHTML('beforeend', `
          <li class="bs-item bs-item-grupo-header">
            <div class="bs-top">
              <span class="bs-deporte">&#127942</span>
              <span class="bs-tipo bs-grupo-nombre">${nombrePartido}</span>
              <span class="bs-cuota bs-grupo-cuota">${cuotaGrupo.toFixed(2)}</span>
            </div>
            <div class="bs-info">${grupo.length} selecciones combinadas</div>
          </li>
        `);

        grupo.forEach(({ tipo, cuota, mercado, _realIdx }) => {
          const estaCorrelada = detectarCorrelacionConOtras(bets, _realIdx);
          betList.insertAdjacentHTML('beforeend', `
            <li class="bs-item bs-item-sub">
              <div class="bs-top">
                <span class="bs-deporte">⚽</span>
                <span class="bs-tipo${estaCorrelada ? ' bs-tipo-correlada' : ''}">${formatearTipo(tipo, mercado)}</span>
                <span class="bs-cuota">${parseFloat(cuota).toFixed(2)}</span>
                <button class="bs-remove" data-real-idx="${_realIdx}">✕</button>
              </div>
            </li>
          `);
        });
      }
    });

    // ── ÚNICO listener de eliminación — usa data-real-idx ──
    betList.querySelectorAll('.bs-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const realIdx = parseInt(e.currentTarget.dataset.realIdx, 10);
        if (isNaN(realIdx)) return;

        const li = e.currentTarget.closest('li.bs-item');
        if (li) {
          li.classList.add('bs-item-removing');
          setTimeout(() => {
            bets.splice(realIdx, 1);
            guardarCarrito();
            refreshSlip();
            updatePotentialWinnings();
          }, 280);
        } else {
          bets.splice(realIdx, 1);
          guardarCarrito();
          refreshSlip();
          updatePotentialWinnings();
        }
      });
    });
  }

  // Cuota total
  const totalOdds = calcularCuotaCorrelada(bets);
  if (totalOddsEl) {
    totalOddsEl.textContent = bets.length ? totalOdds.toFixed(2).replace('.', ',') : '0,00';
  }

  const tabCombi = document.querySelector('.bs-tab[data-target="combi"]');
  if (tabCombi) tabCombi.textContent = `Combinada (${bets.length})`;

  cambiarPestania && cambiarPestania(bets.length >= 2 ? 'combi' : 'simple');
  updatePotentialWinnings();
  updateMobileButton();
  actualizarBadgeApuestas();
  guardarCarrito();
}

function formatearTipo(tipo, mercado) {
  const m = normM(mercado);
  if (m === 'resultado') return tipo.toLowerCase() === 'empate' ? 'Empate' : `Gana ${tipo}`;
  if (m === 'tarjetas') {
    let partes = tipo.split(' - ').map(s => s.trim());
    let main = '', cantidad = '', equipo = '', periodo = '';
    partes[0] = partes[0].replace(/\([^)]*\)/g, '').trim();
    const match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)/i);
    if (match) { main = match[1]; cantidad = match[2]; } else { main = partes[0]; }
    partes = partes.filter(p => !/^\d+\)$/.test(p));
    periodo = partes.find(p => /(encuentro|mitad)/i.test(p)) || '';
    equipo  = partes.find((p, i) => i > 0 && p !== periodo && !/^\d+\)$/.test(p) && !/(Más de|Menos de|Exactamente)/i.test(p)) || '';
    return `Tarjetas: ${main} ${cantidad} tarjeta${cantidad === '1' ? '' : 's'}${equipo ? ` - ${equipo}` : ''}${periodo ? ` - ${periodo}` : ''}`;
  }
  if (m === 'corners') {
    let partes = tipo.split(' - ').map(s => s.trim());
    let main = '', cantidad = '', equipo = '', periodo = '';
    const match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)?\s*corners?/i);
    if (match) { [main, cantidad] = [match[1], match[2] || '']; } else { main = partes[0]; }
    const pp = ['primera', '1ª mitad', 'segunda', '2ª mitad', 'encuentro'];
    partes.forEach(p => {
      const l = p.toLowerCase();
      if (l === 'primera') periodo = "1ª Mitad";
      else if (l === 'segunda') periodo = "2ª Mitad";
      else if (l === 'encuentro') periodo = "Encuentro";
    });
    equipo = partes.find(p => {
      const l = p.toLowerCase();
      return !(p === partes[0] || cantidad === p || pp.includes(l) || /^\d+\)?$/.test(p));
    }) || '';
    return `Corners: ${main}${cantidad ? ` ${cantidad} corners` : ''}${periodo ? ` - ${periodo}` : ''}${equipo ? ` - ${equipo}` : ''}`;
  }
  if (m === 'goleadores') return `Gol de ${tipo}`;
  return tipo;
}

/* =========================================================
   8. FUNCIONES DE UI
   ========================================================= */
function updatePotentialWinnings() {
  if (!stakeInput || !winEl || !totalOddsEl) return;
  const stake = parseFloat(stakeInput.value) || 0;
  const cuota = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  const win   = stake * cuota;
  winEl.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €';
}

function updateMobileButton() {
  if (!cartIcon || !totalOddsText || !totalOddsEl) return;
  const total = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  if (!bets.length) {
    cartIcon.style.display      = 'inline';
    totalOddsText.style.display = 'none';
  } else {
    cartIcon.style.display      = 'none';
    totalOddsText.style.display = 'inline';
    totalOddsText.textContent   = total.toFixed(2).replace('.', ',');
  }
}

function actualizarBadgeApuestas() {
  if (!betBadge) return;
  if (bets.length > 0) {
    betBadge.style.display = 'inline-block';
    betBadge.textContent   = bets.length;
  } else {
    betBadge.style.display = 'none';
  }
}

/* =========================================================
   9. INIT
   ========================================================= */
cargarCarrito();
refreshSlip();

/* =========================================================
   10. SIDEBAR MÓVIL
   ========================================================= */
const sidebarOverlay = document.getElementById('sidebar-overlay');
const bsToggle       = document.querySelector('.bs-toggle');

function openSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (sidebarOverlay) { sidebarOverlay.style.display = 'block'; sidebarOverlay.classList.add('active'); }
  document.body.style.overflow = "hidden";
}
function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarOverlay) { sidebarOverlay.style.display = 'none'; sidebarOverlay.classList.remove('active'); }
  document.body.style.overflow = "";
}

if (mobileBtn)      mobileBtn.addEventListener('click', openSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
if (bsToggle)       bsToggle.addEventListener('click', closeSidebar);

document.addEventListener('click', function(e) {
  if (
    window.innerWidth <= 768 &&
    sidebar && sidebar.classList.contains('open') &&
    !sidebar.contains(e.target) &&
    mobileBtn && !mobileBtn.contains(e.target) &&
    (!sidebarOverlay || !sidebarOverlay.contains(e.target))
  ) { closeSidebar(); }
});

if (sidebarOverlay) sidebarOverlay.style.display = 'none';

/* =========================================================
   11. GUARDAR APUESTA AL PULSAR "ACEPTAR"
   ========================================================= */
const acceptBtn = document.querySelector('.accept-btn');
if (acceptBtn) {
  acceptBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user)          { alert('Debes iniciar sesión para realizar una apuesta.'); return; }
    if (!bets.length)   { alert('No hay apuestas en el carrito.'); return; }

    const stake = parseFloat(stakeInput.value) || 0;
    if (stake <= 0)     { alert('El importe debe ser mayor que cero.'); return; }

    const betsSinId = bets.filter(b => !b.partidoId);
    if (betsSinId.length) { alert('Error interno: Hay una apuesta sin partidoId.'); return; }

    const userRef     = db.collection('usuarios').doc(user.uid);
    const userDoc     = await userRef.get();
    const userData    = userDoc.data();
    const saldoActual = parseFloat(userData?.saldo) || 0;
    if (stake > saldoActual) { alert('No tienes saldo suficiente.'); return; }

    const totalOdds    = calcularCuotaCorrelada(bets);
    const potentialWin = stake * totalOdds;

    const apuestaData = {
      usuarioId: user.uid,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      stake, totalOdds, potentialWin,
      bets: bets.map(b => ({
        partido:   b.partido,
        tipo:      b.mercado === 'tarjetas' ? limpiaParentesisTarjetas(b.tipo)
                 : b.mercado === 'corners'  ? normalizaPeriodoCorners(limpiaParentesisTarjetas(b.tipo))
                 : b.tipo,
        cuota:     parseFloat(b.cuota),
        partidoId: b.partidoId,
        mercado:   b.mercado
      })),
      estado: "pendiente", resultado: null, aceptadaPorUsuario: false
    };

    try {
      await db.collection('apuestas').add(apuestaData);
      await userRef.update({ saldo: firebase.firestore.FieldValue.increment(-stake) });
      alert('¡Apuesta realizada con éxito!');
      bets = [];
      guardarCarrito();
      refreshSlip();
      stakeInput.value = 5;
      updatePotentialWinnings();
      closeSidebar();
      if (typeof headerLeft !== "undefined" && headerLeft) {
        headerLeft.innerHTML = `${(saldoActual - stake).toFixed(2)} €`;
      }
    } catch (err) {
      console.error('Error al guardar la apuesta:', err);
      alert('Ocurrió un error al guardar la apuesta. Intenta de nuevo.');
    }
  });
}

/* =========================================================
   12. CARGAR PARTIDOS EN LA PÁGINA PRINCIPAL
   ========================================================= */
let listaPartidos = [];

if (document.getElementById('partidos-container')) {

  function partidoHaComenzado(partido) {
    if (!partido.fecha || !partido.hora) return false;
    const [anio, mes, dia] = partido.fecha.split('-');
    const [hora, minuto]   = partido.hora.split(':');
    return new Date() >= new Date(anio, mes - 1, dia, hora, minuto);
  }

  async function cargarPartidos() {
    try {
      const snapshot = await db.collection('partidos').get();
      listaPartidos  = snapshot.docs.map(doc => ({ ...doc.data(), partidoId: doc.id }));
      mostrarPartidos(listaPartidos);
    } catch (err) { console.error("Error al cargar partidos:", err); }
  }
  cargarPartidos();

  function mostrarPartidos(partidos) {
    const container = document.getElementById('partidos-container');
    container.innerHTML = '';
    if (!Array.isArray(partidos)) return;

    const partidosPorFecha = {};
    const fechaClaves      = [];

    partidos.forEach(partido => {
      if (!partido.fecha) return;
      const fechaObj  = new Date(partido.fecha + 'T00:00');
      const hoyObj    = new Date(); hoyObj.setHours(0,0,0,0);
      const mananaObj = new Date(hoyObj); mananaObj.setDate(hoyObj.getDate() + 1);

      let claveFecha;
      if (fechaObj.getTime() === hoyObj.getTime())         claveFecha = "Hoy";
      else if (fechaObj.getTime() === mananaObj.getTime()) claveFecha = "Mañana";
      else {
        const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'short' });
        claveFecha = `${diaSemana} ${fechaObj.getDate()}`;
      }

      if (!partidosPorFecha[claveFecha]) { partidosPorFecha[claveFecha] = []; fechaClaves.push({ claveFecha, fechaObj }); }
      partidosPorFecha[claveFecha].push(partido);
    });

    fechaClaves.sort((a, b) => {
      if (a.claveFecha === "Hoy") return -1;
      if (b.claveFecha === "Hoy") return 1;
      return a.fechaObj - b.fechaObj;
    });

    for (const { claveFecha } of fechaClaves) {
      const partidosVisibles = partidosPorFecha[claveFecha]
        .filter(p => !partidoHaComenzado(p))
        .sort((a, b) => {
          const [hA, mA] = a.hora.split(':').map(Number);
          const [hB, mB] = b.hora.split(':').map(Number);
          return hA !== hB ? hA - hB : mA - mB;
        });
      if (!partidosVisibles.length) continue;

      const grupoDiv = document.createElement('div');
      grupoDiv.classList.add('grupo-fecha');
      const fechaDiv = document.createElement('div');
      fechaDiv.classList.add('fecha');
      fechaDiv.textContent = claveFecha;
      grupoDiv.appendChild(fechaDiv);

      partidosVisibles.forEach(partido => {
        const { equipo1, equipo2 } = partido;
        const deporte     = (partido.deporte || "").toLowerCase();
        const escudo1     = `Equipos/${removeTildes(equipo1.toLowerCase().replace(/\s/g,''))}.png`;
        const escudo2     = `Equipos/${removeTildes(equipo2.toLowerCase().replace(/\s/g,''))}.png`;
        const nac1        = partido.nacionalidad1 || "";
        const nac2        = partido.nacionalidad2 || "";
        const horaPartido = partido.hora || '00:00';

        let cuota1 = '-', cuotaX = '-', cuota2 = '-';
        if (partido.mercados?.resultado?.opciones) {
          partido.mercados.resultado.opciones.forEach(o => {
            if (o.valor === "1")      cuota1 = o.cuota.toFixed(2);
            else if (o.valor === "X") cuotaX = o.cuota.toFixed(2);
            else if (o.valor === "2") cuota2 = o.cuota.toFixed(2);
          });
        }

        let cuotasHTML = '', claseCuotas = '';
        if (deporte === 'futbol') {
          claseCuotas = 'cuotas-futbol';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn" data-partido="${equipo1} vs ${equipo2}" data-tipo="${equipo1}" data-mercado="resultado">${cuota1}</div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">Empate</div>
              <div class="valor-cuota cuota-btn" data-partido="${equipo1} vs ${equipo2}" data-tipo="Empate" data-mercado="resultado">${cuotaX}</div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn" data-partido="${equipo1} vs ${equipo2}" data-tipo="${equipo2}" data-mercado="resultado">${cuota2}</div>
            </div>`;
        } else if (deporte === 'baloncesto' || deporte === 'tenis') {
          claseCuotas = deporte === 'baloncesto' ? 'cuotas-baloncesto' : 'cuotas-tenis';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn" data-partido="${equipo1} vs ${equipo2}" data-tipo="${equipo1}">${cuota1}</div>
            </div>
            <div class="cuota cuota-derecha">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn" data-partido="${equipo1} vs ${equipo2}" data-tipo="${equipo2}">${cuota2}</div>
            </div>`;
        }

        let equiposHTML = '';
        if (deporte === "tenis") {
          equiposHTML = `
            <div class="info-equipos">
              <div class="equipo equipo1">
                <div class="bandera-wrapper">${nac1 ? `<img src="banderas/${removeTildes(nac1.toLowerCase().replace(/\s/g,''))}.png" alt="${nac1}" class="bandera"/>` : ''}</div>
                <span>${equipo1}</span>
              </div>
              <div class="hora">${horaPartido}</div>
              <div class="equipo equipo2">
                <div class="bandera-wrapper">${nac2 ? `<img src="banderas/${removeTildes(nac2.toLowerCase().replace(/\s/g,''))}.png" alt="${nac2}" class="bandera"/>` : ''}</div>
                <span>${equipo2}</span>
              </div>
            </div>`;
        } else {
          equiposHTML = `
            <div class="info-equipos">
              <div class="equipo equipo1">
                <div class="escudo-wrapper"><img src="${escudo1}" alt="${equipo1}" class="escudo"/></div>
                <span>${equipo1}</span>
              </div>
              <div class="hora">${horaPartido}</div>
              <div class="equipo equipo2">
                <div class="escudo-wrapper"><img src="${escudo2}" alt="${equipo2}" class="escudo"/></div>
                <span>${equipo2}</span>
              </div>
            </div>`;
        }

        let goleadoresHTML = '';
        if (deporte === 'futbol' && partido.mercados?.goleadores?.opciones?.length > 0) {
          const pid = partido.partidoId;
          goleadoresHTML = `<div class="goleadores-lista" id="goleadores-${pid}" style="display:none;">`;
          partido.mercados.goleadores.opciones.forEach(gol => {
            goleadoresHTML += `
              <div class="goleador-opcion"
                data-partido="${equipo1} vs ${equipo2}"
                data-jugador="${gol.nombre}"
                data-cuota="${gol.cuota}"
                data-partidoid="${pid}">
                <span class="nombre-goleador">${gol.nombre}</span>
                <span class="cuota-goleador">${gol.cuota}</span>
              </div>`;
          });
          goleadoresHTML += `</div>`;
        }

        const verMasHTML  = `<a class="ver-partido-btn" href="partido.html?partidoId=${partido.partidoId}">Ver mercados</a>`;
        const partidoDiv  = document.createElement('div');
        partidoDiv.classList.add('partido');
        partidoDiv.innerHTML = `
          <div class="info-hora">${equiposHTML}</div>
          <div class="cuotas ${claseCuotas}">${cuotasHTML}</div>
          ${goleadoresHTML}
          ${verMasHTML}
        `;
        grupoDiv.appendChild(partidoDiv);
      });
      container.appendChild(grupoDiv);
    }
    asignarEventosGoleadores();
  }

  function asignarEventosGoleadores() {
    document.querySelectorAll('.btn-goleadores').forEach(btn => {
      btn.addEventListener('click', function() {
        const lista = document.getElementById('goleadores-' + this.dataset.id);
        if (lista) lista.style.display = lista.style.display === 'block' ? 'none' : 'block';
      });
    });
  }

  if (document.getElementById('logo-scroll')) {
    document.getElementById('logo-scroll').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Eventos de clic en partidos (cuotas + goleadores)
  document.getElementById('partidos-container').addEventListener('click', e => {
    const cuotaBtn = e.target.closest('.valor-cuota.cuota-btn');
    if (cuotaBtn) {
      const partidoNombre = cuotaBtn.dataset.partido;
      const tipo          = cuotaBtn.dataset.tipo;
      const cuota         = cuotaBtn.textContent.trim();
      const mercado       = cuotaBtn.dataset.mercado || "resultado";
      const partidoObj    = listaPartidos.find(p => `${p.equipo1} vs ${p.equipo2}` === partidoNombre);
      if (!partidoObj) { alert('No se encontró el partido.'); return; }
      window.addBetToSlip({ partido: partidoNombre, tipo, cuota, partidoId: partidoObj.partidoId, mercado });
      return;
    }
    const goleadorDiv = e.target.closest('.goleador-opcion');
    if (goleadorDiv) {
      window.addBetToSlip({
        partido:   goleadorDiv.dataset.partido,
        tipo:      goleadorDiv.dataset.jugador,
        cuota:     goleadorDiv.dataset.cuota,
        partidoId: goleadorDiv.dataset.partidoid,
        mercado:   'goleadores'
      });
    }
  });
}

/* =========================================================
   13. PESTAÑAS
   ========================================================= */
function cambiarPestania(target) {
  document.querySelectorAll('.bs-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.target === target)
  );
  document.querySelectorAll('[data-content]').forEach(sec =>
    sec.style.display = sec.dataset.content === target ? 'block' : 'none'
  );
}

/* =========================================================
   14. SALDO ALL-IN
   ========================================================= */
let saldoUsuario = 0;
auth.onAuthStateChanged(async user => {
  if (user) {
    try { saldoUsuario = parseFloat((await db.collection('usuarios').doc(user.uid).get()).data()?.saldo) || 0; }
    catch {}
  } else { saldoUsuario = 0; }
});

const allInBtn = document.querySelector('.qs.all-in');
if (allInBtn && stakeInput) {
  allInBtn.addEventListener('click', () => {
    stakeInput.value = saldoUsuario > 0 ? saldoUsuario : '';
    updatePotentialWinnings();
  });
}

/* =========================================================
   15. HEADER
   ========================================================= */
const headerLeft  = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');
if (headerLeft && headerRight) {
  auth.onAuthStateChanged(async user => {
    if (user) {
      try {
        const userData = (await db.collection('usuarios').doc(user.uid).get()).data();
        headerLeft.innerHTML = userData ? `${parseFloat(userData.saldo).toFixed(2)} €` : '';
        headerRight.innerHTML = `
          <div class="user-menu" style="position:relative;display:inline-block;">
            <span class="username" style="cursor:pointer;">${userData?.username || user.email}</span>
            <div class="dropdown-content" id="dropdown-menu" style="
              display:none;position:absolute;right:0;top:100%;
              box-shadow:0 4px 8px rgba(255,255,0,0.3);border-radius:4px;
              padding:10px;opacity:0;transition:opacity 0.3s ease;
              z-index:1000;background-color:var(--rojo-oscuro);font-size:16px;min-width:140px;">
              ${userData?.rol === "admin" ? `<a href="adminhub.html" style="display:block;padding:8px;color:white;text-decoration:none;">Panel Admin</a>` : ''}
              <a href="apuestas.html" style="display:block;padding:8px;color:white;text-decoration:none;">Mis apuestas</a>
              <a href="#" id="logout-link" style="display:block;padding:8px;color:white;text-decoration:none;">Cerrar sesión</a>
            </div>
          </div>`;

        const username     = headerRight.querySelector('.username');
        const dropdownMenu = document.getElementById('dropdown-menu');
        let menuOpen = false;

        const openMenu  = () => { dropdownMenu.style.display = 'block'; requestAnimationFrame(() => { dropdownMenu.style.opacity = '1'; }); menuOpen = true; };
        const closeMenu = () => { dropdownMenu.style.opacity = '0'; setTimeout(() => { dropdownMenu.style.display = 'none'; }, 300); menuOpen = false; };

        username.addEventListener('mouseenter', () => { if (!menuOpen) openMenu(); });
        document.addEventListener('click', ev => {
          if (!dropdownMenu.contains(ev.target) && !username.contains(ev.target) && menuOpen) closeMenu();
        });
        document.getElementById('logout-link').addEventListener('click', async e => {
          e.preventDefault();
          await auth.signOut();
          localStorage.removeItem('carritoApuestas');
          window.location.href = 'login.html';
        });

      } catch (err) { console.error('Error header:', err); }
    } else {
      headerLeft.innerHTML  = `<a href="register.html" class="header-btn">Registrarse</a>`;
      headerRight.innerHTML = `<a href="login.html" class="header-btn">Iniciar sesión</a>`;
    }
  });
}
