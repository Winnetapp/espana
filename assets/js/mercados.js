/* =============================================================
   mercados.js  —  v2.0
   Renderiza los mercados de apuestas de un partido.
   Solo muestra mercados cuyos campos existen en Firestore.

   NUEVO v2.0:
   · Mercados extras de Bet365 (odds-api.io):
     BTTS, DNB, HT result, Totals HT, Team Totals,
     Corners, Bookings, European Handicap.
   · obtenerGanadores() ampliado para resaltar resultado
     correcto en partidos terminados (FT).
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
   HELPER: leer campos dinámicos over/under de un objeto cuotas
   Devuelve array de { label, campo, cuota, tipo, mercado }
   prefijo  = 'over' | 'under'  (para leer c[`over${key}`])
   prefixTipo = texto para el label ("Más de" / "Menos de")
   mercadoId  = string para dataset-mercado
   labelFn(line) → string para la etiqueta visual
───────────────────────────────────────────────────────────── */
function leerLineasOU(c, prefijos, mercadoId, labelFnOver, labelFnUnder) {
  // Detectar todas las líneas disponibles
  const lineas = new Set();
  for (const key of Object.keys(c)) {
    for (const pref of prefijos) {
      if (key.startsWith(pref)) {
        // "over095" → "095" → 9.5 ; "over25" → "25" → 2.5
        const raw = key.slice(pref.length);
        lineas.add(raw);
      }
    }
  }

  // Convertir clave numérica "25" → 2.5, "095" → 9.5
  const parse = raw => {
    if (raw.length >= 3 && raw.startsWith('0')) {
      // "095" → "9.5"
      return parseFloat(raw.slice(1, -1) + '.' + raw.slice(-1));
    }
    if (raw.length >= 3) {
      // "25" → 2.5 ; "105" → 10.5
      return parseFloat(raw.slice(0, -1) + '.' + raw.slice(-1));
    }
    return parseFloat(raw);
  };

  const resultado = [];
  const sorted = [...lineas].sort((a, b) => parse(a) - parse(b));

  for (const raw of sorted) {
    const line   = parse(raw);
    const keyRaw = raw; // tal como está en c
    // Buscar prefijo real (puede ser 'over' o 'cornersOver', etc.)
    const overKey  = prefijos[0] + keyRaw;
    const underKey = prefijos[1] + keyRaw;

    if (c[overKey]  != null) resultado.push({ label: labelFnOver(line),  cuota: c[overKey],  tipo: labelFnOver(line),  mercado: mercadoId });
    if (c[underKey] != null) resultado.push({ label: labelFnUnder(line), cuota: c[underKey], tipo: labelFnUnder(line), mercado: mercadoId });
  }

  return resultado;
}

