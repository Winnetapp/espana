/* =============================================================
   assets/js/betslip-core.js
   Módulo compartido de carrito entre index.html y partido.html

   MODALES MÓVIL:
   · index.html   → #index-slip-overlay / #index-slip-modal   (bottom sheet)
   · partido.html → #slip-overlay / #slip-modal               (bottom sheet)
   Ambos usan el mismo patrón: sube desde abajo, sin ocupar
   toda la pantalla, con padding inferior para no chocar con
   la barra de navegación.
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

  /* ── Correlaciones ── */
  function segmento(tipo) {
    const t = (tipo || '').toLowerCase();
    if (/encuentro/.test(t))        return 'encuentro';
    if (/1ª mitad|primera/.test(t)) return 'primera';
    if (/2ª mitad|segunda/.test(t)) return 'segunda';
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

  function factorCorrelacion(a, b) {
    const mA = normM(a.mercado), mB = normM(b.mercado);
    const tA = (a.tipo || '').toLowerCase(), tB = (b.tipo || '').toLowerCase();
    const esRes   = m => m === 'resultado' || m === 'dobleoportunidad';
    const esAmbos = m => m === 'ambosmarcan';
    const esImpar = m => m === 'golesimparpar';
    const esCorn  = m => m === 'corners';
    const esTarj  = m => m === 'tarjetas';
    const esGoles = m => m === 'totalgoles';
    const esDNB   = m => m === 'dnb';

    if (esAmbos(mA) && esAmbos(mB)) {
      const [segA, segB] = [segmento(tA), segmento(tB)];
      const [opA,  opB]  = [opcionSiNo(tA), opcionSiNo(tB)];
      if (opA === opB) {
        if ((segA !== 'encuentro') && segB === 'encuentro') return 0;
        if ((segB !== 'encuentro') && segA === 'encuentro') return 0;
        if (opA === 'no') return 0.5;
      }
      return 1;
    }
    if ((esAmbos(mA) && esRes(mB) && opcionSiNo(tA) === 'si') ||
        (esAmbos(mB) && esRes(mA) && opcionSiNo(tB) === 'si')) return 0.5;
    if (esAmbos(mA) && esGoles(mB) && opcionSiNo(tA) === 'si' && direccion(tB) === 'mas') return 0.5;
    if (esAmbos(mB) && esGoles(mA) && opcionSiNo(tB) === 'si' && direccion(tA) === 'mas') return 0.5;
    if (esGoles(mA) && esGoles(mB)) {
      const [dA, dB] = [direccion(tA), direccion(tB)];
      const [nA, nB] = [valorNum(tA), valorNum(tB)];
      if (dA === dB && dA === 'mas' && nA !== null && nB !== null && (nA >= nB || nB >= nA)) return 0.7;
      if (dA === 'mas'   && dB === 'menos' && nA !== null && nB !== null && nA === nB) return 0;
      if (dA === 'menos' && dB === 'mas'   && nA !== null && nB !== null && nA === nB) return 0;
    }
    if (esDNB(mA) && esRes(mB)) return 0.5;
    if (esDNB(mB) && esRes(mA)) return 0.5;
    if (esCorn(mA) && esCorn(mB)) {
      const [dA, dB] = [direccion(tA), direccion(tB)];
      const [nA, nB] = [valorNum(tA), valorNum(tB)];
      if (dA === dB && nA !== null && nB !== null) {
        if (dA === 'mas'   && (segmento(tA) !== 'encuentro') && segmento(tB) === 'encuentro' && nA >= nB) return 0;
        if (dA === 'menos' && segmento(tA) === 'encuentro'   && (segmento(tB) !== 'encuentro') && nA <= nB) return 0;
      }
      return 0.5;
    }
    if (esTarj(mA) && esTarj(mB)) {
      const [dA, dB] = [direccion(tA), direccion(tB)];
      const [nA, nB] = [valorNum(tA), valorNum(tB)];
      if (dA === dB && nA !== null && nB !== null) {
        if (dA === 'mas'   && (segmento(tA) !== 'encuentro') && segmento(tB) === 'encuentro' && nA >= nB) return 0;
        if (dA === 'menos' && segmento(tA) === 'encuentro'   && (segmento(tB) !== 'encuentro') && nA <= nB) return 0;
      }
      return 0.5;
    }
    if (esImpar(mA) && esImpar(mB)) {
      if ((segmento(tA) !== 'encuentro') && segmento(tB) === 'encuentro') return 0;
      if ((segmento(tB) !== 'encuentro') && segmento(tA) === 'encuentro') return 0;
      return 0.5;
    }
    if ((esRes(mA) && esImpar(mB)) || (esRes(mB) && esImpar(mA))) return 0.5;
    return 1;
  }

  function claveExclusion(mercado, tipo) {
    const m = normM(mercado);
    if (m === 'resultado' || m === 'dobleoportunidad') return 'resultado_o_doble';
    if (m === 'ambosmarcan')   return `ambosmarcan|${segmento(tipo)}`;
    if (m === 'golesimparpar') return `golesimparpar|${segmento(tipo)}`;
    if (m === 'dnb')     return 'dnb';
    if (m === 'descanso') return 'descanso';
    if (m === 'segunda')  return 'segunda';
    if (m === 'corners') {
      const t = (tipo || '').toLowerCase();
      const eq = t.includes('local') ? 'local' : t.includes('visitante') ? 'visitante' : 'ambos';
      return `corners|${segmento(tipo)}|${eq}`;
    }
    if (m === 'tarjetas') {
      const t = (tipo || '').toLowerCase();
      const eq = t.includes('local') ? 'local' : t.includes('visitante') ? 'visitante' : 'ambos';
      return `tarjetas|${segmento(tipo)}|${eq}`;
    }
    return m;
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
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) bets = arr; } } catch {}
  }
  function guardar() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bets)); }

  /* ── addBet ── */
  async function addBet({ partido, tipo, cuota, partidoId, mercado }) {
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

    if (idx !== -1) {
      const ant = bets[idx];
      if (normM(ant.mercado) === mNorm &&
          (ant.tipo  || '').toLowerCase() === (tipo  || '').toLowerCase() &&
          (ant.cuota || '').toString()     === cStr) {
        bets.splice(idx, 1); guardar(); notificar(); toast('Selección eliminada', 'info'); return;
      }
      bets[idx] = { partido, tipo, cuota: cStr, partidoId: pid, mercado: mNorm };
      guardar(); notificar(); toast('Selección reemplazada ✓', 'ok'); return;
    }

    bets.push({ partido, tipo, cuota: cStr, partidoId: pid, mercado: mNorm });
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
          if (item) { item.classList.add('bs-item-removing'); setTimeout(() => { bets.splice(idx, 1); guardar(); render(); }, 280); }
          else       { bets.splice(idx, 1); guardar(); render(); }
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
    if (bets.length < 3) { wrap.innerHTML = `<div class="sistema-vacio">Necesitas al menos 3 selecciones de partidos diferentes para crear una apuesta de sistema.</div>`; return; }
    const porPartido = {};
    bets.forEach(b => { const pid = (b.partidoId || b.partido || '').toString().trim(); if (!porPartido[pid]) porPartido[pid] = b; });
    const selecciones = Object.values(porPartido), n = selecciones.length;
    if (n < 3) { wrap.innerHTML = `<div class="sistema-vacio">Las selecciones deben ser de al menos 3 partidos distintos.</div>`; return; }
    let html = `<div class="sistema-info">Sistema de ${n} selecciones</div><div class="sistema-opciones">`;
    for (let k = 2; k < n; k++) {
      const { combos, cuotaMedia, retornoTotal } = calcularSistema(selecciones, k);
      html += `<label class="sistema-opcion" for="sis-${k}"><div class="sis-radio-wrap"><input type="radio" name="sistema-tipo" id="sis-${k}" value="${k}" class="sis-radio" ${k === 2 ? 'checked' : ''}><div class="sis-info"><span class="sis-titulo">${k}/${n} — ${combos} combinaciones</span><span class="sis-detalle">Cuota media <strong>${cuotaMedia.toFixed(2)}</strong></span></div></div><span class="sis-retorno">×${retornoTotal.toFixed(1)}</span></label>`;
    }
    html += `</div>`;
    const stakeVal      = parseFloat(document.querySelector('.stake-input input')?.value || 5) || 5;
    const kSel          = parseInt(wrap.querySelector('input[name="sistema-tipo"]:checked')?.value || 2);
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
    // partido.html específicos
    document.querySelectorAll('#slip-total-odds, #slip-total-odds-modal').forEach(el =>
      el.textContent = bets.length ? cuota.toFixed(2) : '—'
    );
    document.querySelectorAll('#slip-ganancias, #slip-ganancias-modal').forEach(el =>
      el.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €'
    );
    // index.html específicos
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
    if (badge) { badge.style.display = bets.length ? 'inline-block' : 'none'; badge.textContent = bets.length; }
    if (totalText && cartIcon) {
      const cuota = calcularCuotaCombinada(bets);
      if (bets.length) { cartIcon.style.display = 'none'; totalText.style.display = 'inline'; totalText.textContent = cuota.toFixed(2).replace('.', ','); }
      else             { cartIcon.style.display = 'inline'; totalText.style.display = 'none'; }
    }
    const badgePartido = document.getElementById('mobile-bet-badge');
    if (badgePartido) { badgePartido.textContent = bets.length; badgePartido.classList.toggle('visible', bets.length > 0); }
  }

  function actualizarPestanas() {
    const tabCombi = document.querySelector('.bs-tab[data-target="combi"]');
    if (tabCombi) tabCombi.textContent = `Combinada (${bets.length})`;
    const tabActual = document.querySelector('.bs-tab.active')?.dataset.target;
    if (bets.length >= 2 && tabActual === 'simple') cambiarPestana('combi');
    if (bets.length < 2  && tabActual === 'combi')  cambiarPestana('simple');
  }

  function cambiarPestana(target) {
    document.querySelectorAll('.bs-tab').forEach(t => t.classList.toggle('active', t.dataset.target === target));
    document.querySelectorAll('[data-content]').forEach(s => s.style.display = s.dataset.content === target ? 'block' : 'none');
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

  /* ── Cerrar ambos modales móvil ── */
  function cerrarModalesMobil() {
    // partido.html
    document.getElementById('slip-overlay')?.classList.remove('active');
    document.getElementById('slip-modal')?.classList.remove('open');
    // index.html
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
    for (const pid of idsUnicos) { if (await partidoEnVivo(pid)) { const nombre = bets.find(b => b.partidoId === pid)?.partido || pid; pidsBloqueados.push(nombre); } }
    if (pidsBloqueados.length) {
      bets = bets.filter(b => !pidsBloqueados.some(nombre => b.partido === nombre));
      guardar(); render();
      toast(pidsBloqueados.length === 1 ? `⚠ "${pidsBloqueados[0]}" ya está en vivo y se ha eliminado del carrito` : `⚠ ${pidsBloqueados.length} partidos están en vivo y se han eliminado del carrito`, 'error');
      return;
    }

    const tabActual = document.querySelector('.bs-tab.active')?.dataset.target || 'simple';
    const stakeEl = [...document.querySelectorAll('.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal')]
      .find(el => el && el.value !== '') || document.querySelector('.stake-input input');
    const stake     = parseFloat(stakeEl?.value || 5) || 0;
    if (stake <= 0) { toast('El importe debe ser mayor que 0', 'error'); return; }

    const userRef  = db.collection('usuarios').doc(user.uid);
    const userSnap = await userRef.get();
    const saldo    = parseFloat(userSnap.data()?.saldo) || 0;

    let apuestaData, totalDescontar;

    if (tabActual === 'sistema' && bets.length >= 3) {
      const porPartido = {};
      bets.forEach(b => { const pid = b.partidoId; if (!porPartido[pid]) porPartido[pid] = b; });
      const sels = Object.values(porPartido);
      const k    = parseInt(document.querySelector('input[name="sistema-tipo"]:checked')?.value || 2);
      const { combos } = calcularSistema(sels, k);
      totalDescontar    = stake * combos;
      if (totalDescontar > saldo) { toast('Saldo insuficiente', 'error'); return; }
      apuestaData = {
        usuarioId: user.uid, fecha: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: 'sistema', sistema: { k, n: sels.length, combos },
        stake, totalDescontar, totalOdds: calcularCuotaCombinada(sels),
        potentialWin: stake * calcularCuotaCombinada(sels) * combos,
        bets: bets.map(b => ({ ...b, cuota: parseFloat(b.cuota) })),
        estado: 'pendiente', resultado: null,
      };
    } else {
      const totalOdds = calcularCuotaCombinada(bets);
      totalDescontar   = stake;
      if (totalDescontar > saldo) { toast('Saldo insuficiente', 'error'); return; }
      apuestaData = {
        usuarioId: user.uid, fecha: firebase.firestore.FieldValue.serverTimestamp(),
        tipo: bets.length === 1 ? 'simple' : 'combinada',
        stake, totalOdds, potentialWin: stake * totalOdds,
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
      document.querySelectorAll('.hdr-dd-saldo').forEach(el => { el.textContent = `${nuevoSaldo.toFixed(2)} €`; });
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
        const v = btn.classList.contains('all-in') ? (window._saldoUsuario || 0) : (parseFloat(btn.textContent) || 0);
        document.querySelectorAll('.stake-input input, #slip-stake, #slip-stake-modal, #index-stake-modal').forEach(el => { el.value = v; });
        renderFooter();
      });
    });

    document.querySelectorAll(
      '#clear-bets, .slip-clear-btn, #slip-clear-btn, #slip-clear-btn-modal, #index-slip-clear-btn'
    ).forEach(el => el?.addEventListener('click', () => { vaciar(); toast('Carrito vaciado', 'info'); }));

    document.querySelectorAll(
      '.accept-btn, #btn-apostar, #btn-apostar-modal, #index-btn-apostar-modal'
    ).forEach(el => el?.addEventListener('click', realizarApuesta));

    /* Modal partido.html */
    const mobileBetBtn = document.getElementById('mobile-bet-btn');
    const slipOverlay  = document.getElementById('slip-overlay');
    const slipModal    = document.getElementById('slip-modal');
    mobileBetBtn?.addEventListener('click', () => { slipOverlay?.classList.add('active'); slipModal?.classList.add('open'); document.body.style.overflow = 'hidden'; });
    slipOverlay?.addEventListener('click',  () => { slipOverlay.classList.remove('active'); slipModal?.classList.remove('open'); document.body.style.overflow = ''; });

    /* Modal index.html — apertura gestionada por inline script de index.html */

    render();
  }

  /* ── API pública ── */
  window.BetSlip     = { addBet, vaciar, render, getBets: () => bets, onChange: fn => _subs.push(fn) };
  window.addBetToSlip = addBet;
  window.addBet       = (tipo, cuota, mercado) => {
    const p = window._partidoData;
    addBet({ partido: p ? `${p.local} vs ${p.visitante}` : '', tipo, cuota: String(cuota), mercado, partidoId: window._partidoId || '' });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  function formatTipo(tipo, mercado) {
    const m = normM(mercado);
    if (m === 'resultado')        return tipo.toLowerCase() === 'empate' ? 'Empate' : `Gana ${tipo}`;
    if (m === 'goleadores')       return `Gol de ${tipo}`;
    if (m === 'totalgoles')       return tipo;
    if (m === 'ambosmarcan')      return `Ambos marcan: ${tipo}`;
    if (m === 'dnb')              return tipo;
    if (m === 'dobleoportunidad') return tipo;
    if (m === 'descanso')         return tipo;
    if (m === 'segunda')          return tipo;
    return tipo;
  }

})();