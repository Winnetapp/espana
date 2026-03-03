/* =============================================================
   assets/js/daily-reward.js
   Sistema de recompensa diaria — Winnetapp

   Firestore — campos en usuarios/{uid}:
     rachaActual      : number  — día actual dentro de la semana (1-7)
     semanaTotal      : number  — semana acumulada desde el inicio (empieza en 1)
     ultimaRecompensa : string  — fecha "YYYY-MM-DD" del último cobro
     rachaMaxima      : number  — récord histórico de días seguidos
     rachaFuego       : boolean — multiplicador ×2 activo
     piezas           : number  — piezas acumuladas (1 cada semana completada)
     saldo            : number  — saldo total del usuario

   Tabla de recompensas:
     Día N de Semana S → (S-1) + (N × 0.15) €
     Día 7             → S € exacto (cofre/ruleta)
     Semana 4 día 7    → 4 € + 10 € bonus mes completo

   Racha de fuego (×2):
     · Se activa al completar 28 días seguidos (4 semanas)
     · Multiplica días 1-6 × 2 mientras se mantenga la racha
     · El día 7 no se multiplica (tiene su propio premio fijo)
     · Un día perdido → rachaFuego = false, hay que rehacer otro mes

   Piezas:
     · +1 pieza al completar cada semana (día 7)
     · 3 piezas = 5 € canjeables en cualquier momento
   ============================================================= */

