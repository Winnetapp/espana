/* =============================================================
  apuestas.js — Winnet · Seguimiento de apuestas profesional
  ============================================================= */

/* ── Elementos DOM ── */
const container       = document.getElementById('apuestas-container');
const tabButtons      = document.querySelectorAll('.tab-btn');
const filtrosDiv      = document.getElementById('filtros-apuestas-todas');
const filtroPrincipal = document.getElementById('filtro-principal');
const filtroExtra     = document.getElementById('filtro-extra');
const btnFiltrar      = document.getElementById('aplicar-filtros');
const btnLimpiar      = document.getElementById('limpiar-filtros');

/* ── Estado ── */
let apuestas       = [];
let currentUser    = null;
let currentTab     = 'pendientes';
let filtrosActivos = {};
let unsubscribe    = null;
let partidoCache   = {};

/* =========================================================
  FLATPICKR
  ========================================================= */
flatpickr('#filtro-rango-fecha', { mode: 'range', dateFormat: 'Y-m-d', locale: 'es' });

/* =========================================================
  FILTROS DINÁMICOS
  ========================================================= */
filtroPrincipal.addEventListener('change', () => {
  filtroExtra.innerHTML = '';
  switch (filtroPrincipal.value) {
    case 'fecha':
      filtroExtra.innerHTML = '<input type="text" id="filtro-rango-fecha" placeholder="Selecciona rango de fechas" style="min-width:220px;">';
      setTimeout(() => {
        flatpickr('#filtro-rango-fecha', { mode: 'range', dateFormat: 'Y-m-d', locale: 'es' });
      }, 20);
      break;
    case 'estado':
      filtroExtra.innerHTML = `
        <select id="filtro-estado" class="filtro-select" style="min-width:140px;">
          <option value="ganada">Ganadas</option>
          <option value="perdida">Perdidas</option>
          <option value="pendiente">Pendientes</option>
        </select>`;
      break;
    case 'ganancia':
      filtroExtra.innerHTML = `<input type="number" id="filtro-min-ganancia" placeholder="Mín. Ganancia €" min="0" />`;
      break;
    case 'perdida':
      filtroExtra.innerHTML = `<input type="number" id="filtro-min-perdida" placeholder="Mín. Importe €" min="0" />`;
      break;
    case 'ordenar':
      filtroExtra.innerHTML = `
        <select id="ordenar-por" class="filtro-select">
          <option value="fecha-desc">Fecha ↓ (más recientes)</option>
          <option value="fecha-asc">Fecha ↑ (más antiguas)</option>
          <option value="ganancia-desc">Ganancia ↓</option>
          <option value="ganancia-asc">Ganancia ↑</option>
          <option value="stake-desc">Importe ↓</option>
          <option value="stake-asc">Importe ↑</option>
        </select>`;
      break;
  }
});

btnFiltrar.addEventListener('click', () => {
  const tipo = filtroPrincipal.value;
  filtrosActivos = {};
  if (tipo === 'estado')   filtrosActivos.estado      = document.getElementById('filtro-estado')?.value;
  if (tipo === 'ganancia') filtrosActivos.minGanancia = document.getElementById('filtro-min-ganancia')?.value;
  if (tipo === 'perdida')  filtrosActivos.minPerdida  = document.getElementById('filtro-min-perdida')?.value;
  if (tipo === 'ordenar')  filtrosActivos.ordenar     = document.getElementById('ordenar-por')?.value;
  if (tipo === 'fecha') {
    const rango = (document.getElementById('filtro-rango-fecha')?.value || '').split(' a ');
    filtrosActivos.fechaInicio = rango[0] || '';
    filtrosActivos.fechaFin   = rango[1] || '';
  }
  render();
});

btnLimpiar.addEventListener('click', () => {
  filtroPrincipal.value = '';
  filtroExtra.innerHTML = '';
  filtrosActivos = {};
  render();
});

/* =========================================================
  TABS
  ========================================================= */
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    filtrosDiv.style.display = currentTab === 'todas' ? '' : 'none';
    render();
  });
});

/* =========================================================
  AUTH → suscripción en tiempo real
  ========================================================= */
auth.onAuthStateChanged(user => {
  if (!user) {
    container.innerHTML = renderEmptyState('🔒', 'Inicia sesión', 'Debes iniciar sesión para ver tus apuestas.');
    document.getElementById('stats-apuestas').style.display = 'none';
    return;
  }
  currentUser = user;
  suscribirApuestas(user.uid);
});

