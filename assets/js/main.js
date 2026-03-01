/* =============================================================
   assets/js/main.js
   · Tab EN VIVO: SOLO estados 1H/HT/2H/ET/P con filtro doble
   · Tab HISTORIAL: colección 'historial' + partidos con FT en 'partidos'
   · Tab PRÓXIMOS: solo NS agrupado por fecha y liga
   · Tab FAVORITOS: partidos marcados con corazón por el usuario
   · ANTI-TRAMPAS: cuotas de tarjetas en vivo deshabilitadas visualmente
   ============================================================= */

function removeTildes(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getFecha(p) {
  if (p.timestamp?.toDate) return p.timestamp.toDate();
  if (p.fecha)             return new Date(p.fecha);
  return null;
}

function etiquetaDia(fecha) {
  if (!fecha) return 'Sin fecha';
  const hoy    = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);
  const mismodia = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mismodia(fecha, hoy))    return 'Hoy';
  if (mismodia(fecha, manana)) return 'Mañana';
  return fecha.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function claveDia(fecha) {
  if (!fecha) return Infinity;
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ── Minuto en tiempo real ── */
function calcularMinutoLive(p) {
  if (p.minuto != null) return p.minuto;
  const fecha = getFecha(p);
  if (!fecha) return null;
  const t = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (p.estado === '1H') return Math.min(Math.max(t, 1), 45);
  if (p.estado === 'HT') return 'HT';
  if (p.estado === '2H') return Math.min(Math.max(t - 50, 46), 90);
  if (p.estado === 'ET') return 'ET+';
  if (p.estado === 'P')  return 'PEN';
  return null;
}

window._ticker ??= null;
window._listaVivo ??= [];

function iniciarTicker() {
  if (_ticker) return;
  _ticker = setInterval(() => {
    document.querySelectorAll('[data-badge-vivo]').forEach(badge => {
      const p = _listaVivo.find(x => x.partidoId === badge.dataset.badgeVivo);
      if (!p) return;
      const min = calcularMinutoLive(p);
      if (min === null) return;
      badge.innerHTML = min === 'HT'  ? `<span class="vivo-dot"></span> DESCANSO`
                      : min === 'ET+' ? `<span class="vivo-dot"></span> PRÓRROGA`
                      : min === 'PEN' ? `<span class="vivo-dot"></span> PENALTIS`
                      : `<span class="vivo-dot"></span> ${min}'`;
    });
  }, 30_000);
}

function detenerTicker() {
  if (_ticker) { clearInterval(_ticker); _ticker = null; }
}

/* ── Favoritos: fallback seguro por si no está cargado ── */
const _Fav = {
  btnHtml:     (id) => window.Favoritos ? window.Favoritos.btnHtml(id)     : '',
  getAll:      ()   => window.Favoritos ? window.Favoritos.getAll()         : [],
  toggle:      (id) => window.Favoritos ? window.Favoritos.toggle(id)       : Promise.resolve(),
  esFavorito:  (id) => window.Favoritos ? window.Favoritos.esFavorito(id)   : false,
};

/* ═══════════════════════════════════════════════════════
   VISOR PRINCIPAL
═══════════════════════════════════════════════════════ */
if (document.getElementById('partidos-container')) {

  const ESTADOS_VIVO = ['1H', 'HT', '2H', 'ET', 'P'];

  let tabActual     = 'proximos';
  let ligaActual    = 'todas';
  let listaPartidos = [];
  let unsubscribe   = null;

  /* ── Inicializar Favoritos y escuchar cambios ── */
  if (window.Favoritos && typeof Favoritos.init === 'function') {
    Favoritos.init().then(() => {
      _actualizarBadgeFavoritos();
      if (tabActual === 'favoritos') renderizarPartidos(listaPartidos);
    }).catch(err => console.error('Error inicializando Favoritos:', err));
  } else {
    console.warn('Favoritos no está disponible.');
  }

  if (window.Favoritos && typeof Favoritos.onChange === 'function') {
    Favoritos.onChange(ids => {
      _actualizarBadgeFavoritos();
      if (tabActual === 'favoritos') cargarFavoritos();
    });
  }

  function _actualizarBadgeFavoritos() {
    const badge = document.getElementById('fav-tab-badge');
    if (!badge) return;
    const count = _Fav.getAll().length;
    badge.textContent = count;
    badge.classList.toggle('oculto', count === 0);
  }

  function suscribirPartidos() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    detenerTicker();
    _listaVivo = [];

    const container = document.getElementById('partidos-container');
    if (container) container.innerHTML = `
      <div class="partidos-loading"><div class="partidos-spinner"></div>Cargando partidos...</div>`;

    if (tabActual === 'historial')  { cargarHistorial();  return; }
    if (tabActual === 'favoritos')  { cargarFavoritos();  return; }

    const query = tabActual === 'envivo'
      ? db.collection('partidos').where('estado', 'in', ESTADOS_VIVO)
      : db.collection('partidos').where('estado', '==', 'NS').orderBy('timestamp');

    unsubscribe = query.onSnapshot(snap => {
      let lista = snap.docs.map(d => ({ ...d.data(), partidoId: d.id }));
      if (tabActual === 'envivo') {
        lista = lista.filter(p => ESTADOS_VIVO.includes(p.estado));
        _listaVivo = lista;
        iniciarTicker();
      }
      listaPartidos = lista;
      renderizarPartidos(listaPartidos);
    }, err => {
      const fallback = tabActual === 'envivo'
        ? db.collection('partidos').where('estado', 'in', ESTADOS_VIVO)
        : db.collection('partidos').where('estado', '==', 'NS');
      fallback.onSnapshot(snap => {
        let lista = snap.docs.map(d => ({ ...d.data(), partidoId: d.id }));
        if (tabActual === 'envivo') {
          lista = lista.filter(p => ESTADOS_VIVO.includes(p.estado));
          _listaVivo = lista; iniciarTicker();
        }
        listaPartidos = lista;
        renderizarPartidos(listaPartidos);
      });
    });
  }

  async function cargarFavoritos() {
    const container = document.getElementById('partidos-container');
    const ids = _Fav.getAll();
    if (!ids.length) { listaPartidos = []; renderizarPartidos([]); return; }

    if (container) container.innerHTML = `
      <div class="partidos-loading"><div class="partidos-spinner"></div>Cargando favoritos...</div>`;

    try {
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const todos = [];
      for (const chunk of chunks) {
        for (const col of ['partidos', 'historial']) {
          try {
            const snap = await db.collection(col).where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
            snap.docs.forEach(doc => {
              if (!todos.find(p => p.partidoId === doc.id))
                todos.push({ ...doc.data(), partidoId: doc.id });
            });
          } catch {}
        }
      }
      listaPartidos = todos;
      renderizarPartidos(todos);
    } catch (err) {
      console.error('Error cargando favoritos:', err);
      if (container) container.innerHTML = '<div class="empty">Error al cargar favoritos.</div>';
    }
  }

  async function cargarHistorial() {
    const container = document.getElementById('partidos-container');
    try {
      const [snapH, snapFT] = await Promise.all([
        db.collection('historial').limit(300).get().catch(() => ({ docs: [] })),
        db.collection('partidos').where('estado', '==', 'FT').get().catch(() => ({ docs: [] })),
      ]);
      const vistos = new Set();
      const todos  = [];
      snapH.docs.forEach(doc => { if (!vistos.has(doc.id)) { vistos.add(doc.id); todos.push({ ...doc.data(), partidoId: doc.id }); } });
      snapFT.docs.forEach(doc => { if (!vistos.has(doc.id)) { vistos.add(doc.id); todos.push({ ...doc.data(), partidoId: doc.id }); } });
      listaPartidos = todos;
      renderizarPartidos(listaPartidos);
    } catch (err) {
      console.error('Error historial:', err);
      if (container) container.innerHTML = '<div class="empty">Error al cargar historial.</div>';
    }
  }

  function renderizarPartidos(partidos) {
    const container = document.getElementById('partidos-container');
    if (!container) return;
    const filtrados = ligaActual === 'todas' ? partidos : partidos.filter(p => p.liga === ligaActual);
    if      (tabActual === 'envivo')    container.innerHTML = filtrados.length ? renderEnVivo(filtrados)    : renderVacioEnVivo();
    else if (tabActual === 'historial') container.innerHTML = filtrados.length ? renderHistorial(filtrados) : '<div class="empty">No hay partidos en el historial.</div>';
    else if (tabActual === 'favoritos') container.innerHTML = filtrados.length ? renderFavoritos(filtrados) : renderVacioFavoritos();
    else                                container.innerHTML = filtrados.length ? renderProximos(filtrados)  : '<div class="empty">No hay partidos disponibles.</div>';
    window.BetSlip?.render();
  }

  /* ── EN VIVO ── */
  function renderEnVivo(partidos) {
    const orden = { '1H':0,'2H':1,'ET':2,'P':3,'HT':4 };
    const ords  = [...partidos].sort((a,b) => (orden[a.estado]??9)-(orden[b.estado]??9));
    const grupos = {}, ligas = [];
    ords.forEach(p => {
      const l = p.liga || 'Otras ligas';
      if (!grupos[l]) { grupos[l]=[]; ligas.push(l); }
      grupos[l].push(p);
    });
    return `
      <div class="envivo-header">
        <span class="envivo-titulo-global"><span class="vivo-dot"></span> ${partidos.length} partido${partidos.length!==1?'s':''} en directo</span>
      </div>
      ${ligas.map(l => `
        <div class="seccion-liga">
          <div class="seccion-liga-header"><span class="seccion-liga-titulo">${l}</span><span class="seccion-liga-linea"></span></div>
          ${grupos[l].map(p => cardVivo(p)).join('')}
        </div>`).join('')}`;
  }

  function renderVacioEnVivo() {
    return `<div class="envivo-vacio">
      <div class="envivo-vacio-icon">🔴</div>
      <div class="envivo-vacio-titulo">No hay partidos en directo</div>
      <div class="envivo-vacio-sub">Cuando haya partidos en curso aparecerán aquí automáticamente</div>
    </div>`;
  }

  /* ── FAVORITOS ── */
  function renderFavoritos(partidos) {
    const enVivo    = partidos.filter(p => ESTADOS_VIVO.includes(p.estado));
    const historial = partidos.filter(p => p.estado === 'FT' || p.estado === 'AET' || p.estado === 'PEN');
    const proximos  = partidos.filter(p => !ESTADOS_VIVO.includes(p.estado) && p.estado !== 'FT' && p.estado !== 'AET' && p.estado !== 'PEN');
    let html = `<div class="favoritos-header"><span class="favoritos-titulo-global">♥ ${partidos.length} partido${partidos.length !== 1 ? 's' : ''} en favoritos</span></div>`;
    if (enVivo.length)    { html += `<div class="seccion-fecha"><div class="seccion-fecha-header"><span class="seccion-fecha-titulo">🔴 En directo</span></div>${_agruparPorLiga(enVivo, p => cardVivo(p))}</div>`; }
    if (proximos.length)  { html += `<div class="seccion-fecha"><div class="seccion-fecha-header"><span class="seccion-fecha-titulo">📅 Próximos</span></div>${_agruparPorLiga(proximos, p => cardProximo(p))}</div>`; }
    if (historial.length) { html += `<div class="seccion-fecha"><div class="seccion-fecha-header"><span class="seccion-fecha-titulo">🏁 Finalizados</span></div>${_agruparPorLiga(historial, p => cardHistorial(p))}</div>`; }
    return html;
  }

  function _agruparPorLiga(partidos, cardFn) {
    const grupos = {}, ligas = [];
    partidos.forEach(p => {
      const l = p.liga || 'Otras ligas';
      if (!grupos[l]) { grupos[l] = []; ligas.push(l); }
      grupos[l].push(p);
    });
    return ligas.map(l => `
      <div class="seccion-liga">
        <div class="seccion-liga-header"><span class="seccion-liga-titulo">${l}</span><span class="seccion-liga-linea"></span></div>
        ${grupos[l].map(p => cardFn(p)).join('')}
      </div>`).join('');
  }

  function renderVacioFavoritos() {
    return `<div class="favoritos-vacio">
      <div class="favoritos-vacio-icon">🤍</div>
      <div class="favoritos-vacio-titulo">Sin favoritos todavía</div>
      <div class="favoritos-vacio-sub">Pulsa el corazón ♥ en cualquier partido para guardarlo aquí</div>
    </div>`;
  }

  function cardVivo(p) {
    const min = calcularMinutoLive(p);
    const badgeHTML = p.estado==='HT' ? `<span class="vivo-dot"></span> DESCANSO`
                    : p.estado==='ET' ? `<span class="vivo-dot"></span> PRÓRROGA`
                    : p.estado==='P'  ? `<span class="vivo-dot"></span> PENALTIS`
                    : `<span class="vivo-dot"></span> ${min!==null?min+"'":'EN VIVO'}`;
    const gl = p.golesLocal??0, gv = p.golesVisitante??0;
    let c1='-', cX='-', c2='-';
    if (p.cuotas) {
      c1 = p.cuotas.local     !=null ? parseFloat(p.cuotas.local).toFixed(2)     : '-';
      cX = p.cuotas.empate    !=null ? parseFloat(p.cuotas.empate).toFixed(2)    : '-';
      c2 = p.cuotas.visitante !=null ? parseFloat(p.cuotas.visitante).toFixed(2) : '-';
    }
    const ls = removeTildes((p.local||'').toLowerCase().replace(/\s/g,''));
    const vs = removeTildes((p.visitante||'').toLowerCase().replace(/\s/g,''));
    return `
      <div class="partido-card en-vivo" data-href="partido.html?partidoId=${p.partidoId}" style="cursor:pointer;">
        ${_Fav.btnHtml(p.partidoId)}
        <div class="info-equipos">
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.localLogo||`Equipos/${ls}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span class="${gl>gv?'equipo-ganando':''}">${p.local||'Local'}</span>
          </div>
          <div class="centro">
            <span class="badge-vivo" data-badge-vivo="${p.partidoId}">${badgeHTML}</span>
            <div class="marcador marcador-vivo">
              <span class="${gl>gv?'gol-ganador':''}">${gl}</span>
              <span class="marcador-sep">-</span>
              <span class="${gv>gl?'gol-ganador':''}">${gv}</span>
            </div>
          </div>
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.visitanteLogo||`Equipos/${vs}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span class="${gv>gl?'equipo-ganando':''}">${p.visitante||'Visitante'}</span>
          </div>
        </div>
        <div class="cuotas cuotas-futbol cuotas-bloqueadas">
          <div class="cuota cuota-vivo-bloqueada" title="No se aceptan apuestas en partidos en vivo">
            <div class="nombre-equipo-cuota">${p.local||'Local'}</div>
            <div class="valor-cuota cuota-vivo-lock">${c1 !== '-' ? c1 : '—'} 🔒</div>
          </div>
          <div class="cuota cuota-vivo-bloqueada" title="No se aceptan apuestas en partidos en vivo">
            <div class="nombre-equipo-cuota">Empate</div>
            <div class="valor-cuota cuota-vivo-lock">${cX !== '-' ? cX : '—'} 🔒</div>
          </div>
          <div class="cuota cuota-vivo-bloqueada" title="No se aceptan apuestas en partidos en vivo">
            <div class="nombre-equipo-cuota">${p.visitante||'Visitante'}</div>
            <div class="valor-cuota cuota-vivo-lock">${c2 !== '-' ? c2 : '—'} 🔒</div>
          </div>
        </div>
        <div class="cuotas-vivo-aviso">🔒 Apuestas cerradas durante el partido</div>
      </div>`;
  }

  /* ── HISTORIAL ── */
  function renderHistorial(partidos) {
    const ords = [...partidos].sort((a,b) => { const fa=getFecha(a),fb=getFecha(b); if(!fa&&!fb)return 0; if(!fa)return 1; if(!fb)return -1; return fb-fa; });
    const grupoDia={}, ordenDias=[];
    ords.forEach(p => {
      const f=getFecha(p), key=`${claveDia(f)}___${etiquetaDia(f)}`;
      if(!grupoDia[key]){grupoDia[key]={clave:claveDia(f),etiq:etiquetaDia(f),partidos:[]};ordenDias.push(key);}
      grupoDia[key].partidos.push(p);
    });
    ordenDias.sort((a,b)=>grupoDia[b].clave-grupoDia[a].clave);
    return ordenDias.map(key => {
      const {etiq,partidos:psDia}=grupoDia[key];
      const gL={},oL=[];
      psDia.forEach(p=>{const l=p.liga||'Otras ligas';if(!gL[l]){gL[l]=[];oL.push(l);}gL[l].push(p);});
      return `
        <div class="seccion-fecha">
          <div class="seccion-fecha-header"><span class="seccion-fecha-titulo">${etiq}</span></div>
          ${oL.map(l=>`
            <div class="seccion-liga">
              <div class="seccion-liga-header"><span class="seccion-liga-titulo">${l}</span><span class="seccion-liga-linea"></span></div>
              ${gL[l].map(p=>cardHistorial(p)).join('')}
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  function cardHistorial(p) {
    const gl=p.golesLocal??0, gv=p.golesVisitante??0;
    const fecha=getFecha(p);
    const hora=fecha?fecha.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'--:--';
    const ls=removeTildes((p.local||'').toLowerCase().replace(/\s/g,''));
    const vs=removeTildes((p.visitante||'').toLowerCase().replace(/\s/g,''));
    return `
      <div class="partido-card terminado" data-href="partido.html?partidoId=${p.partidoId}" style="cursor:pointer;">
        ${_Fav.btnHtml(p.partidoId)}
        <div class="info-equipos">
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.localLogo||`Equipos/${ls}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span class="${gl>gv?'equipo-ganador-hist':gv>gl?'equipo-perdedor-hist':''}">${p.local||'Local'}</span>
          </div>
          <div class="centro">
            <div class="resultado-ft">
              <span class="ft-label">FT</span>
              <div class="marcador marcador-final">
                <span class="${gl>gv?'gol-ganador':''}">${gl}</span>
                <span class="marcador-sep">-</span>
                <span class="${gv>gl?'gol-ganador':''}">${gv}</span>
              </div>
              <span class="ft-hora">${hora}</span>
            </div>
          </div>
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.visitanteLogo||`Equipos/${vs}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span class="${gv>gl?'equipo-ganador-hist':gl>gv?'equipo-perdedor-hist':''}">${p.visitante||'Visitante'}</span>
          </div>
        </div>
      </div>`;
  }

  /* ── PRÓXIMOS ── */
  function renderProximos(partidos) {
    const ords=[...partidos].sort((a,b)=>{const fa=getFecha(a),fb=getFecha(b);if(!fa&&!fb)return 0;if(!fa)return 1;if(!fb)return -1;return fa-fb;});
    const gD={},oD=[];
    ords.forEach(p=>{const f=getFecha(p),key=`${claveDia(f)}___${etiquetaDia(f)}`;if(!gD[key]){gD[key]={clave:claveDia(f),etiq:etiquetaDia(f),partidos:[]};oD.push(key);}gD[key].partidos.push(p);});
    oD.sort((a,b)=>gD[a].clave-gD[b].clave);
    return oD.map(key=>{
      const {etiq,partidos:psDia}=gD[key];
      const gL={},oL=[];
      psDia.forEach(p=>{const l=p.liga||'Otras ligas';if(!gL[l]){gL[l]=[];oL.push(l);}gL[l].push(p);});
      return `
        <div class="seccion-fecha">
          <div class="seccion-fecha-header"><span class="seccion-fecha-titulo">${etiq}</span></div>
          ${oL.map(l=>`
            <div class="seccion-liga">
              <div class="seccion-liga-header"><span class="seccion-liga-titulo">${l}</span><span class="seccion-liga-linea"></span></div>
              ${gL[l].map(p=>cardProximo(p)).join('')}
            </div>`).join('')}
        </div>`;
    }).join('');
  }

  /* ── cardProximo: las cuotas usan <button> en lugar de <div>
        para que el área clickable sea semántica y no haya
        ambigüedad con el click del card padre              ── */
  function cardProximo(p) {
    const hora=getFecha(p)?.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})||'--:--';
    let c1='-',cX='-',c2='-';
    if(p.cuotas){
      c1=p.cuotas.local     !=null?parseFloat(p.cuotas.local).toFixed(2):'-';
      cX=p.cuotas.empate    !=null?parseFloat(p.cuotas.empate).toFixed(2):'-';
      c2=p.cuotas.visitante !=null?parseFloat(p.cuotas.visitante).toFixed(2):'-';
    }
    const ls=removeTildes((p.local||'').toLowerCase().replace(/\s/g,''));
    const vs=removeTildes((p.visitante||'').toLowerCase().replace(/\s/g,''));

    /* ── Usamos data-cuota-area en el wrapper y <button> para cada cuota ── */
    return `
      <div class="partido-card" data-href="partido.html?partidoId=${p.partidoId}" style="cursor:pointer;">
        ${_Fav.btnHtml(p.partidoId)}
        <div class="info-equipos">
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.localLogo||`Equipos/${ls}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span>${p.local||'Local'}</span>
          </div>
          <div class="centro"><div class="hora">${hora}</div></div>
          <div class="equipo">
            <div class="escudo-wrapper"><img src="${p.visitanteLogo||`Equipos/${vs}.png`}" alt="" onerror="this.style.display='none'"></div>
            <span>${p.visitante||'Visitante'}</span>
          </div>
        </div>
        <div class="cuotas cuotas-futbol" data-cuota-area>
          <button class="cuota cuota-btn-wrap ${c1==='-'?'sin-cuota':''}"
            data-partido="${p.local} vs ${p.visitante}"
            data-tipo="${p.local}"
            data-mercado="resultado"
            data-partidoid="${p.partidoId}"
            data-cuota="${c1}"
            type="button">
            <span class="nombre-equipo-cuota">${p.local||'Local'}</span>
            <span class="valor-cuota">${c1}</span>
          </button>
          <button class="cuota cuota-btn-wrap ${cX==='-'?'sin-cuota':''}"
            data-partido="${p.local} vs ${p.visitante}"
            data-tipo="Empate"
            data-mercado="resultado"
            data-partidoid="${p.partidoId}"
            data-cuota="${cX}"
            type="button">
            <span class="nombre-equipo-cuota">Empate</span>
            <span class="valor-cuota">${cX}</span>
          </button>
          <button class="cuota cuota-btn-wrap ${c2==='-'?'sin-cuota':''}"
            data-partido="${p.local} vs ${p.visitante}"
            data-tipo="${p.visitante}"
            data-mercado="resultado"
            data-partidoid="${p.partidoId}"
            data-cuota="${c2}"
            type="button">
            <span class="nombre-equipo-cuota">${p.visitante||'Visitante'}</span>
            <span class="valor-cuota">${c2}</span>
          </button>
        </div>
      </div>`;
  }

  /* ── Tabs ── */
  document.querySelectorAll('.p-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.p-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tabActual = btn.dataset.tab;
      suscribirPartidos();
    })
  );

  /* ── Filtro liga ── */
  document.querySelectorAll('.liga-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.liga-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ligaActual = btn.dataset.liga;
      renderizarPartidos(listaPartidos);
    })
  );

  /* ══════════════════════════════════════════════════════
     CLICK DELEGADO — lógica robusta y sin ambigüedad
     Prioridad: 1) cuotas bloqueadas (vivo)
                2) botón favorito
                3) botón de cuota (cuota-btn-wrap)
                4) navegación al partido
     ══════════════════════════════════════════════════════ */
  document.getElementById('partidos-container').addEventListener('click', e => {

    /* 1 · Zona de cuotas bloqueadas (en vivo) — absorber sin navegar */
    if (e.target.closest('[data-cuota-area] .cuota-vivo-bloqueada') ||
        e.target.closest('.cuotas-bloqueadas') ||
        e.target.closest('.cuotas-vivo-aviso')) {
      e.stopPropagation();
      return;
    }

    /* 2 · Botón favorito — absorber sin navegar */
    if (e.target.closest('.fav-btn')) {
      e.stopPropagation();
      return;
    }

    /* 3 · Botón de cuota (cuota-btn-wrap) — añadir al carrito sin navegar */
    const btnCuota = e.target.closest('.cuota-btn-wrap');
    if (btnCuota) {
      e.stopPropagation();
      e.preventDefault();
      if (btnCuota.classList.contains('sin-cuota')) return; // cuota no disponible
      const cuota = btnCuota.dataset.cuota;
      if (!cuota || cuota === '-') return;
      window.BetSlip.addBet({
        partido:   btnCuota.dataset.partido,
        tipo:      btnCuota.dataset.tipo,
        cuota:     cuota,
        partidoId: btnCuota.dataset.partidoid,
        mercado:   btnCuota.dataset.mercado || 'resultado',
      });
      return;
    }

    /* 4 · Click en el área general del card → navegar al partido */
    const card = e.target.closest('.partido-card');
    if (card?.dataset.href) {
      window.location.href = card.dataset.href;
    }
  });

  /* ── Goleadores (delegado global) ── */
  document.addEventListener('click', e => {
    const div = e.target.closest('.goleador-opcion');
    if (!div) return;
    window.BetSlip.addBet({
      partido:   div.dataset.partido,
      tipo:      div.dataset.jugador,
      cuota:     div.dataset.cuota,
      partidoId: div.dataset.partidoid,
      mercado:   'goleadores',
    });
  });

  suscribirPartidos();
}

/* ── Service Worker ── */
if ('serviceWorker' in navigator && !window.__swRegistered) {
  window.__swRegistered = true;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}