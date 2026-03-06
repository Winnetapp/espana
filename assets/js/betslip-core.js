/* =============================================================
   betslip-core.js  —  v3.3
   Módulo compartido de carrito entre index.html y partido.html

   CAMBIOS v3.3:
   · addBet() acepta un 4º parámetro `extra` con { line, dir }
     que se almacena en el bet para que worker.js pueda resolver
     sin regex (bet.line + bet.dir en lugar de parsear el tipo).
   · window.addBet() (API pública de partido.html) también pasa
     el extra recibido desde handleOpcion.
   · formatTipo(): el handler de goles unificado ahora usa el
     texto legible directamente ("Más de 2.5 goles") porque
     mercados.js v3.4 ya genera ese texto en data-tipo.
     Se mantiene el fallback de "+2.5"/"-2.5" por compatibilidad.

   FIXES v3.2:
   · formatTipo(): handler para "+2.5"/"-2.5".

   FIXES v3.1:
   · claveExclusion(): todos los mercados con mayúsculas corregidos.
   · parseLineKey() expuesto como helper interno.
   ============================================================= */

(function () {
  'use strict';

  const ESTADOS_VIVO = ['1H', 'HT', '2H', 'ET', 'P'];

  const normM = m => (m || '').toLowerCase().replace(/[\s-]/g, '');

  /* ── Toast ── */
  function crearToastDOM() {
    if (document.getElementById('bet-toast')) return;
    const t = document.createElement('div');
    t.id = 'bet-toast';
    document.body.appendChild(t);
  }
  let _toastTimer;
  function toast(msg, tipo = 'info') {
    crearToastDOM();
    const el = document.getElementById('bet-toast');
    el.textContent = msg;
    el.className = tipo === 'error' ? 'toast-error' : tipo === 'ok' ? 'toast-ok' : '';
    el.classList.add('visible');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
  }

  /* ── Anti-trampas ── */
  async function partidoEnVivo(partidoId) {
    if (!partidoId) return false;
    const db = window.db;
    if (!db) return false;
    try {
      let snap = await db.collection('partidos').doc(partidoId).get();
      if (snap.exists) return ESTADOS_VIVO.includes(snap.data()?.estado);
      snap = await db.collection('historial').doc(partidoId).get();
      if (snap.exists) return ESTADOS_VIVO.includes(snap.data()?.estado);
      return false;
    } catch { return true; }
  }

  /* ── parseLineKey ── */
  function parseLineKey(raw) {
    if (!raw) return null;
    if (raw.startsWith('m')) {
      const v = parseLineKey(raw.slice(1));
      return v !== null ? -v : null;
    }
    const len = raw.length;
    if (len === 1) return parseFloat(raw);
    if (len === 2) return parseFloat(raw[0] + '.' + raw[1]);
    if (len === 3 && raw[0] === '0') return parseFloat('0.' + raw[1] + raw[2]);
    if (len === 3) return parseFloat(raw[0] + '.' + raw[1] + raw[2]);
    return null;
  }

  /* ── Helpers de correlación ── */
  function segmento(tipo) {
    const t = (tipo || '').toLowerCase();
    if (/1ª mitad|primera|1ª|ht/.test(t)) return 'primera';
    if (/2ª mitad|segunda|2ª/.test(t))    return 'segunda';
    return 'encuentro';
  }
  function direccion(tipo) {
    const t = (tipo || '').toLowerCase();
    if (/más de|mas de/.test(t)) return 'mas';
    if (/menos de/.test(t))      return 'menos';
    return null;
  }
  function valorNum(tipo) {
    const m = (tipo || '').match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }
  function opcionSiNo(tipo) {
    const t = (tipo || '').toLowerCase();
    return /sí$|si$/.test(t) ? 'si' : /no$/.test(t) ? 'no' : null;
  }

  /* ── claveExclusion ── */
  function claveExclusion(mercado, tipo) {
    const m = normM(mercado);

    if (m === 'resultado' || m === 'dobleoportunidad') return 'resultado_o_doble';
    if (m === 'ambosmarcan' || m === 'btts')           return `ambosmarcan|${segmento(tipo)}`;
    if (m === 'golesimparpar' || m === 'imparpar')     return 'imparpar|encuentro';
    if (m === 'htimparpar')                            return 'imparpar|primera';
    if (m === 'dnb')                                   return 'dnb';
    if (m === 'descanso' || m === 'htresult')          return 'descanso';
    if (m === 'segunda')                               return 'segunda';
    if (m === 'totalsht')                              return `totalsHT|${valorNum(tipo) ?? 'x'}`;
    if (m === 'asiantotals')                           return `asianTotals|${valorNum(tipo) ?? 'x'}`;
    if (m === 'ehresult')                              return 'ehResult';
    if (m === 'asianhandicap')                         return `asianHandicap|${tipo}`;
    if (m === 'htft')                                  return 'htft';
    if (m === 'correctscore')                          return 'correctScore';
    if (m === 'cleansheethome')                        return 'cleanSheetHome';
    if (m === 'cleansheetaway')                        return 'cleanSheetAway';
    if (m === 'firstscore')                            return 'firstScore';
    if (m === 'nextgoal')                              return 'nextGoal';
    if (m === 'winnil')                                return 'winNil';

    if (m === 'teamtotalhome') return `ttHome|${valorNum(tipo) ?? 'x'}`;
    if (m === 'teamtotalaway') return `ttAway|${valorNum(tipo) ?? 'x'}`;
    if (m === 'httotalhome')   return `htTtHome|${valorNum(tipo) ?? 'x'}`;
    if (m === 'httotalaway')   return `htTtAway|${valorNum(tipo) ?? 'x'}`;

    if (m === 'corners' || m === 'cornerstotal') {
      const t  = (tipo || '').toLowerCase();
      const eq = t.includes('local') ? 'local' : t.includes('visitante') ? 'visitante' : 'ambos';
      return `corners|encuentro|${eq}`;
    }
    if (m === 'cornersht') return `corners|primera|ambos`;

    if (m === 'tarjetas' || m === 'bookingstotal') {
      const t  = (tipo || '').toLowerCase();
      const eq = t.includes('local') ? 'local' : t.includes('visitante') ? 'visitante' : 'ambos';
      return `tarjetas|${segmento(tipo)}|${eq}`;
    }

    if (m === 'totalgoles') return `totalgoles|${valorNum(tipo) ?? 'x'}|${direccion(tipo) ?? 'x'}`;

    return m;
  }

  /* ── factorCorrelacion ── */
  function factorCorrelacion(a, b) {
    const mA = normM(a.mercado), mB = normM(b.mercado);
    const tA = (a.tipo || '').toLowerCase(), tB = (b.tipo || '').toLowerCase();

    const esRes      = m => m === 'resultado' || m === 'dobleoportunidad';
    const esAmbos    = m => m === 'ambosmarcan' || m === 'btts';
    const esImpar    = m => m === 'golesimparpar' || m === 'imparpar';
    const esHTImpar  = m => m === 'htimparpar';
    const esCorn     = m => m === 'corners' || m === 'cornerstotal';
    const esCornHT   = m => m === 'cornersht';
    const esTarj     = m => m === 'tarjetas' || m === 'bookingstotal';
    const esGoles    = m => m === 'totalgoles';
    const esAsian    = m => m === 'asiantotals';
    const esDNB      = m => m === 'dnb';
    const esHTResult = m => m === 'descanso' || m === 'htresult';
    const esTotalHT  = m => m === 'totalsht';
    const esTTHome   = m => m === 'teamtotalhome';
    const esTTAway   = m => m === 'teamtotalaway';
    const esHTTHome  = m => m === 'httotalhome';
    const esHTTAway  = m => m === 'httotalaway';
    const esEH       = m => m === 'ehresult';
    const esAH       = m => m === 'asianhandicap';
    const esHTFT     = m => m === 'htft';
    const esCS       = m => m === 'correctscore';
    const esCSHome   = m => m === 'cleansheethome';
    const esCSAway   = m => m === 'cleansheetaway';
    const esWinNil   = m => m === 'winnil';
    const esFirst    = m => m === 'firstscore';
    const esNext     = m => m === 'nextgoal';

    if (esRes(mA) && esRes(mB)) return 0.5;

    if (esAmbos(mA) && esAmbos(mB)) {
      const [opA, opB] = [opcionSiNo(tA), opcionSiNo(tB)];
      if (opA === opB && opA === 'no') return 0.5;
      return 1;
    }
    if ((esAmbos(mA) && esRes(mB) && opcionSiNo(tA) === 'si') ||
        (esAmbos(mB) && esRes(mA) && opcionSiNo(tB) === 'si')) return 0.5;

    if (esGoles(mA) && esGoles(mB)) {
      // ★ v3.3: usar dir/line del bet si disponibles, si no fallback a texto
      const dA = a.dir || direccion(tA), dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA),  nB = b.line ?? valorNum(tB);
      if (dA === 'over'  && dB === 'under' && nA === nB) return 0;
      if (dA === 'under' && dB === 'over'  && nA === nB) return 0;
      if (dA === 'mas'   && dB === 'menos' && nA === nB) return 0;
      if (dA === 'menos' && dB === 'mas'   && nA === nB) return 0;
      if ((dA === dB || (dA === 'over' && dB === 'mas') || (dA === 'mas' && dB === 'over')) && nA !== null && nB !== null) return 0.7;
    }

    if (esAsian(mA) && esAsian(mB)) {
      const [dA, dB] = [direccion(tA), direccion(tB)];
      const [nA, nB] = [valorNum(tA), valorNum(tB)];
      if (dA === 'mas' && dB === 'menos' && nA === nB) return 0;
      if (dA === 'menos' && dB === 'mas' && nA === nB) return 0;
      if (dA === dB) return 0.7;
    }

    if ((esGoles(mA) && esAsian(mB)) || (esGoles(mB) && esAsian(mA))) return 0.7;

    if (esDNB(mA) && esRes(mB)) return 0.5;
    if (esDNB(mB) && esRes(mA)) return 0.5;

    if (esCS(mA) && esRes(mB)) return 0.3;
    if (esCS(mB) && esRes(mA)) return 0.3;
    if (esCS(mA) && esCS(mB))  return 0;

    if (esHTFT(mA) && esRes(mB)) return 0.4;
    if (esHTFT(mB) && esRes(mA)) return 0.4;

    if ((esCSHome(mA) || esCSAway(mA) || esWinNil(mA)) && esRes(mB)) return 0.5;
    if ((esCSHome(mB) || esCSAway(mB) || esWinNil(mB)) && esRes(mA)) return 0.5;
    if (esWinNil(mA) && (esCSHome(mB) || esCSAway(mB))) return 0.5;
    if (esWinNil(mB) && (esCSHome(mA) || esCSAway(mA))) return 0.5;

    if ((esFirst(mA) || esNext(mA)) && esRes(mB)) return 0.5;
    if ((esFirst(mB) || esNext(mB)) && esRes(mA)) return 0.5;
    if (esFirst(mA) && esNext(mB)) return 0.6;
    if (esFirst(mB) && esNext(mA)) return 0.6;

    if (esHTResult(mA) && esTotalHT(mB)) return 0.5;
    if (esHTResult(mB) && esTotalHT(mA)) return 0.5;

    if (esImpar(mA) && esGoles(mB)) return 0.5;
    if (esImpar(mB) && esGoles(mA)) return 0.5;
    if (esHTImpar(mA) && esTotalHT(mB)) return 0.5;
    if (esHTImpar(mB) && esTotalHT(mA)) return 0.5;
    if (esImpar(mA) && esImpar(mB)) return 0;

    if (esTTHome(mA) && esTTHome(mB)) {
      const [dA, dB] = [a.dir || direccion(tA), b.dir || direccion(tB)];
      const [nA, nB] = [a.line ?? valorNum(tA),  b.line ?? valorNum(tB)];
      if ((dA === 'over' || dA === 'mas') && (dB === 'under' || dB === 'menos') && nA === nB) return 0;
      if ((dA === 'under'|| dA === 'menos') && (dB === 'over' || dB === 'mas') && nA === nB) return 0;
      if (dA === dB) return 0.7;
    }
    if (esTTAway(mA) && esTTAway(mB)) {
      const [dA, dB] = [a.dir || direccion(tA), b.dir || direccion(tB)];
      const [nA, nB] = [a.line ?? valorNum(tA),  b.line ?? valorNum(tB)];
      if ((dA === 'over' || dA === 'mas') && (dB === 'under' || dB === 'menos') && nA === nB) return 0;
      if ((dA === 'under'|| dA === 'menos') && (dB === 'over' || dB === 'mas') && nA === nB) return 0;
      if (dA === dB) return 0.7;
    }

    if (esHTTHome(mA) && esHTTHome(mB)) return 0.7;
    if (esHTTAway(mA) && esHTTAway(mB)) return 0.7;

    if (esCorn(mA) && esCorn(mB)) return 0.5;
    if (esCornHT(mA) && esCornHT(mB)) return 0.5;
    if (esCorn(mA) && esCornHT(mB)) return 0.5;
    if (esCorn(mB) && esCornHT(mA)) return 0.5;

    if (esTarj(mA) && esTarj(mB)) return 0.5;

    if (esEH(mA) && esRes(mB)) return 0.5;
    if (esEH(mB) && esRes(mA)) return 0.5;
    if (esAH(mA) && esRes(mB)) return 0.5;
    if (esAH(mB) && esRes(mA)) return 0.5;

    return 1;
  }

  function calcularCuotaCombinada(bets) {
    if (!bets || !bets.length) return 1;
    if (bets.length === 1)     return parseFloat(bets[0].cuota) || 1;
    const porPartido = {};
    bets.forEach(b => {
      const pid = (b.partidoId || b.partido || '').toString().trim();
      if (!porPartido[pid]) porPartido[pid] = [];
      porPartido[pid].push(b);
    });
    let total = 1;
    for (const grupo of Object.values(porPartido)) {
      if (grupo.length === 1) { total *= parseFloat(grupo[0].cuota) || 1; continue; }
      const absorbidas = new Set();
      for (let i = 0; i < grupo.length; i++)
        for (let j = i + 1; j < grupo.length; j++)
          if (factorCorrelacion(grupo[i], grupo[j]) === 0) {
            const ci = parseFloat(grupo[i].cuota) || 1, cj = parseFloat(grupo[j].cuota) || 1;
            absorbidas.add(ci <= cj ? i : j);
          }
      const activas = grupo.filter((_, i) => !absorbidas.has(i));
      if (!activas.length) continue;
      if (activas.length === 1) { total *= parseFloat(activas[0].cuota) || 1; continue; }
      let cuotaPartido = parseFloat(activas[0].cuota) || 1;
      for (let i = 1; i < activas.length; i++) {
        const cuotaNueva = parseFloat(activas[i].cuota) || 1;
        let factorMin = 1;
        for (let j = 0; j < i; j++) { const f = factorCorrelacion(activas[j], activas[i]); if (f < factorMin) factorMin = f; }
        if (factorMin > 0 && factorMin < 1) cuotaPartido *= 1 + (cuotaNueva - 1) * factorMin;
        else if (factorMin === 1)            cuotaPartido *= cuotaNueva;
      }
      total *= cuotaPartido;
    }
    return Math.round(total * 100) / 100;
  }

  function infoCorrelacion(bets, idx) {
    const b   = bets[idx];
    const pid = (b.partidoId || b.partido || '').toString().trim();
    let minFactor = 1;
    for (let i = 0; i < bets.length; i++) {
      if (i === idx) continue;
      const a = bets[i];
      if ((a.partidoId || a.partido || '').toString().trim() !== pid) continue;
      const f = factorCorrelacion(a, b);
      if (f < minFactor) minFactor = f;
    }
    return minFactor;
  }

  function combinaciones(arr, k) {
    if (k === 1) return arr.map(x => [x]);
    const result = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const resto = combinaciones(arr.slice(i + 1), k - 1);
      resto.forEach(c => result.push([arr[i], ...c]));
    }
    return result;
  }

  function calcularSistema(bets, k) {
    const combos  = combinaciones(bets, k);
    const cuotas  = combos.map(combo => calcularCuotaCombinada(combo));
    const retorno = cuotas.reduce((sum, c) => sum + c, 0);
    return { combos: combos.length, cuotaMedia: retorno / combos.length, retornoTotal: retorno };
  }

  /* ── Almacén ── */
  const STORAGE_KEY = 'carritoApuestas';
  let bets = [];
  function cargar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) bets = arr; }
    } catch {}
  }
  function guardar() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bets)); }

  /* ── addBet ─────────────────────────────────────────────────
     ★ v3.3: acepta extra = { line, dir } para mercados de goles
  ─────────────────────────────────────────────────────────────*/
  async function addBet({ partido, tipo, cuota, partidoId, mercado, line, dir }) {
    const pid   = (partidoId || '').toString().trim();
    const mNorm = normM(mercado);
    const cStr  = (cuota || '').toString().trim();
    const clave = claveExclusion(mNorm, tipo);

    if (pid) {
      const enVivo = await partidoEnVivo(pid);
      if (enVivo) { toast('⚠ No se puede apostar en partidos en vivo', 'error'); return; }
    }

    const idx = bets.findIndex(b =>
      (b.partidoId || '').toString().trim() === pid &&
      claveExclusion(normM(b.mercado), b.tipo) === clave
    );

    // ★ Construir el objeto bet con line/dir si están presentes
    const betObj = { partido, tipo, cuota: cStr, partidoId: pid, mercado: mNorm };
    if (line != null) betObj.line = line;
    if (dir  != null) betObj.dir  = dir;

    if (idx !== -1) {
      const ant = bets[idx];
      if (normM(ant.mercado) === mNorm &&
          (ant.tipo  || '').toLowerCase() === (tipo  || '').toLowerCase() &&
          (ant.cuota || '').toString()     === cStr) {
        bets.splice(idx, 1); guardar(); notificar(); toast('Selección eliminada', 'info'); return;
      }
      bets[idx] = betObj;
      guardar(); notificar(); toast('Selección reemplazada ✓', 'ok'); return;
    }

    bets.push(betObj);
    guardar(); notificar(); toast('Apuesta añadida ✓', 'ok');
  }

  function vaciar() { bets = []; guardar(); notificar(); }

  /* ── Render ── */
  function render() {
    renderListas(); renderSistema(); renderFooter(); renderMobileBtn();
    actualizarBotones(); actualizarPestanas();
    document.querySelectorAll(
      '.accept-btn, #btn-apostar, #btn-apostar-modal, #index-btn-apostar-modal'
    ).forEach(btn => {
      if (!btn) return;
      btn.disabled = bets.length === 0;
      btn.style.opacity = bets.length === 0 ? '0.4' : '1';
      btn.style.cursor  = bets.length === 0 ? 'not-allowed' : 'pointer';
    });
  }

  function renderListas() {
    const html = bets.length ? buildListaHTML() : `
      <li class="bs-empty"><span>🎯</span><span>Selecciona una cuota para apostar</span></li>`;
    document.querySelectorAll(
      '.bs-list, #slip-list, #slip-list-modal, #bet-list, #index-bet-list-modal'
    ).forEach(el => {
      el.innerHTML = html;
      el.querySelectorAll('.bs-remove').forEach(btn =>
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx  = parseInt(btn.dataset.idx, 10);
          const item = btn.closest('.bs-item, li');
          if (item) {
            item.classList.add('bs-item-removing');
            setTimeout(() => { bets.splice(idx, 1); guardar(); render(); }, 280);
          } else {
            bets.splice(idx, 1); guardar(); render();
          }
        })
      );
    });
  }

  function buildListaHTML() {
    const grupos = {}, orden = [];
    bets.forEach((b, i) => {
      const pid = (b.partidoId || b.partido || '').toString().trim();
      if (!grupos[pid]) { grupos[pid] = []; orden.push(pid); }
      grupos[pid].push({ ...b, _idx: i });
    });
    return orden.map(pid => {
      const grupo = grupos[pid];
      if (grupo.length === 1) {
        const { partido, tipo, cuota, mercado, _idx } = grupo[0];
        return `<li class="bs-item"><div class="bs-top"><span class="bs-tipo">${formatTipo(tipo, mercado)}</span><span class="bs-cuota">${parseFloat(cuota).toFixed(2)}</span><button class="bs-remove" data-idx="${_idx}" title="Eliminar">✕</button></div><div class="bs-info">${partido}</div></li>`;
      }
      const cuotaGrupo = calcularCuotaCombinada(grupo);
      const subItems   = grupo.map(({ tipo, cuota, mercado, _idx }) => {
        const factor = infoCorrelacion(bets, _idx);
        const badge  = factor === 0    ? `<span class="bs-corr-badge bs-corr-incompatible">⚠ Absorbida</span>`
                     : factor < 1      ? `<span class="bs-corr-badge bs-corr-reducida">↘ Correlada</span>` : '';
        return `<li class="bs-item bs-item-sub"><div class="bs-top"><span class="bs-tipo">${formatTipo(tipo, mercado)}</span><span class="bs-cuota bs-cuota-sub">${parseFloat(cuota).toFixed(2)}</span><button class="bs-remove" data-idx="${_idx}" title="Eliminar">✕</button></div>${badge}</li>`;
      }).join('');
      return `<li class="bs-item bs-item-grupo-header"><div class="bs-top"><span class="bs-tipo bs-grupo-nombre">⚽ ${grupo[0].partido}</span><span class="bs-cuota bs-grupo-cuota">${cuotaGrupo.toFixed(2)}</span></div><div class="bs-info">${grupo.length} selecciones · cuota combinada ajustada</div></li>${subItems}`;
    }).join('');
  }

  function renderSistema() {
    const wrap = document.querySelector('[data-content="sistema"]');
    if (!wrap) return;
    if (bets.length < 3) {
      wrap.innerHTML = `<div class="sistema-vacio">Necesitas al menos 3 selecciones de partidos diferentes para crear una apuesta de sistema.</div>`;
      return;
    }
    const porPartido = {};
    bets.forEach(b => {
      const pid = (b.partidoId || b.partido || '').toString().trim();
      if (!porPartido[pid]) porPartido[pid] = b;
    });
    const selecciones = Object.values(porPartido), n = selecciones.length;
    if (n < 3) {
      wrap.innerHTML = `<div class="sistema-vacio">Las selecciones deben ser de al menos 3 partidos distintos.</div>`;
      return;
    }
    let html = `<div class="sistema-info">Sistema de ${n} selecciones</div><div class="sistema-opciones">`;
    for (let k = 2; k < n; k++) {
      const { combos, cuotaMedia, retornoTotal } = calcularSistema(selecciones, k);
      html += `<label class="sistema-opcion" for="sis-${k}"><div class="sis-radio-wrap"><input type="radio" name="sistema-tipo" id="sis-${k}" value="${k}" class="sis-radio" ${k === 2 ? 'checked' : ''}><div class="sis-info"><span class="sis-titulo">${k}/${n} — ${combos} combinaciones</span><span class="sis-detalle">Cuota media <strong>${cuotaMedia.toFixed(2)}</strong></span></div></div><span class="sis-retorno">×${retornoTotal.toFixed(1)}</span></label>`;
    }
    html += `</div>`;
    const stakeVal = parseFloat(document.querySelector('.stake-input input')?.value || 5) || 5;
    const kSel     = parseInt(wrap.querySelector('input[name="sistema-tipo"]:checked')?.value || 2);
    const { combos: ca } = calcularSistema(selecciones, kSel);
    html += `<div class="sistema-footer"><div class="sis-detalle-apuesta"><span class="sis-label">Importe por combinación</span><span class="sis-valor">${stakeVal.toFixed(2)} €</span></div><div class="sis-detalle-apuesta"><span class="sis-label">Total apostado</span><span class="sis-valor">${(stakeVal * ca).toFixed(2)} €</span></div></div>`;
    wrap.innerHTML = html;
    wrap.querySelectorAll('.sis-radio').forEach(r => r.addEventListener('change', renderSistema));
  }

  function renderFooter() {
    const cuota   = calcularCuotaCombinada(bets);
    const stakeEl = document.querySelector('#index-stake-modal, #slip-stake-modal, #slip-stake, .stake-input input');
    const stake   = parseFloat(stakeEl?.value || 5) || 0;
    const win     = stake * cuota;

    document.querySelectorAll('#total-odds, .tot-value').forEach(el =>
      el.textContent = bets.length ? cuota.toFixed(2).replace('.', ',') : '0,00'
    );
    document.querySelectorAll('#potential-winnings, .pw-value').forEach(el =>
      el.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €'
    );
    document.querySelectorAll('#slip-total-odds, #slip-total-odds-modal').forEach(el =>
      el.textContent = bets.length ? cuota.toFixed(2) : '—'
    );
    document.querySelectorAll('#slip-ganancias, #slip-ganancias-modal').forEach(el =>
      el.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €'
    );
    document.querySelectorAll('#index-total-odds-modal').forEach(el =>
      el.textContent = bets.length ? cuota.toFixed(2).replace('.', ',') : '0,00'
    );
    document.querySelectorAll('#index-ganancias-modal').forEach(el =>
      el.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €'
    );
  }

  function renderMobileBtn() {
    const badge     = document.getElementById('betBadge');
    const totalText = document.getElementById('totalOddsText');
    const cartIcon  = document.getElementById('cartIcon');
    if (badge) {
      badge.style.display = bets.length ? 'inline-block' : 'none';
      badge.textContent = bets.length;
    }
    if (totalText && cartIcon) {
      const cuota = calcularCuotaCombinada(bets);
      if (bets.length) {
        cartIcon.style.display = 'none';
        totalText.style.display = 'inline';
        totalText.textContent = cuota.toFixed(2).replace('.', ',');
      } else {
        cartIcon.style.display = 'inline';
        totalText.style.display = 'none';
      }
    }
    const badgePartido = document.getElementById('mobile-bet-badge');
    if (badgePartido) {
      badgePartido.textContent = bets.length;
      badgePartido.classList.toggle('visible', bets.length > 0);
    }
  }

  function actualizarPestanas() {
    const tabCombi = document.querySelector('.bs-tab[data-target="combi"]');
    if (tabCombi) tabCombi.textContent = `Combinada (${bets.length})`;
    const tabActual = document.querySelector('.bs-tab.active')?.dataset.target;
    if (bets.length >= 2 && tabActual === 'simple') cambiarPestana('combi');
    if (bets.length < 2  && tabActual === 'combi')  cambiarPestana('simple');
  }

  function cambiarPestana(target) {
    document.querySelectorAll('.bs-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.target === target)
    );
    document.querySelectorAll('[data-content]').forEach(s =>
      s.style.display = s.dataset.content === target ? 'block' : 'none'
    );
  }

  function actualizarBotones() {
    document.querySelectorAll('.cuota-btn').forEach(btn => {
      const activa = bets.some(b =>
        (b.partidoId || '').toString() === btn.dataset.partidoid &&
        (b.tipo   || '').toLowerCase() === (btn.dataset.tipo    || '').toLowerCase() &&
        normM(b.mercado) === normM(btn.dataset.mercado || 'resultado')
      );
      btn.closest('.cuota')?.classList.toggle('activa', activa);
    });
    document.querySelectorAll('.opcion-btn').forEach(btn => {
      const activa = bets.some(b =>
        b.partidoId === (window._partidoId || '') &&
        b.tipo      === btn.dataset.tipo &&
        normM(b.mercado) === normM(btn.dataset.mercado)
      );
      btn.classList.toggle('activa', activa);
    });
  }

  function cerrarModalesMobil() {
    document.getElementById('slip-overlay')?.classList.remove('active');
    document.getElementById('slip-modal')?.classList.remove('open');
    document.getElementById('index-slip-overlay')?.classList.remove('active');
    document.getElementById('index-slip-modal')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Realizar apuesta ── */
  async function realizarApuesta() {
    const auth = window.auth, db = window.db;
    if (!auth || !db) { toast('Error: Firebase no disponible', 'error'); return; }
    const user = auth.currentUser;
    if (!user)        { toast('Debes iniciar sesión para apostar', 'error'); return; }
    if (!bets.length) { toast('No hay apuestas en el carrito', 'error');    return; }

    const pidsBloqueados = [];
    const idsUnicos = [...new Set(bets.map(b => (b.partidoId || '').toString().trim()).filter(Boolean))];
    for (const pid of idsUnicos) {
      if (await partidoEnVivo(pid)) {
        const nombre = bets.find(b => b.partidoId === pid)?.partido || pid;
        pidsBloqueados.push(nombre);
      }
    }
    if (pidsBloqueados.length) {
      bets = bets.filter(b => !pidsBloqueados.some(nombre => b.partido === nombre));
      guardar(); render();
      toast(
        pidsBloqueados.length === 1
          ? `⚠ "${pidsBloqueados[0]}" ya está en vivo y se ha eliminado del carrito`
          : `⚠ ${pidsBloqueados.length} partidos están en vivo y se han eliminado del carrito`,
        'error'
      );
      return;
    }

    const tabActual = document.querySelector('.bs-tab.active')?.dataset.target || 'simple';
    const stakeEl = [...document.querySelectorAll('.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal')]
      .find(el => el && el.value !== '') || document.querySelector('.stake-input input');
    const stake = parseFloat(stakeEl?.value || 5) || 0;
    if (stake <= 0) { toast('El importe debe ser mayor que 0', 'error'); return; }

    const userRef  = db.collection('usuarios').doc(user.uid);
    const userSnap = await userRef.get();
    const saldo    = parseFloat(userSnap.data()?.saldo) || 0;

    let apuestaData, totalDescontar;

    if (tabActual === 'sistema' && bets.length >= 3) {
      const porPartido = {};
      bets.forEach(b => {
        const pid = b.partidoId;
        if (!porPartido[pid]) porPartido[pid] = b;
      });
      const sels = Object.values(porPartido);
      const k    = parseInt(document.querySelector('input[name="sistema-tipo"]:checked')?.value || 2);
      const { combos } = calcularSistema(sels, k);
      totalDescontar = stake * combos;
      if (totalDescontar > saldo) { toast('Saldo insuficiente', 'error'); return; }
      apuestaData = {
        usuarioId: user.uid,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: 'sistema',
        sistema: { k, n: sels.length, combos },
        stake, totalDescontar,
        totalOdds: calcularCuotaCombinada(sels),
        potentialWin: stake * calcularCuotaCombinada(sels) * combos,
        bets: bets.map(b => ({ ...b, cuota: parseFloat(b.cuota) })),
        estado: 'pendiente', resultado: null,
      };
    } else {
      const totalOdds = calcularCuotaCombinada(bets);
      totalDescontar  = stake;
      if (totalDescontar > saldo) { toast('Saldo insuficiente', 'error'); return; }
      apuestaData = {
        usuarioId: user.uid,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: bets.length === 1 ? 'simple' : 'combinada',
        stake, totalOdds,
        potentialWin: stake * totalOdds,
        bets: bets.map(b => ({ ...b, cuota: parseFloat(b.cuota) })),
        estado: 'pendiente', resultado: null,
      };
    }

    try {
      await db.collection('apuestas').add(apuestaData);
      await userRef.update({ saldo: firebase.firestore.FieldValue.increment(-totalDescontar) });
      toast('¡Apuesta realizada! 🎉', 'ok');
      vaciar();
      const nuevoSaldo = saldo - totalDescontar;
      window._saldoUsuario = nuevoSaldo;
      const saldoVal = document.getElementById('hdr-saldo-val');
      if (saldoVal) saldoVal.textContent = `${nuevoSaldo.toFixed(2)} €`;
      document.querySelectorAll('.hdr-dd-saldo').forEach(el => {
        el.textContent = `${nuevoSaldo.toFixed(2)} €`;
      });
      cerrarModalesMobil();
    } catch (err) {
      console.error('[BetSlip] Error al guardar apuesta:', err);
      toast('Error al guardar la apuesta. Inténtalo de nuevo.', 'error');
    }
  }

  const _subs = [];
  function notificar() { render(); _subs.forEach(fn => fn(bets)); }

  /* ── Init ── */
  function init() {
    cargar();

    document.querySelectorAll('.bs-tab, .js-tab').forEach(btn =>
      btn.addEventListener('click', () => cambiarPestana(btn.dataset.target))
    );

    document.querySelectorAll(
      '.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal'
    ).forEach(el => {
      el.addEventListener('input', () => {
        const val = el.value;
        document.querySelectorAll('.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal').forEach(o => {
          if (o !== el) o.value = val;
        });
        renderFooter();
      });
    });

    document.querySelectorAll('.qs').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.classList.contains('all-in')
          ? (window._saldoUsuario || 0)
          : (parseFloat(btn.textContent) || 0);
        document.querySelectorAll('.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal').forEach(el => {
          el.value = v;
        });
        renderFooter();
      });
    });

    document.querySelectorAll(
      '#clear-bets, .slip-clear-btn, #slip-clear-btn, #slip-clear-btn-modal, #index-slip-clear-btn'
    ).forEach(el => el?.addEventListener('click', () => { vaciar(); toast('Carrito vaciado', 'info'); }));

    document.querySelectorAll(
      '.accept-btn, #btn-apostar, #btn-apostar-modal, #index-btn-apostar-modal'
    ).forEach(el => el?.addEventListener('click', realizarApuesta));

    const mobileBetBtn = document.getElementById('mobile-bet-btn');
    const slipOverlay  = document.getElementById('slip-overlay');
    const slipModal    = document.getElementById('slip-modal');
    mobileBetBtn?.addEventListener('click', () => {
      slipOverlay?.classList.add('active');
      slipModal?.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    slipOverlay?.addEventListener('click', () => {
      slipOverlay.classList.remove('active');
      slipModal?.classList.remove('open');
      document.body.style.overflow = '';
    });

    render();
  }

  /* ── API pública ── */
  window.BetSlip      = { addBet, vaciar, render, getBets: () => bets, onChange: fn => _subs.push(fn) };
  window.addBetToSlip = addBet;

  // ★ v3.3: addBet global acepta extra { line, dir } como 4º param
  window.addBet = (tipo, cuota, mercado, extra = {}) => {
    const p = window._partidoData;
    addBet({
      partido:   p ? `${p.local} vs ${p.visitante}` : '',
      tipo,
      cuota:     String(cuota),
      mercado,
      partidoId: window._partidoId || '',
      line:      extra.line ?? null,
      dir:       extra.dir  ?? null,
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ═══════════════════════════════════════════════════════════
     formatTipo — convierte (tipo, mercado) en texto legible
  ═══════════════════════════════════════════════════════════ */
  function formatTipo(tipo, mercado) {
    const m = normM(mercado);

    if (m === 'resultado')        return tipo.toLowerCase() === 'empate' ? 'Empate' : `Gana ${tipo}`;
    if (m === 'dobleoportunidad') return tipo;
    if (m === 'goleadores')       return `Gol de ${tipo}`;

    // ★ v3.4: totalgoles ya viene con texto legible desde mercados.js
    // Si por algún motivo viene el formato antiguo "+2.5"/"-2.5", también se maneja
    if (m === 'totalgoles') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        const val = tipo.slice(1);
        return `${dir} ${val} goles`;
      }
      return tipo; // ya viene como "Más de 2.5 goles"
    }

    if (m === 'totalsht') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `${dir} ${tipo.slice(1)} (1ª)`;
      }
      return tipo.replace(/\s*\(1ª parte\)/i, '') + ' · 1ª parte';
    }

    if (m === 'teamtotalhome') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `🏠 ${dir} ${tipo.slice(1)}`;
      }
      return `🏠 ${tipo}`;
    }
    if (m === 'teamtotalaway') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `✈️ ${dir} ${tipo.slice(1)}`;
      }
      return `✈️ ${tipo}`;
    }
    if (m === 'httotalhome') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `🏠 ${dir} ${tipo.slice(1)} (1ª)`;
      }
      return `🏠 ${tipo}`;
    }
    if (m === 'httotalaway') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `✈️ ${dir} ${tipo.slice(1)} (1ª)`;
      }
      return `✈️ ${tipo}`;
    }

    if (m === 'descanso' || m === 'htresult')
      return `1ª mitad: ${tipo.replace(/^ht1?:\s*/i, '')}`;
    if (m === 'segunda')
      return `2ª mitad: ${tipo.replace(/^ht2?:\s*/i, '')}`;

    if (m === 'dnb') return tipo.replace(/^DNB:\s*/i, 'Sin empate: ');

    if (m === 'ambosmarcan' || m === 'btts') {
      const v = tipo.toLowerCase();
      if (v === 'sí' || v === 'si' || v === 'yes') return 'Ambos marcan: Sí';
      if (v === 'no')                               return 'Ambos marcan: No';
      return `Ambos marcan: ${tipo}`;
    }

    if (m === 'imparpar')   return `Goles ${tipo}`;
    if (m === 'htimparpar') return `Goles ${tipo} (1ª mitad)`;

    if (m === 'asiantotals') return tipo.replace(/\s*\(asian\)/i, '') + ' (Asian)';

    if (m === 'cornerstotal' || m === 'corners') return `📐 ${tipo}`;
    if (m === 'cornersht')    return `📐 ${tipo}`;

    if (m === 'bookingstotal' || m === 'tarjetas') return `🟨 ${tipo}`;

    if (m === 'ehresult')      return tipo.replace(/^EH:\s*/i, 'Hándicap: ');
    if (m === 'asianhandicap') return tipo.replace(/^AH:\s*/i, 'H. Asiático: ');

    if (m === 'htft') {
      const HTFT_LABELS = {
        htft_1_1: '1ª: Local / FT: Local',     htft_1_x: '1ª: Local / FT: Empate',
        htft_1_2: '1ª: Local / FT: Visitante', htft_x_1: '1ª: Empate / FT: Local',
        htft_x_x: '1ª: Empate / FT: Empate',   htft_x_2: '1ª: Empate / FT: Visitante',
        htft_2_1: '1ª: Visitante / FT: Local', htft_2_x: '1ª: Visitante / FT: Empate',
        htft_2_2: '1ª: Visitante / FT: Visitante',
      };
      return HTFT_LABELS[tipo] || tipo;
    }

    if (m === 'correctscore') {
      if (tipo === 'csOther') return 'Marcador exacto: Otro';
      const raw = tipo.replace('cs', '');
      return `Marcador: ${raw.slice(0, -1)}-${raw.slice(-1)}`;
    }

    if (m === 'cleansheethome') {
      const v = tipo.endsWith('Yes') ? 'Sí' : 'No';
      return `🧤 Portería a cero local: ${v}`;
    }
    if (m === 'cleansheetaway') {
      const v = tipo.endsWith('Yes') ? 'Sí' : 'No';
      return `🧤 Portería a cero visitante: ${v}`;
    }

    if (m === 'firstscore') {
      if (tipo === 'firstScoreHome') return '🥇 Primer gol: Local';
      if (tipo === 'firstScoreNone') return '🥇 Sin goles';
      if (tipo === 'firstScoreAway') return '🥇 Primer gol: Visitante';
    }

    if (m === 'nextgoal') {
      if (tipo === 'nextGoalHome') return '⚡ Próx. gol: Local';
      if (tipo === 'nextGoalNone') return '⚡ Sin gol';
      if (tipo === 'nextGoalAway') return '⚡ Próx. gol: Visitante';
    }

    if (m === 'winnil') {
      if (tipo === 'winNilHome') return '🔒 Local gana sin encajar';
      if (tipo === 'winNilAway') return '🔒 Visitante gana sin encajar';
    }

    // Fallback genérico para "+X"/"-X" legacy
    if (/^[+-]\d/.test(tipo)) {
      const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
      return `${dir} ${tipo.slice(1)}`;
    }

    return tipo;
  }

})();