async function suscribirApuestas(uid) {
  if (unsubscribe) unsubscribe();
  container.innerHTML = `
    <div class="loading-spinner-wrap">
      <div class="spinner-ring"></div>
      <span>Cargando apuestas...</span>
    </div>`;

  unsubscribe = db.collection('apuestas')
    .where('usuarioId', '==', uid)
    .orderBy('fecha', 'desc')
    .onSnapshot(async snap => {
      apuestas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const ids = new Set();
      apuestas.forEach(a => (a.bets || []).forEach(b => { if (b.partidoId) ids.add(String(b.partidoId)); }));

      const idsNuevos = [...ids].filter(id => !partidoCache[id]);
      if (idsNuevos.length) {
        await Promise.all(idsNuevos.map(async id => {
          let doc = await db.collection('partidos').doc(id).get();
          if (!doc.exists) doc = await db.collection('historial').doc(id).get();
          if (doc.exists) partidoCache[id] = doc.data();
        }));
      }

      actualizarStats();
      actualizarContadores();
      render();
    }, err => {
      console.error('Error suscripción:', err);
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error al cargar</div></div>`;
    });
}

/* =========================================================
  STATS
  ========================================================= */
function actualizarStats() {
  const el = document.getElementById('stats-apuestas');
  if (!el) return;
  el.style.display = apuestas.length ? 'flex' : 'none';

  const ganadas    = apuestas.filter(a => a.estado === 'ganada');
  const resueltas  = apuestas.filter(a => a.estado === 'ganada' || a.estado === 'perdida');
  const pendientes = apuestas.filter(a => a.estado === 'pendiente');

  const totalApostado = apuestas.reduce((s, a) => s + (a.stake || 0), 0);
  const totalCobrado  = ganadas.reduce((s, a) => s + (a.ganancia || a.potentialWin || 0), 0);
  const pct = resueltas.length ? Math.round((ganadas.length / resueltas.length) * 100) : null;

  document.getElementById('stat-apostado').textContent  = fmt(totalApostado);
  document.getElementById('stat-ganancias').textContent = fmt(totalCobrado);
  document.getElementById('stat-pendiente').textContent = pendientes.length;
  document.getElementById('stat-acierto').textContent   = pct !== null ? `${pct}%` : '—';
}

function actualizarContadores() {
  const pendientesN = apuestas.filter(a => a.estado === 'pendiente').length;
  const listasN     = apuestas.filter(a => (a.estado === 'ganada' || a.estado === 'perdida' || a.estado === 'devuelta') && !a.aceptadaPorUsuario).length;
  const elP = document.getElementById('count-pendientes');
  const elL = document.getElementById('count-listas');
  if (elP) elP.textContent = pendientesN;
  if (elL) { elL.textContent = listasN; elL.classList.toggle('alerta', listasN > 0); }
}

/* =========================================================
  RENDER PRINCIPAL
  ========================================================= */
function render() {
  let lista = [];
  switch (currentTab) {
    case 'pendientes':
      lista = apuestas.filter(a => a.estado === 'pendiente');
      break;
    case 'listas':
      lista = apuestas.filter(a => (a.estado === 'ganada' || a.estado === 'perdida' || a.estado === 'devuelta') && !a.aceptadaPorUsuario);
      break;
    case 'terminadas':
      lista = apuestas.filter(a => a.aceptadaPorUsuario === true);
      break;
    case 'todas':
      lista = [...apuestas];
      if (filtrosActivos.estado)      lista = lista.filter(a => a.estado === filtrosActivos.estado);
      if (filtrosActivos.fechaInicio) {
        const ts = new Date(filtrosActivos.fechaInicio + 'T00:00:00Z').getTime() / 1000;
        lista = lista.filter(a => (a.fecha?.seconds ?? 0) >= ts);
      }
      if (filtrosActivos.fechaFin) {
        const ts = new Date(filtrosActivos.fechaFin + 'T23:59:59Z').getTime() / 1000;
        lista = lista.filter(a => (a.fecha?.seconds ?? 0) <= ts);
      }
      if (filtrosActivos.minGanancia) lista = lista.filter(a => (a.potentialWin || 0) >= Number(filtrosActivos.minGanancia));
      if (filtrosActivos.minPerdida)  lista = lista.filter(a => (a.stake || 0) >= Number(filtrosActivos.minPerdida));
      switch (filtrosActivos.ordenar) {
        case 'fecha-desc':    lista.sort((a, b) => (b.fecha?.seconds||0) - (a.fecha?.seconds||0)); break;
        case 'fecha-asc':     lista.sort((a, b) => (a.fecha?.seconds||0) - (b.fecha?.seconds||0)); break;
        case 'ganancia-desc': lista.sort((a, b) => (b.potentialWin||0) - (a.potentialWin||0)); break;
        case 'ganancia-asc':  lista.sort((a, b) => (a.potentialWin||0) - (b.potentialWin||0)); break;
        case 'stake-desc':    lista.sort((a, b) => (b.stake||0) - (a.stake||0)); break;
        case 'stake-asc':     lista.sort((a, b) => (a.stake||0) - (b.stake||0)); break;
      }
      break;
  }

  if (!lista.length) {
    const msgs = {
      pendientes: ['⏳', 'Sin apuestas en curso', 'Cuando apuestes, aparecerán aquí mientras esperan resultado.'],
      listas:     ['🔔', 'Nada pendiente de confirmar', 'Cuando una apuesta se resuelva, aparecerá aquí para que la confirmes.'],
      terminadas: ['📁', 'Sin historial', 'Las apuestas que confirmes se guardarán aquí.'],
      todas:      ['🎯', 'Sin resultados', 'No hay apuestas que coincidan con los filtros aplicados.'],
    };
    const [ico, tit, sub] = msgs[currentTab] || ['🎯', 'Sin apuestas', ''];
    container.innerHTML = renderEmptyState(ico, tit, sub);
    return;
  }

  container.innerHTML = '';
  lista.forEach((apuesta, i) => {
    const card = document.createElement('div');
    card.innerHTML = buildTarjeta(apuesta);
    card.querySelector('.apuesta-card').style.animationDelay = `${i * 0.04}s`;
    container.appendChild(card.firstElementChild);
  });
}

/* =========================================================
  BUILD TARJETA APUESTA
  ========================================================= */
function buildTarjeta(a) {
  const bets      = a.bets || [];
  const esSimple  = bets.length === 1;
  const esSistema = a.tipo === 'sistema';

  const tipoBadge = esSimple
    ? `<span class="ac-tipo-badge">Simple</span>`
    : esSistema
    ? `<span class="ac-tipo-badge sistema">${a.sistema?.k}/${a.sistema?.n} Sistema</span>`
    : `<span class="ac-tipo-badge combinada">Combinada · ${bets.length} sel.</span>`;

  const estadoBadge = {
    pendiente: `<span class="ac-estado-badge pendiente"><span class="live-dot"></span> En curso</span>`,
    ganada:    `<span class="ac-estado-badge ganada">✓ Ganada</span>`,
    perdida:   `<span class="ac-estado-badge perdida">✗ Perdida</span>`,
    devuelta:  `<span class="ac-estado-badge devuelta">↩ Devuelta</span>`,
  }[a.estado] || `<span class="ac-estado-badge">${a.estado}</span>`;

  const fechaApuesta = a.fecha?.toDate
    ? `<span class="ac-fecha"><i class="far fa-calendar-alt"></i> ${fmtFechaApuesta(a.fecha.toDate())}</span>`
    : '';

  const betsHTML  = bets.map(b => buildBetRow(b, a)).join('');
  const stake     = a.stake || 0;
  const ganancia  = a.ganancia ?? a.potentialWin ?? 0;

  let resultadoLabel = '', resultadoVal = '', resultadoClass = '';
  if (a.estado === 'ganada')        { resultadoLabel = 'Cobrado';        resultadoVal = `+${fmt(ganancia)}`; resultadoClass = 'ganada'; }
  else if (a.estado === 'perdida')  { resultadoLabel = 'Perdido';        resultadoVal = `-${fmt(stake)}`;    resultadoClass = 'perdida'; }
  else if (a.estado === 'devuelta') { resultadoLabel = 'Devuelto';       resultadoVal = fmt(stake);           resultadoClass = 'devuelta'; }
  else                              { resultadoLabel = 'Gan. potencial'; resultadoVal = fmt(ganancia);        resultadoClass = 'pendiente'; }

  let banner = '';
  if (a.estado === 'ganada')        banner = `<div class="ac-banner ganada"><i class="fas fa-trophy"></i> ¡Apuesta ganadora! · Ganancia: <strong>${fmt(ganancia)}</strong>${a.motivo ? `<span class="ac-banner-motivo">· ${a.motivo}</span>` : ''}</div>`;
  else if (a.estado === 'perdida')  banner = `<div class="ac-banner perdida"><i class="fas fa-times-circle"></i> Apuesta no ganadora${a.motivo ? `<span class="ac-banner-motivo">· ${a.motivo}</span>` : ''}</div>`;
  else if (a.estado === 'devuelta') banner = `<div class="ac-banner devuelta"><i class="fas fa-undo"></i> Apuesta devuelta${a.motivo ? `<span class="ac-banner-motivo">· ${a.motivo}</span>` : ''}</div>`;

  let acciones = '';
  if (currentTab === 'listas') {
    if (a.estado === 'ganada')        acciones = `<div class="ac-acciones"><button class="btn-confirmar cobrar"   onclick="aceptarApuesta('${a.id}', 'ganada',   ${ganancia})"><i class="fas fa-check"></i> Confirmar cobro <span class="btn-confirmar-amount">${fmt(ganancia)}</span></button></div>`;
    else if (a.estado === 'perdida')  acciones = `<div class="ac-acciones"><button class="btn-confirmar perder"   onclick="aceptarApuesta('${a.id}', 'perdida',  0)"><i class="fas fa-times"></i> Confirmar pérdida <span class="btn-confirmar-amount">-${fmt(stake)}</span></button></div>`;
    else if (a.estado === 'devuelta') acciones = `<div class="ac-acciones"><button class="btn-confirmar devuelta" onclick="aceptarApuesta('${a.id}', 'devuelta', ${stake})"><i class="fas fa-undo"></i> Confirmar devolución <span class="btn-confirmar-amount">${fmt(stake)}</span></button></div>`;
  }

  return `
    <div class="apuesta-card estado-${a.estado}">
      <div class="ac-header">
        <div class="ac-header-left">${tipoBadge}<span class="ac-total-odds">${(a.totalOdds || 0).toFixed(2)}</span>${fechaApuesta}</div>
        ${estadoBadge}
      </div>
      <div class="ac-bets">${betsHTML}</div>
      <div class="ac-footer">
        <div class="ac-footer-izq"><div><span class="ac-importe-label">Importe</span><span class="ac-importe-val">${fmt(stake)}</span></div></div>
        <div class="ac-resultado-bloque"><span class="ac-resultado-label">${resultadoLabel}</span><span class="ac-resultado-val ${resultadoClass}">${resultadoVal}</span></div>
      </div>
      ${banner}
      ${acciones}
    </div>`;
}

/* =========================================================
  HELPERS INTERNOS PARA calcularResultadoBet
  ========================================================= */
function _normM(m) {
  return (m || '').toLowerCase().replace(/[\s\-_]/g, '');
}

function _extraerLinea(tipo) {
  const m = (tipo || '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function _esOver(tipo) {
  const t = (tipo || '').toLowerCase();
  return t.startsWith('+') || t.includes('más de') || t.includes('mas de') || t.includes('over');
}

function _esUnder(tipo) {
  const t = (tipo || '').toLowerCase();
  return t.startsWith('-') || t.includes('menos de') || t.includes('under');
}

/* =========================================================
  CALCULAR RESULTADO DE UNA SELECCIÓN INDIVIDUAL
  Devuelve: 'ganada' | 'perdida' | 'devuelta' | null
  ========================================================= */
function calcularResultadoBet(b, p) {
  if (!p || p.estado !== 'FT') return null;

  const gl   = p.golesLocal       ?? 0;
  const gv   = p.golesVisitante   ?? 0;
  const glHT = p.golesLocalHT     ?? p.htGolesLocal     ?? null;
  const gvHT = p.golesVisitanteHT ?? p.htGolesVisitante ?? null;

  const local     = (p.local     || '').trim().toLowerCase();
  const visitante = (p.visitante || '').trim().toLowerCase();

  const mercado = _normM(b.mercado || b.tipoApuesta || '');
  const tipo    = (b.tipo || '').trim();
  const tipoL   = tipo.toLowerCase();

  const resTC = gl > gv ? 'local' : gv > gl ? 'visitante' : 'empate';
  const resHT = (glHT !== null && gvHT !== null)
    ? (glHT > gvHT ? 'local' : gvHT > glHT ? 'visitante' : 'empate')
    : null;
  const totalGoles   = gl + gv;
  const totalGolesHT = (glHT !== null && gvHT !== null) ? glHT + gvHT : null;

  /* ── 1X2 resultado ── */
  if (mercado === 'resultado') {
    if (tipoL === 'empate')   return resTC === 'empate'    ? 'ganada' : 'perdida';
    if (tipoL === local)      return resTC === 'local'     ? 'ganada' : 'perdida';
    if (tipoL === visitante)  return resTC === 'visitante' ? 'ganada' : 'perdida';
    if (tipoL === '1')        return resTC === 'local'     ? 'ganada' : 'perdida';
    if (tipoL === 'x')        return resTC === 'empate'    ? 'ganada' : 'perdida';
    if (tipoL === '2')        return resTC === 'visitante' ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Doble oportunidad ── */
  if (mercado === 'dobleoportunidad') {
    const t = tipoL.replace(/\s/g, '');
    if (t === '1x' || t === 'x1') return (resTC === 'local'     || resTC === 'empate')    ? 'ganada' : 'perdida';
    if (t === '12' || t === '21') return (resTC === 'local'     || resTC === 'visitante') ? 'ganada' : 'perdida';
    if (t === '2x' || t === 'x2') return (resTC === 'visitante' || resTC === 'empate')    ? 'ganada' : 'perdida';
    if (tipoL.includes(local)     && tipoL.includes('empate'))    return (resTC === 'local'     || resTC === 'empate')    ? 'ganada' : 'perdida';
    if (tipoL.includes(visitante) && tipoL.includes('empate'))    return (resTC === 'visitante' || resTC === 'empate')    ? 'ganada' : 'perdida';
    if (tipoL.includes(local)     && tipoL.includes(visitante))   return (resTC === 'local'     || resTC === 'visitante') ? 'ganada' : 'perdida';
    return null;
  }

  /* ── DNB (sin empate) ── */
  if (mercado === 'dnb') {
    if (resTC === 'empate') return 'devuelta';
    const t = tipoL.replace(/^dnb:\s*/i, '').trim();
    if (t === local)     return resTC === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante) return resTC === 'visitante' ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Ambos marcan (BTTS) ── */
  if (mercado === 'ambosmarcan' || mercado === 'btts') {
    const ambosMarcaron = gl > 0 && gv > 0;
    if (tipoL === 'sí' || tipoL === 'si' || tipoL === 'yes') return ambosMarcaron  ? 'ganada' : 'perdida';
    if (tipoL === 'no')                                       return !ambosMarcaron ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Total goles (over/under) ── */
  if (mercado === 'totalgoles') {
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    if (_esOver(tipo))  return totalGoles > linea  ? 'ganada' : 'perdida';
    if (_esUnder(tipo)) return totalGoles < linea  ? 'ganada' : (totalGoles === linea ? 'devuelta' : 'perdida');
    return null;
  }

  /* ── Descanso / Resultado 1ª mitad ── */
  if (mercado === 'descanso' || mercado === 'htresult') {
    if (resHT === null) return null;
    const t = tipoL.replace(/^ht1?:\s*/i, '').trim();
    if (t === 'empate')   return resHT === 'empate'    ? 'ganada' : 'perdida';
    if (t === local)      return resHT === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante)  return resHT === 'visitante' ? 'ganada' : 'perdida';
    if (t === '1')        return resHT === 'local'     ? 'ganada' : 'perdida';
    if (t === 'x')        return resHT === 'empate'    ? 'ganada' : 'perdida';
    if (t === '2')        return resHT === 'visitante' ? 'ganada' : 'perdida';
    const linea = _extraerLinea(t);
    if (linea !== null && totalGolesHT !== null) {
      if (_esOver(t))  return totalGolesHT > linea  ? 'ganada' : 'perdida';
      if (_esUnder(t)) return totalGolesHT < linea  ? 'ganada' : (totalGolesHT === linea ? 'devuelta' : 'perdida');
    }
    return null;
  }

  /* ── Resultado 2ª mitad ── */
  if (mercado === 'segunda') {
    if (glHT === null || gvHT === null) return null;
    const gl2  = gl - glHT;
    const gv2  = gv - gvHT;
    const res2 = gl2 > gv2 ? 'local' : gv2 > gl2 ? 'visitante' : 'empate';
    const tot2 = gl2 + gv2;
    const t    = tipoL.replace(/^ht2?:\s*/i, '').trim();
    if (t === 'empate')  return res2 === 'empate'    ? 'ganada' : 'perdida';
    if (t === local)     return res2 === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante) return res2 === 'visitante' ? 'ganada' : 'perdida';
    const linea = _extraerLinea(t);
    if (linea !== null) {
      if (_esOver(t))  return tot2 > linea  ? 'ganada' : 'perdida';
      if (_esUnder(t)) return tot2 < linea  ? 'ganada' : (tot2 === linea ? 'devuelta' : 'perdida');
    }
    return null;
  }

  /* ── Helper líneas asiáticas (quarter lines) ── */
  function _resolverOU(val, linea, esOver, esUnder) {
    if (!esOver && !esUnder) return null;
    const dec = Math.abs(linea % 1);
    // Línea entera o .5 → sin devolución parcial
    if (dec === 0 || dec === 0.5) {
      if (esOver)  return val > linea  ? 'ganada' : (val === linea && dec === 0 ? 'devuelta' : 'perdida');
      if (esUnder) return val < linea  ? 'ganada' : (val === linea && dec === 0 ? 'devuelta' : 'perdida');
    }
    // Línea quarter (.25 / .75) → split bet
    if (dec === 0.25 || dec === 0.75) {
      const l1 = linea - 0.25, l2 = linea + 0.25;
      const r1 = esOver ? (val > l1 ? 'ganada' : val === l1 ? 'devuelta' : 'perdida')
                        : (val < l1 ? 'ganada' : val === l1 ? 'devuelta' : 'perdida');
      const r2 = esOver ? (val > l2 ? 'ganada' : val === l2 ? 'devuelta' : 'perdida')
                        : (val < l2 ? 'ganada' : val === l2 ? 'devuelta' : 'perdida');
      if (r1 === 'ganada'  && r2 === 'ganada')  return 'ganada';
      if (r1 === 'perdida' && r2 === 'perdida') return 'perdida';
      return 'devuelta'; // mitad ganada/perdida → devuelta como aproximación visual
    }
    return null;
  }

  /* ── Over/Under 1ª mitad ── */
  if (mercado === 'totalsht') {
    if (totalGolesHT === null) return null;
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    return _resolverOU(totalGolesHT, linea, _esOver(tipo), _esUnder(tipo));
  }

  /* ── Team Total Local ── */
  if (mercado === 'teamtotalhome') {
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    return _resolverOU(gl, linea, _esOver(tipo), _esUnder(tipo));
  }

  /* ── Team Total Visitante ── */
  if (mercado === 'teamtotalaway') {
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    return _resolverOU(gv, linea, _esOver(tipo), _esUnder(tipo));
  }

  /* ── HT Team Total Local ── */
  if (mercado === 'httotalhome') {
    if (glHT === null) return null;
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    return _resolverOU(glHT, linea, _esOver(tipo), _esUnder(tipo));
  }

  /* ── HT Team Total Visitante ── */
  if (mercado === 'httotalaway') {
    if (gvHT === null) return null;
    const linea = _extraerLinea(tipo);
    if (linea === null) return null;
    return _resolverOU(gvHT, linea, _esOver(tipo), _esUnder(tipo));
  }

  /* ── Impar / Par total ── */
  if (mercado === 'imparpar' || mercado === 'golesimparpar') {
    if (tipoL === 'par')   return totalGoles % 2 === 0 ? 'ganada' : 'perdida';
    if (tipoL === 'impar') return totalGoles % 2 !== 0 ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Impar / Par 1ª mitad ── */
  if (mercado === 'htimparpar') {
    if (totalGolesHT === null) return null;
    if (tipoL === 'par')   return totalGolesHT % 2 === 0 ? 'ganada' : 'perdida';
    if (tipoL === 'impar') return totalGolesHT % 2 !== 0 ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Portería a cero local ── */
  if (mercado === 'cleansheethome') {
    if (tipo === 'csHomeYes') return gv === 0 ? 'ganada' : 'perdida';
    if (tipo === 'csHomeNo')  return gv > 0   ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Portería a cero visitante ── */
  if (mercado === 'cleansheetaway') {
    if (tipo === 'csAwayYes') return gl === 0 ? 'ganada' : 'perdida';
    if (tipo === 'csAwayNo')  return gl > 0   ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Win to Nil ── */
  if (mercado === 'winnil') {
    if (tipo === 'winNilHome') return (gl > gv && gv === 0) ? 'ganada' : 'perdida';
    if (tipo === 'winNilAway') return (gv > gl && gl === 0) ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Marcador exacto ── */
  if (mercado === 'correctscore') {
    const expected = `cs${gl}${gv}`;
    if (tipo === 'csOther') {
      const knownScores = [
        'cs00','cs10','cs01','cs11','cs20','cs02','cs21','cs12',
        'cs22','cs30','cs03','cs31','cs13','cs32','cs23','cs33',
        'cs40','cs04','cs41','cs14','cs42','cs24',
      ];
      return !knownScores.includes(expected) ? 'ganada' : 'perdida';
    }
    return tipo === expected ? 'ganada' : 'perdida';
  }

  /* ── HT/FT ── */
  if (mercado === 'htft') {
    if (resHT === null) return null;
    const htRes = glHT > gvHT ? '1' : glHT < gvHT ? '2' : 'x';
    const ftRes = gl   > gv   ? '1' : gl   < gv   ? '2' : 'x';
    const parts = (tipo || '').split('_');
    if (parts.length !== 3) return null;
    return (htRes === parts[1] && ftRes === parts[2]) ? 'ganada' : 'perdida';
  }

  /* ── Hándicap europeo ── */
  if (mercado === 'ehresult') {
    const ehMatch = tipo.replace(/^EH:\s*/i, '').trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)/);
    if (!ehMatch) return null;
    const hdp    = parseFloat(ehMatch[1]);
    const equipo = ehMatch[2].trim().toLowerCase();
    if (isNaN(hdp)) return null;
    let ajustado;
    if (equipo === local)     ajustado = (gl + hdp) - gv;
    else if (equipo === visitante) ajustado = (gv + hdp) - gl;
    else if (equipo === 'empate' || equipo === 'x') return ((gl + hdp) - gv) === 0 ? 'ganada' : 'perdida';
    else return null;
    if (ajustado > 0) return 'ganada';
    if (ajustado < 0) return 'perdida';
    return 'devuelta';
  }

  /* ── Hándicap asiático ── */
  if (mercado === 'asianhandicap') {
    const ahRaw   = tipo.replace(/^AH:\s*/i, '').trim();
    const ahMatch = ahRaw.match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)/);
    if (!ahMatch) return null;
    const hdp    = parseFloat(ahMatch[1]);
    const equipo = ahMatch[2].trim().toLowerCase();
    if (isNaN(hdp)) return null;
    let diff;
    if (equipo === local)          diff = gl - gv + hdp;
    else if (equipo === visitante) diff = gv - gl + hdp;
    else return null;
    const dec = Math.abs(hdp % 1);
    if (dec === 0 || dec === 0.5) {
      if (diff > 0) return 'ganada';
      if (diff < 0) return 'perdida';
      return dec === 0 ? 'devuelta' : 'perdida';
    }
    if (dec === 0.25 || dec === 0.75) {
      const r1 = (diff - 0.25) > 0 ? 'ganada' : (diff - 0.25) < 0 ? 'perdida' : 'devuelta';
      const r2 = (diff + 0.25) > 0 ? 'ganada' : (diff + 0.25) < 0 ? 'perdida' : 'devuelta';
      if (r1 === 'ganada'  && r2 === 'ganada')   return 'ganada';
      if (r1 === 'perdida' && r2 === 'perdida')  return 'perdida';
      return 'devuelta'; // mitad ganada/perdida → mostramos devuelta como aproximación visual
    }
    return null;
  }

  /* ── Mercados sin resolución automática (stats no disponibles) ── */
  // corners, bookings, goleadores, firstScore, nextGoal → el worker tampoco los resuelve
  return null;
}

/* =========================================================
  BUILD BET ROW
  ========================================================= */
function buildBetRow(b, apuesta) {
  const partidoData  = b.partidoId ? partidoCache[String(b.partidoId)] : null;
  const enVivo       = partidoData && ['1H','HT','2H','ET','P'].includes(partidoData.estado);
  const terminado    = partidoData && partidoData.estado === 'FT';

  const selNombre     = fmtSeleccion(b, partidoData);
  const localNombre   = partidoData?.local     || '';
  const visitNombre   = partidoData?.visitante || '';
  const partidoNombre = partidoData ? `${localNombre} <span>vs</span> ${visitNombre}` : (b.partido || '');
  const mercadoTag    = fmtMercadoTag(b.mercado || b.tipoApuesta);
  const fechaP        = partidoData?.fecha ? `<span class="ac-bet-fecha">${fmtFechaPartido(partidoData.fecha)}</span>` : '';

  /* ── Determinar color del indicador ── */
  let indicatorClass = '';

  if (b.resultado === 'ganada') {
    indicatorClass = 'ganada';
  } else if (b.resultado === 'perdida') {
    indicatorClass = 'perdida';
  } else if (b.resultado === 'devuelta') {
    indicatorClass = 'devuelta';
  } else if (enVivo) {
    indicatorClass = 'en-curso';
  } else if (terminado) {
    const res = calcularResultadoBet(b, partidoData);
    if      (res === 'ganada')   indicatorClass = 'ganada';
    else if (res === 'perdida')  indicatorClass = 'perdida';
    else if (res === 'devuelta') indicatorClass = 'devuelta';
    else                         indicatorClass = 'en-curso';
  } else if (apuesta.estado !== 'pendiente') {
    if ((apuesta.bets || []).length === 1) {
      if (apuesta.estado === 'ganada')   indicatorClass = 'ganada';
      if (apuesta.estado === 'perdida')  indicatorClass = 'perdida';
      if (apuesta.estado === 'devuelta') indicatorClass = 'devuelta';
    }
  }

  let estadoPartido = '';
  if (enVivo) {
    const minuto   = partidoData.minuto ? `${partidoData.minuto}'` : '';
    const marcador = (partidoData.golesLocal ?? 0) + ' - ' + (partidoData.golesVisitante ?? 0);
    estadoPartido = `<div class="ac-bet-live"><span class="live-indicator"><span class="live-dot"></span> En vivo ${minuto}</span><span class="ac-bet-marcador">⚽ ${marcador}</span></div>`;
  } else if (terminado) {
    const marcador = (partidoData.golesLocal ?? 0) + ' - ' + (partidoData.golesVisitante ?? 0);
    estadoPartido = `<div class="ac-bet-ft">FT: <strong>${marcador}</strong></div>`;
  }

  return `
    <div class="ac-bet-row">
      <div class="ac-bet-indicator ${indicatorClass}"></div>
      <div class="ac-bet-body">
        <div class="ac-bet-top">
          <span class="ac-bet-seleccion">${selNombre}</span>
          <span class="ac-bet-cuota">${parseFloat(b.cuota || 1).toFixed(2)}</span>
        </div>
        <div class="ac-bet-meta">
          <span class="ac-bet-partido-nombre">${partidoNombre}</span>
          <span class="ac-bet-mercado-tag">${mercadoTag}</span>
          ${fechaP}
        </div>
        ${estadoPartido}
      </div>
    </div>`;
}

/* =========================================================
  ACEPTAR APUESTA
  ========================================================= */
window.aceptarApuesta = async function(id, estado, importe) {
  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
    const apuestaRef = db.collection('apuestas').doc(id);
    const apuestaDoc = await apuestaRef.get();
    if (!apuestaDoc.exists) throw new Error('Apuesta no encontrada');
    const apuesta = apuestaDoc.data();
    if (apuesta.aceptadaPorUsuario) { console.warn('[aceptar] Ya aceptada, ignorando.'); return; }
    const batch = db.batch();
    batch.update(apuestaRef, { aceptadaPorUsuario: true });
    if (importe > 0 && apuesta.usuarioId) {
      const usuarioRef = db.collection('usuarios').doc(apuesta.usuarioId);
      batch.update(usuarioRef, { saldo: firebase.firestore.FieldValue.increment(importe) });
    }
    await batch.commit();

    if (importe > 0) {
      const usuarioSnap = await db.collection('usuarios').doc(apuesta.usuarioId).get();
      const nuevoSaldo = parseFloat(usuarioSnap.data()?.saldo || 0);
      window._saldoUsuario = nuevoSaldo;
      const elSaldoVal = document.getElementById('hdr-saldo-val');
      if (elSaldoVal) elSaldoVal.textContent = `${nuevoSaldo.toFixed(2)} €`;
      const elDdSaldo = document.querySelector('.hdr-dd-saldo');
      if (elDdSaldo) elDdSaldo.textContent = `${nuevoSaldo.toFixed(2)} €`;
    }
  } catch (e) {
    console.error('[aceptar] Error:', e);
    alert('Error al confirmar la apuesta. Inténtalo de nuevo.');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
};

/* =========================================================
  UTILIDADES DE FORMATO
  ========================================================= */
function fmt(n) { return `${(parseFloat(n) || 0).toFixed(2).replace('.', ',')} €`; }

function fmtFechaApuesta(date) {
  const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${dias[date.getDay()]} ${String(date.getDate()).padStart(2,'0')} ${meses[date.getMonth()]} · ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function fmtFechaPartido(fechaStr) {
  if (!fechaStr) return '';
  try {
    const d    = new Date(fechaStr);
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    return `${dias[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch { return ''; }
}

function fmtSeleccion(b, partido) {
  const m    = (b.mercado || b.tipoApuesta || '').toLowerCase().replace(/[\s-]/g,'');
  const tipo = b.tipo || '';
  const local     = partido?.local     || '';
  const visitante = partido?.visitante || '';
  if (m === 'resultado') {
    if (tipo.toLowerCase() === 'empate') return 'Empate (X)';
    if (tipo === local)     return `Gana ${local} (1)`;
    if (tipo === visitante) return `Gana ${visitante} (2)`;
    return `Gana ${tipo}`;
  }
  if (m === 'dobleoportunidad') return tipo;
  if (m === 'dnb')         return tipo.replace(/^dnb:\s*/i,'') + ' (sin empate)';
  if (m === 'ambosmarcan') return `Ambos marcan: ${tipo}`;
  if (m === 'totalgoles')  return tipo;
  if (m === 'descanso')    return `1ª mitad: ${tipo.replace(/^ht1?:\s*/i,'')}`;
  if (m === 'segunda')     return `2ª mitad: ${tipo.replace(/^ht2?:\s*/i,'')}`;
  if (m === 'totalsht')    return `1ª mitad (goles): ${tipo}`;
  if (m === 'teamtotalhome') return `🏠 Goles local: ${tipo}`;
  if (m === 'teamtotalaway') return `✈️ Goles visitante: ${tipo}`;
  if (m === 'httotalhome')   return `🏠 Goles local 1ª mitad: ${tipo}`;
  if (m === 'httotalaway')   return `✈️ Goles visitante 1ª mitad: ${tipo}`;
  if (m === 'imparpar')    return `Goles ${tipo}`;
  if (m === 'htimparpar')  return `Goles ${tipo} (1ª mitad)`;
  if (m === 'cleansheethome') return tipo === 'csHomeYes' ? `🧤 ${local} sin encajar: Sí` : `🧤 ${local} sin encajar: No`;
  if (m === 'cleansheetaway') return tipo === 'csAwayYes' ? `🧤 ${visitante} sin encajar: Sí` : `🧤 ${visitante} sin encajar: No`;
  if (m === 'winnil') return tipo === 'winNilHome' ? `🔒 ${local} gana sin encajar` : `🔒 ${visitante} gana sin encajar`;
  if (m === 'correctscore') {
    if (tipo === 'csOther') return 'Marcador exacto: Otro';
    const raw = tipo.replace('cs', '');
    return `Marcador: ${raw.slice(0,-1)}-${raw.slice(-1)}`;
  }
  if (m === 'htft') {
    const HTFT_LABELS = {
      htft_1_1:'1ª: Local / FT: Local', htft_1_x:'1ª: Local / FT: Empate',
      htft_1_2:'1ª: Local / FT: Visitante', htft_x_1:'1ª: Empate / FT: Local',
      htft_x_x:'1ª: Empate / FT: Empate', htft_x_2:'1ª: Empate / FT: Visitante',
      htft_2_1:'1ª: Visitante / FT: Local', htft_2_x:'1ª: Visitante / FT: Empate',
      htft_2_2:'1ª: Visitante / FT: Visitante',
    };
    return HTFT_LABELS[tipo] || tipo;
  }
  if (m === 'ehresult')      return tipo.replace(/^EH:\s*/i, 'Hándicap europeo: ');
  if (m === 'asianhandicap') return tipo.replace(/^AH:\s*/i, 'H. Asiático: ');
  if (m === 'cornerstotal' || m === 'corners') return `📐 ${tipo}`;
  if (m === 'cornersht')     return `📐 ${tipo} (1ª mitad)`;
  if (m === 'bookingstotal' || m === 'tarjetas') return `🟨 ${tipo}`;
  if (m === 'firstscore') {
    if (tipo === 'firstScoreHome') return `🥇 Primer gol: ${local}`;
    if (tipo === 'firstScoreNone') return '🥇 Sin goles';
    if (tipo === 'firstScoreAway') return `🥇 Primer gol: ${visitante}`;
  }
  if (m === 'nextgoal') {
    if (tipo === 'nextGoalHome') return `⚡ Próx. gol: ${local}`;
    if (tipo === 'nextGoalNone') return '⚡ Sin gol';
    if (tipo === 'nextGoalAway') return `⚡ Próx. gol: ${visitante}`;
  }
  if (m === 'goleadores' || b.esGoleador) return `Gol de ${tipo}`;
  if (m === 'corners')    return tipo;
  if (m === 'tarjetas')   return fmtTarjeta(tipo);
  return tipo;
}

function fmtTarjeta(tipo) { return tipo.replace(/\(.*?\)/g,'').replace(/\s{2,}/g,' ').trim(); }

function fmtMercadoTag(mercado) {
  const tags = {
    resultado:'1X2', dobleoportunidad:'Doble op.', dnb:'Sin empate',
    ambosmarcan:'BTTS', totalgoles:'Goles', descanso:'1ª Mitad',
    segunda:'2ª Mitad', totalsht:'Goles 1ª M.', teamtotalhome:'Goles Local',
    teamtotalaway:'Goles Visit.', httotalhome:'Goles Local 1ª', httotalaway:'Goles Visit. 1ª', imparpar:'Impar/Par', htimparpar:'Impar/Par 1ª',
    goleadores:'Goleador', corners:'Córners', cornerstotal:'Córners',
    cornersht:'Córners 1ª', tarjetas:'Tarjetas', bookingstotal:'Tarjetas',
    cleansheethome:'P. a cero', cleansheetaway:'P. a cero', winnil:'Win to Nil',
    correctscore:'Marcador', htft:'HT/FT', ehresult:'H. Europeo',
    asianhandicap:'H. Asiático', firstscore:'1er Gol', nextgoal:'Próx. Gol',
  };
  const key = (mercado || '').toLowerCase().replace(/[\s-]/g,'');
  return tags[key] || mercado || 'Apuesta';
}

function renderEmptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-sub">${sub}</div></div>`;
}