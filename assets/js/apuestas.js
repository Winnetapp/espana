/* =============================================================
   mercados.js  —  v3.0
   Renderiza TODOS los mercados de apuestas disponibles.

   MERCADOS INCLUIDOS:
   ─ Resultado 1X2
   ─ Doble oportunidad
   ─ Draw No Bet
   ─ Ambos marcan (BTTS)
   ─ Total goles (over/under)
   ─ Asian Totals (aOver/aUnder)         ← NUEVO
   ─ Impar/Par total                     ← NUEVO
   ─ Resultado 1ª mitad
   ─ Over/Under 1ª mitad
   ─ Impar/Par 1ª mitad                  ← NUEVO
   ─ Resultado 2ª mitad
   ─ HT/FT Doble resultado               ← NUEVO
   ─ Marcador exacto (Correct Score)     ← NUEVO
   ─ Total goles local
   ─ Total goles visitante
   ─ Total goles local 1ª mitad          ← NUEVO
   ─ Total goles visitante 1ª mitad      ← NUEVO
   ─ Asian Handicap                      ← NUEVO
   ─ Hándicap europeo
   ─ Portería a cero local               ← NUEVO
   ─ Portería a cero visitante           ← NUEVO
   ─ Primer equipo en marcar             ← NUEVO
   ─ Próximo gol                         ← NUEVO
   ─ Sin encajar (Win to Nil)            ← NUEVO
   ─ Córners (total partido)
   ─ Córners (1ª mitad)                  ← NUEVO
   ─ Tarjetas
   ============================================================= */

window.toggleMercado = function(id) {
  document.getElementById('sec-' + id)?.classList.toggle('collapsed');
};

window.handleOpcion = function(btn) {
  if (btn.classList.contains('sin-cuota'))    return;
  if (btn.classList.contains('ft-bloqueada')) return;
  window.addBet(btn.dataset.tipo, btn.dataset.cuota, btn.dataset.mercado);
};

/* ─────────────────────────────────────────────────────────────
   HELPER: convertir clave numérica "25" → 2.5, "m10" → -1.0
─────────────────────────────────────────────────────────────── */
function parseLineKey(raw) {
  if (!raw) return null;
  // Negativo: "m10" → -1.0, "m25" → -2.5
  if (raw.startsWith('m')) {
    const pos = raw.slice(1);
    return -parseLineKey(pos);
  }
  // "095" → 9.5 (con cero inicial, tenemos 1 decimal)
  if (raw.length >= 3 && raw.startsWith('0')) {
    return parseFloat(raw.slice(1, -1) + '.' + raw.slice(-1));
  }
  // "25" → 2.5 ; "105" → 10.5 ; "35" → 3.5
  if (raw.length >= 2) {
    return parseFloat(raw.slice(0, -1) + '.' + raw.slice(-1));
  }
  return parseFloat(raw);
}

/* ─────────────────────────────────────────────────────────────
   HELPER: leer líneas over/under dinámicas
─────────────────────────────────────────────────────────────── */
function leerLineasOU(c, prefOver, prefUnder, mercadoId, labelOver, labelUnder) {
  const lineas = new Set();
  for (const key of Object.keys(c)) {
    if (key.startsWith(prefOver))  lineas.add(key.slice(prefOver.length));
    if (key.startsWith(prefUnder)) lineas.add(key.slice(prefUnder.length));
  }
  const sorted = [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b));
  const opts = [];
  for (const raw of sorted) {
    const line = parseLineKey(raw);
    if (line === null || line <= 0) continue; // ignorar líneas inválidas (p.ej. cornersUnder0)
    if (c[prefOver  + raw] != null) opts.push({ label: labelOver(line),  cuota: c[prefOver  + raw], tipo: labelOver(line),  mercado: mercadoId });
    if (c[prefUnder + raw] != null) opts.push({ label: labelUnder(line), cuota: c[prefUnder + raw], tipo: labelUnder(line), mercado: mercadoId });
  }
  return opts;
}

