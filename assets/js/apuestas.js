/* =============================================================
  apuestas.js — Winnet · Seguimiento de apuestas profesional

  CAMBIOS v2.0:
  · calcularResultadoBet(): reescrito completamente.
    - dobleoportunidad: maneja tanto "1X"/"12"/"X2" como los
      textos completos generados por mercados.js ("Local o Empate",
      "Local o Visitante", "Empate o Visitante") con comparación
      normalizada contra nombres reales del partido.
    - dnb: devuelta correcta cuando hay empate.
    - correctScore: clave normalizada (mercados.js usa 'correctScore',
      apuestas.js normaliza a 'correctscore' → OK por normM).
    - htft: resuelto correctamente con claves htft_1_1 etc.
    - cleanSheetHome/Away: tipos csHomeYes/No correctamente evaluados.
    - winNil: tipos winNilHome/winNilAway correctamente evaluados.
    - firstScore/nextGoal: tipos firstScoreHome/Away/None.
    - imparPar / htImparPar: manejado en calcularResultadoBet.
    - corners/tarjetas: now resueltos con resolverOU si tienen
      line+dir (forward compat).

  CAMBIOS v1.1:
  · resolverOU(): usa b.line + b.dir si disponibles (v3.4+).
    Fallback a regex sobre el tipo para apuestas antiguas.
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
  HELPER: resolver over/under usando line+dir o fallback texto
  ========================================================= */
function resolverOU(b, total) {
  if (total === null || total === undefined) return null;
  // Primero: line/dir estructurados (mercados.js v3.4+)
  if (b.line != null && b.dir != null) {
    if (b.dir === 'over')  return total > b.line  ? 'ganada' : total === b.line ? 'devuelta' : 'perdida';
    if (b.dir === 'under') return total < b.line  ? 'ganada' : total === b.line ? 'devuelta' : 'perdida';
    return null;
  }
  // Fallback: extraer del texto del tipo
  const t = (b.tipo || '').toLowerCase();
  const numMatch = t.match(/(\d+(?:[.,]\d+)?)/);
  if (!numMatch) return null;
  const linea = parseFloat(numMatch[1].replace(',', '.'));
  const esOver = /más de|mas de|over/.test(t) || /^\+\d/.test(b.tipo || '');
  if (esOver) return total > linea ? 'ganada' : total === linea ? 'devuelta' : 'perdida';
  else        return total < linea ? 'ganada' : total === linea ? 'devuelta' : 'perdida';
}

/* =========================================================
  CALCULAR RESULTADO DE UNA SELECCIÓN INDIVIDUAL — v2.0
  ========================================================= */
