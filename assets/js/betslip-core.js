/* =============================================================
   betslip-core.js  —  v4.4
   Módulo compartido de carrito entre index.html y partido.html

   CAMBIOS v4.4:
   · factorCorrelacion() completamente reescrito con lógica
     probabilística real de casas de apuestas profesionales.

     PRINCIPIO: dos selecciones son "redundantes" (factor 0 o muy
     bajo) cuando una implica o está CONTENIDA en la otra.
     Son "independientes" (factor 1) solo cuando pertenecen a
     segmentos del partido realmente distintos o a equipos
     distintos sin relación directa.

     Casos clave corregidos:
     ─────────────────────────────────────────────────────────
     [A] BTTS Sí + Over 0.5 / Over 1.5 → factor 0 (BTTS Sí ya
         implica ≥2 goles, Over 0.5/1.5 están contenidos)
     [B] BTTS Sí + Over 2.5+ → factor 0.55 (correlados pero no
         contenidos: BTTS no garantiza >2 goles)
     [C] BTTS No + Over cualquier línea → factor 0.35
         (si nadie marca, difícil que haya muchos goles)
     [D] BTTS Sí + Under 1.5 → factor 0 (incompatible, bloqueado
         antes de llegar aquí, pero por si acaso → 0)
     [E] BTTS Sí + Under 2.5 → factor 0 (BTTS garantiza ≥2,
         Under 2.5 exige <2.5, solo se cumple con exactamente 2
         → cuotas ya reflejan esto, no multiplicar)
     [F] BTTS Sí + Under 3.5+ → factor 0.55
     [G] 1X2 + Over alta (>2.5) → factor 0.65 (partido abierto
         favorece a uno pero no implica resultado concreto)
     [H] 1X2 local gana + BTTS Sí → factor 0.45 (gana local Y
         marca visitante, eventos parcialmente dependientes)
     [I] 1X2 empate + Over → factor 0.5 (empate con goles es
         correlado; empate 0-0 es under, empate 1-1, 2-2 es over)
     [J] 1X2 empate + BTTS Sí → factor 0 (empate implica ≥1 gol
         de cada, BTTS Sí está contenido en empate con goles,
         EXCEPTO empate 0-0)
     [K] DNB + Over 0.5/1.5 → factor 0.35 (DNB anula empate,
         un gol diferencia favorece un equipo, correlados)
     [L] Resultado 2ª mitad vs resultado 1ª mitad → factor 0.6
     [M] Over/Under mismo mercado misma línea ya bloqueado
     [N] Over N + Over M (mismo partido, mismo mercado, N>M) →
         el reemplazo inteligente ya los maneja; si coexisten
         factor 0.85 (Over 2.5 + Over 1.5 → Over 2.5 implica
         Over 1.5, redundante)
     [O] Under N + Under M (mismo partido, N<M) → mismo caso
     [P] Goles encuentro vs goles 1ª mitad → factor 0.5
         (segmentos distintos pero correlados: muchos goles en
         primera aumenta probabilidad de muchos en el encuentro)
     [Q] TeamTotal local + TeamTotal visitante → factor 0.7
     [R] Marcador exacto ya es incompatible con todo (manejado)
     [S] HT/FT ya es incompatible con todo (manejado)
     [T] CleanSheet local + 1X2 local gana → factor 0.45
     [U] WinNil + CleanSheet mismo equipo → factor 0
         (WinNil implica CleanSheet)
     [V] Corners misma dirección misma línea → factor 0
         (mismo mercado mismo partido, ya manejado por clave)
     [W] 1X2 empate + DNB → incompatible (ya manejado)
     [X] BTTS Sí + CorrectScore con al menos 1 gol de cada →
         correlados

   CAMBIOS v4.3: resolverConflictoGoles()
   CAMBIOS v4.2: partidoNoApostable() ampliado
   CAMBIOS v4.1: validarDNBEnCarrito() fix
   CAMBIOS v4.0: reglas reales casas de apuestas base

   Mantiene compatibilidad con mercados.js v4.1 y worker.js v6.6
   ============================================================= */