/* ─────────────────────────────────────────────────────────────
   DETERMINAR GANADOR POR MERCADO
   Devuelve un Set con los dataset.tipo que deben resaltarse.
───────────────────────────────────────────────────────────── */
function obtenerGanadores(mercadoId, p, c) {
  const gl  = p.golesLocal      ?? null;
  const gv  = p.golesVisitante  ?? null;
  const tot = (gl !== null && gv !== null) ? gl + gv : null;
  const htL = p.golesLocalHT     ?? p.htGolesLocal     ?? null;
  const htV = p.golesVisitanteHT ?? p.htGolesVisitante ?? null;

  const ganadores = new Set();

  switch (mercadoId) {

    case 'resultado': {
      if (gl === null || gv === null) break;
      if (gl > gv)   ganadores.add(p.local);
      if (gl === gv) ganadores.add('Empate');
      if (gv > gl)   ganadores.add(p.visitante);
      break;
    }

    case 'doble': {
      if (gl === null || gv === null) break;
      if (gl >= gv)  ganadores.add(`${p.local} o Empate`);
      if (gl !== gv) ganadores.add(`${p.local} o ${p.visitante}`);
      if (gv >= gl)  ganadores.add(`Empate o ${p.visitante}`);
      break;
    }

    case 'dnb':
    case 'dnbExtra': {
      if (gl === null || gv === null) break;
      // empate → devolución, no se resalta nadie
      if (gl > gv) { ganadores.add(`DNB: ${p.local}`);     ganadores.add(p.local); }
      if (gv > gl) { ganadores.add(`DNB: ${p.visitante}`); ganadores.add(p.visitante); }
      break;
    }

    case 'ambosmarcan':
    case 'btts': {
      if (gl === null || gv === null) break;
      const am = gl > 0 && gv > 0;
      if (am)  { ganadores.add('Sí'); ganadores.add('Yes'); }
      if (!am) { ganadores.add('No'); }
      break;
    }

    case 'totalgoles': {
      if (tot === null) break;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('over') && !key.startsWith('under')) continue;
        const isOver = key.startsWith('over');
        const raw    = key.slice(isOver ? 4 : 5);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && tot > line)  ganadores.add(`Más de ${line} goles`);
        if (!isOver && tot < line)  ganadores.add(`Menos de ${line} goles`);
        if (!isOver && tot > line)  ganadores.add(`Más de ${line} goles`);
        if (isOver  && tot < line)  ganadores.add(`Menos de ${line} goles`);
      }
      // Simplificar: solo la respuesta correcta
      if (c.over25  != null) { if (tot > 2.5) ganadores.add('Más de 2.5 goles');   else ganadores.add('Menos de 2.5 goles'); }
      if (c.over15  != null) { if (tot > 1.5) ganadores.add('Más de 1.5 goles');   else ganadores.add('Menos de 1.5 goles'); }
      if (c.over35  != null) { if (tot > 3.5) ganadores.add('Más de 3.5 goles');   else ganadores.add('Menos de 3.5 goles'); }
      if (c.over45  != null) { if (tot > 4.5) ganadores.add('Más de 4.5 goles');   else ganadores.add('Menos de 4.5 goles'); }
      if (c.over05  != null) { if (tot > 0.5) ganadores.add('Más de 0.5 goles');   else ganadores.add('Menos de 0.5 goles'); }
      break;
    }

    case 'ht1': {
      if (htL === null || htV === null) break;
      if (htL > htV)   ganadores.add(`HT1: ${p.local}`);
      if (htL === htV) ganadores.add('HT1: Empate');
      if (htV > htL)   ganadores.add(`HT1: ${p.visitante}`);
      // También para los tipos del mercado extra htResult
      if (htL > htV)   ganadores.add(p.local);
      if (htL === htV) ganadores.add('Empate');
      if (htV > htL)   ganadores.add(p.visitante);
      break;
    }

    case 'htResult': {
      if (htL === null || htV === null) break;
      if (htL > htV)   ganadores.add(p.local);
      if (htL === htV) ganadores.add('Empate');
      if (htV > htL)   ganadores.add(p.visitante);
      break;
    }

    case 'ht2': {
      if (gl === null || gv === null || htL === null || htV === null) break;
      const h2L = gl - htL, h2V = gv - htV;
      if (h2L > h2V)   ganadores.add(`HT2: ${p.local}`);
      if (h2L === h2V) ganadores.add('HT2: Empate');
      if (h2V > h2L)   ganadores.add(`HT2: ${p.visitante}`);
      break;
    }

    case 'totalsHT': {
      if (htL === null || htV === null) break;
      const totHT = htL + htV;
      for (const key of Object.keys(c)) {
        if (!key.startsWith('htOver') && !key.startsWith('htUnder')) continue;
        const isOver = key.startsWith('htOver');
        const raw    = key.slice(isOver ? 6 : 7);
        const line   = parseLineKey(raw);
        if (line === null) continue;
        if (isOver  && totHT > line) ganadores.add(`Más de ${line} (1ª parte)`);
        if (!isOver && totHT < line) ganadores.add(`Menos de ${line} (1ª parte)`);
      }
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
        if (isOver  && gl > line) ganadores.add(`${p.local} más de ${line}`);
        if (!isOver && gl < line) ganadores.add(`${p.local} menos de ${line}`);
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
        if (isOver  && gv > line) ganadores.add(`${p.visitante} más de ${line}`);
        if (!isOver && gv < line) ganadores.add(`${p.visitante} menos de ${line}`);
      }
      break;
    }

    case 'ehResult': {
      // Hándicap europeo: no podemos calcular ganador sin saber el hándicap aplicado
      // Lo dejamos sin resaltar
      break;
    }

    // Corners y tarjetas no los resolvemos automáticamente (no tenemos los datos)
    case 'cornersTotal':
    case 'bookingsTotal':
      break;
  }

  return ganadores;
}

/* Convierte clave numérica "25" → 2.5 */
function parseLineKey(raw) {
  if (!raw) return null;
  if (raw.length >= 3 && raw.startsWith('0')) {
    return parseFloat(raw.slice(1, -1) + '.' + raw.slice(-1));
  }
  if (raw.length >= 2) {
    return parseFloat(raw.slice(0, -1) + '.' + raw.slice(-1));
  }
  return parseFloat(raw);
}