/* ─────────────────────────────────────────────────────────────
   DETERMINAR GANADORES (para partidos FT)
─────────────────────────────────────────────────────────────── */
function obtenerGanadores(mercadoId, p, c) {
  const gl   = p.golesLocal       ?? null;
  const gv   = p.golesVisitante   ?? null;
  const htL  = p.golesLocalHT     ?? p.htGolesLocal     ?? null;
  const htV  = p.golesVisitanteHT ?? p.htGolesVisitante ?? null;
  const tot  = (gl !== null && gv !== null) ? gl + gv : null;
  const totHT = (htL !== null && htV !== null) ? htL + htV : null;
  const g = new Set();

  switch (mercadoId) {

    case 'resultado': {
      if (gl === null || gv === null) break;
      if (gl > gv)   g.add(p.local);
      if (gl === gv) g.add('Empate');
      if (gv > gl)   g.add(p.visitante);
      break;
    }

    case 'doble': {
      if (gl === null || gv === null) break;
      if (gl >= gv)  g.add(`${p.local} o Empate`);
      if (gl !== gv) g.add(`${p.local} o ${p.visitante}`);
      if (gv >= gl)  g.add(`Empate o ${p.visitante}`);
      break;
    }

    case 'dnb':
    case 'dnbExtra': {
      if (gl === null || gv === null) break;
      if (gl > gv) { g.add(`DNB: ${p.local}`);     g.add(p.local); }
      if (gv > gl) { g.add(`DNB: ${p.visitante}`); g.add(p.visitante); }
      break;
    }

    case 'btts': {
      if (gl === null || gv === null) break;
      const am = gl > 0 && gv > 0;
      if (am)  { g.add('Sí'); g.add('Yes'); }
      if (!am) { g.add('No'); }
      break;
    }

    case 'totalgoles':
    case 'asianTotals': {
      if (tot === null) break;
      for (const key of Object.keys(c)) {
        const isOver = key.startsWith('over') || key.startsWith('aOver');
        const isUnder = key.startsWith('under') || key.startsWith('aUnder');
        if (!isOver && !isUnder) continue;
        const pref = isOver
          ? (key.startsWith('aOver') ? 'aOver' : 'over')
          : (key.startsWith('aUnder') ? 'aUnder' : 'under');
        const raw  = key.slice(pref.length);
        const line = parseLineKey(raw);
        if (line === null) continue;
        const labelO = mercadoId === 'asianTotals' ? `Más de ${line} (Asian)` : `Más de ${line} goles`;
        const labelU = mercadoId === 'asianTotals' ? `Menos de ${line} (Asian)` : `Menos de ${line} goles`;
        if (isOver  && tot > line) g.add(labelO);
        if (!isOver && tot < line) g.add(labelU);
      }
      break;
    }

    case 'imparPar': {
      if (tot === null) break;
      if (tot % 2 === 0) g.add('Par');
      else               g.add('Impar');
      break;
    }

    case 'htResult': {
      if (htL === null || htV === null) break;
      if (htL > htV)   g.add(p.local);
      if (htL === htV) g.add('Empate');
      if (htV > htL)   g.add(p.visitante);
      break;
    }

    case 'totalsHT': {
      if (totHT === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('htOver') && !key.startsWith('htUnder')) continue;
        const isOver = key.startsWith('htOver');
        const raw    = key.slice(isOver ? 6 : 7);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && totHT > line) g.add(`Más de ${line} (1ª parte)`);
        if (!isOver && totHT < line) g.add(`Menos de ${line} (1ª parte)`);
      }
      break;
    }

    case 'htImparPar': {
      if (totHT === null) break;
      if (totHT % 2 === 0) g.add('Par');
      else                  g.add('Impar');
      break;
    }

    case 'ht2': {
      if (gl === null || gv === null || htL === null || htV === null) break;
      const h2L = gl - htL, h2V = gv - htV;
      if (h2L > h2V)   g.add(`HT2: ${p.local}`);
      if (h2L === h2V) g.add('HT2: Empate');
      if (h2V > h2L)   g.add(`HT2: ${p.visitante}`);
      break;
    }

    case 'htft': {
      if (gl === null || gv === null || htL === null || htV === null) break;
      const resHT = htL > htV ? '1' : htV > htL ? '2' : 'x';
      const resFT = gl  > gv  ? '1' : gv  > gl  ? '2' : 'x';
      g.add(`htft_${resHT}_${resFT}`);
      break;
    }

    case 'correctScore': {
      if (gl === null || gv === null) break;
      const key = `cs${gl}${gv}`;
      if (c[key] != null) g.add(key);
      else                g.add('csOther');
      break;
    }

    case 'teamTotalHome': {
      if (gl === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('ttHomeOver') && !key.startsWith('ttHomeUnder')) continue;
        const isOver = key.startsWith('ttHomeOver');
        const raw    = key.slice(isOver ? 10 : 11);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && gl > line) g.add(`${p.local} más de ${line}`);
        if (!isOver && gl < line) g.add(`${p.local} menos de ${line}`);
      }
      break;
    }

    case 'teamTotalAway': {
      if (gv === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('ttAwayOver') && !key.startsWith('ttAwayUnder')) continue;
        const isOver = key.startsWith('ttAwayOver');
        const raw    = key.slice(isOver ? 10 : 11);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && gv > line) g.add(`${p.visitante} más de ${line}`);
        if (!isOver && gv < line) g.add(`${p.visitante} menos de ${line}`);
      }
      break;
    }

    case 'htTotalHome': {
      if (htL === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('htTtHomeOver') && !key.startsWith('htTtHomeUnder')) continue;
        const isOver = key.startsWith('htTtHomeOver');
        const raw    = key.slice(isOver ? 12 : 13);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && htL > line) g.add(`${p.local} más de ${line} (1ª)`);
        if (!isOver && htL < line) g.add(`${p.local} menos de ${line} (1ª)`);
      }
      break;
    }

    case 'htTotalAway': {
      if (htV === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('htTtAwayOver') && !key.startsWith('htTtAwayUnder')) continue;
        const isOver = key.startsWith('htTtAwayOver');
        const raw    = key.slice(isOver ? 12 : 13);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && htV > line) g.add(`${p.visitante} más de ${line} (1ª)`);
        if (!isOver && htV < line) g.add(`${p.visitante} menos de ${line} (1ª)`);
      }
      break;
    }

    case 'cleanSheetHome': {
      if (gv === null) break;
      if (gv === 0) g.add('csHomeYes');
      else          g.add('csHomeNo');
      break;
    }

    case 'cleanSheetAway': {
      if (gl === null) break;
      if (gl === 0) g.add('csAwayYes');
      else          g.add('csAwayNo');
      break;
    }

    case 'winNil': {
      if (gl === null || gv === null) break;
      if (gl > gv && gv === 0) g.add('winNilHome');
      if (gv > gl && gl === 0) g.add('winNilAway');
      break;
    }

    // firstScore, nextGoal, asianHandicap → no resolvemos automáticamente
    case 'firstScore':
    case 'nextGoal':
    case 'asianHandicap':
    case 'ehResult':
    case 'cornersTotal':
    case 'cornersHT':
    case 'bookingsTotal':
      break;
  }
  return g;
}

