/* =============================================================
   betslip-core.js  —  v4.2
   Módulo compartido de carrito entre index.html y partido.html

   CAMBIOS v4.2:
   · partidoNoApostable(): renombrada y ampliada. Antes solo
     bloqueaba partidos en vivo (1H, HT, 2H, ET, P). Ahora
     también bloquea partidos terminados (FT, AET, PEN) y
     cualquier estado distinto de NS/TBD. Un partido que ha
     comenzado —ya sea en juego o finalizado— no puede recibir
     nuevas apuestas ni confirmar apuestas pendientes en carrito.

   CAMBIOS v4.1:
   · validarDNBEnCarrito(): fix completo. DNB nunca puede
     coexistir con ninguna otra selección en el carrito,
     independientemente de si son del mismo partido o de
     partidos distintos.

   CAMBIOS v4.0 — Reglas reales de casas de apuestas:
   ─────────────────────────────────────────────────────────
   FIX 1 · claveExclusion()
   FIX 2 · esIncompatible()
   FIX 3 · DNB solo en apuesta simple
   FIX 4 · addBet() con validación previa
   FIX 5 · factorCorrelacion() revisado
   FIX 6 · actualizarBotones() con clase incompatible-bloqueada
   FIX 7 · realizarApuesta() con segunda validación

   Mantiene compatibilidad con mercados.js v3.4 y worker.js v6.5
   ============================================================= */