/* ── Render mercados ─────────────────────────────────────────── */
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

  /* ── 1. Resultado 1X2 ─────────────────────────────────────── */
  if (c.local != null || c.empate != null || c.visitante != null) {
    mercados.push({
      id: 'resultado',
      titulo: '⚽ Resultado del partido (1X2)',
      cols: 3,
      opciones: [
        { label: p.local,     cuota: c.local,     tipo: p.local,     mercado: 'resultado' },
        { label: 'Empate',    cuota: c.empate,    tipo: 'Empate',    mercado: 'resultado' },
        { label: p.visitante, cuota: c.visitante, tipo: p.visitante, mercado: 'resultado' },
      ]
    });
  }

  /* ── 2. Doble oportunidad ─────────────────────────────────── */
  if (c.double_chance_1X != null || c.double_chance_X2 != null || c.double_chance_12 != null) {
    mercados.push({
      id: 'doble',
      titulo: '🔄 Doble oportunidad',
      cols: 3,
      opciones: [
        { label: `${p.local} o Empate`,           cuota: c.double_chance_1X, tipo: `${p.local} o Empate`,           mercado: 'dobleoportunidad' },
        { label: `${p.local} o ${p.visitante}`,    cuota: c.double_chance_12, tipo: `${p.local} o ${p.visitante}`,    mercado: 'dobleoportunidad' },
        { label: `Empate o ${p.visitante}`,         cuota: c.double_chance_X2, tipo: `Empate o ${p.visitante}`,         mercado: 'dobleoportunidad' },
      ]
    });
  }

  /* ── 3. Draw No Bet (the-odds-api) ───────────────────────── */
  if (c.dnbLocal != null || c.dnbVisitante != null) {
    mercados.push({
      id: 'dnb',
      titulo: '🚫 Sin empate (Draw No Bet)',
      cols: 2,
      opciones: [
        { label: p.local,     cuota: c.dnbLocal,     tipo: `DNB: ${p.local}`,     mercado: 'dnb' },
        { label: p.visitante, cuota: c.dnbVisitante, tipo: `DNB: ${p.visitante}`, mercado: 'dnb' },
      ]
    });
  }

  /* ── 4. Draw No Bet (Bet365 / odds-api.io) ───────────────── */
  if (c.dnbHome != null || c.dnbAway != null) {
    // Solo mostrar si no se cargó ya el DNB de the-odds-api
    if (c.dnbLocal == null && c.dnbVisitante == null) {
      mercados.push({
        id: 'dnbExtra',
        titulo: '🚫 Sin empate (Draw No Bet)',
        cols: 2,
        opciones: [
          { label: p.local,     cuota: c.dnbHome, tipo: `DNB: ${p.local}`,     mercado: 'dnb' },
          { label: p.visitante, cuota: c.dnbAway, tipo: `DNB: ${p.visitante}`, mercado: 'dnb' },
        ]
      });
    }
  }

  /* ── 5. Ambos marcan (BTTS) ──────────────────────────────── */
  // Prioridad: campos legacy (ambosMarcanSi) → campos nuevos (bttsYes)
  const bttsYes = c.ambosMarcanSi ?? c.bttsYes;
  const bttsNo  = c.ambosMarcanNo ?? c.bttsNo;
  if (bttsYes != null || bttsNo != null) {
    mercados.push({
      id: 'btts',
      titulo: '🎯 Ambos equipos marcan',
      cols: 2,
      opciones: [
        { label: 'Sí', cuota: bttsYes, tipo: 'Sí', mercado: 'ambosmarcan' },
        { label: 'No', cuota: bttsNo,  tipo: 'No', mercado: 'ambosmarcan' },
      ]
    });
  }

  /* ── 6. Total goles ──────────────────────────────────────── */
  const golesLineas = [
    { campo: 'over05',  label: 'Más de 0.5'   },
    { campo: 'under05', label: 'Menos de 0.5' },
    { campo: 'over15',  label: 'Más de 1.5'   },
    { campo: 'under15', label: 'Menos de 1.5' },
    { campo: 'over25',  label: 'Más de 2.5'   },
    { campo: 'under25', label: 'Menos de 2.5' },
    { campo: 'over35',  label: 'Más de 3.5'   },
    { campo: 'under35', label: 'Menos de 3.5' },
    { campo: 'over45',  label: 'Más de 4.5'   },
    { campo: 'under45', label: 'Menos de 4.5' },
  ].filter(o => c[o.campo] != null);

  if (golesLineas.length) {
    mercados.push({
      id: 'totalgoles',
      titulo: '📊 Total goles',
      cols: 2,
      opciones: golesLineas.map(o => ({
        label:   o.label,
        cuota:   c[o.campo],
        tipo:    `${o.label} goles`,
        mercado: 'totalgoles'
      }))
    });
  }

  /* ── 7. Resultado 1ª mitad ───────────────────────────────── */
  // Prioridad: campos legacy (htLocal) → campos nuevos (htHome)
  const htHome = c.htLocal ?? c.htHome;
  const htDraw = c.htEmpate ?? c.htDraw;
  const htAway = c.htVisitante ?? c.htAway;
  if (htHome != null || htDraw != null || htAway != null) {
    mercados.push({
      id: 'htResult',
      titulo: '⏱ Resultado 1ª mitad',
      cols: 3,
      opciones: [
        { label: p.local,     cuota: htHome, tipo: p.local,     mercado: 'descanso' },
        { label: 'Empate',    cuota: htDraw, tipo: 'Empate',    mercado: 'descanso' },
        { label: p.visitante, cuota: htAway, tipo: p.visitante, mercado: 'descanso' },
      ]
    });
  }

  /* ── 8. Over/Under 1ª mitad (Totals HT) ─────────────────── */
  // Detectar líneas disponibles: htOver05, htOver15, htOver25...
  const totalsHTOpciones = (() => {
    const opts = [];
    const keys = Object.keys(c).filter(k => k.startsWith('htOver') || k.startsWith('htUnder'));
    const lineas = new Set();
    for (const k of keys) {
      const isOver = k.startsWith('htOver');
      const raw    = k.slice(isOver ? 6 : 7);
      lineas.add(raw);
    }
    for (const raw of [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b))) {
      const line     = parseLineKey(raw);
      const overKey  = `htOver${raw}`;
      const underKey = `htUnder${raw}`;
      if (c[overKey]  != null) opts.push({ label: `Más de ${line}`,   cuota: c[overKey],  tipo: `Más de ${line} (1ª parte)`,   mercado: 'totalsHT' });
      if (c[underKey] != null) opts.push({ label: `Menos de ${line}`, cuota: c[underKey], tipo: `Menos de ${line} (1ª parte)`, mercado: 'totalsHT' });
    }
    return opts;
  })();

  if (totalsHTOpciones.length) {
    mercados.push({
      id: 'totalsHT',
      titulo: '📊 Goles 1ª mitad (Over/Under)',
      cols: 2,
      opciones: totalsHTOpciones,
      collapsed: true,
    });
  }

  /* ── 9. Resultado 2ª mitad ───────────────────────────────── */
  if (c.h2Local != null || c.h2Empate != null || c.h2Visitante != null) {
    mercados.push({
      id: 'ht2',
      titulo: '⏱ Resultado 2ª mitad',
      cols: 3,
      opciones: [
        { label: p.local,     cuota: c.h2Local,     tipo: `HT2: ${p.local}`,     mercado: 'segunda' },
        { label: 'Empate',    cuota: c.h2Empate,    tipo: 'HT2: Empate',         mercado: 'segunda' },
        { label: p.visitante, cuota: c.h2Visitante, tipo: `HT2: ${p.visitante}`, mercado: 'segunda' },
      ]
    });
  }

  /* ── 10. Total goles local ───────────────────────────────── */
  const ttHomeOpciones = (() => {
    const opts  = [];
    const keys  = Object.keys(c).filter(k => k.startsWith('ttHomeOver') || k.startsWith('ttHomeUnder'));
    const lineas = new Set();
    for (const k of keys) {
      const isOver = k.startsWith('ttHomeOver');
      lineas.add(k.slice(isOver ? 10 : 11));
    }
    for (const raw of [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b))) {
      const line = parseLineKey(raw);
      if (c[`ttHomeOver${raw}`]  != null) opts.push({ label: `Más de ${line}`,   cuota: c[`ttHomeOver${raw}`],  tipo: `${p.local} más de ${line}`,   mercado: 'teamTotalHome' });
      if (c[`ttHomeUnder${raw}`] != null) opts.push({ label: `Menos de ${line}`, cuota: c[`ttHomeUnder${raw}`], tipo: `${p.local} menos de ${line}`, mercado: 'teamTotalHome' });
    }
    return opts;
  })();

  if (ttHomeOpciones.length) {
    mercados.push({
      id: 'teamTotalHome',
      titulo: `🏠 Goles ${p.local}`,
      cols: 2,
      opciones: ttHomeOpciones,
      collapsed: true,
    });
  }

  /* ── 11. Total goles visitante ───────────────────────────── */
  const ttAwayOpciones = (() => {
    const opts  = [];
    const keys  = Object.keys(c).filter(k => k.startsWith('ttAwayOver') || k.startsWith('ttAwayUnder'));
    const lineas = new Set();
    for (const k of keys) {
      const isOver = k.startsWith('ttAwayOver');
      lineas.add(k.slice(isOver ? 10 : 11));
    }
    for (const raw of [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b))) {
      const line = parseLineKey(raw);
      if (c[`ttAwayOver${raw}`]  != null) opts.push({ label: `Más de ${line}`,   cuota: c[`ttAwayOver${raw}`],  tipo: `${p.visitante} más de ${line}`,   mercado: 'teamTotalAway' });
      if (c[`ttAwayUnder${raw}`] != null) opts.push({ label: `Menos de ${line}`, cuota: c[`ttAwayUnder${raw}`], tipo: `${p.visitante} menos de ${line}`, mercado: 'teamTotalAway' });
    }
    return opts;
  })();

  if (ttAwayOpciones.length) {
    mercados.push({
      id: 'teamTotalAway',
      titulo: `✈️ Goles ${p.visitante}`,
      cols: 2,
      opciones: ttAwayOpciones,
      collapsed: true,
    });
  }

  /* ── 12. Córners ─────────────────────────────────────────── */
  const cornersOpciones = (() => {
    const opts   = [];
    const keys   = Object.keys(c).filter(k => k.startsWith('cornersOver') || k.startsWith('cornersUnder'));
    const lineas = new Set();
    for (const k of keys) {
      const isOver = k.startsWith('cornersOver');
      lineas.add(k.slice(isOver ? 11 : 12));
    }
    for (const raw of [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b))) {
      const line = parseLineKey(raw);
      if (c[`cornersOver${raw}`]  != null) opts.push({ label: `Más de ${line}`,   cuota: c[`cornersOver${raw}`],  tipo: `Córners más de ${line}`,   mercado: 'cornersTotal' });
      if (c[`cornersUnder${raw}`] != null) opts.push({ label: `Menos de ${line}`, cuota: c[`cornersUnder${raw}`], tipo: `Córners menos de ${line}`, mercado: 'cornersTotal' });
    }
    return opts;
  })();

  if (cornersOpciones.length) {
    mercados.push({
      id: 'cornersTotal',
      titulo: '📐 Córners',
      cols: 2,
      opciones: cornersOpciones,
      collapsed: true,
    });
  }

  /* ── 13. Tarjetas ────────────────────────────────────────── */
  const bookingsOpciones = (() => {
    const opts   = [];
    const keys   = Object.keys(c).filter(k => k.startsWith('bookingsOver') || k.startsWith('bookingsUnder'));
    const lineas = new Set();
    for (const k of keys) {
      const isOver = k.startsWith('bookingsOver');
      lineas.add(k.slice(isOver ? 12 : 13));
    }
    for (const raw of [...lineas].sort((a, b) => parseLineKey(a) - parseLineKey(b))) {
      const line = parseLineKey(raw);
      if (c[`bookingsOver${raw}`]  != null) opts.push({ label: `Más de ${line}`,   cuota: c[`bookingsOver${raw}`],  tipo: `Tarjetas más de ${line}`,   mercado: 'bookingsTotal' });
      if (c[`bookingsUnder${raw}`] != null) opts.push({ label: `Menos de ${line}`, cuota: c[`bookingsUnder${raw}`], tipo: `Tarjetas menos de ${line}`, mercado: 'bookingsTotal' });
    }
    return opts;
  })();

  if (bookingsOpciones.length) {
    mercados.push({
      id: 'bookingsTotal',
      titulo: '🟨 Tarjetas',
      cols: 2,
      opciones: bookingsOpciones,
      collapsed: true,
    });
  }

  /* ── 14. Hándicap europeo ────────────────────────────────── */
  if (c.ehHome != null || c.ehDraw != null || c.ehAway != null) {
    mercados.push({
      id: 'ehResult',
      titulo: '⚖️ Hándicap europeo',
      cols: 3,
      opciones: [
        { label: p.local,     cuota: c.ehHome, tipo: `EH: ${p.local}`,     mercado: 'ehResult' },
        { label: 'Empate',    cuota: c.ehDraw, tipo: 'EH: Empate',         mercado: 'ehResult' },
        { label: p.visitante, cuota: c.ehAway, tipo: `EH: ${p.visitante}`, mercado: 'ehResult' },
      ],
      collapsed: true,
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
    const ganadores  = terminado ? obtenerGanadores(m.id, p, c) : new Set();
    const colapsado  = m.collapsed ? ' collapsed' : '';

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