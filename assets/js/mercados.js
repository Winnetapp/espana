/* =============================================================
   mercados.js
   Renderiza los mercados de apuestas de un partido.
   Solo muestra mercados cuyos campos existen en Firestore.

   · Si el partido está terminado (FT / historial): los botones
     se muestran en modo "consulta" — no se pueden añadir al
     carrito y se resalta la opción ganadora.
   ============================================================= */

window.toggleMercado = function(id) {
  document.getElementById('sec-' + id)?.classList.toggle('collapsed');
};

window.handleOpcion = function(btn) {
  if (btn.classList.contains('sin-cuota'))   return;
  if (btn.classList.contains('ft-bloqueada')) return; // partido terminado
  window.addBet(btn.dataset.tipo, btn.dataset.cuota, btn.dataset.mercado);
};

/* ─────────────────────────────────────────────────────────────
   DETERMINAR GANADOR POR MERCADO
   Devuelve un Set con los dataset.tipo que deben resaltarse.
───────────────────────────────────────────────────────────── */
function obtenerGanadores(mercadoId, p, c) {
  const gl = p.golesLocal     ?? null;
  const gv = p.golesVisitante ?? null;
  const totalGoles = (gl !== null && gv !== null) ? gl + gv : null;

  const ganadores = new Set();

  switch (mercadoId) {

    case 'resultado': {
      if (gl === null || gv === null) break;
      if (gl > gv)  ganadores.add(p.local);
      if (gl === gv) ganadores.add('Empate');
      if (gv > gl)  ganadores.add(p.visitante);
      break;
    }

    case 'doble': {
      if (gl === null || gv === null) break;
      if (gl >= gv)  ganadores.add(`${p.local} o Empate`);           // 1X
      if (gl !== gv) ganadores.add(`${p.local} o ${p.visitante}`);   // 12
      if (gv >= gl)  ganadores.add(`Empate o ${p.visitante}`);       // X2
      break;
    }

    case 'dnb': {
      if (gl === null || gv === null) break;
      if (gl > gv) ganadores.add(`DNB: ${p.local}`);
      if (gv > gl) ganadores.add(`DNB: ${p.visitante}`);
      // empate → devolución, ninguno gana
      break;
    }

    case 'ambosmarcan': {
      if (gl === null || gv === null) break;
      const ambos = gl > 0 && gv > 0;
      ganadores.add(ambos ? 'Sí' : 'No');
      break;
    }

    case 'totalgoles': {
      if (totalGoles === null) break;
      if (c.over05  != null) { if (totalGoles >  0.5) ganadores.add('Más de 0.5 goles');   else ganadores.add('Menos de 0.5 goles'); }
      if (c.over15  != null) { if (totalGoles >  1.5) ganadores.add('Más de 1.5 goles');   else ganadores.add('Menos de 1.5 goles'); }
      if (c.over25  != null) { if (totalGoles >  2.5) ganadores.add('Más de 2.5 goles');   else ganadores.add('Menos de 2.5 goles'); }
      if (c.over35  != null) { if (totalGoles >  3.5) ganadores.add('Más de 3.5 goles');   else ganadores.add('Menos de 3.5 goles'); }
      if (c.over45  != null) { if (totalGoles >  4.5) ganadores.add('Más de 4.5 goles');   else ganadores.add('Menos de 4.5 goles'); }
      break;
    }

    case 'ht1': {
      const htL = p.golesLocalHT     ?? p.htLocal     ?? null;
      const htV = p.golesVisitanteHT ?? p.htVisitante ?? null;
      if (htL === null || htV === null) break;
      if (htL > htV)  ganadores.add(`HT1: ${p.local}`);
      if (htL === htV) ganadores.add('HT1: Empate');
      if (htV > htL)  ganadores.add(`HT1: ${p.visitante}`);
      break;
    }

    case 'ht2': {
      // Goles 2ª mitad = total - 1ª mitad
      const htL = p.golesLocalHT     ?? p.htLocal     ?? null;
      const htV = p.golesVisitanteHT ?? p.htVisitante ?? null;
      if (gl === null || gv === null || htL === null || htV === null) break;
      const h2L = gl - htL;
      const h2V = gv - htV;
      if (h2L > h2V)  ganadores.add(`HT2: ${p.local}`);
      if (h2L === h2V) ganadores.add('HT2: Empate');
      if (h2V > h2L)  ganadores.add(`HT2: ${p.visitante}`);
      break;
    }
  }

  return ganadores;
}