(function () {
  'use strict';

  const ESTADOS_NO_APOSTABLE = ['1H', 'HT', '2H', 'ET', 'P', 'FT', 'AET', 'PEN', 'SUSP', 'INT', 'ABD', 'AWD', 'WO'];
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
  ───────────────────────────────────────────────────────── */
  async function partidoNoApostable(partidoId) {
    if (!partidoId) return false;
    const db = window.db;
    if (!db) return false;
    try {
      let snap = await db.collection('partidos').doc(partidoId).get();
      if (snap.exists) {
        const estado = snap.data()?.estado;
        if (estado) return !ESTADOS_APOSTABLE.includes(estado);
        return false;
      }
      snap = await db.collection('historial').doc(partidoId).get();
      if (snap.exists) return true;
      return false;
    } catch { return true; }
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

  const esMercadoTotales = m =>
    esGoles(m) || esTotalHT(m) || esTTHome(m) || esTTAway(m) || esHTTHome(m) || esHTTAway(m);

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
     v4.3 · resolverConflictoGoles
  ───────────────────────────────────────────────────────── */
  function resolverConflictoGoles(betNuevo, betsActuales) {
    const mNuevo = normM(betNuevo.mercado);
    if (!esMercadoTotales(mNuevo)) return { accion: 'ninguna' };

    const dirNueva   = betNuevo.dir  || direccion(betNuevo.tipo);
    const lineaNueva = betNuevo.line ?? valorNum(betNuevo.tipo);

    if (dirNueva === null || lineaNueva === null) return { accion: 'ninguna' };

    const pidNuevo = (betNuevo.partidoId || '').toString().trim();

    for (let i = 0; i < betsActuales.length; i++) {
      const b = betsActuales[i];
      if ((b.partidoId || '').toString().trim() !== pidNuevo) continue;
      if (normM(b.mercado) !== mNuevo) continue;

      const dirExistente   = b.dir  || direccion(b.tipo);
      const lineaExistente = b.line ?? valorNum(b.tipo);

      if (dirExistente === null || lineaExistente === null) continue;
      if (dirNueva !== dirExistente) continue;

      if (dirNueva === 'over') {
        if (lineaNueva > lineaExistente) return { accion: 'reemplazar', idx: i };
        else if (lineaNueva < lineaExistente) return { accion: 'descartar' };
        else return { accion: 'ninguna' };
      }

      if (dirNueva === 'under') {
        if (lineaNueva < lineaExistente) return { accion: 'reemplazar', idx: i };
        else if (lineaNueva > lineaExistente) return { accion: 'descartar' };
        else return { accion: 'ninguna' };
      }
    }

    return { accion: 'ninguna' };
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
      if (nA !== null && nB !== null && dA !== null && dB !== null && dA !== dB) {
        const overLine  = dA === 'over'  ? nA : nB;
        const underLine = dA === 'under' ? nA : nB;
        if (overLine >= underLine)
          return { incompatible: true, motivo: `Over ${overLine} y Under ${underLine} son incompatibles: el over debe ser menor que el under` };
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

  /* =================================================================
     factorCorrelacion  —  v4.4
     REESCRITURA COMPLETA con lógica probabilística profesional.

     Retorna un factor entre 0 y 1:
       0   → cuotas no se multiplican (selecciones redundantes/contenidas)
       0.x → correlación parcial (cuota combinada penalizada)
       1   → independientes (se multiplican normalmente)

     REGLA DE ORO: si la selección A implica probabilísticamente
     que B va a ocurrir (o ya está contenida en A), el factor
     debe ser 0 o muy bajo — NO tiene sentido pagar cuota extra.
  ================================================================= */
  function factorCorrelacion(a, b) {
    const mA = normM(a.mercado), mB = normM(b.mercado);
    const tA = (a.tipo || '').toLowerCase();
    const tB = (b.tipo || '').toLowerCase();

    // Si son incompatibles, factor 0 (la cuota menor absorbe)
    const { incompatible } = esIncompatible(a, b);
    if (incompatible) return 0;

    // Helpers locales
    const dA  = a.dir  || direccion(tA);
    const dB  = b.dir  || direccion(tB);
    const nA  = a.line ?? valorNum(tA);
    const nB  = b.line ?? valorNum(tB);
    const opA = opcionSiNo(tA);
    const opB = opcionSiNo(tB);

    // ── Abreviaturas de clasificación ──────────────────────────────
    const bttsA = esAmbos(mA), bttsB = esAmbos(mB);
    const resA  = esRes(mA),   resB  = esRes(mB);
    const golA  = esGoles(mA), golB  = esGoles(mB);
    const htA   = esHTResult(mA), htB = esHTResult(mB);
    const h2A   = esSegunda(mA),  h2B = esSegunda(mB);
    const dnbA  = esDNB(mA),   dnbB  = esDNB(mB);
    const dcA   = esDoble(mA), dcB   = esDoble(mB);
    const ttHA  = esTTHome(mA), ttHB = esTTHome(mB);
    const ttAA  = esTTAway(mA), ttAB = esTTAway(mB);
    const htGolA = esTotalHT(mA), htGolB = esTotalHT(mB);
    const csHA  = esCSHome(mA), csHB = esCSHome(mB);
    const csAA  = esCSAway(mA), csAB = esCSAway(mB);
    const wnA   = esWinNil(mA), wnB  = esWinNil(mB);
    const firstA = esFirst(mA), firstB = esFirst(mB);
    const nextA  = esNext(mA),  nextB  = esNext(mB);
    const cornA  = esCorn(mA),  cornB  = esCorn(mB);
    const cornHTA = esCornHT(mA), cornHTB = esCornHT(mB);
    const tarjA  = esTarj(mA), tarjB   = esTarj(mB);
    const ehA    = esEH(mA),   ehB    = esEH(mB);
    const ahA    = esAH(mA),   ahB    = esAH(mB);
    const asianA = esAsian(mA), asianB = esAsian(mB);
    const imparA = esImpar(mA), imparB = esImpar(mB);
    const htImA  = esHTImpar(mA), htImB = esHTImpar(mB);

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 1: BTTS (Ambos marcan) con Total Goles
       Casos más importantes y que estaban mal en v4.3
    ────────────────────────────────────────────────────────────── */
    if (bttsA || bttsB) {
      const esBttsA = bttsA, esBttsB = bttsB;
      const esGolX  = golA || golB;

      if (esBttsA && esGolX) {
        // Obtenemos el lado BTTS y el lado Goles
        const bttsSi = esBttsA ? opA === 'si' : opB === 'si';
        const bttsNo = esBttsA ? opA === 'no' : opB === 'no';
        const gDir   = esBttsA ? dB : dA;
        const gLine  = esBttsA ? nB : nA;

        if (bttsSi) {
          // BTTS Sí garantiza MÍNIMO 2 goles (1 de cada equipo)
          if (gDir === 'over' && gLine !== null) {
            if (gLine <= 1.5) return 0;     // Over 0.5/1.5 están contenidos en BTTS Sí
            if (gLine <= 2.5) return 0.20;  // Over 2.5 muy correlado: BTTS garantiza 2, se necesita 1 más
            if (gLine <= 3.5) return 0.55;  // Over 3.5: correlado moderado
            return 0.70;                    // Over 4.5+: correlación menor
          }
          if (gDir === 'under' && gLine !== null) {
            if (gLine <= 2.5) return 0;     // Under 2.5 con BTTS Sí: solo pasa con exactamente 2 goles → absurdo combinar
            if (gLine <= 3.5) return 0.30;  // Under 3.5: BTTS garantiza 2, se necesita que no haya 3º
            return 0.55;                    // Under 4.5+: correlación moderada
          }
        }

        if (bttsNo) {
          // BTTS No significa máximo 1 equipo marca → partido de pocos goles
          if (gDir === 'over' && gLine !== null) {
            if (gLine <= 1.5) return 0.25;  // Over 0.5/1.5 posible aunque BTTS No (un equipo marca 2+)
            return 0.40;                    // Over 2.5+: bastante correlado negativamente
          }
          if (gDir === 'under' && gLine !== null) {
            if (gLine <= 1.5) return 0.20;  // Under 1.5 + BTTS No: ambos apuestan a partido sin goles o solo 1
            if (gLine <= 2.5) return 0.30;  // Under 2.5 + BTTS No: correlados (pocos goles)
            return 0.55;
          }
        }
      }

      // BTTS + BTTS del mismo segmento (ya bloqueado, pero por si acaso)
      if (esBttsA && esBttsB) {
        if (opA !== null && opB !== null && opA === opB) return 0;
        return 0;
      }
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 2: BTTS con 1X2 Resultado
    ────────────────────────────────────────────────────────────── */
    if ((bttsA && resB) || (bttsB && resA)) {
      const bttsSi = bttsA ? opA === 'si' : opB === 'si';
      const bttsNo = bttsA ? opA === 'no' : opB === 'no';
      const tipoRes = (resA ? tA : tB);
      const esEmpate = tipoRes.includes('empate');
      const esLocal  = !esEmpate && (resA ? !tA.includes('visitante') : !tB.includes('visitante'));

      if (bttsSi) {
        if (esEmpate) return 0;   // Empate + BTTS Sí → para que haya empate CON goles, ambos deben marcar → redundante
        return 0.40;              // Local/Visitante + BTTS Sí: correlados pero no idénticos
      }
      if (bttsNo) {
        if (esEmpate) return 0.15; // Empate + BTTS No: solo pasa con 0-0 → casi el mismo evento
        return 0.50;              // Local/visitante + BTTS No: partido con pocos goles
      }
      return 0.45;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 3: Total goles encuentro con 1X2 Resultado
    ────────────────────────────────────────────────────────────── */
    if ((golA && resB) || (golB && resA)) {
      const gDir  = golA ? dA : dB;
      const gLine = golA ? nA : nB;
      const tipoRes = resA ? tA : tB;
      const esEmpate = tipoRes.includes('empate');

      if (gDir === 'over' && gLine !== null) {
        if (esEmpate) {
          // Empate + Over: empate con goles (1-1, 2-2) → correlados
          if (gLine <= 1.5) return 0.35;
          if (gLine <= 2.5) return 0.45;
          return 0.60;
        }
        // Local/visitante + Over: partido abierto puede favorecer a cualquiera
        if (gLine <= 1.5) return 0.60;
        if (gLine <= 2.5) return 0.55;
        return 0.65;
      }
      if (gDir === 'under' && gLine !== null) {
        if (esEmpate) {
          // Empate + Under: correlados fuertes (0-0 es under y empate)
          if (gLine <= 1.5) return 0.25; // Empate + Under 1.5 → casi solo 0-0
          if (gLine <= 2.5) return 0.35;
          return 0.55;
        }
        // Victoria + Under pocos goles: un equipo gana por 1-0, etc
        if (gLine <= 1.5) return 0.35;
        if (gLine <= 2.5) return 0.50;
        return 0.60;
      }
      return 0.55;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 4: Total goles entre sí (mismo mercado, mismo partido)
    ────────────────────────────────────────────────────────────── */
    if (golA && golB) {
      if (dA === null || dB === null || nA === null || nB === null) return 0.65;

      // Misma línea mismo sentido → ya manejado por clave (toggle)
      if (nA === nB && dA === dB) return 0;

      // Over A + Over B mismo mercado (diferentes líneas)
      if (dA === 'over' && dB === 'over') {
        const lineaAlta = Math.max(nA, nB);
        const lineBaja  = Math.min(nA, nB);
        // Over alta implica Over baja: Over 2.5 implica Over 1.5 → casi redundante
        if (lineaAlta - lineBaja <= 1) return 0.10;
        if (lineaAlta - lineBaja <= 2) return 0.35;
        return 0.55;
      }

      // Under A + Under B mismo mercado (diferentes líneas)
      if (dA === 'under' && dB === 'under') {
        const lineBaja = Math.min(nA, nB);
        const lineaAlta = Math.max(nA, nB);
        // Under baja implica Under alta: Under 1.5 implica Under 2.5 → casi redundante
        if (lineaAlta - lineBaja <= 1) return 0.10;
        if (lineaAlta - lineBaja <= 2) return 0.35;
        return 0.55;
      }

      // Over + Under diferentes líneas (no incompatibles, ya validado)
      // Ej: Over 1.5 + Under 3.5 → hay margen (2-3 goles cumplen ambos)
      const overLine  = dA === 'over'  ? nA : nB;
      const underLine = dA === 'under' ? nA : nB;
      const margen = underLine - overLine;
      if (margen <= 1) return 0.25;
      if (margen <= 2) return 0.50;
      return 0.70;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 5: Asian Totals (similar a totalgoles)
    ────────────────────────────────────────────────────────────── */
    if (asianA && asianB) {
      if (dA === null || dB === null || nA === null || nB === null) return 0.65;
      if (nA === nB && dA === dB) return 0;
      if (dA === dB) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.10;
        return 0.40;
      }
      const overLine  = dA === 'over'  ? nA : nB;
      const underLine = dA === 'under' ? nA : nB;
      const margen = underLine - overLine;
      if (margen <= 1) return 0.25;
      return 0.60;
    }

    if ((golA && asianB) || (golB && asianA)) return 0.65;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 6: Goles encuentro vs goles 1ª mitad
       Son segmentos distintos pero correlados
    ────────────────────────────────────────────────────────────── */
    if ((golA && htGolB) || (golB && htGolA)) {
      // Muchos goles en 1ª mitad correlaciona con muchos en el total
      const gDirEnc = golA ? dA : dB;
      const gDirHT  = golA ? dB : dA;
      const gLineEnc = golA ? nA : nB;
      const gLineHT  = golA ? nB : nA;

      if (gDirEnc !== null && gDirHT !== null && gDirEnc === gDirHT) return 0.45;
      return 0.55; // Sentidos opuestos en distintos segmentos: moderado
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 7: Total goles vs TeamTotal (local o visitante)
    ────────────────────────────────────────────────────────────── */
    if ((golA && (ttHB || ttAB)) || (golB && (ttHA || ttAA))) {
      const gDirEnc  = golA ? dA : dB;
      const gDirTeam = golA ? dB : dA;
      const gLineEnc  = golA ? nA : nB;
      const gLineTeam = golA ? nB : nA;

      if (gDirEnc !== null && gDirTeam !== null) {
        if (gDirEnc === gDirTeam) {
          // Over total + Over equipo: si un equipo marca mucho, el total sube
          if (gDirEnc === 'over' && gLineTeam !== null && gLineEnc !== null) {
            // Over total 2.5 + Over local 1.5: el local metiendo 2 ya casi cumple el total
            if (gLineTeam >= gLineEnc * 0.7) return 0.30;
            return 0.50;
          }
          return 0.45;
        }
        return 0.60; // Sentidos opuestos
      }
      return 0.55;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 8: TeamTotal local vs TeamTotal visitante
    ────────────────────────────────────────────────────────────── */
    if ((ttHA && ttAB) || (ttAA && ttHB)) {
      // Son equipos distintos: bastante independientes, correlación solo por "partido abierto"
      if (dA !== null && dB !== null) {
        if (dA === dB) return 0.70; // Ambos Over o ambos Under: partido abierto/cerrado
        return 0.80;                // Sentidos opuestos: bastante independientes
      }
      return 0.70;
    }

    // TeamTotal local + TeamTotal local (diferentes líneas)
    if (ttHA && ttHB) {
      if (dA === null || dB === null || nA === null || nB === null) return 0.65;
      if (nA === nB && dA !== dB) return 0;
      if (dA === dB) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.10;
        return 0.40;
      }
      return 0.70;
    }

    // TeamTotal visitante + TeamTotal visitante (diferentes líneas)
    if (ttAA && ttAB) {
      if (dA === null || dB === null || nA === null || nB === null) return 0.65;
      if (nA === nB && dA !== dB) return 0;
      if (dA === dB) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.10;
        return 0.40;
      }
      return 0.70;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 9: HT Total Goles entre sí
    ────────────────────────────────────────────────────────────── */
    if (esHTTHome(mA) && esHTTHome(mB)) return 0.65;
    if (esHTTAway(mA) && esHTTAway(mB)) return 0.65;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 10: 1X2 resultado con otros mercados
    ────────────────────────────────────────────────────────────── */
    // 1X2 + Doble oportunidad: incompatibles (ya manejado arriba)

    // 1X2 + resultado HT
    if ((resA && htB) || (htA && resB)) {
      // El resultado final y el de la primera mitad están correlados
      // Un equipo que gana la primera tiene más probabilidades de ganar el partido
      return 0.55;
    }

    // 1X2 + resultado 2ª mitad
    if ((resA && h2B) || (h2A && resB)) return 0.60;

    // 1X2 + DNB: incompatible (ya bloqueado)

    // 1X2 + Win to Nil: incompatible (ya bloqueado)

    // 1X2 + CleanSheet
    if ((resA && (csHB || csAB)) || ((csHA || csAA) && resB)) {
      // Local gana + portería a cero local: victoria sin encajar (correlados)
      // Visitante gana + portería a cero visitante: ídem
      return 0.45;
    }

    // 1X2 + FirstScore / NextGoal
    if ((resA && (firstB || nextB)) || ((firstA || nextA) && resB)) return 0.50;

    // 1X2 + Handicap europeo
    if ((resA && ehB) || (ehA && resB)) return 0.50;
    if ((resA && ahB) || (ahA && resB)) return 0.50;

    // 1X2 local/visitante + Asian Handicap mismo equipo: correlados
    if ((resA && asianB) || (asianA && resB)) return 0.55;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 11: DNB con mercados de goles
    ────────────────────────────────────────────────────────────── */
    if ((dnbA && golB) || (golA && dnbB)) {
      const gDir  = golA ? dA : dB;
      const gLine = golA ? nA : nB;
      // DNB + Over: si hay goles suficientes para distinguir ganador, correlados
      if (gDir === 'over' && gLine !== null) {
        if (gLine <= 0.5) return 0.40;
        if (gLine <= 1.5) return 0.45;
        return 0.55;
      }
      // DNB + Under: pocos goles → partido sin goles → DNB devuelve si empate (0-0) → correlados
      if (gDir === 'under' && gLine !== null) {
        if (gLine <= 1.5) return 0.25;
        return 0.45;
      }
      return 0.50;
    }

    if ((dnbA && htB) || (htA && dnbB)) return 0.65;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 12: Resultado HT con Total Goles HT
    ────────────────────────────────────────────────────────────── */
    if ((htA && htGolB) || (htGolA && htB)) return 0.45;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 13: Impar/Par con Goles
       El resultado impar/par está muy correlado con los totales
    ────────────────────────────────────────────────────────────── */
    if ((imparA && golB) || (golA && imparB)) {
      const tipoImpar = imparA ? tA : tB;
      const gDir  = golA ? dA : dB;
      const gLine = golA ? nA : nB;

      if (tipoImpar.includes('impar')) {
        // Impar goles + Over: goles impares (1,3,5...) → correlado con over si la línea es par
        if (gDir === 'over' && gLine !== null) {
          if (gLine <= 1.5) return 0.35; // Over 1.5 + Impar: solo 1 gol o 3+ → cierta correlación
          return 0.50;
        }
        return 0.50;
      }
      // Par goles
      if (gDir === 'under' && gLine !== null) {
        if (gLine <= 2.5) return 0.35; // Par + Under 2.5: solo 0 o 2 goles → correlados
        return 0.50;
      }
      return 0.50;
    }

    if ((htImA && htGolB) || (htGolA && htImB)) return 0.45;
    if (imparA && imparB) return 0; // Impar + Par del mismo segmento → incompatible (ya manejado)
    if (htImA && htImB)   return 0;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 14: CleanSheet y WinNil
    ────────────────────────────────────────────────────────────── */
    // WinNil implica CleanSheet del mismo equipo → factor 0
    if (wnA && csHB && tA.includes('home')) return 0;
    if (wnA && csAB && tA.includes('away')) return 0;
    if (wnB && csHA && tB.includes('home')) return 0;
    if (wnB && csAA && tB.includes('away')) return 0;

    // WinNil + CleanSheet equipo contrario: independientes
    if ((wnA && (csHB || csAB)) || ((csHA || csAA) && wnB)) return 0.60;

    // CleanSheet home + CleanSheet away: imposible que ambos tengan portería a cero con resultado
    // (si local tiene portería a cero Y visitante tiene portería a cero → 0-0, pero eso
    //  requiere que ambos no encajen, lo que implica 0-0 → prácticamente el mismo evento)
    if ((csHA && csAB) || (csAA && csHB)) {
      if ((opA === 'si' || tA.includes('yes')) && (opB === 'si' || tB.includes('yes'))) return 0.10;
      return 0.50;
    }

    // CleanSheet + Total Goles: si portería a cero local Sí → visitante no marca
    if ((csHA || csAA) && golB) {
      const esCS_Si = csHA ? tA.includes('yes') : tA.includes('yes');
      const gDir  = dB;
      const gLine = nB;
      if (esCS_Si && gDir === 'under' && gLine !== null) {
        // CleanSheet Sí + Under X: el equipo que tiene portería a cero no encaja → menos goles
        return 0.35;
      }
      if (esCS_Si && gDir === 'over' && gLine !== null && gLine <= 1.5) {
        return 0.40; // Portería a cero + Over 1.5: el otro equipo debe meter al menos 2
      }
      return 0.55;
    }
    if (golA && (csHB || csAB)) {
      const esCS_Si = csHB ? tB.includes('yes') : tB.includes('yes');
      const gDir  = dA;
      const gLine = nA;
      if (esCS_Si && gDir === 'under' && gLine !== null) return 0.35;
      if (esCS_Si && gDir === 'over'  && gLine !== null && gLine <= 1.5) return 0.40;
      return 0.55;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 15: FirstScore / NextGoal
    ────────────────────────────────────────────────────────────── */
    if (firstA && nextB) return 0.55;
    if (firstB && nextA) return 0.55;

    // FirstScore/NextGoal "sin goles" + Under: correlados
    if ((firstA || nextA) && golB) {
      const esSinGol = tA.includes('none') || tA.includes('sin');
      const gDir  = dB;
      const gLine = nB;
      if (esSinGol && gDir === 'under' && gLine !== null && gLine <= 1.5) return 0.15;
      if (esSinGol && gDir === 'over') return 0.20;
      return 0.55;
    }
    if ((firstB || nextB) && golA) {
      const esSinGol = tB.includes('none') || tB.includes('sin');
      const gDir  = dA;
      const gLine = nA;
      if (esSinGol && gDir === 'under' && gLine !== null && gLine <= 1.5) return 0.15;
      if (esSinGol && gDir === 'over') return 0.20;
      return 0.55;
    }

    // FirstScore/NextGoal con resultado
    if ((firstA || nextA) && resB) return 0.50;
    if ((firstB || nextB) && resA) return 0.50;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 16: Córners
       Los córners son bastante independientes de los goles/resultado
       salvo correlación general "partido activo"
    ────────────────────────────────────────────────────────────── */
    if (cornA && cornB) {
      // Mismo mercado misma línea mismo sentido → ya manejado por clave
      if (dA === dB && nA !== null && nB !== null) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.20;
        return 0.55;
      }
      return 0.65;
    }
    if (cornHTA && cornHTB) {
      if (dA === dB && nA !== null && nB !== null) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.20;
        return 0.55;
      }
      return 0.65;
    }
    // Córners encuentro + Córners 1ª mitad: correlados (la primera pone la base)
    if ((cornA && cornHTB) || (cornHTA && cornB)) return 0.55;

    // Córners + Resultado: prácticamente independientes (equipo dominante tiene más córners Y gana)
    if ((cornA || cornHTA) && resB) return 0.80;
    if (resA && (cornB || cornHTB)) return 0.80;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 17: Tarjetas
       Las tarjetas son bastante independientes del marcador salvo
       correlación con "partido disputado/tenso"
    ────────────────────────────────────────────────────────────── */
    if (tarjA && tarjB) {
      if (dA === dB && nA !== null && nB !== null) {
        const diff = Math.abs(nA - nB);
        if (diff <= 1) return 0.20;
        return 0.55;
      }
      return 0.65;
    }
    // Tarjetas + cualquier otro mercado de goles/resultado: bastante independiente
    if (tarjA || tarjB) return 0.85;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 18: Hándicaps
    ────────────────────────────────────────────────────────────── */
    if ((ehA || ahA) && (ehB || ahB)) return 0.50;

    // EH/AH + goles: equipo con ventaja tiende a mantener resultado cerrado
    if ((ehA && golB) || (golA && ehB)) return 0.55;
    if ((ahA && golB) || (golA && ahB)) return 0.55;

    // AH mismo partido mismo equipo líneas distintas
    if (ahA && ahB) {
      // Si las líneas son muy cercanas → correlados
      if (nA !== null && nB !== null) {
        const diff = Math.abs(nA - nB);
        if (diff <= 0.5) return 0.15;
        return 0.45;
      }
      return 0.45;
    }

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 19: Resultado HT/2H entre sí y con goles HT
    ────────────────────────────────────────────────────────────── */
    if (htA && h2B) return 0.65; // Primera y segunda mitad: cierta correlación de forma
    if (h2A && htB) return 0.65;
    if (htA && htB) return 0;    // Mismo mercado → claveExclusion maneja, pero por si acaso

    // Doble oportunidad + BTTS
    if ((dcA && bttsB) || (bttsA && dcB)) {
      const bttsSi = bttsA ? opA === 'si' : opB === 'si';
      if (bttsSi) return 0.40;
      return 0.55;
    }

    // Doble oportunidad + Goles
    if ((dcA && golB) || (golA && dcB)) {
      const gDir  = golA ? dA : dB;
      const gLine = golA ? nA : nB;
      if (gDir === 'over' && gLine !== null && gLine <= 1.5) return 0.45;
      return 0.55;
    }

    // Doble oportunidad + HT result
    if ((dcA && htB) || (htA && dcB)) return 0.55;

    /* ──────────────────────────────────────────────────────────────
       BLOQUE 20: Segmentos completamente distintos (primera ↔ encuentro)
       Mercados de 1ª mitad vs mercados de encuentro completo
       son más independientes que dos del mismo segmento
    ────────────────────────────────────────────────────────────── */
    const segA = segmento(tA);
    const segB = segmento(tB);
    if (segA !== segB && segA !== 'encuentro' && segB !== 'encuentro') {
      // Primera mitad vs segunda mitad: correlación baja-moderada
      return 0.75;
    }

    // ── FALLBACK: mercados sin correlación conocida → independientes ──
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
     addBet — v4.3: incluye resolverConflictoGoles
  ───────────────────────────────────────────────────────── */
  async function addBet({ partido, tipo, cuota, partidoId, mercado, line, dir }) {
    const pid   = (partidoId || '').toString().trim();
    const mNorm = normM(mercado);
    const cStr  = (cuota || '').toString().trim();
    const clave = claveExclusion(mNorm, tipo);

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

    const dnbCheck = validarDNBEnCarrito(betNuevo, bets);
    if (!dnbCheck.ok) { toast(`🚫 ${dnbCheck.motivo}`, 'error'); return; }

    const conflicto = resolverConflictoGoles(betNuevo, bets);

    if (conflicto.accion === 'reemplazar') {
      const existente = bets[conflicto.idx];
      const dirLabel  = (betNuevo.dir || direccion(betNuevo.tipo)) === 'over' ? 'Más de' : 'Menos de';
      const lineaAntigua = existente.line ?? valorNum(existente.tipo);
      const lineaNueva   = betNuevo.line  ?? valorNum(betNuevo.tipo);
      bets[conflicto.idx] = betNuevo;
      guardar(); notificar();
      toast(`🔄 Selección actualizada: ${dirLabel} ${lineaNueva} goles (sustituye a ${dirLabel} ${lineaAntigua})`, 'ok');
      return;
    }

    if (conflicto.accion === 'descartar') {
      const existente    = bets.find((b, i) => {
        if ((b.partidoId || '').toString().trim() !== pid) return false;
        if (normM(b.mercado) !== mNorm) return false;
        const dEx = b.dir || direccion(b.tipo);
        const dNu = betNuevo.dir || direccion(betNuevo.tipo);
        return dEx === dNu;
      });
      const dirLabel     = (betNuevo.dir || direccion(betNuevo.tipo)) === 'over' ? 'Más de' : 'Menos de';
      const lineaActual  = existente ? (existente.line ?? valorNum(existente.tipo)) : '?';
      const lineaNueva   = betNuevo.line ?? valorNum(betNuevo.tipo);
      toast(`ℹ Ya tienes ${dirLabel} ${lineaActual} goles, que es más restrictivo que ${dirLabel} ${lineaNueva}`, 'info');
      return;
    }

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
          if (f === 0)       avisos.push('⚠ Selecciones redundantes: una incluye a la otra');
          else if (f <= 0.25) avisos.push('↘ Correlación muy fuerte: cuota reducida considerablemente');
          else if (f <= 0.50) avisos.push('↘ Correlación fuerte: cuota reducida significativamente');
          else if (f <= 0.70) avisos.push('↘ Correlación moderada: cuota reducida');
        }
      }
      const avisosHTML = [...new Set(avisos)].map(a =>
        `<div class="bs-corr-aviso">${a}</div>`
      ).join('');

      const cuotaGrupo = calcularCuotaCombinada(grupo);
      const subItems   = grupo.map(({ tipo, cuota, mercado, _idx }) => {
        const factor = infoCorrelacion(bets, _idx);
        const badge  = factor === 0   ? `<span class="bs-corr-badge bs-corr-incompatible">⚠ Absorbida</span>`
                     : factor <= 0.25 ? `<span class="bs-corr-badge bs-corr-reducida">↘ Muy correlada</span>`
                     : factor <= 0.50 ? `<span class="bs-corr-badge bs-corr-reducida">↘ Fuerte correlación</span>`
                     : factor <= 0.70 ? `<span class="bs-corr-badge bs-corr-reducida">↘ Correlada</span>`
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
     realizarApuesta
  ───────────────────────────────────────────────────────── */
  async function realizarApuesta() {
    const auth = window.auth, db = window.db;
    if (!auth || !db) { toast('Error: Firebase no disponible', 'error'); return; }
    const user = auth.currentUser;
    if (!user)        { toast('Debes iniciar sesión para apostar', 'error'); return; }
    if (!bets.length) { toast('No hay apuestas en el carrito', 'error');    return; }

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