function calcularResultadoBet(b, p) {
  if (!p) return null;
  // Solo resolver si el partido está terminado
  const ESTADOS_FT = ['FT', 'AET', 'PEN'];
  if (!ESTADOS_FT.includes(p.estado)) return null;

  const gl   = p.golesLocal        ?? 0;
  const gv   = p.golesVisitante    ?? 0;
  const glHT = p.golesLocalHT      ?? p.htGolesLocal     ?? 0;
  const gvHT = p.golesVisitanteHT  ?? p.htGolesVisitante ?? 0;

  // Normalizar nombres para comparación flexible
  const normStr = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const local     = normStr(p.local);
  const visitante = normStr(p.visitante);

  const mercado = (b.mercado || b.tipoApuesta || '').toLowerCase().replace(/[\s\-_]/g, '');
  const tipo    = (b.tipo || '').trim();
  const tipoN   = normStr(tipo);

  const resTC = gl > gv ? 'local' : gv > gl ? 'visitante' : 'empate';
  const resHT = glHT > gvHT ? 'local' : gvHT > glHT ? 'visitante' : 'empate';
  const totalGoles   = gl + gv;
  const totalGolesHT = glHT + gvHT;

  /* ── 1X2 resultado ── */
  if (mercado === 'resultado') {
    const t = tipoN;
    if (t === 'empate' || t === 'x') return resTC === 'empate'    ? 'ganada' : 'perdida';
    if (t === local    || t === '1') return resTC === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante|| t === '2') return resTC === 'visitante' ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Doble oportunidad ── FIX v2.0: maneja textos completos ── */
  if (mercado === 'dobleoportunidad') {
    const t = tipoN.replace(/\s/g, '');
    // Formas cortas
    if (t === '1x' || t === 'x1') return (resTC === 'local'     || resTC === 'empate')    ? 'ganada' : 'perdida';
    if (t === '12' || t === '21') return (resTC === 'local'     || resTC === 'visitante') ? 'ganada' : 'perdida';
    if (t === '2x' || t === 'x2') return (resTC === 'visitante' || resTC === 'empate')    ? 'ganada' : 'perdida';

    // Textos completos: "Local o Empate", "Empate o Visitante", "Local o Visitante"
    // Comparamos contra los nombres reales del partido normalizados
    const incluyeLocal     = tipoN.includes(local);
    const incluyeVisitante = tipoN.includes(visitante);
    const incluyeEmpate    = /empate|draw/.test(tipoN);

    if (incluyeLocal && incluyeEmpate && !incluyeVisitante)
      return (resTC === 'local' || resTC === 'empate') ? 'ganada' : 'perdida';
    if (incluyeVisitante && incluyeEmpate && !incluyeLocal)
      return (resTC === 'visitante' || resTC === 'empate') ? 'ganada' : 'perdida';
    if (incluyeLocal && incluyeVisitante && !incluyeEmpate)
      return (resTC === 'local' || resTC === 'visitante') ? 'ganada' : 'perdida';

    // Fallback: intentar detectar por orden "X o Y"
    const partes = tipoN.split(/\so\s|\sor\s/);
    if (partes.length === 2) {
      const [p1, p2] = partes.map(s => s.trim());
      const cubre = (r) => r === p1 || r === p2 ||
        (r === 'local'     && (p1 === local     || p2 === local))     ||
        (r === 'visitante' && (p1 === visitante || p2 === visitante)) ||
        (r === 'empate'    && (p1 === 'empate'  || p2 === 'empate'));
      return cubre(resTC) ? 'ganada' : 'perdida';
    }

    return null;
  }

  /* ── DNB ── FIX v2.0: devuelta en empate ── */
  if (mercado === 'dnb') {
    if (resTC === 'empate') return 'devuelta';  // ← FIX: devuelta, no perdida
    // Extraer equipo: "DNB: Barcelona" → "barcelona"
    const t = normStr(tipo.replace(/^dnb:\s*/i, ''));
    if (t === local     || t === '1') return resTC === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante || t === '2') return resTC === 'visitante' ? 'ganada' : 'perdida';
    // Intentar coincidencia parcial por si el nombre tiene abreviatura
    if (local.includes(t)     || t.includes(local))     return resTC === 'local'     ? 'ganada' : 'perdida';
    if (visitante.includes(t) || t.includes(visitante)) return resTC === 'visitante' ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Ambos marcan (BTTS) ── */
  if (mercado === 'ambosmarcan' || mercado === 'btts') {
    const ambosMarcaron = gl > 0 && gv > 0;
    const t = tipoN;
    if (t === 'sí' || t === 'si' || t === 'yes') return ambosMarcaron  ? 'ganada' : 'perdida';
    if (t === 'no')                               return !ambosMarcaron ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Total goles partido ── */
  if (mercado === 'totalgoles') return resolverOU(b, totalGoles);

  /* ── Total goles 1ª mitad ── */
  if (mercado === 'totalsht') return resolverOU(b, totalGolesHT);

  /* ── Team Total Local ── */
  if (mercado === 'teamtotalhome') return resolverOU(b, gl);

  /* ── Team Total Visitante ── */
  if (mercado === 'teamtotalaway') return resolverOU(b, gv);

  /* ── Team Total Local 1ª mitad ── */
  if (mercado === 'httotalhome') return resolverOU(b, glHT);

  /* ── Team Total Visitante 1ª mitad ── */
  if (mercado === 'httotalaway') return resolverOU(b, gvHT);

  /* ── Resultado 1ª mitad ── */
  if (mercado === 'descanso' || mercado === 'htresult') {
    const t = normStr(tipo.replace(/^ht1?:\s*/i, ''));
    if (t === 'empate' || t === 'x') return resHT === 'empate'    ? 'ganada' : 'perdida';
    if (t === local    || t === '1') return resHT === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante|| t === '2') return resHT === 'visitante' ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Resultado 2ª mitad ── */
  if (mercado === 'segunda') {
    const gl2  = gl  - glHT;
    const gv2  = gv  - gvHT;
    const res2 = gl2 > gv2 ? 'local' : gv2 > gl2 ? 'visitante' : 'empate';
    const t    = normStr(tipo.replace(/^ht2?:\s*/i, ''));
    if (t === 'empate' || t === 'x') return res2 === 'empate'    ? 'ganada' : 'perdida';
    if (t === local    || t === '1') return res2 === 'local'     ? 'ganada' : 'perdida';
    if (t === visitante|| t === '2') return res2 === 'visitante' ? 'ganada' : 'perdida';
    // Over/under en 2ª mitad
    return resolverOU(b, gl2 + gv2);
  }

  /* ── Impar / Par ── FIX v2.0 ── */
  if (mercado === 'imparpar' || mercado === 'golesimparpar') {
    const t   = tipoN;
    const par = totalGoles % 2 === 0;
    if (t === 'par'   || t === 'even') return par  ? 'ganada' : 'perdida';
    if (t === 'impar' || t === 'odd')  return !par ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Impar / Par 1ª mitad ── FIX v2.0 ── */
  if (mercado === 'htimparpar') {
    const t   = tipoN;
    const par = totalGolesHT % 2 === 0;
    if (t === 'par'   || t === 'even') return par  ? 'ganada' : 'perdida';
    if (t === 'impar' || t === 'odd')  return !par ? 'ganada' : 'perdida';
    return null;
  }

  /* ── HT/FT ── FIX v2.0 ── */
  if (mercado === 'htft') {
    const resHTKey = resHT === 'local' ? '1' : resHT === 'visitante' ? '2' : 'x';
    const resFTKey = resTC === 'local' ? '1' : resTC === 'visitante' ? '2' : 'x';
    const claveReal = `htft_${resHTKey}_${resFTKey}`;
    return tipoN === claveReal ? 'ganada' : 'perdida';
  }

  /* ── Marcador exacto ── FIX v2.0 ── */
  if (mercado === 'correctscore') {
    if (tipo === 'csOther') {
      // "Otro resultado": gana si el marcador exacto no tiene cuota definida
      const claveNormal = `cs${gl}${gv}`;
      // Si el marcador exacto es uno de los ofertados, csOther pierde
      // La clave csOther gana si el resultado no estaba en la lista de marcadores
      // Como no tenemos las claves disponibles aquí, usamos heurística:
      // marcadores > 4 goles por equipo normalmente caen en "Otro"
      const esOtro = gl > 4 || gv > 4 || (gl + gv) > 7;
      return esOtro ? 'ganada' : 'perdida';
    }
    // "cs21" → local 2 visitante 1
    const raw = tipo.replace(/^cs/i, '');
    if (raw.length === 2) {
      const gLocal = parseInt(raw[0], 10);
      const gVisit = parseInt(raw[1], 10);
      return gl === gLocal && gv === gVisit ? 'ganada' : 'perdida';
    }
    return null;
  }

  /* ── Portería a cero Local ── FIX v2.0 ── */
  if (mercado === 'cleansheethome') {
    const porteriaLocal = gv === 0; // local no encaja si visitante marcó 0
    if (tipo === 'csHomeYes') return porteriaLocal  ? 'ganada' : 'perdida';
    if (tipo === 'csHomeNo')  return !porteriaLocal ? 'ganada' : 'perdida';
    // Fallback por texto "Sí"/"No"
    const t = tipoN;
    if (t === 'sí' || t === 'si' || t === 'yes') return porteriaLocal  ? 'ganada' : 'perdida';
    if (t === 'no')                               return !porteriaLocal ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Portería a cero Visitante ── FIX v2.0 ── */
  if (mercado === 'cleansheetaway') {
    const porteriaVisit = gl === 0; // visitante no encaja si local marcó 0
    if (tipo === 'csAwayYes') return porteriaVisit  ? 'ganada' : 'perdida';
    if (tipo === 'csAwayNo')  return !porteriaVisit ? 'ganada' : 'perdida';
    const t = tipoN;
    if (t === 'sí' || t === 'si' || t === 'yes') return porteriaVisit  ? 'ganada' : 'perdida';
    if (t === 'no')                               return !porteriaVisit ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Win to Nil ── FIX v2.0 ── */
  if (mercado === 'winnil') {
    if (tipo === 'winNilHome') return (gl > gv && gv === 0) ? 'ganada' : 'perdida';
    if (tipo === 'winNilAway') return (gv > gl && gl === 0) ? 'ganada' : 'perdida';
    return null;
  }

  /* ── Primer equipo en marcar ── FIX v2.0 ── */
  if (mercado === 'firstscore') {
    // Necesitamos saber quién marcó primero. Si no hay dato, devolver null.
    // Si totalGoles === 0, "sin goles" gana.
    if (tipo === 'firstScoreNone') return totalGoles === 0 ? 'ganada' : 'perdida';
    // Sin dato de primer goleador, no podemos resolver con certeza.
    // Si el worker guarda p.primerGol podemos usarlo:
    if (p.primerGol === 'local'     || p.primerGolLocal)     { if (tipo === 'firstScoreHome') return 'ganada'; if (tipo === 'firstScoreAway') return 'perdida'; }
    if (p.primerGol === 'visitante' || p.primerGolVisitante) { if (tipo === 'firstScoreAway') return 'ganada'; if (tipo === 'firstScoreHome') return 'perdida'; }
    // Fallback: si solo marcó un equipo, inferimos
    if (gl > 0 && gv === 0) { if (tipo === 'firstScoreHome') return 'ganada'; if (tipo === 'firstScoreAway') return 'perdida'; }
    if (gv > 0 && gl === 0) { if (tipo === 'firstScoreAway') return 'ganada'; if (tipo === 'firstScoreHome') return 'perdida'; }
    return null; // No podemos determinar sin dato de primer gol
  }

  /* ── Próximo gol (solo válido durante el partido, post-FT sin sentido) ── */
  if (mercado === 'nextgoal') return null;

  /* ── Córners ── FIX v2.0: resuelve si hay line+dir ── */
  if (mercado === 'corners' || mercado === 'cornerstotal') {
    if (p.corners != null) return resolverOU(b, p.corners);
    return null;
  }
  if (mercado === 'cornersht') {
    if (p.cornersHT != null) return resolverOU(b, p.cornersHT);
    return null;
  }

  /* ── Tarjetas ── FIX v2.0: resuelve si hay line+dir ── */
  if (mercado === 'tarjetas' || mercado === 'bookingstotal') {
    if (p.tarjetas != null) return resolverOU(b, p.tarjetas);
    return null;
  }

  /* ── Hándicap europeo ── */
  if (mercado === 'ehresult') {
    // [FIX v2.1] Leer línea desde bet.line (mercados.js v4.2) o extraerla del tipo
    const hcp   = b.line ?? parseFloat((tipo.match(/EH:\s*([+-]?\d+(?:\.\d+)?)/) || [])[1] ?? '0');
    const glAdj = gl + hcp;
    const diff  = glAdj - gv;
    const t = normStr(tipo.replace(/^EH:\s*/i, '').replace(/[+-]?\d+(?:\.\d+)?\s*/g, '').trim());
    if (diff === 0) return (t === 'empate' || t === 'x') ? 'ganada' : 'devuelta';
    if (diff > 0)   return (t === 'empate' || t === 'x') ? 'perdida' : t === local     ? 'ganada' : 'perdida';
    /* diff < 0 */  return (t === 'empate' || t === 'x') ? 'perdida' : t === visitante ? 'ganada' : 'perdida';
  }

  /* ── Asian Handicap ── */
  if (mercado === 'asianhandicap') {
    // Formato tipo: "AH: +1.5 Barcelona" o "AH: -1.5 Real Madrid"
    const matchAH = tipo.match(/AH:\s*([+-]\d+(?:\.\d+)?)\s+(.*)/i);
    if (!matchAH) return null;
    const hdp    = parseFloat(matchAH[1]);
    const equipo = normStr(matchAH[2]);
    const esLocal = equipo === local || local.includes(equipo) || equipo.includes(local);
    const glAdj   = esLocal ? gl + hdp : gv + hdp;
    const glOpp   = esLocal ? gv       : gl;
    // Líneas medias: devuelta si empate ajustado
    if (glAdj === glOpp) return 'devuelta';
    return glAdj > glOpp ? 'ganada' : 'perdida';
  }

  /* ── Goleadores (no auto-resoluble aquí) ── */
  if (mercado === 'goleadores') return null;

  return null;
}

/* =========================================================
  BUILD BET ROW
  ========================================================= */
function buildBetRow(b, apuesta) {
  const partidoData  = b.partidoId ? partidoCache[String(b.partidoId)] : null;
  const enVivo       = partidoData && ['1H','HT','2H','ET','P'].includes(partidoData.estado);
  const terminado    = partidoData && ['FT','AET','PEN'].includes(partidoData.estado);

  const selNombre     = fmtSeleccion(b, partidoData);
  const localNombre   = partidoData?.local     || '';
  const visitNombre   = partidoData?.visitante || '';
  const partidoNombre = partidoData ? `${localNombre} <span>vs</span> ${visitNombre}` : (b.partido || '');
  const mercadoTag    = fmtMercadoTag(b.mercado || b.tipoApuesta);
  const fechaP        = partidoData?.fecha ? `<span class="ac-bet-fecha">${fmtFechaPartido(partidoData.fecha)}</span>` : '';

  let indicatorClass = '';

  // 1. Prioridad: detalleResultados del worker (fuente más fiable)
  const detalleResultados = apuesta.detalleResultados || [];
  const detalleMatch = detalleResultados.find(d =>
    (d.tipo    || '') === (b.tipo    || '') &&
    (d.mercado || '') === (b.mercado || '')
  );
  const detalleRes = detalleMatch?.resultado ?? null;

  if (detalleRes === 'ganada') {
    indicatorClass = 'ganada';
  } else if (detalleRes === 'perdida') {
    indicatorClass = 'perdida';
  } else if (detalleRes === 'devuelta') {
    indicatorClass = 'devuelta';

  // 2. Campo resultado individual en el bet (legado)
  } else if (b.resultado === 'ganada') {
    indicatorClass = 'ganada';
  } else if (b.resultado === 'perdida') {
    indicatorClass = 'perdida';
  } else if (b.resultado === 'devuelta') {
    indicatorClass = 'devuelta';

  // 3. Partido en vivo
  } else if (enVivo) {
    indicatorClass = 'en-curso';

  // 4. Partido terminado → calcular en cliente
  } else if (terminado) {
    const res = calcularResultadoBet(b, partidoData);
    if      (res === 'ganada')   indicatorClass = 'ganada';
    else if (res === 'perdida')  indicatorClass = 'perdida';
    else if (res === 'devuelta') indicatorClass = 'devuelta';
    else                         indicatorClass = 'en-curso';

  // 5. Apuesta resuelta pero partido no en caché → usar estado de apuesta (solo simple)
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
  const m    = (b.mercado || b.tipoApuesta || '').toLowerCase().replace(/[\s\-_]/g,'');
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
  if (m === 'dnb')              return tipo.replace(/^dnb:\s*/i,'') + ' (sin empate)';
  if (m === 'ambosmarcan' || m === 'btts') return `Ambos marcan: ${tipo}`;
  if (m === 'totalgoles')       return tipo;
  if (m === 'totalsht')         return tipo;
  if (m === 'teamtotalhome')    return `🏠 ${tipo}`;
  if (m === 'teamtotalaway')    return `✈️ ${tipo}`;
  if (m === 'httotalhome')      return `🏠 ${tipo}`;
  if (m === 'httotalaway')      return `✈️ ${tipo}`;
  if (m === 'descanso' || m === 'htresult') return `1ª mitad: ${tipo.replace(/^ht1?:\s*/i,'')}`;
  if (m === 'segunda')          return `2ª mitad: ${tipo.replace(/^ht2?:\s*/i,'')}`;
  if (m === 'goleadores' || b.esGoleador) return `Gol de ${tipo}`;
  if (m === 'corners' || m === 'cornerstotal') return tipo;
  if (m === 'cornersht')        return tipo;
  if (m === 'tarjetas' || m === 'bookingstotal') return fmtTarjeta(tipo);
  if (m === 'htft') {
    const HTFT_LABELS = {
      htft_1_1:'1ª: Local / FT: Local',     htft_1_x:'1ª: Local / FT: Empate',
      htft_1_2:'1ª: Local / FT: Visitante', htft_x_1:'1ª: Empate / FT: Local',
      htft_x_x:'1ª: Empate / FT: Empate',   htft_x_2:'1ª: Empate / FT: Visitante',
      htft_2_1:'1ª: Visit. / FT: Local',    htft_2_x:'1ª: Visit. / FT: Empate',
      htft_2_2:'1ª: Visit. / FT: Visit.',
    };
    return HTFT_LABELS[tipo] || tipo;
  }
  if (m === 'correctscore') {
    if (tipo === 'csOther') return 'Marcador exacto: Otro';
    const raw = tipo.replace(/^cs/i, '');
    if (raw.length === 2) return `Marcador: ${raw[0]}-${raw[1]}`;
    return tipo;
  }
  if (m === 'cleansheethome') return `🧤 P.a cero ${local}: ${tipo.endsWith('Yes') ? 'Sí' : 'No'}`;
  if (m === 'cleansheetaway') return `🧤 P.a cero ${visitante}: ${tipo.endsWith('Yes') ? 'Sí' : 'No'}`;
  if (m === 'winnil') {
    if (tipo === 'winNilHome') return `🔒 ${local} gana sin encajar`;
    if (tipo === 'winNilAway') return `🔒 ${visitante} gana sin encajar`;
  }
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
  if (m === 'ehresult')      return tipo.replace(/^EH:\s*/i, 'Hándicap: ');
  if (m === 'asianhandicap') return tipo.replace(/^AH:\s*/i, 'H.Asiático: ');
  if (m === 'imparpar' || m === 'golesimparpar') return `Goles ${tipo}`;
  if (m === 'htimparpar')    return `Goles ${tipo} (1ª mitad)`;
  return tipo;
}

function fmtTarjeta(tipo) { return tipo.replace(/\(.*?\)/g,'').replace(/\s{2,}/g,' ').trim(); }

function fmtMercadoTag(mercado) {
  const tags = {
    resultado:         '1X2',
    dobleoportunidad:  'Doble op.',
    dnb:               'Sin empate',
    ambosmarcan:       'BTTS',
    btts:              'BTTS',
    totalgoles:        'Goles',
    totalsht:          'Goles 1ª',
    teamtotalhome:     'Goles Local',
    teamtotalaway:     'Goles Visit.',
    httotalhome:       'Goles Local 1ª',
    httotalaway:       'Goles Visit. 1ª',
    descanso:          '1ª Mitad',
    htresult:          '1ª Mitad',
    segunda:           '2ª Mitad',
    goleadores:        'Goleador',
    corners:           'Córners',
    cornerstotal:      'Córners',
    cornersht:         'Córners 1ª',
    tarjetas:          'Tarjetas',
    bookingstotal:     'Tarjetas',
    htft:              'HT/FT',
    correctscore:      'Marcador exacto',
    cleansheethome:    'P. a cero',
    cleansheetaway:    'P. a cero',
    winnil:            'Win to Nil',
    firstscore:        'Primer gol',
    nextgoal:          'Próximo gol',
    ehresult:          'Hándicap EU',
    asianhandicap:     'Hándicap AS',
    imparpar:          'Impar/Par',
    golesimparpar:     'Impar/Par',
    htimparpar:        'Impar/Par 1ª',
    asiantotals:       'Asian Totals',
  };
  const key = (mercado || '').toLowerCase().replace(/[\s\-_]/g,'');
  return tags[key] || mercado || 'Apuesta';
}

function renderEmptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-sub">${sub}</div></div>`;
}