/* ── Render mercados ─────────────────────────────────────────── */
window.renderMercados = function(p) {
  const wrap = document.getElementById('mercados-wrap');
  const c    = p.cuotas;

  /* ── ¿Partido terminado? ── */
  const ESTADOS_FT  = ['FT', 'AET', 'PEN'];
  const terminado   = ESTADOS_FT.includes(p.estado);

  if (!c) {
    wrap.innerHTML = `
      <div class="sin-cuotas-aviso">
        <i class="fas fa-lock"></i>
        Las cuotas para este partido aún no están disponibles.
      </div>`;
    return;
  }

  const mercados = [];

  /* 1 · Resultado 1X2 */
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

  /* 2 · Doble oportunidad */
  if (c.double_chance_1X != null || c.double_chance_X2 != null || c.double_chance_12 != null) {
    mercados.push({
      id: 'doble',
      titulo: '🔄 Doble oportunidad',
      cols: 3,
      opciones: [
        { label: `${p.local} o Empate`,            cuota: c.double_chance_1X, tipo: `${p.local} o Empate`,            mercado: 'dobleoportunidad' },
        { label: `${p.local} o ${p.visitante}`,     cuota: c.double_chance_12, tipo: `${p.local} o ${p.visitante}`,     mercado: 'dobleoportunidad' },
        { label: `Empate o ${p.visitante}`,          cuota: c.double_chance_X2, tipo: `Empate o ${p.visitante}`,          mercado: 'dobleoportunidad' },
      ]
    });
  }

  /* 3 · Sin empate (DNB) */
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

  /* 4 · Ambos marcan */
  if (c.ambosMarcanSi != null || c.ambosMarcanNo != null) {
    mercados.push({
      id: 'ambosmarcan',
      titulo: '🎯 Ambos equipos marcan',
      cols: 2,
      opciones: [
        { label: 'Sí', cuota: c.ambosMarcanSi, tipo: 'Sí', mercado: 'ambosmarcan' },
        { label: 'No', cuota: c.ambosMarcanNo, tipo: 'No', mercado: 'ambosmarcan' },
      ]
    });
  }

  /* 5 · Total goles */
  const golesLineas = [
    { campo: 'over05',  label: 'Más de 0.5'  },
    { campo: 'under05', label: 'Menos de 0.5'},
    { campo: 'over15',  label: 'Más de 1.5'  },
    { campo: 'under15', label: 'Menos de 1.5'},
    { campo: 'over25',  label: 'Más de 2.5'  },
    { campo: 'under25', label: 'Menos de 2.5'},
    { campo: 'over35',  label: 'Más de 3.5'  },
    { campo: 'under35', label: 'Menos de 3.5'},
    { campo: 'over45',  label: 'Más de 4.5'  },
    { campo: 'under45', label: 'Menos de 4.5'},
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

  /* 6 · 1ª mitad */
  if (c.htLocal != null || c.htEmpate != null || c.htVisitante != null) {
    mercados.push({
      id: 'ht1',
      titulo: '⏱ Resultado 1ª mitad',
      cols: 3,
      opciones: [
        { label: p.local,     cuota: c.htLocal,     tipo: `HT1: ${p.local}`,     mercado: 'descanso' },
        { label: 'Empate',    cuota: c.htEmpate,    tipo: 'HT1: Empate',         mercado: 'descanso' },
        { label: p.visitante, cuota: c.htVisitante, tipo: `HT1: ${p.visitante}`, mercado: 'descanso' },
      ]
    });
  }

  /* 7 · 2ª mitad */
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

  if (!mercados.length) {
    wrap.innerHTML = `
      <div class="sin-cuotas-aviso">
        <i class="fas fa-lock"></i>
        Las cuotas para este partido aún no están disponibles.
      </div>`;
    return;
  }

  /* ── Banner informativo si el partido ha terminado ── */
  const bannerFT = terminado ? `
    <div class="ft-mercados-banner">
      <i class="fas fa-flag-checkered"></i>
      Partido finalizado · Solo consulta · No se aceptan apuestas
    </div>` : '';

  /* ── Render HTML ── */
  wrap.innerHTML = bannerFT + mercados.map(m => {
    const ganadores = terminado ? obtenerGanadores(m.id, p, c) : new Set();

    return `
      <div class="mercado-section" id="sec-${m.id}">
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
              if (!tieneValor)  clases += ' sin-cuota';
              if (terminado)    clases += ' ft-bloqueada';
              if (esGanadora)   clases += ' ft-ganadora';

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