/* ─────────────────────────────────────────────────────────────
   RENDER PRINCIPAL
─────────────────────────────────────────────────────────────── */
window.renderMercados = function(p) {
  const wrap = document.getElementById('mercados-wrap');
  const c    = p.cuotas;

  const ESTADOS_FT = ['FT', 'AET', 'PEN'];
  const terminado  = ESTADOS_FT.includes(p.estado);

  if (!c) {
    wrap.innerHTML = `
      <div class="sin-cuotas-aviso">
        <i class="fas fa-lock"></i>
        Las cuotas para este partido aún no están disponibles.
      </div>`;
    return;
  }

  const mercados = [];

  /* ── 1. Resultado 1X2 ────────────────────────────────────── */
  if (c.local != null || c.empate != null || c.visitante != null) {
    mercados.push({
      id: 'resultado', titulo: '⚽ Resultado del partido (1X2)', cols: 3,
      opciones: [
        { label: p.local,     cuota: c.local,     tipo: p.local,     mercado: 'resultado' },
        { label: 'Empate',    cuota: c.empate,    tipo: 'Empate',    mercado: 'resultado' },
        { label: p.visitante, cuota: c.visitante, tipo: p.visitante, mercado: 'resultado' },
      ]
    });
  }

  /* ── 2. Doble oportunidad ────────────────────────────────── */
  const dc1X = c.dc1X ?? c.double_chance_1X;
  const dc12 = c.dc12 ?? c.double_chance_12;
  const dcX2 = c.dcX2 ?? c.double_chance_X2;
  if (dc1X != null || dc12 != null || dcX2 != null) {
    mercados.push({
      id: 'doble', titulo: '🔄 Doble oportunidad', cols: 3,
      opciones: [
        { label: `${p.local} o Empate`,        cuota: dc1X, tipo: `${p.local} o Empate`,        mercado: 'dobleoportunidad' },
        { label: `${p.local} o ${p.visitante}`, cuota: dc12, tipo: `${p.local} o ${p.visitante}`, mercado: 'dobleoportunidad' },
        { label: `Empate o ${p.visitante}`,      cuota: dcX2, tipo: `Empate o ${p.visitante}`,      mercado: 'dobleoportunidad' },
      ]
    });
  }

  /* ── 3. Draw No Bet ──────────────────────────────────────── */
  const dnbH = c.dnbLocal ?? c.dnbHome;
  const dnbA = c.dnbVisitante ?? c.dnbAway;
  if (dnbH != null || dnbA != null) {
    mercados.push({
      id: 'dnbExtra', titulo: '🚫 Sin empate (Draw No Bet)', cols: 2,
      opciones: [
        { label: p.local,     cuota: dnbH, tipo: `DNB: ${p.local}`,     mercado: 'dnb' },
        { label: p.visitante, cuota: dnbA, tipo: `DNB: ${p.visitante}`, mercado: 'dnb' },
      ]
    });
  }

  /* ── 4. Ambos marcan (BTTS) ──────────────────────────────── */
  const bttsY = c.ambosMarcanSi ?? c.bttsYes;
  const bttsN = c.ambosMarcanNo ?? c.bttsNo;
  if (bttsY != null || bttsN != null) {
    mercados.push({
      id: 'btts', titulo: '🎯 Ambos equipos marcan', cols: 2,
      opciones: [
        { label: 'Sí', cuota: bttsY, tipo: 'Sí', mercado: 'ambosmarcan' },
        { label: 'No', cuota: bttsN, tipo: 'No', mercado: 'ambosmarcan' },
      ]
    });
  }

  /* ── 5. Total goles (Over/Under) ─────────────────────────── */
  const golesLineas = leerLineasOU(c, 'over', 'under', 'totalgoles',
    line => `Más de ${line} goles`, line => `Menos de ${line} goles`);
  if (golesLineas.length) {
    mercados.push({ id: 'totalgoles', titulo: '📊 Total goles', cols: 2, opciones: golesLineas });
  }

  /* ── 6. Asian Totals ─────────────────────────────────────── */
  const asianLineas = leerLineasOU(c, 'aOver', 'aUnder', 'asianTotals',
    line => `Más de ${line} (Asian)`, line => `Menos de ${line} (Asian)`);
  if (asianLineas.length) {
    mercados.push({
      id: 'asianTotals', titulo: '🀄 Totales asiáticos', cols: 2,
      opciones: asianLineas, collapsed: true,
    });
  }

  /* ── 7. Impar / Par total ────────────────────────────────── */
  if (c.totalOdd != null || c.totalEven != null) {
    mercados.push({
      id: 'imparPar', titulo: '🔢 Impar / Par (total goles)', cols: 2,
      opciones: [
        { label: 'Impar', cuota: c.totalOdd,  tipo: 'Impar', mercado: 'imparPar' },
        { label: 'Par',   cuota: c.totalEven, tipo: 'Par',   mercado: 'imparPar' },
      ], collapsed: true,
    });
  }

  /* ── 8. Resultado 1ª mitad ───────────────────────────────── */
  const htHome = c.htLocal ?? c.htHome;
  const htDraw = c.htEmpate ?? c.htDraw;
  const htAway = c.htVisitante ?? c.htAway;
  if (htHome != null || htDraw != null || htAway != null) {
    mercados.push({
      id: 'htResult', titulo: '⏱ Resultado 1ª mitad', cols: 3,
      opciones: [
        { label: p.local,     cuota: htHome, tipo: p.local,     mercado: 'descanso' },
        { label: 'Empate',    cuota: htDraw, tipo: 'Empate',    mercado: 'descanso' },
        { label: p.visitante, cuota: htAway, tipo: p.visitante, mercado: 'descanso' },
      ]
    });
  }

  /* ── 9. Over/Under 1ª mitad ──────────────────────────────── */
  const totHTLineas = leerLineasOU(c, 'htOver', 'htUnder', 'totalsHT',
    line => `Más de ${line} (1ª parte)`, line => `Menos de ${line} (1ª parte)`);
  if (totHTLineas.length) {
    mercados.push({
      id: 'totalsHT', titulo: '📊 Goles 1ª mitad (Over/Under)', cols: 2,
      opciones: totHTLineas, collapsed: true,
    });
  }

  /* ── 10. Impar/Par 1ª mitad ──────────────────────────────── */
  if (c.htOdd != null || c.htEven != null) {
    mercados.push({
      id: 'htImparPar', titulo: '🔢 Impar / Par (1ª mitad)', cols: 2,
      opciones: [
        { label: 'Impar', cuota: c.htOdd,  tipo: 'Impar', mercado: 'htImparPar' },
        { label: 'Par',   cuota: c.htEven, tipo: 'Par',   mercado: 'htImparPar' },
      ], collapsed: true,
    });
  }

  /* ── 11. Resultado 2ª mitad ──────────────────────────────── */
  if (c.h2Local != null || c.h2Empate != null || c.h2Visitante != null) {
    mercados.push({
      id: 'ht2', titulo: '⏱ Resultado 2ª mitad', cols: 3,
      opciones: [
        { label: p.local,     cuota: c.h2Local,     tipo: `HT2: ${p.local}`,     mercado: 'segunda' },
        { label: 'Empate',    cuota: c.h2Empate,    tipo: 'HT2: Empate',         mercado: 'segunda' },
        { label: p.visitante, cuota: c.h2Visitante, tipo: `HT2: ${p.visitante}`, mercado: 'segunda' },
      ]
    });
  }

  /* ── 12. HT/FT Doble resultado ───────────────────────────── */
  const HTFT_KEYS = [
    ['htft_1_1','1ª: Local / FT: Local'],
    ['htft_1_x','1ª: Local / FT: Empate'],
    ['htft_1_2','1ª: Local / FT: Visitante'],
    ['htft_x_1','1ª: Empate / FT: Local'],
    ['htft_x_x','1ª: Empate / FT: Empate'],
    ['htft_x_2','1ª: Empate / FT: Visitante'],
    ['htft_2_1','1ª: Visitante / FT: Local'],
    ['htft_2_x','1ª: Visitante / FT: Empate'],
    ['htft_2_2','1ª: Visitante / FT: Visitante'],
  ].filter(([k]) => c[k] != null);
  if (HTFT_KEYS.length) {
    mercados.push({
      id: 'htft', titulo: '🔀 Descanso / Final (HT/FT)', cols: 3,
      opciones: HTFT_KEYS.map(([k, label]) => ({ label, cuota: c[k], tipo: k, mercado: 'htft' })),
      collapsed: true,
    });
  }

  /* ── 13. Marcador exacto (Correct Score) ─────────────────── */
  const CS_MAP = [
    ['cs00','0-0'],['cs10','1-0'],['cs01','0-1'],
    ['cs11','1-1'],['cs20','2-0'],['cs02','0-2'],
    ['cs21','2-1'],['cs12','1-2'],['cs22','2-2'],
    ['cs30','3-0'],['cs03','0-3'],['cs31','3-1'],
    ['cs13','1-3'],['cs32','3-2'],['cs23','2-3'],
    ['cs33','3-3'],['cs40','4-0'],['cs04','0-4'],
    ['cs41','4-1'],['cs14','1-4'],['cs42','4-2'],
    ['cs24','2-4'],['csOther','Otro resultado'],
  ].filter(([k]) => c[k] != null);
  if (CS_MAP.length) {
    mercados.push({
      id: 'correctScore', titulo: '🎯 Marcador exacto', cols: 3,
      opciones: CS_MAP.map(([k, label]) => ({ label, cuota: c[k], tipo: k, mercado: 'correctScore' })),
      collapsed: true,
    });
  }

  /* ── 14. Total goles local ───────────────────────────────── */
  const ttHomeOpts = leerLineasOU(c, 'ttHomeOver', 'ttHomeUnder', 'teamTotalHome',
    line => `${p.local} más de ${line}`, line => `${p.local} menos de ${line}`);
  if (ttHomeOpts.length) {
    mercados.push({
      id: 'teamTotalHome', titulo: `🏠 Goles ${p.local}`, cols: 2,
      opciones: ttHomeOpts, collapsed: true,
    });
  }

  /* ── 15. Total goles visitante ───────────────────────────── */
  const ttAwayOpts = leerLineasOU(c, 'ttAwayOver', 'ttAwayUnder', 'teamTotalAway',
    line => `${p.visitante} más de ${line}`, line => `${p.visitante} menos de ${line}`);
  if (ttAwayOpts.length) {
    mercados.push({
      id: 'teamTotalAway', titulo: `✈️ Goles ${p.visitante}`, cols: 2,
      opciones: ttAwayOpts, collapsed: true,
    });
  }

  /* ── 16. Total goles local 1ª mitad ─────────────────────── */
  const htTtHomeOpts = leerLineasOU(c, 'htTtHomeOver', 'htTtHomeUnder', 'htTotalHome',
    line => `${p.local} más de ${line} (1ª)`, line => `${p.local} menos de ${line} (1ª)`);
  if (htTtHomeOpts.length) {
    mercados.push({
      id: 'htTotalHome', titulo: `🏠 Goles ${p.local} — 1ª mitad`, cols: 2,
      opciones: htTtHomeOpts, collapsed: true,
    });
  }

  /* ── 17. Total goles visitante 1ª mitad ──────────────────── */
  const htTtAwayOpts = leerLineasOU(c, 'htTtAwayOver', 'htTtAwayUnder', 'htTotalAway',
    line => `${p.visitante} más de ${line} (1ª)`, line => `${p.visitante} menos de ${line} (1ª)`);
  if (htTtAwayOpts.length) {
    mercados.push({
      id: 'htTotalAway', titulo: `✈️ Goles ${p.visitante} — 1ª mitad`, cols: 2,
      opciones: htTtAwayOpts, collapsed: true,
    });
  }

  /* ── 18. Asian Handicap ──────────────────────────────────── */
  const ahLineas = new Set();
  for (const key of Object.keys(c)) {
    if (key.startsWith('ahHome') || key.startsWith('ahAway')) {
      ahLineas.add(key.slice(6)); // "Home25" → "25", eliminar prefijo "ahHome"/"ahAway"
    }
  }
  // Recopilar por clave real (ahHomeXX, ahAwayXX)
  const ahOpts = [];
  for (const raw of [...ahLineas].sort()) {
    const line = parseLineKey(raw);
    if (c[`ahHome${raw}`] != null) ahOpts.push({ label: `${p.local} (${line > 0 ? '+' : ''}${line})`, cuota: c[`ahHome${raw}`], tipo: `AH: ${p.local} ${line > 0 ? '+' : ''}${line}`, mercado: 'asianHandicap' });
    if (c[`ahAway${raw}`] != null) ahOpts.push({ label: `${p.visitante} (${line > 0 ? '+' : ''}${line})`, cuota: c[`ahAway${raw}`], tipo: `AH: ${p.visitante} ${line > 0 ? '+' : ''}${line}`, mercado: 'asianHandicap' });
  }
  if (ahOpts.length) {
    mercados.push({
      id: 'asianHandicap', titulo: '⚖️ Hándicap asiático', cols: 2,
      opciones: ahOpts, collapsed: true,
    });
  }

  /* ── 19. Hándicap europeo ────────────────────────────────── */
  if (c.ehHome != null || c.ehDraw != null || c.ehAway != null) {
    mercados.push({
      id: 'ehResult', titulo: '⚖️ Hándicap europeo', cols: 3,
      opciones: [
        { label: p.local,     cuota: c.ehHome, tipo: `EH: ${p.local}`,     mercado: 'ehResult' },
        { label: 'Empate',    cuota: c.ehDraw, tipo: 'EH: Empate',         mercado: 'ehResult' },
        { label: p.visitante, cuota: c.ehAway, tipo: `EH: ${p.visitante}`, mercado: 'ehResult' },
      ], collapsed: true,
    });
  }

  /* ── 20. Portería a cero — Local ─────────────────────────── */
  if (c.csHomeYes != null || c.csHomeNo != null) {
    mercados.push({
      id: 'cleanSheetHome', titulo: `🧤 Portería a cero — ${p.local}`, cols: 2,
      opciones: [
        { label: 'Sí', cuota: c.csHomeYes, tipo: 'csHomeYes', mercado: 'cleanSheetHome' },
        { label: 'No', cuota: c.csHomeNo,  tipo: 'csHomeNo',  mercado: 'cleanSheetHome' },
      ], collapsed: true,
    });
  }

  /* ── 21. Portería a cero — Visitante ─────────────────────── */
  if (c.csAwayYes != null || c.csAwayNo != null) {
    mercados.push({
      id: 'cleanSheetAway', titulo: `🧤 Portería a cero — ${p.visitante}`, cols: 2,
      opciones: [
        { label: 'Sí', cuota: c.csAwayYes, tipo: 'csAwayYes', mercado: 'cleanSheetAway' },
        { label: 'No', cuota: c.csAwayNo,  tipo: 'csAwayNo',  mercado: 'cleanSheetAway' },
      ], collapsed: true,
    });
  }

  /* ── 22. Primer equipo en marcar ─────────────────────────── */
  if (c.firstScoreHome != null || c.firstScoreNone != null || c.firstScoreAway != null) {
    mercados.push({
      id: 'firstScore', titulo: '🥇 Primer equipo en marcar', cols: 3,
      opciones: [
        { label: p.local,       cuota: c.firstScoreHome, tipo: 'firstScoreHome', mercado: 'firstScore' },
        { label: 'Sin goles',   cuota: c.firstScoreNone, tipo: 'firstScoreNone', mercado: 'firstScore' },
        { label: p.visitante,   cuota: c.firstScoreAway, tipo: 'firstScoreAway', mercado: 'firstScore' },
      ], collapsed: true,
    });
  }

  /* ── 23. Próximo gol ─────────────────────────────────────── */
  if (c.nextGoalHome != null || c.nextGoalNone != null || c.nextGoalAway != null) {
    mercados.push({
      id: 'nextGoal', titulo: '⚡ Próximo gol', cols: 3,
      opciones: [
        { label: p.local,     cuota: c.nextGoalHome, tipo: 'nextGoalHome', mercado: 'nextGoal' },
        { label: 'Sin gol',   cuota: c.nextGoalNone, tipo: 'nextGoalNone', mercado: 'nextGoal' },
        { label: p.visitante, cuota: c.nextGoalAway, tipo: 'nextGoalAway', mercado: 'nextGoal' },
      ], collapsed: true,
    });
  }

  /* ── 24. Sin encajar y ganar (Win to Nil) ────────────────── */
  if (c.winNilHome != null || c.winNilAway != null) {
    mercados.push({
      id: 'winNil', titulo: '🔒 Ganar sin encajar (Win to Nil)', cols: 2,
      opciones: [
        { label: p.local,     cuota: c.winNilHome, tipo: 'winNilHome', mercado: 'winNil' },
        { label: p.visitante, cuota: c.winNilAway, tipo: 'winNilAway', mercado: 'winNil' },
      ], collapsed: true,
    });
  }

  /* ── 25. Córners — Total partido ─────────────────────────── */
  const cornersOpts = leerLineasOU(c, 'cornersOver', 'cornersUnder', 'cornersTotal',
    line => `Córners más de ${line}`, line => `Córners menos de ${line}`);
  if (cornersOpts.length) {
    mercados.push({
      id: 'cornersTotal', titulo: '📐 Córners', cols: 2,
      opciones: cornersOpts, collapsed: true,
    });
  }

  /* ── 26. Córners — 1ª mitad ──────────────────────────────── */
  const cornersHTOpts = leerLineasOU(c, 'cornersHTOver', 'cornersHTUnder', 'cornersHT',
    line => `Córners más de ${line} (1ª)`, line => `Córners menos de ${line} (1ª)`);
  if (cornersHTOpts.length) {
    mercados.push({
      id: 'cornersHT', titulo: '📐 Córners — 1ª mitad', cols: 2,
      opciones: cornersHTOpts, collapsed: true,
    });
  }

  /* ── 27. Tarjetas ────────────────────────────────────────── */
  const bookingsOpts = leerLineasOU(c, 'bookingsOver', 'bookingsUnder', 'bookingsTotal',
    line => `Tarjetas más de ${line}`, line => `Tarjetas menos de ${line}`);
  if (bookingsOpts.length) {
    mercados.push({
      id: 'bookingsTotal', titulo: '🟨 Tarjetas', cols: 2,
      opciones: bookingsOpts, collapsed: true,
    });
  }

  /* ── Sin mercados ─────────────────────────────────────────── */
  if (!mercados.length) {
    wrap.innerHTML = `
      <div class="sin-cuotas-aviso">
        <i class="fas fa-lock"></i>
        Las cuotas para este partido aún no están disponibles.
      </div>`;
    return;
  }

  /* ── Banner partido terminado ─────────────────────────────── */
  const bannerFT = terminado ? `
    <div class="ft-mercados-banner">
      <i class="fas fa-flag-checkered"></i>
      Partido finalizado · Solo consulta · No se aceptan apuestas
    </div>` : '';

  /* ── Render HTML ──────────────────────────────────────────── */
  wrap.innerHTML = bannerFT + mercados.map(m => {
    const ganadores = terminado ? obtenerGanadores(m.id, p, c) : new Set();
    const colapsado = m.collapsed ? ' collapsed' : '';

    return `
      <div class="mercado-section${colapsado}" id="sec-${m.id}">
        <div class="mercado-header" onclick="toggleMercado('${m.id}')">
          <span class="mercado-titulo">${m.titulo}</span>
          <i class="fas fa-chevron-down mercado-chevron"></i>
        </div>
        <div class="mercado-body">
          <div class="opciones-grid cols-${m.cols}">
            ${m.opciones.map(o => {
              const tieneValor = o.cuota != null && o.cuota !== '-';
              const esGanadora = ganadores.has(o.tipo);
              let clases = 'opcion-btn';
              if (!tieneValor) clases += ' sin-cuota';
              if (terminado)   clases += ' ft-bloqueada';
              if (esGanadora)  clases += ' ft-ganadora';
              return `
                <button class="${clases}"
                        data-tipo="${o.tipo}"
                        data-cuota="${tieneValor ? o.cuota : '-'}"
                        data-mercado="${o.mercado}"
                        onclick="handleOpcion(this)"
                        ${terminado ? 'title="Partido finalizado"' : ''}>
                  <span class="opcion-label">${o.label}</span>
                  <span class="opcion-cuota">${tieneValor ? parseFloat(o.cuota).toFixed(2) : '—'}</span>
                  ${esGanadora ? '<span class="ft-ganadora-badge">✓ Ganadora</span>' : ''}
                </button>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  window.actualizarBotones?.();
};