window.DailyReward = (function () {

  /* ─────────────────────────────────────────
     RECOMPENSAS
  ───────────────────────────────────────── */

  /**
   * Devuelve la recompensa en euros para un día y semana dados.
   * Día 7 siempre = semana exacta en euros.
   * Días 1-6 = (semana - 1) + día × 0.15
   */
  function recompensaDia(dia, semana) {
    if (dia === 7) return semana;
    return parseFloat(((semana - 1) + dia * 0.15).toFixed(2));
  }

  function aplicarMultiplicador(cantidad, rachaFuego) {
    return rachaFuego ? parseFloat((cantidad * 2).toFixed(2)) : cantidad;
  }

  /* ─────────────────────────────────────────
     FECHAS (zona horaria España)
  ───────────────────────────────────────── */
  function hoyES() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  }
  function ayerES() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  }

  /* ─────────────────────────────────────────
     INFO VISUAL POR DÍA
  ───────────────────────────────────────── */
  const DIA_INFO = [
    { emoji: '🌱', label: 'Día 1' },
    { emoji: '🔥', label: 'Día 2' },
    { emoji: '⚡', label: 'Día 3' },
    { emoji: '💎', label: 'Día 4' },
    { emoji: '🚀', label: 'Día 5' },
    { emoji: '👑', label: 'Día 6' },
    { emoji: '🎁', label: 'Día 7' },
  ];

  /* ─────────────────────────────────────────
     LÓGICA PRINCIPAL — DAR RECOMPENSA
  ───────────────────────────────────────── */
  async function calcularYDar(uid) {
    const ref  = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    const ud   = snap.data() || {};

    const hoy    = hoyES();
    const ayer   = ayerES();
    const ultima = ud.ultimaRecompensa || null;

    // Ya cobró hoy
    if (ultima === hoy) {
      return {
        estado:     'ya-reclamado',
        racha:      ud.rachaActual  || 0,
        semana:     ud.semanaTotal  || 1,
        rachaFuego: ud.rachaFuego   || false,
        piezas:     ud.piezas       || 0,
        rachaMax:   ud.rachaMaxima  || 0,
      };
    }

    // ── Estado actual ──
    let racha      = ud.rachaActual  || 0;
    let semana     = ud.semanaTotal  || 1;
    let rachaMax   = ud.rachaMaxima  || 0;
    let rachaFuego = ud.rachaFuego   || false;
    let piezas     = ud.piezas       || 0;

    const sigueRacha = ultima === ayer;

    if (!sigueRacha) {
      // Racha rota → reset
      racha      = 1;
      rachaFuego = false;
    } else {
      racha += 1;
    }

    // ── Semana completada (día 7) ──
    let semanaCompletada = false;
    let nuevaPieza       = false;
    let bonusMes         = false;

    if (racha === 7) {
      semanaCompletada = true;
      nuevaPieza       = true;
      piezas          += 1;

      // ¿Completó 4 semanas seguidas? → bonus mes + activar racha de fuego
      if (semana % 4 === 0) {
        bonusMes   = true;
        rachaFuego = true;
      }

      semana += 1;
      racha   = 0; // el próximo día arrancará como día 1
    }

    if (racha > rachaMax) rachaMax = racha;

    // ── Calcular cantidad ──
    const diaReal    = semanaCompletada ? 7 : racha;
    const semanaReal = semanaCompletada ? semana - 1 : semana;

    let cantidad = recompensaDia(diaReal, semanaReal);

    // Multiplicador ×2 solo en días 1-6
    if (!semanaCompletada) {
      cantidad = aplicarMultiplicador(cantidad, rachaFuego);
    }

    // Bonus mes completo (4 semanas seguidas)
    const bonusCantidad = bonusMes ? 10 : 0;

    // ── Guardar en Firestore ──
    const updates = {
      rachaActual:      racha,
      semanaTotal:      semana,
      rachaMaxima:      rachaMax,
      ultimaRecompensa: hoy,
      rachaFuego:       rachaFuego,
      piezas:           piezas,
      saldo:            firebase.firestore.FieldValue.increment(cantidad + bonusCantidad),
    };

    await ref.update(updates);

    // ── Actualizar saldo en la UI del header ──
    _actualizarSaldoUI(ud.saldo || 0, cantidad + bonusCantidad);

    return {
      estado:           'reclamado',
      racha:            diaReal,
      semana:           semanaReal,
      cantidad,
      bonusMes,
      bonusCantidad,
      rachaMax,
      rachaFuego,
      semanaCompletada,
      nuevaPieza,
      piezas,
    };
  }

  async function obtenerEstado(uid) {
    const snap = await db.collection('usuarios').doc(uid).get();
    const ud   = snap.data() || {};
    return {
      yaCobro:    ud.ultimaRecompensa === hoyES(),
      racha:      ud.rachaActual  || 0,
      semana:     ud.semanaTotal  || 1,
      rachaMax:   ud.rachaMaxima  || 0,
      rachaFuego: ud.rachaFuego   || false,
      piezas:     ud.piezas       || 0,
    };
  }

  /* ─────────────────────────────────────────
     CANJEAR PIEZAS
  ───────────────────────────────────────── */
  async function canjearPiezas(uid) {
    const ref  = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    const ud   = snap.data() || {};
    const piezas = ud.piezas || 0;

    if (piezas < 3) return { ok: false, msg: `Necesitas 3 piezas. Tienes ${piezas}.` };

    await ref.update({
      piezas: firebase.firestore.FieldValue.increment(-3),
      saldo:  firebase.firestore.FieldValue.increment(5),
    });

    _actualizarSaldoUI(ud.saldo || 0, 5);
    return { ok: true, nuevoPiezas: piezas - 3 };
  }

  /* ─────────────────────────────────────────
     HELPER: actualizar saldo en header
  ───────────────────────────────────────── */
  function _actualizarSaldoUI(saldoAnterior, incremento) {
    const nuevo = parseFloat((saldoAnterior + incremento).toFixed(2));
    window._saldoUsuario = nuevo;
    const el = document.getElementById('hdr-saldo-val');
    if (el) el.textContent = `${nuevo.toFixed(2)} €`;
    document.querySelectorAll('.hdr-dd-saldo').forEach(e => {
      e.textContent = `${nuevo.toFixed(2)} €`;
    });
  }

  /* ─────────────────────────────────────────
     HELPER: formato euros
  ───────────────────────────────────────── */
  function fmt(n) {
    return n.toFixed(2).replace('.', ',') + '€';
  }

  /* ─────────────────────────────────────────
     MODAL DÍAS 1-6
  ───────────────────────────────────────── */
  function mostrarModal({ racha, semana, cantidad, rachaMax, rachaFuego, nuevaPieza, piezas, bonusMes, bonusCantidad }) {
    if (document.getElementById('_dr-modal')) return;

    const info = DIA_INFO[Math.min(racha - 1, 6)];

    const slots = Array.from({ length: 7 }, (_, i) => {
      const d      = i + 1;
      const done   = d < racha;
      const active = d === racha;
      const locked = d > racha;
      const amt    = fmt(recompensaDia(d, semana));
      return `
        <div style="
          display:flex;flex-direction:column;align-items:center;gap:3px;
          padding:6px 2px;border-radius:10px;
          border:1px solid ${active ? '#f5c518' : done ? 'rgba(34,197,94,0.3)' : '#252830'};
          background:${active ? 'rgba(245,197,24,0.1)' : done ? 'rgba(34,197,94,0.08)' : '#0e0f14'};
          opacity:${locked ? 0.35 : 1};
          ${active ? 'box-shadow:0 0 12px rgba(245,197,24,0.25);' : ''}
        ">
          <span style="font-size:${done ? '0.85' : '1'}rem">${done ? '✓' : active ? DIA_INFO[i].emoji : '🔒'}</span>
          <span style="font-size:0.5rem;color:#8a8f9e;font-weight:700;text-transform:uppercase;">D${d}</span>
          <span style="font-size:0.54rem;color:${d === 7 ? '#e63030' : '#f5c518'};font-weight:700;">${amt}</span>
        </div>`;
    }).join('');

    const fuegoTag = rachaFuego ? `
      <div style="text-align:center;margin-bottom:10px;">
        <span style="background:rgba(255,107,43,0.15);border:1px solid rgba(255,107,43,0.4);color:#ff6b2b;font-size:0.72rem;padding:3px 12px;border-radius:20px;letter-spacing:1px;font-weight:700;text-transform:uppercase;">
          🔥 RACHA DE FUEGO × 2
        </span>
      </div>` : '';

    const bonusTag = bonusMes ? `
      <div style="background:rgba(245,197,24,0.08);border:1px solid rgba(245,197,24,0.3);border-radius:12px;padding:12px;text-align:center;margin-bottom:14px;">
        <div style="font-size:1.6rem;margin-bottom:4px;">🏆</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:1rem;color:#f5c518;font-weight:900;letter-spacing:1px;">¡MES COMPLETO!</div>
        <div style="font-size:0.78rem;color:#e8edf5;margin-top:2px;">+${bonusCantidad}€ de bonus + 🔥 Racha de fuego × 2 activada</div>
      </div>` : '';

    const piezaTag = nuevaPieza ? `
      <div style="background:#0e0f14;border:1px solid rgba(245,197,24,0.2);border-radius:12px;padding:10px;text-align:center;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span style="font-size:1.3rem;">🧩</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:0.88rem;color:#f5c518;font-weight:700;">+1 PIEZA · ${piezas}/3</span>
        ${piezas >= 3 ? '<span style="font-size:0.7rem;color:#22c55e;">¡Canjea por 5€!</span>' : ''}
      </div>` : '';

    const ov = document.createElement('div');
    ov.id = '_dr-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99997;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);animation:drFI .3s ease;';

    ov.innerHTML = `
<style>
@keyframes drFI  { from{opacity:0} to{opacity:1} }
@keyframes drSU  { from{transform:translateY(36px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes drBNC { 0%{transform:scale(.3)} 60%{transform:scale(1.12)} 80%{transform:scale(.96)} 100%{transform:scale(1)} }
@keyframes drSH  { 0%{background-position:200% center} 100%{background-position:-200% center} }
</style>
<div style="background:#16181d;border:1px solid #252830;border-radius:22px;padding:28px 22px 22px;max-width:420px;width:100%;position:relative;overflow:hidden;animation:drSU .4s cubic-bezier(.34,1.56,.64,1) both;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(245,197,24,.07),transparent 65%);pointer-events:none;"></div>

  <div style="text-align:center;margin-bottom:14px;">
    <span style="background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.25);border-radius:20px;padding:3px 12px;font-family:'Barlow Condensed',sans-serif;font-size:0.75rem;font-weight:700;color:#f5c518;letter-spacing:.5px;text-transform:uppercase;">
      Semana ${semana}
    </span>
  </div>

  ${fuegoTag}

  <div style="text-align:center;margin-bottom:8px;">
    <span style="font-size:3.4rem;display:inline-block;animation:drBNC .6s cubic-bezier(.36,.07,.19,.97) .3s both;">${info.emoji}</span>
  </div>
  <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.4rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#e8edf5;text-align:center;margin-bottom:4px;">¡Día ${racha}!</div>
  <div style="text-align:center;color:#5a6580;font-size:0.82rem;margin-bottom:16px;">${info.label}</div>

  <div style="text-align:center;margin-bottom:16px;">
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:2.8rem;font-weight:900;background:linear-gradient(135deg,#f5c518,#ffe555,#f5c518);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:drSH 2s linear infinite;display:inline-block;">
      +${fmt(cantidad)}
    </span>
    ${rachaFuego ? '<div style="font-size:0.72rem;color:#ff6b2b;margin-top:2px;">recompensa doblada 🔥</div>' : ''}
  </div>

  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px;">${slots}</div>

  ${bonusTag}
  ${piezaTag}

  <div style="display:flex;gap:8px;margin-bottom:16px;">
    ${[['🔥', racha + ' días', 'Racha'], ['🏆', rachaMax, 'Récord'], ['🧩', piezas + '/3', 'Piezas']].map(([ic, val, lbl]) => `
      <div style="flex:1;background:#0e0f14;border:1px solid #1e2530;border-radius:10px;padding:10px 6px;text-align:center;">
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;font-weight:800;color:#e8edf5;display:block;">${ic} ${val}</span>
        <span style="font-size:0.6rem;color:#5a6580;text-transform:uppercase;letter-spacing:.4px;">${lbl}</span>
      </div>`).join('')}
  </div>

  <button id="_dr-ok" style="width:100%;padding:14px;background:linear-gradient(135deg,#f5c518,#e6b800);color:#0a0a0c;border:none;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;font-weight:900;letter-spacing:1px;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 20px rgba(245,197,24,.3);transition:all .2s;">
    ¡Reclamar recompensa!
  </button>
</div>`;

    document.body.appendChild(ov);
    const cerrar = () => { ov.style.opacity = '0'; ov.style.transition = 'opacity .22s'; setTimeout(() => ov.remove(), 230); };
    document.getElementById('_dr-ok').addEventListener('click', cerrar);
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
    document.getElementById('_dr-ok').addEventListener('mouseenter', function () { this.style.transform = 'translateY(-2px)'; });
    document.getElementById('_dr-ok').addEventListener('mouseleave', function () { this.style.transform = ''; });
  }

  /* ─────────────────────────────────────────
     MODAL COFRE (semanas impares, día 7)
  ───────────────────────────────────────── */
  function mostrarModalCofre({ semana, piezas, bonusMes, bonusCantidad }) {
    if (document.getElementById('_dr-modal')) return;

    const premio = semana;

    const bonusTag = bonusMes ? `
      <div style="background:rgba(245,197,24,0.08);border:1px solid rgba(245,197,24,0.3);border-radius:12px;padding:10px;text-align:center;margin-bottom:12px;">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.95rem;color:#f5c518;font-weight:900;">🏆 ¡MES COMPLETO! +${bonusCantidad}€</div>
        <div style="font-size:0.72rem;color:#e8edf5;margin-top:2px;">🔥 Racha de fuego × 2 activada</div>
      </div>` : '';

    const ov = document.createElement('div');
    ov.id = '_dr-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99997;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);';

    ov.innerHTML = `
<style>
@keyframes cofreShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-8deg) scale(1.05)} 40%{transform:rotate(8deg) scale(1.08)} 60%{transform:rotate(-5deg)} 80%{transform:rotate(3deg)} }
@keyframes cofreBounce { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.15)} 80%{transform:scale(.96)} 100%{transform:scale(1);opacity:1} }
@keyframes goldRain { 0%{transform:translateY(-20px) rotate(0);opacity:1} 100%{transform:translateY(90px) rotate(720deg);opacity:0} }
@keyframes revealAmt { 0%{transform:scale(.5) translateY(10px);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
@keyframes drSH2 { 0%{background-position:200% center} 100%{background-position:-200% center} }
@keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
</style>
<div style="background:#16181d;border:1px solid #2a2218;border-radius:24px;padding:28px 22px 22px;max-width:380px;width:100%;text-align:center;position:relative;overflow:hidden;animation:fadeInUp .4s ease;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,rgba(245,164,24,.12),transparent 65%);pointer-events:none;"></div>
  <div id="_cofre-coins" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;"></div>

  <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;color:#5a6580;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px;">🏆 Semana ${semana} completada</div>

  <div id="_cofre-anim" style="font-size:5rem;margin-bottom:6px;cursor:pointer;display:inline-block;animation:cofreBounce .6s ease both;" title="¡Toca el cofre!">🎁</div>
  <div id="_cofre-tap-hint" style="font-size:0.76rem;color:#5a6580;margin-bottom:18px;animation:fadeInUp .5s .4s ease both;opacity:0;">Toca el cofre para abrirlo</div>

  <div id="_cofre-reveal" style="display:none;">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:3.2rem;font-weight:900;background:linear-gradient(135deg,#f5c518,#ffe555,#f5a818);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:drSH2 2s linear infinite,revealAmt .5s ease both;margin-bottom:4px;">+${fmt(premio)}</div>
    <div style="color:#5a6580;font-size:0.8rem;margin-bottom:14px;">añadidos a tu saldo</div>
    ${bonusTag}
    <div style="background:#0e0f14;border:1px solid rgba(245,197,24,.18);border-radius:12px;padding:10px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px;">
      <span style="font-size:1.2rem;">🧩</span>
      <span style="font-family:'Barlow Condensed',sans-serif;color:#f5c518;font-weight:700;font-size:0.9rem;">+1 PIEZA · ${piezas}/3</span>
      ${piezas >= 3 ? '<span style="font-size:0.68rem;color:#22c55e;">¡Canjea por 5€!</span>' : ''}
    </div>
  </div>

  <button id="_cofre-ok" style="display:none;width:100%;padding:14px;background:linear-gradient(135deg,#f5c518,#e6b800);color:#0a0a0c;border:none;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;font-weight:900;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">¡Genial!</button>
</div>`;

    document.body.appendChild(ov);

    let abierto = false;
    document.getElementById('_cofre-anim').addEventListener('click', () => {
      if (abierto) return;
      abierto = true;

      const cofreEl = document.getElementById('_cofre-anim');
      cofreEl.style.animation = 'cofreShake .5s ease';
      document.getElementById('_cofre-tap-hint').style.display = 'none';

      setTimeout(() => {
        cofreEl.textContent = '🎊';
        cofreEl.style.animation = 'cofreBounce .4s ease';

        const coinsEl = document.getElementById('_cofre-coins');
        for (let i = 0; i < 20; i++) {
          const c = document.createElement('div');
          c.style.cssText = `position:absolute;left:${10 + Math.random() * 80}%;top:15%;font-size:${0.8 + Math.random() * 0.9}rem;animation:goldRain ${0.6 + Math.random() * 0.5}s ${Math.random() * 0.4}s ease-out forwards;`;
          c.textContent = ['🪙','💰','✨','⭐','💫'][Math.floor(Math.random() * 5)];
          coinsEl.appendChild(c);
        }

        setTimeout(() => {
          document.getElementById('_cofre-reveal').style.display = 'block';
          document.getElementById('_cofre-ok').style.display = 'block';
        }, 400);
      }, 500);
    });

    const cerrar = () => { ov.style.opacity = '0'; ov.style.transition = 'opacity .22s'; setTimeout(() => ov.remove(), 230); };
    document.getElementById('_cofre-ok').addEventListener('click', cerrar);
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
  }

  /* ─────────────────────────────────────────
     MODAL RULETA (semanas pares, día 7)
  ───────────────────────────────────────── */
  function mostrarModalRuleta({ semana, piezas, bonusMes, bonusCantidad }) {
    if (document.getElementById('_dr-modal')) return;

    const premioReal = semana;
    const ITEM_H     = 64;

    // Opciones decorativas alrededor del premio real
    const opciones = [
      parseFloat((premioReal * 0.5).toFixed(2)),
      parseFloat((premioReal * 0.75).toFixed(2)),
      premioReal,                                   // ← ganador idx 2
      parseFloat((premioReal * 1.5).toFixed(2)),
      parseFloat((premioReal * 2).toFixed(2)),
      parseFloat((premioReal * 0.25).toFixed(2)),
      premioReal,
      parseFloat((premioReal * 1.25).toFixed(2)),
    ];
    const GANADOR_IDX  = 2;
    const TOTAL_ITEMS  = opciones.length;

    const bonusTag = bonusMes ? `
      <div style="background:rgba(245,197,24,0.08);border:1px solid rgba(245,197,24,0.3);border-radius:12px;padding:10px;text-align:center;margin-bottom:12px;">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.95rem;color:#f5c518;font-weight:900;">🏆 ¡MES COMPLETO! +${bonusCantidad}€</div>
        <div style="font-size:0.72rem;color:#e8edf5;margin-top:2px;">🔥 Racha de fuego × 2 activada</div>
      </div>` : '';

    const itemsHTML = [...opciones, ...opciones, ...opciones].map((v, i) => {
      const isWinner = i % TOTAL_ITEMS === GANADOR_IDX;
      return `<div style="height:${ITEM_H}px;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:1.6rem;font-weight:900;color:${isWinner ? '#f5c518' : '#3a3f50'};flex-shrink:0;">${fmt(v)}</div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.id = '_dr-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99997;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);';

    ov.innerHTML = `
<style>
@keyframes fadeInUp3 { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes drSH3 { 0%{background-position:200% center} 100%{background-position:-200% center} }
@keyframes pulseSpin { 0%,100%{box-shadow:0 0 0 0 rgba(245,197,24,.5)} 50%{box-shadow:0 0 0 8px rgba(245,197,24,0)} }
</style>
<div style="background:#16181d;border:1px solid #252830;border-radius:24px;padding:28px 22px 22px;max-width:380px;width:100%;text-align:center;position:relative;overflow:hidden;animation:fadeInUp3 .4s ease;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(245,197,24,.07),transparent 65%);pointer-events:none;"></div>

  <div style="font-family:'Barlow Condensed',sans-serif;font-size:0.72rem;font-weight:700;color:#5a6580;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px;">🎰 Semana ${semana} completada</div>

  <div style="position:relative;height:${ITEM_H * 3}px;overflow:hidden;border-radius:14px;border:1px solid #2a2830;margin-bottom:18px;background:#0e0f14;">
    <div style="position:absolute;top:50%;left:0;right:0;transform:translateY(-50%);height:${ITEM_H}px;background:rgba(245,197,24,.07);border-top:1px solid rgba(245,197,24,.28);border-bottom:1px solid rgba(245,197,24,.28);z-index:2;pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,#0e0f14 0%,transparent 28%,transparent 72%,#0e0f14 100%);z-index:3;pointer-events:none;"></div>
    <div id="_ruleta-strip" style="will-change:transform;">${itemsHTML}</div>
  </div>

  <button id="_ruleta-spin" style="width:100%;padding:14px;background:linear-gradient(135deg,#f5c518,#e6b800);color:#0a0a0c;border:none;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;font-weight:900;letter-spacing:1px;text-transform:uppercase;cursor:pointer;animation:pulseSpin 1.5s infinite;">
    🎰 ¡Girar ruleta!
  </button>

  <div id="_ruleta-reveal" style="display:none;margin-top:16px;">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:3rem;font-weight:900;background:linear-gradient(135deg,#f5c518,#ffe555,#f5a818);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:drSH3 2s linear infinite;">+${fmt(premioReal)}</div>
    <div style="color:#5a6580;font-size:0.8rem;margin-bottom:14px;">añadidos a tu saldo</div>
    ${bonusTag}
    <div style="background:#0e0f14;border:1px solid rgba(245,197,24,.18);border-radius:12px;padding:10px;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px;">
      <span style="font-size:1.2rem;">🧩</span>
      <span style="font-family:'Barlow Condensed',sans-serif;color:#f5c518;font-weight:700;font-size:0.9rem;">+1 PIEZA · ${piezas}/3</span>
      ${piezas >= 3 ? '<span style="font-size:0.68rem;color:#22c55e;">¡Canjea por 5€!</span>' : ''}
    </div>
    <button id="_ruleta-ok" style="width:100%;padding:14px;background:linear-gradient(135deg,#f5c518,#e6b800);color:#0a0a0c;border:none;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:1.05rem;font-weight:900;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">¡Genial!</button>
  </div>
</div>`;

    document.body.appendChild(ov);

    let girado = false;
    document.getElementById('_ruleta-spin').addEventListener('click', () => {
      if (girado) return;
      girado = true;

      const spinBtn = document.getElementById('_ruleta-spin');
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.5';
      spinBtn.style.animation = 'none';

      const strip      = document.getElementById('_ruleta-strip');
      const targetIdx  = TOTAL_ITEMS + GANADOR_IDX;
      const targetY    = -(targetIdx * ITEM_H) + ITEM_H;

      strip.style.transition = 'transform 3s cubic-bezier(0.17,0.67,0.12,1.0)';
      strip.style.transform  = `translateY(${targetY}px)`;

      setTimeout(() => {
        document.getElementById('_ruleta-reveal').style.display = 'block';
        spinBtn.style.display = 'none';
      }, 3100);
    });

    const cerrar = () => { ov.style.opacity = '0'; ov.style.transition = 'opacity .22s'; setTimeout(() => ov.remove(), 230); };
    setTimeout(() => {
      const ok = document.getElementById('_ruleta-ok');
      if (ok) ok.addEventListener('click', cerrar);
    }, 3200);
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
  }

  /* ─────────────────────────────────────────
     MODAL YA COBRADO HOY
  ───────────────────────────────────────── */
  function mostrarYaCobrado({ racha, semana, rachaFuego, piezas }) {
    if (document.getElementById('_dr-modal')) return;

    const proxDia    = racha >= 7 ? 1 : racha + 1;
    const proxSemana = racha >= 7 ? semana + 1 : semana;
    const proxR      = recompensaDia(proxDia, proxSemana);
    const info       = DIA_INFO[Math.min(racha - 1, 6)];

    const ov = document.createElement('div');
    ov.id = '_dr-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99997;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    ov.innerHTML = `
<div style="background:#16181d;border:1px solid #252830;border-radius:22px;padding:28px 22px 22px;max-width:340px;width:100%;text-align:center;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(34,197,94,.05),transparent 65%);pointer-events:none;"></div>
  <div style="font-size:2.8rem;margin-bottom:12px;">✅</div>
  <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.3rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#e8edf5;margin-bottom:6px;">Ya reclamaste hoy</div>
  <div style="color:#5a6580;font-size:0.82rem;margin-bottom:16px;line-height:1.6;">
    Tu racha es <strong style="color:#f5c518;">${info.emoji} ${racha} días</strong>.
    ${rachaFuego ? '<br><span style="color:#ff6b2b;">🔥 Racha de fuego × 2 activa</span>' : ''}
    <br>Vuelve mañana para seguir.
  </div>
  <div style="background:#0e0f14;border:1px solid #1e2530;border-radius:12px;padding:14px;margin-bottom:12px;">
    <div style="font-size:0.65rem;color:#5a6580;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Próxima recompensa</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:2rem;font-weight:900;color:#f5c518;">+${fmt(proxR)} ${proxDia === 7 ? (proxSemana % 2 !== 0 ? '🎁' : '🎰') : ''}</div>
    <div style="font-size:0.7rem;color:#5a6580;margin-top:2px;">Día ${proxDia} · Semana ${proxSemana}</div>
  </div>
  <div style="background:#0e0f14;border:1px solid #1e2530;border-radius:10px;padding:10px;margin-bottom:16px;">
    <span style="font-size:0.7rem;color:#5a6580;">Piezas: </span>
    ${'🧩'.repeat(Math.min(piezas, 3))}${'⬜'.repeat(Math.max(0, 3 - piezas))}
    <span style="font-size:0.7rem;color:#f5c518;margin-left:6px;">${piezas}/3</span>
  </div>
  <button onclick="this.closest('#_dr-modal').remove()" style="width:100%;padding:12px;background:#1e2530;color:#e8edf5;border:none;border-radius:10px;font-family:'Barlow Condensed',sans-serif;font-size:0.95rem;font-weight:700;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;">Cerrar</button>
</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  /* ─────────────────────────────────────────
     FAB FLOTANTE
  ───────────────────────────────────────── */
  function crearFAB(uid) {
    if (document.getElementById('_dr-fab')) return document.getElementById('_dr-fab');

    const fab = document.createElement('button');
    fab.id    = '_dr-fab';
    fab.title = 'Tap: reclamar · Mantener: ver recompensas';
    fab.innerHTML = '🎁';
    fab.style.cssText = `
      position:fixed;bottom:calc(var(--bn-h,64px) + 16px);left:20px;
      z-index:9990;width:50px;height:50px;
      background:linear-gradient(135deg,#f5c518,#e6b800);
      border:none;border-radius:50%;font-size:1.4rem;cursor:pointer;
      box-shadow:0 4px 18px rgba(245,197,24,.45);
      transition:transform .18s,box-shadow .18s,opacity .18s;
      display:flex;align-items:center;justify-content:center;
    `;

    const dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;top:2px;right:2px;width:10px;height:10px;background:#e63030;border-radius:50%;border:2px solid #0a0a0c;display:none;';
    fab.appendChild(dot);

    fab.addEventListener('mouseenter', () => { fab.style.transform = 'scale(1.1)'; fab.style.boxShadow = '0 6px 24px rgba(245,197,24,.6)'; });
    fab.addEventListener('mouseleave', () => { fab.style.transform = ''; fab.style.boxShadow = '0 4px 18px rgba(245,197,24,.45)'; });

    // Pulsación larga → ir a página de recompensas
    let holdTimer = null;
    let isHolding = false;

    fab.addEventListener('pointerdown', () => {
      isHolding = false;
      holdTimer = setTimeout(() => {
        isHolding = true;
        fab.style.transform = 'scale(0.92)';
        setTimeout(() => { window.location.href = 'rewards-page.html'; }, 120);
      }, 600);
    });

    const cancelHold = () => {
      clearTimeout(holdTimer);
      isHolding = false;
      fab.style.transform = '';
      fab.style.boxShadow = '0 4px 18px rgba(245,197,24,.45)';
    };

    fab.addEventListener('pointerup',    cancelHold);
    fab.addEventListener('pointerleave', cancelHold);

    // Tap normal → reclamar
    fab.addEventListener('click', async () => {
      if (isHolding) return;
      try {
        const est = await obtenerEstado(uid);
        if (est.yaCobro) {
          mostrarYaCobrado(est);
        } else {
          const res = await calcularYDar(uid);
          if (res.estado === 'reclamado') {
            _despacharModal(res);
          }
        }
        dot.style.display = 'none';
      } catch (e) {
        console.error('[DailyReward] FAB error:', e);
      }
    });

    document.body.appendChild(fab);
    return fab;
  }

  /* ─────────────────────────────────────────
     HELPER: decidir qué modal mostrar
  ───────────────────────────────────────── */
  function _despacharModal(res) {
    if (res.semanaCompletada) {
      const args = { semana: res.semana, piezas: res.piezas, bonusMes: res.bonusMes, bonusCantidad: res.bonusCantidad };
      if (res.semana % 2 !== 0) mostrarModalCofre(args);
      else                       mostrarModalRuleta(args);
    } else {
      mostrarModal(res);
    }
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  async function init(uid) {
    if (!uid) return;
    try {
      const fab = crearFAB(uid);
      const dot = fab.querySelector('span');

      const res = await calcularYDar(uid);

      if (res.estado === 'reclamado') {
        setTimeout(() => _despacharModal(res), 700);
        if (dot) dot.style.display = 'none';
      } else {
        // Ya cobró hoy: FAB apagado
        fab.style.opacity = '0.55';
        fab.title = 'Recompensa ya reclamada — vuelve mañana';
        if (dot) dot.style.display = 'none';
      }
    } catch (e) {
      console.error('[DailyReward] init error:', e);
    }
  }

  window.addEventListener('header-ready', async e => {
    if (e.detail?.uid) await init(e.detail.uid);
  }, { once: true });

  if (window._headerReadyFired && window._headerReadyUid) {
    init(window._headerReadyUid);
  }

  return { init, obtenerEstado, canjearPiezas };

})();