(function () {
  'use strict';

  // Estados en los que un partido ya NO acepta apuestas
  const ESTADOS_NO_APOSTABLE = ['1H', 'HT', '2H', 'ET', 'P', 'FT', 'AET', 'PEN', 'SUSP', 'INT', 'ABD', 'AWD', 'WO'];
  // Estados en los que el partido todavía acepta apuestas
  const ESTADOS_APOSTABLE    = ['NS', 'TBD', 'PST'];

  const normM = m => (m || '').toLowerCase().replace(/[\s\-_]/g, '');

  /* ─────────────────────────────────────────────────────────
     TOAST
  ───────────────────────────────────────────────────────── */
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
    _toastTimer = setTimeout(() => el.classList.remove('visible'), 3400);
  }

  /* ─────────────────────────────────────────────────────────
     v4.2 · partidoNoApostable
     Devuelve true si el partido ya ha comenzado o finalizado.
     Bloquea tanto partidos en vivo como terminados.
  ───────────────────────────────────────────────────────── */
  async function partidoNoApostable(partidoId) {
    if (!partidoId) return false;
    const db = window.db;
    if (!db) return false;
    try {
      let snap = await db.collection('partidos').doc(partidoId).get();
      if (snap.exists) {
        const estado = snap.data()?.estado;
        // Si el estado es conocido y NO está en la lista apostable → bloqueado
        if (estado) return !ESTADOS_APOSTABLE.includes(estado);
        return false;
      }
      // Si está en historial, definitivamente terminado
      snap = await db.collection('historial').doc(partidoId).get();
      if (snap.exists) return true;
      return false;
    } catch { return true; } // en caso de error, bloquear por seguridad
  }

  /* ─────────────────────────────────────────────────────────
     parseLineKey
  ───────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     HELPERS de correlación / clasificación
  ───────────────────────────────────────────────────────── */
  function segmento(tipo) {
    const t = (tipo || '').toLowerCase();
    if (/1ª mitad|primera|1ª|ht/.test(t)) return 'primera';
    if (/2ª mitad|segunda|2ª/.test(t))    return 'segunda';
    return 'encuentro';
  }
  function direccion(tipo) {
    const t = (tipo || '').toLowerCase();
    if (/más de|mas de|over/.test(t) || /^\+\d/.test(tipo)) return 'over';
    if (/menos de|under/.test(t)     || /^-\d/.test(tipo))  return 'under';
    return null;
  }
  function valorNum(tipo) {
    const m = (tipo || '').match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }
  function opcionSiNo(tipo) {
    const t = (tipo || '').toLowerCase();
    return /sí$|si$|yes$/.test(t) ? 'si' : /no$/.test(t) ? 'no' : null;
  }

  /* ─────────────────────────────────────────────────────────
     CLASIFICADORES de mercado
  ───────────────────────────────────────────────────────── */
  const esRes      = m => m === 'resultado';
  const esDoble    = m => m === 'dobleoportunidad';
  const esDNB      = m => m === 'dnb';
  const esAmbos    = m => m === 'ambosmarcan' || m === 'btts';
  const esGoles    = m => m === 'totalgoles';
  const esTotalHT  = m => m === 'totalsht';
  const esTTHome   = m => m === 'teamtotalhome';
  const esTTAway   = m => m === 'teamtotalaway';
  const esHTTHome  = m => m === 'httotalhome';
  const esHTTAway  = m => m === 'httotalaway';
  const esImpar    = m => m === 'golesimparpar' || m === 'imparpar';
  const esHTImpar  = m => m === 'htimparpar';
  const esHTResult = m => m === 'descanso' || m === 'htresult';
  const esSegunda  = m => m === 'segunda';
  const esHTFT     = m => m === 'htft';
  const esCS       = m => m === 'correctscore';
  const esCSHome   = m => m === 'cleansheethome';
  const esCSAway   = m => m === 'cleansheetaway';
  const esWinNil   = m => m === 'winnil';
  const esFirst    = m => m === 'firstscore';
  const esNext     = m => m === 'nextgoal';
  const esCorn     = m => m === 'corners' || m === 'cornerstotal';
  const esCornHT   = m => m === 'cornersht';
  const esTarj     = m => m === 'tarjetas' || m === 'bookingstotal';
  const esAH       = m => m === 'asianhandicap';
  const esEH       = m => m === 'ehresult';
  const esAsian    = m => m === 'asiantotals';

  /* ─────────────────────────────────────────────────────────
     claveExclusion
  ───────────────────────────────────────────────────────── */
  function claveExclusion(mercado, tipo) {
    const m = normM(mercado);

    if (esRes(m))    return 'resultado';
    if (esDoble(m))  return 'dobleoportunidad';
    if (esDNB(m))    return 'dnb';

    if (esAmbos(m))    return `ambosmarcan|${segmento(tipo)}`;
    if (esImpar(m))    return 'imparpar|encuentro';
    if (esHTImpar(m))  return 'imparpar|primera';
    if (esHTResult(m)) return 'descanso';
    if (esSegunda(m))  return 'segunda';
    if (esTotalHT(m))  return `totalsHT|${valorNum(tipo) ?? 'x'}`;
    if (esAsian(m))    return `asianTotals|${valorNum(tipo) ?? 'x'}`;
    if (esEH(m))       return 'ehResult';
    if (esAH(m))       return `asianHandicap|${tipo}`;
    if (esHTFT(m))     return 'htft';
    if (esCS(m))       return 'correctScore';
    if (esCSHome(m))   return 'cleanSheetHome';
    if (esCSAway(m))   return 'cleanSheetAway';
    if (esFirst(m))    return 'firstScore';
    if (esNext(m))     return 'nextGoal';
    if (esWinNil(m))   return 'winNil';
    if (esTTHome(m))   return `ttHome|${valorNum(tipo) ?? 'x'}`;
    if (esTTAway(m))   return `ttAway|${valorNum(tipo) ?? 'x'}`;
    if (esHTTHome(m))  return `htTtHome|${valorNum(tipo) ?? 'x'}`;
    if (esHTTAway(m))  return `htTtAway|${valorNum(tipo) ?? 'x'}`;
    if (esCorn(m))     return `corners|encuentro`;
    if (esCornHT(m))   return `corners|primera`;
    if (esTarj(m))     return `tarjetas|encuentro`;
    if (esGoles(m))    return `totalgoles|${valorNum(tipo) ?? 'x'}|${direccion(tipo) ?? 'x'}`;

    return m;
  }

  /* ─────────────────────────────────────────────────────────
     esIncompatible
  ───────────────────────────────────────────────────────── */
  function esIncompatible(a, b) {
    const mA = normM(a.mercado), mB = normM(b.mercado);
    const tA = (a.tipo || '').toLowerCase();
    const tB = (b.tipo || '').toLowerCase();

    if ((esRes(mA) && esDoble(mB)) || (esDoble(mA) && esRes(mB)))
      return { incompatible: true, motivo: 'Resultado (1X2) y Doble oportunidad son incompatibles en el mismo partido' };

    if ((esRes(mA) && esDNB(mB)) || (esDNB(mA) && esRes(mB)))
      return { incompatible: true, motivo: 'Resultado (1X2) y Sin empate (DNB) son incompatibles en el mismo partido' };

    if ((esDoble(mA) && esDNB(mB)) || (esDNB(mA) && esDoble(mB)))
      return { incompatible: true, motivo: 'Doble oportunidad y Sin empate (DNB) son incompatibles en el mismo partido' };

    const esGolA = esGoles(mA) || esTotalHT(mA) || esTTHome(mA) || esTTAway(mA) || esHTTHome(mA) || esHTTAway(mA) || esAsian(mA);
    const esGolB = esGoles(mB) || esTotalHT(mB) || esTTHome(mB) || esTTAway(mB) || esHTTHome(mB) || esHTTAway(mB) || esAsian(mB);
    if (esGolA && esGolB && mA === mB) {
      const dA = a.dir || direccion(tA);
      const dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA);
      const nB = b.line ?? valorNum(tB);
      if (nA !== null && nB !== null && nA === nB) {
        if ((dA === 'over' && dB === 'under') || (dA === 'under' && dB === 'over'))
          return { incompatible: true, motivo: `Over ${nA} y Under ${nA} del mismo mercado son incompatibles` };
      }
    }

    if (esAmbos(mA) && esAmbos(mB)) {
      const opA = opcionSiNo(tA), opB = opcionSiNo(tB);
      if (opA !== null && opB !== null && opA !== opB)
        return { incompatible: true, motivo: 'Ambos marcan Sí y No son incompatibles en el mismo partido' };
    }

    if ((esCS(mA) && !esCS(mB)) || (!esCS(mA) && esCS(mB)))
      return { incompatible: true, motivo: 'El marcador exacto no puede combinarse con otros mercados del mismo partido' };

    if ((esHTFT(mA) && !esHTFT(mB)) || (!esHTFT(mA) && esHTFT(mB)))
      return { incompatible: true, motivo: 'Descanso/Final (HT/FT) no puede combinarse con otros mercados del mismo partido' };

    if ((esRes(mA) && esWinNil(mB)) || (esWinNil(mA) && esRes(mB)))
      return { incompatible: true, motivo: 'Resultado (1X2) y Ganar sin encajar son incompatibles en el mismo partido' };

    if (esDNB(mA) && esAmbos(mB) && opcionSiNo(tB) === 'no')
      return { incompatible: true, motivo: 'Sin empate (DNB) y Ambos marcan No son incompatibles en el mismo partido' };
    if (esDNB(mB) && esAmbos(mA) && opcionSiNo(tA) === 'no')
      return { incompatible: true, motivo: 'Sin empate (DNB) y Ambos marcan No son incompatibles en el mismo partido' };

    return { incompatible: false, motivo: '' };
  }

  /* ─────────────────────────────────────────────────────────
     validarDNBEnCarrito (v4.1)
  ───────────────────────────────────────────────────────── */
  function validarDNBEnCarrito(betNuevo, betsActuales) {
    const mNuevo = normM(betNuevo.mercado);

    if (esDNB(mNuevo)) {
      if (betsActuales.length > 0)
        return { ok: false, motivo: 'Sin empate (DNB) solo se puede apostar como apuesta simple, sin combinar con ninguna otra selección' };
    } else {
      const hayDNB = betsActuales.some(b => esDNB(normM(b.mercado)));
      if (hayDNB)
        return { ok: false, motivo: 'No se puede añadir más selecciones: el carrito ya tiene una apuesta Sin empate (DNB) que solo puede ir como simple' };
    }
    return { ok: true };
  }

  /* ─────────────────────────────────────────────────────────
     factorCorrelacion
  ───────────────────────────────────────────────────────── */
  function factorCorrelacion(a, b) {
    const mA = normM(a.mercado), mB = normM(b.mercado);
    const tA = (a.tipo || '').toLowerCase();
    const tB = (b.tipo || '').toLowerCase();

    const { incompatible } = esIncompatible(a, b);
    if (incompatible) return 0;

    if (esRes(mA) && esAmbos(mB) && opcionSiNo(tB) === 'si') return 0.4;
    if (esAmbos(mA) && esRes(mB) && opcionSiNo(tA) === 'si') return 0.4;
    if (esRes(mA) && esAmbos(mB) && opcionSiNo(tB) === 'no') return 0.5;
    if (esAmbos(mA) && esRes(mB) && opcionSiNo(tA) === 'no') return 0.5;
    if (esRes(mA) && esGoles(mB)) return 0.5;
    if (esGoles(mA) && esRes(mB)) return 0.5;
    if (esDoble(mA) && esAmbos(mB)) return 0.5;
    if (esAmbos(mA) && esDoble(mB)) return 0.5;
    if (esDNB(mA) && esGoles(mB)) return 0.5;
    if (esGoles(mA) && esDNB(mB)) return 0.5;
    if (esDNB(mA) && esHTResult(mB)) return 0.7;
    if (esHTResult(mA) && esDNB(mB)) return 0.7;

    if (esGoles(mA) && esGoles(mB)) {
      const dA = a.dir || direccion(tA), dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA),  nB = b.line ?? valorNum(tB);
      if (nA !== null && nB !== null && nA === nB && dA !== null && dB !== null) return 0;
      if (dA === dB) return 0.7;
      if (nA !== null && nB !== null && nA !== nB) return 0.8;
      return 0.7;
    }

    if (esAsian(mA) && esAsian(mB)) {
      const dA = a.dir || direccion(tA), dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA),  nB = b.line ?? valorNum(tB);
      if (nA !== null && nB !== null && nA === nB && dA !== null && dB !== null) return 0;
      if (dA === dB) return 0.7;
      return 0.8;
    }

    if ((esGoles(mA) && esAsian(mB)) || (esGoles(mB) && esAsian(mA))) return 0.7;
    if (esAmbos(mA) && esAmbos(mB)) return 0.6;
    if (esAmbos(mA) && esGoles(mB) && opcionSiNo(tA) === 'si') return 0.4;
    if (esGoles(mA) && esAmbos(mB) && opcionSiNo(tB) === 'si') return 0.4;
    if (esAmbos(mA) && esGoles(mB) && opcionSiNo(tA) === 'no') return 0.5;
    if (esGoles(mA) && esAmbos(mB) && opcionSiNo(tB) === 'no') return 0.5;
    if (esHTResult(mA) && esRes(mB)) return 0.6;
    if (esHTResult(mB) && esRes(mA)) return 0.6;
    if (esHTResult(mA) && esTotalHT(mB)) return 0.5;
    if (esHTResult(mB) && esTotalHT(mA)) return 0.5;
    if (esImpar(mA) && esGoles(mB)) return 0.5;
    if (esImpar(mB) && esGoles(mA)) return 0.5;
    if (esHTImpar(mA) && esTotalHT(mB)) return 0.5;
    if (esHTImpar(mB) && esTotalHT(mA)) return 0.5;
    if (esImpar(mA) && esImpar(mB)) return 0;

    if (esTTHome(mA) && esTTHome(mB)) {
      const dA = a.dir || direccion(tA), dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA),  nB = b.line ?? valorNum(tB);
      if (nA !== null && nB !== null && nA === nB && dA !== dB) return 0;
      if (dA === dB) return 0.7;
      return 0.8;
    }
    if (esTTAway(mA) && esTTAway(mB)) {
      const dA = a.dir || direccion(tA), dB = b.dir || direccion(tB);
      const nA = a.line ?? valorNum(tA),  nB = b.line ?? valorNum(tB);
      if (nA !== null && nB !== null && nA === nB && dA !== dB) return 0;
      if (dA === dB) return 0.7;
      return 0.8;
    }

    if ((esTTHome(mA) || esTTAway(mA)) && esGoles(mB)) return 0.6;
    if (esGoles(mA) && (esTTHome(mB) || esTTAway(mB))) return 0.6;
    if (esHTTHome(mA) && esHTTHome(mB)) return 0.7;
    if (esHTTAway(mA) && esHTTAway(mB)) return 0.7;
    if ((esCSHome(mA) || esCSAway(mA)) && esRes(mB)) return 0.5;
    if ((esCSHome(mB) || esCSAway(mB)) && esRes(mA)) return 0.5;
    if (esWinNil(mA) && (esCSHome(mB) || esCSAway(mB))) return 0.5;
    if (esWinNil(mB) && (esCSHome(mA) || esCSAway(mA))) return 0.5;
    if ((esFirst(mA) || esNext(mA)) && esRes(mB)) return 0.5;
    if ((esFirst(mB) || esNext(mB)) && esRes(mA)) return 0.5;
    if (esFirst(mA) && esNext(mB)) return 0.6;
    if (esFirst(mB) && esNext(mA)) return 0.6;
    if (esCorn(mA) && esCorn(mB)) return 0.6;
    if (esCornHT(mA) && esCornHT(mB)) return 0.6;
    if ((esCorn(mA) && esCornHT(mB)) || (esCorn(mB) && esCornHT(mA))) return 0.6;
    if (esTarj(mA) && esTarj(mB)) return 0.6;
    if ((esEH(mA) || esAH(mA)) && esRes(mB)) return 0.5;
    if ((esEH(mB) || esAH(mB)) && esRes(mA)) return 0.5;
    if (esSegunda(mA) && esRes(mB)) return 0.7;
    if (esSegunda(mB) && esRes(mA)) return 0.7;

    return 1;
  }

  /* ─────────────────────────────────────────────────────────
     calcularCuotaCombinada
  ───────────────────────────────────────────────────────── */
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
            const ci = parseFloat(grupo[i].cuota) || 1;
            const cj = parseFloat(grupo[j].cuota) || 1;
            absorbidas.add(ci <= cj ? i : j);
          }

      const activas = grupo.filter((_, i) => !absorbidas.has(i));
      if (!activas.length) continue;
      if (activas.length === 1) { total *= parseFloat(activas[0].cuota) || 1; continue; }

      let cuotaPartido = parseFloat(activas[0].cuota) || 1;
      for (let i = 1; i < activas.length; i++) {
        const cuotaNueva = parseFloat(activas[i].cuota) || 1;
        let factorMin = 1;
        for (let j = 0; j < i; j++) {
          const f = factorCorrelacion(activas[j], activas[i]);
          if (f < factorMin) factorMin = f;
        }
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

  /* ─────────────────────────────────────────────────────────
     ALMACÉN
  ───────────────────────────────────────────────────────── */
  const STORAGE_KEY = 'carritoApuestas';
  let bets = [];
  function cargar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) bets = arr; }
    } catch {}
  }
  function guardar() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bets)); }

  /* ─────────────────────────────────────────────────────────
     addBet — v4.2: usa partidoNoApostable en lugar de partidoEnVivo
  ───────────────────────────────────────────────────────── */
  async function addBet({ partido, tipo, cuota, partidoId, mercado, line, dir }) {
    const pid   = (partidoId || '').toString().trim();
    const mNorm = normM(mercado);
    const cStr  = (cuota || '').toString().trim();
    const clave = claveExclusion(mNorm, tipo);

    // Bloqueo: partido ya comenzado o terminado
    if (pid) {
      const noApostable = await partidoNoApostable(pid);
      if (noApostable) {
        toast('⚠ Este partido ya ha comenzado o finalizado, no se aceptan apuestas', 'error');
        return;
      }
    }

    const betNuevo = { partido, tipo, cuota: cStr, partidoId: pid, mercado: mNorm };
    if (line != null) betNuevo.line = line;
    if (dir  != null) betNuevo.dir  = dir;

    // Validar restricción DNB
    const dnbCheck = validarDNBEnCarrito(betNuevo, bets);
    if (!dnbCheck.ok) { toast(`🚫 ${dnbCheck.motivo}`, 'error'); return; }

    // Validar incompatibilidades con selecciones del mismo partido
    const delMismoPartido = bets.filter(b =>
      (b.partidoId || '').toString().trim() === pid && pid !== ''
    );
    for (const existing of delMismoPartido) {
      if (claveExclusion(normM(existing.mercado), existing.tipo) === clave) continue;
      const { incompatible, motivo } = esIncompatible(existing, betNuevo);
      if (incompatible) { toast(`🚫 ${motivo}`, 'error'); return; }
    }

    const esSoloEnPartido = esCS(mNorm) || esHTFT(mNorm);
    if (esSoloEnPartido && delMismoPartido.length > 0) {
      bets = bets.filter(b => (b.partidoId || '').toString().trim() !== pid);
      toast('⚠ Este mercado reemplaza otras selecciones del mismo partido', 'info');
    }
    const tieneUnico = delMismoPartido.some(b => {
      const mb = normM(b.mercado); return esCS(mb) || esHTFT(mb);
    });
    if (tieneUnico && !esSoloEnPartido) {
      toast('🚫 No se puede combinar este mercado con Marcador exacto o HT/FT del mismo partido', 'error');
      return;
    }

    const idx = bets.findIndex(b =>
      (b.partidoId || '').toString().trim() === pid &&
      claveExclusion(normM(b.mercado), b.tipo) === clave
    );

    if (idx !== -1) {
      const ant = bets[idx];
      if (normM(ant.mercado) === mNorm &&
          (ant.tipo  || '').toLowerCase() === (tipo  || '').toLowerCase() &&
          (ant.cuota || '').toString()     === cStr) {
        bets.splice(idx, 1);
        guardar(); notificar(); toast('Selección eliminada', 'info');
        return;
      }
      bets[idx] = betNuevo;
      guardar(); notificar(); toast('Selección reemplazada ✓', 'ok');
      return;
    }

    bets.push(betNuevo);
    guardar(); notificar(); toast('Apuesta añadida ✓', 'ok');
  }

  function vaciar() { bets = []; guardar(); notificar(); }

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
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
        return `<li class="bs-item">
          <div class="bs-top">
            <span class="bs-tipo">${formatTipo(tipo, mercado)}</span>
            <span class="bs-cuota">${parseFloat(cuota).toFixed(2)}</span>
            <button class="bs-remove" data-idx="${_idx}" title="Eliminar">✕</button>
          </div>
          <div class="bs-info">${partido}</div>
        </li>`;
      }

      const avisos = [];
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const f = factorCorrelacion(grupo[i], grupo[j]);
          if (f === 0)       avisos.push('⚠ Selecciones incompatibles detectadas');
          else if (f <= 0.4) avisos.push('↘ Correlación fuerte: cuota reducida significativamente');
          else if (f <= 0.6) avisos.push('↘ Correlación moderada: cuota reducida');
        }
      }
      const avisosHTML = [...new Set(avisos)].map(a =>
        `<div class="bs-corr-aviso">${a}</div>`
      ).join('');

      const cuotaGrupo = calcularCuotaCombinada(grupo);
      const subItems   = grupo.map(({ tipo, cuota, mercado, _idx }) => {
        const factor = infoCorrelacion(bets, _idx);
        const badge  = factor === 0  ? `<span class="bs-corr-badge bs-corr-incompatible">⚠ Absorbida</span>`
                     : factor <= 0.4 ? `<span class="bs-corr-badge bs-corr-reducida">↘ Muy correlada</span>`
                     : factor <= 0.6 ? `<span class="bs-corr-badge bs-corr-reducida">↘ Correlada</span>`
                     : '';
        return `<li class="bs-item bs-item-sub">
          <div class="bs-top">
            <span class="bs-tipo">${formatTipo(tipo, mercado)}</span>
            <span class="bs-cuota bs-cuota-sub">${parseFloat(cuota).toFixed(2)}</span>
            <button class="bs-remove" data-idx="${_idx}" title="Eliminar">✕</button>
          </div>
          ${badge}
        </li>`;
      }).join('');

      return `<li class="bs-item bs-item-grupo-header">
        <div class="bs-top">
          <span class="bs-tipo bs-grupo-nombre">⚽ ${grupo[0].partido}</span>
          <span class="bs-cuota bs-grupo-cuota">${cuotaGrupo.toFixed(2)}</span>
        </div>
        <div class="bs-info">${grupo.length} selecciones · cuota combinada ajustada</div>
        ${avisosHTML}
      </li>${subItems}`;
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
      html += `<label class="sistema-opcion" for="sis-${k}">
        <div class="sis-radio-wrap">
          <input type="radio" name="sistema-tipo" id="sis-${k}" value="${k}" class="sis-radio" ${k === 2 ? 'checked' : ''}>
          <div class="sis-info">
            <span class="sis-titulo">${k}/${n} — ${combos} combinaciones</span>
            <span class="sis-detalle">Cuota media <strong>${cuotaMedia.toFixed(2)}</strong></span>
          </div>
        </div>
        <span class="sis-retorno">×${retornoTotal.toFixed(1)}</span>
      </label>`;
    }
    html += `</div>`;
    const stakeVal = parseFloat(document.querySelector('.stake-input input')?.value || 5) || 5;
    const kSel     = parseInt(wrap.querySelector('input[name="sistema-tipo"]:checked')?.value || 2);
    const { combos: ca } = calcularSistema(selecciones, kSel);
    html += `<div class="sistema-footer">
      <div class="sis-detalle-apuesta"><span class="sis-label">Importe por combinación</span><span class="sis-valor">${stakeVal.toFixed(2)} €</span></div>
      <div class="sis-detalle-apuesta"><span class="sis-label">Total apostado</span><span class="sis-valor">${(stakeVal * ca).toFixed(2)} €</span></div>
    </div>`;
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

  /* ─────────────────────────────────────────────────────────
     actualizarBotones
  ───────────────────────────────────────────────────────── */
  function actualizarBotones() {
    const pidActual = window._partidoId || '';

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
        b.partidoId === pidActual &&
        b.tipo      === btn.dataset.tipo &&
        normM(b.mercado) === normM(btn.dataset.mercado)
      );
      btn.classList.toggle('activa', activa);

      if (activa) { btn.classList.remove('incompatible-bloqueada'); return; }

      const betPrueba = {
        partidoId: pidActual,
        tipo:      btn.dataset.tipo || '',
        mercado:   btn.dataset.mercado || '',
        line:      btn.dataset.line ? parseFloat(btn.dataset.line) : null,
        dir:       btn.dataset.dir  || null,
      };

      const dnbCheck = validarDNBEnCarrito(betPrueba, bets);
      if (!dnbCheck.ok) { btn.classList.add('incompatible-bloqueada'); return; }

      const clavePrueba = claveExclusion(normM(betPrueba.mercado), betPrueba.tipo);
      const delMismoPartido = bets.filter(b =>
        (b.partidoId || '').toString().trim() === pidActual &&
        claveExclusion(normM(b.mercado), b.tipo) !== clavePrueba
      );

      let bloqueado = false;
      for (const existing of delMismoPartido) {
        const { incompatible } = esIncompatible(existing, betPrueba);
        if (incompatible) { bloqueado = true; break; }
      }
      btn.classList.toggle('incompatible-bloqueada', bloqueado);
    });
  }

  function cerrarModalesMobil() {
    document.getElementById('slip-overlay')?.classList.remove('active');
    document.getElementById('slip-modal')?.classList.remove('open');
    document.getElementById('index-slip-overlay')?.classList.remove('active');
    document.getElementById('index-slip-modal')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ─────────────────────────────────────────────────────────
     realizarApuesta — v4.2: bloquea partidos comenzados/terminados
  ───────────────────────────────────────────────────────── */
  async function realizarApuesta() {
    const auth = window.auth, db = window.db;
    if (!auth || !db) { toast('Error: Firebase no disponible', 'error'); return; }
    const user = auth.currentUser;
    if (!user)        { toast('Debes iniciar sesión para apostar', 'error'); return; }
    if (!bets.length) { toast('No hay apuestas en el carrito', 'error');    return; }

    // Validación final de incompatibilidades
    const porPartido = {};
    bets.forEach(b => {
      const pid = (b.partidoId || '').toString().trim();
      if (!porPartido[pid]) porPartido[pid] = [];
      porPartido[pid].push(b);
    });
    for (const grupo of Object.values(porPartido)) {
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const { incompatible, motivo } = esIncompatible(grupo[i], grupo[j]);
          if (incompatible) { toast(`🚫 Apuesta inválida: ${motivo}`, 'error'); return; }
        }
      }
    }
    for (let i = 0; i < bets.length; i++) {
      const check = validarDNBEnCarrito(bets[i], bets.filter((_, j) => j !== i));
      if (!check.ok) { toast(`🚫 ${check.motivo}`, 'error'); return; }
    }

    // v4.2: Bloquear partidos que ya han comenzado O terminado
    const pidsBloqueados = [];
    const idsUnicos = [...new Set(bets.map(b => (b.partidoId || '').toString().trim()).filter(Boolean))];
    for (const pid of idsUnicos) {
      if (await partidoNoApostable(pid)) {
        const nombre = bets.find(b => b.partidoId === pid)?.partido || pid;
        pidsBloqueados.push(nombre);
      }
    }
    if (pidsBloqueados.length) {
      bets = bets.filter(b => !pidsBloqueados.some(nombre => b.partido === nombre));
      guardar(); render();
      toast(
        pidsBloqueados.length === 1
          ? `⚠ "${pidsBloqueados[0]}" ya ha comenzado o finalizado y se ha eliminado del carrito`
          : `⚠ ${pidsBloqueados.length} partidos ya han comenzado o finalizado y se han eliminado del carrito`,
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
      const porPartidoSis = {};
      bets.forEach(b => {
        const pid = b.partidoId;
        if (!porPartidoSis[pid]) porPartidoSis[pid] = b;
      });
      const sels = Object.values(porPartidoSis);
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

  /* ─────────────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────
     API PÚBLICA
  ───────────────────────────────────────────────────────── */
  window.BetSlip      = { addBet, vaciar, render, getBets: () => bets, onChange: fn => _subs.push(fn) };
  window.addBetToSlip = addBet;

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

  window._betslipEsIncompatible  = esIncompatible;
  window._betslipValidarDNB      = validarDNBEnCarrito;
  window._betslipNoApostable     = partidoNoApostable;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* ─────────────────────────────────────────────────────────
     formatTipo
  ───────────────────────────────────────────────────────── */
  function formatTipo(tipo, mercado) {
    const m = normM(mercado);

    if (m === 'resultado')        return tipo.toLowerCase() === 'empate' ? 'Empate' : `Gana ${tipo}`;
    if (m === 'dobleoportunidad') return tipo;
    if (m === 'goleadores')       return `Gol de ${tipo}`;
    if (m === 'dnb')              return tipo.replace(/^DNB:\s*/i, 'Sin empate: ');

    if (m === 'totalgoles') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `${dir} ${tipo.slice(1)} goles`;
      }
      return tipo;
    }
    if (m === 'totalsht') {
      if (/^[+-]\d/.test(tipo)) {
        const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
        return `${dir} ${tipo.slice(1)} (1ª)`;
      }
      return tipo.replace(/\s*\(1ª parte\)/i, '') + ' · 1ª parte';
    }
    if (m === 'teamtotalhome') {
      if (/^[+-]\d/.test(tipo)) { const d = tipo.startsWith('+') ? 'Más de' : 'Menos de'; return `🏠 ${d} ${tipo.slice(1)}`; }
      return `🏠 ${tipo}`;
    }
    if (m === 'teamtotalaway') {
      if (/^[+-]\d/.test(tipo)) { const d = tipo.startsWith('+') ? 'Más de' : 'Menos de'; return `✈️ ${d} ${tipo.slice(1)}`; }
      return `✈️ ${tipo}`;
    }
    if (m === 'httotalhome') {
      if (/^[+-]\d/.test(tipo)) { const d = tipo.startsWith('+') ? 'Más de' : 'Menos de'; return `🏠 ${d} ${tipo.slice(1)} (1ª)`; }
      return `🏠 ${tipo}`;
    }
    if (m === 'httotalaway') {
      if (/^[+-]\d/.test(tipo)) { const d = tipo.startsWith('+') ? 'Más de' : 'Menos de'; return `✈️ ${d} ${tipo.slice(1)} (1ª)`; }
      return `✈️ ${tipo}`;
    }
    if (m === 'descanso' || m === 'htresult') return `1ª mitad: ${tipo.replace(/^ht1?:\s*/i, '')}`;
    if (m === 'segunda')  return `2ª mitad: ${tipo.replace(/^ht2?:\s*/i, '')}`;
    if (m === 'ambosmarcan' || m === 'btts') {
      const v = tipo.toLowerCase();
      if (v === 'sí' || v === 'si' || v === 'yes') return 'Ambos marcan: Sí';
      if (v === 'no')                               return 'Ambos marcan: No';
      return `Ambos marcan: ${tipo}`;
    }
    if (m === 'imparpar')        return `Goles ${tipo}`;
    if (m === 'htimparpar')      return `Goles ${tipo} (1ª mitad)`;
    if (m === 'asiantotals')     return tipo.replace(/\s*\(asian\)/i, '') + ' (Asian)';
    if (m === 'cornerstotal' || m === 'corners') return `📐 ${tipo}`;
    if (m === 'cornersht')       return `📐 ${tipo}`;
    if (m === 'bookingstotal' || m === 'tarjetas') return `🟨 ${tipo}`;
    if (m === 'ehresult')        return tipo.replace(/^EH:\s*/i, 'Hándicap: ');
    if (m === 'asianhandicap')   return tipo.replace(/^AH:\s*/i, 'H. Asiático: ');
    if (m === 'htft') {
      const HTFT_LABELS = {
        htft_1_1:'1ª: Local / FT: Local',     htft_1_x:'1ª: Local / FT: Empate',
        htft_1_2:'1ª: Local / FT: Visitante', htft_x_1:'1ª: Empate / FT: Local',
        htft_x_x:'1ª: Empate / FT: Empate',   htft_x_2:'1ª: Empate / FT: Visitante',
        htft_2_1:'1ª: Visitante / FT: Local', htft_2_x:'1ª: Visitante / FT: Empate',
        htft_2_2:'1ª: Visitante / FT: Visitante',
      };
      return HTFT_LABELS[tipo] || tipo;
    }
    if (m === 'correctscore') {
      if (tipo === 'csOther') return 'Marcador exacto: Otro';
      const raw = tipo.replace('cs', '');
      return `Marcador: ${raw.slice(0, -1)}-${raw.slice(-1)}`;
    }
    if (m === 'cleansheethome') return `🧤 Portería a cero local: ${tipo.endsWith('Yes') ? 'Sí' : 'No'}`;
    if (m === 'cleansheetaway') return `🧤 Portería a cero visitante: ${tipo.endsWith('Yes') ? 'Sí' : 'No'}`;
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
    if (/^[+-]\d/.test(tipo)) {
      const dir = tipo.startsWith('+') ? 'Más de' : 'Menos de';
      return `${dir} ${tipo.slice(1)}`;
    }
    return tipo;
  }

})();