/* =============================================================
   assets/js/ranking.js — Winnet (con modal de usuario)
   ============================================================= */

let criterioActual = 'saldo';
let rankingData    = [];
let uidActual      = null;
let cargando       = false;

document.querySelectorAll('.rk-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rk-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    criterioActual = btn.dataset.criterio;
    renderRanking();
  });
});

auth.onAuthStateChanged(user => {
  uidActual = user?.uid || null;
  if (!cargando) cargarRanking();
});

async function cargarRanking() {
  cargando = true;
  const container = document.getElementById('ranking-container');
  container.innerHTML = `<div class="rk-loading"><div class="rk-spinner"></div>Cargando ranking...</div>`;
  try {
    const snapUsuarios = await db.collection('usuarios').orderBy('saldo', 'desc').limit(100).get();
    const usuarios = snapUsuarios.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.username);
    if (!usuarios.length) {
      container.innerHTML = `<div class="rk-empty"><span class="rk-empty-icon">🏆</span><div class="rk-empty-title">Aún no hay usuarios</div></div>`;
      return;
    }
    const chunks = [];
    for (let i = 0; i < usuarios.length; i += 10) chunks.push(usuarios.slice(i, i + 10));
    const statsMap = {};
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async u => {
        try {
          const snap = await db.collection('apuestas').where('usuarioId','==',u.uid).where('estado','in',['ganada','perdida','devuelta']).get();
          let ganadas=0, perdidas=0, devueltas=0, totalApostado=0, totalCobrado=0;
          const apuestas = snap.docs.map(d=>d.data()).sort((a,b)=>(b.fecha?.seconds||0)-(a.fecha?.seconds||0));
          for (const a of apuestas) {
            totalApostado += a.stake||0;
            if (a.estado==='ganada')    { ganadas++;   totalCobrado += a.ganancia||a.potentialWin||0; }
            else if (a.estado==='perdida')  perdidas++;
            else if (a.estado==='devuelta') { devueltas++; totalCobrado += a.stake||0; }
          }
          let r=0;
          for (const a of apuestas) {
            if (a.estado==='ganada')       { if (r>=0) r++; else break; }
            else if (a.estado==='perdida') { if (r<=0) r--; else break; }
          }
          statsMap[u.uid] = { ganadas, perdidas, devueltas, totalApostado, totalCobrado, beneficio: totalCobrado-totalApostado, racha: r, resueltas: ganadas+perdidas, acierto: (ganadas+perdidas)>0 ? Math.round((ganadas/(ganadas+perdidas))*100) : null };
        } catch { statsMap[u.uid] = { ganadas:0,perdidas:0,devueltas:0,totalApostado:0,totalCobrado:0,beneficio:0,racha:0,resueltas:0,acierto:null }; }
      }));
    }
    rankingData = usuarios.map(u => ({ ...u, stats: statsMap[u.uid] || { ganadas:0,perdidas:0,resueltas:0,acierto:null,beneficio:0,racha:0 } }));
    renderRanking();
  } catch (err) {
    container.innerHTML = `<div class="rk-empty"><span class="rk-empty-icon">⚠️</span><div class="rk-empty-title">Error al cargar</div><div style="font-size:0.8rem;margin-top:6px;">${err.message}</div></div>`;
  } finally { cargando = false; }
}

function renderRanking() {
  const container = document.getElementById('ranking-container');
  if (!rankingData.length) return;

  const sorted = [...rankingData].sort((a,b) => {
    switch (criterioActual) {
      case 'saldo':     return (b.saldo||0)-(a.saldo||0);
      case 'beneficio': return (b.stats.beneficio||0)-(a.stats.beneficio||0);
      case 'acierto':
        if (a.stats.resueltas<3) return 1; if (b.stats.resueltas<3) return -1;
        return (b.stats.acierto??-1)-(a.stats.acierto??-1);
      case 'ganadas':   return (b.stats.ganadas||0)-(a.stats.ganadas||0);
      default: return 0;
    }
  });

  const lista = criterioActual==='acierto' ? sorted.filter(u=>u.stats.resueltas>=3) : sorted;

  if (!lista.length) {
    container.innerHTML = `<div class="rk-empty"><span class="rk-empty-icon">📊</span><div class="rk-empty-title">Sin datos suficientes</div><div style="color:var(--texto-dim);font-size:0.82rem;margin-top:6px;">Se necesitan al menos 3 apuestas resueltas.</div></div>`;
    actualizarMiBanner(null); return;
  }

  const top3=lista.slice(0,3), resto=lista.slice(3);
  let html='';

  if (top3.length>=1) {
    const podioOrder = top3.length===1 ? [null,top3[0],null] : top3.length===2 ? [top3[1],top3[0],null] : [top3[1],top3[0],top3[2]];
    const posLabels=['2º','1º','3º'], posClases=['pos-2','pos-1','pos-3'];
    html+=`<div class="podio">`;
    podioOrder.forEach((u,i) => {
      if (!u) { html+=`<div></div>`; return; }
      const esYo=u.uid===uidActual;
      html+=`<div class="podio-item ${posClases[i]} rk-clickable" data-uid="${u.uid}" title="Ver perfil">
        <div class="podio-corona">👑</div>
        <div class="podio-avatar">${(u.username||'?').charAt(0).toUpperCase()}</div>
        <div class="podio-posicion">${posLabels[i]}</div>
        <div class="podio-nombre">${u.username||'Anónimo'}${esYo?' 👤':''}</div>
        <div class="podio-valor">${formatValor(u,criterioActual)}</div>
      </div>`;
    });
    html+=`</div>`;
  }

  if (resto.length) {
    html+=`<div class="rk-divider">Resto del ranking</div><div class="ranking-lista">`;
    resto.forEach((u,i) => {
      const esYo=u.uid===uidActual;
      html+=`<div class="rk-row${esYo?' yo':''} rk-clickable" data-uid="${u.uid}" style="animation-delay:${i*0.03}s;cursor:pointer;">
        <div class="rk-pos">${i+4}º</div>
        <div class="rk-info">
          <div class="rk-avatar">${(u.username||'?').charAt(0).toUpperCase()}</div>
          <div>
            <div class="rk-nombre">${u.username||'Anónimo'}${esYo?'<span class="rk-badge-yo">Tú</span>':''}</div>
            <div class="rk-sub">${buildSubInfo(u)}</div>
          </div>
        </div>
        <div class="rk-valor ${getValorClass(u,criterioActual)}">${formatValor(u,criterioActual)}</div>
      </div>`;
    });
    html+=`</div>`;
  }

  container.innerHTML = html;

  document.querySelectorAll('.rk-clickable').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      if (!uid) return;
      uid === uidActual ? window.location.href='perfil.html' : abrirModalUsuario(uid);
    });
  });

  actualizarMiBanner(lista);
}

/* ═══════════════════════════════════
   MODAL
═══════════════════════════════════ */
function abrirModalUsuario(uid) {
  document.getElementById('rk-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'rk-modal';
  modal.innerHTML = `
    <div class="rk-modal-overlay" id="rk-modal-overlay">
      <div class="rk-modal-box" id="rk-modal-box">
        <div class="rk-modal-header">
          <span class="rk-modal-title">Perfil de usuario</span>
          <button class="rk-modal-close" id="rk-modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="rk-modal-body" id="rk-modal-body">
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 20px;color:#8a8f9e;">
            <div class="rk-spinner"></div>Cargando...
          </div>
        </div>
        <div class="rk-modal-footer">
          <a href="usuario.html?uid=${uid}" class="rk-modal-btn-perfil">
            <i class="fas fa-user"></i> Ver perfil completo
          </a>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('rk-modal-overlay').addEventListener('click', e => { if (e.target.id==='rk-modal-overlay') cerrarModal(); });
  document.getElementById('rk-modal-close').addEventListener('click', cerrarModal);
  document.addEventListener('keydown', function esc(e) { if (e.key==='Escape') { cerrarModal(); document.removeEventListener('keydown',esc); } });
  requestAnimationFrame(() => modal.querySelector('.rk-modal-box').classList.add('open'));
  cargarDatosModal(uid);
}

function cerrarModal() {
  const modal=document.getElementById('rk-modal'); if (!modal) return;
  const box=modal.querySelector('.rk-modal-box');
  box.classList.remove('open'); box.classList.add('closing');
  setTimeout(()=>modal.remove(), 220);
}

async function cargarDatosModal(uid) {
  const body = document.getElementById('rk-modal-body');
  try {
    const snapU = await db.collection('usuarios').doc(uid).get();
    if (!snapU.exists) throw new Error('no existe');
    const ud=snapU.data(), username=ud.username||'Usuario', saldo=parseFloat(ud.saldo||0), esAdmin=ud.rol==='admin';
    const inicial=username.charAt(0).toUpperCase();

    const snapAp = await db.collection('apuestas').where('usuarioId','==',uid).where('estado','in',['ganada','perdida','devuelta']).get();
    const apuestas=snapAp.docs.map(d=>d.data());
    const ganadas=apuestas.filter(a=>a.estado==='ganada'), perdidas=apuestas.filter(a=>a.estado==='perdida');
    const resueltas=ganadas.length+perdidas.length;
    const totalCobrado=ganadas.reduce((s,a)=>s+(a.ganancia||a.potentialWin||0),0);
    const totalApostado=apuestas.reduce((s,a)=>s+(a.stake||0),0);
    const beneficio=totalCobrado-totalApostado;
    const pct=resueltas>0?Math.round((ganadas.length/resueltas)*100):null;

    const snapSeg=await db.collection('seguidores').where('siguiendoA','==',uid).get();
    let numSeg=snapSeg.size;

    let yoLeSigo=false;
    if (uidActual) {
      const snapYo=await db.collection('seguidores').where('seguidor','==',uidActual).where('siguiendoA','==',uid).limit(1).get();
      yoLeSigo=!snapYo.empty;
    }

    body.innerHTML = `
      <div class="rk-modal-identity">
        <div class="rk-modal-avatar">${inicial}</div>
        <div>
          <div class="rk-modal-username">${username}${esAdmin?`<span class="perfil-rol-badge admin" style="margin-left:6px;">Admin</span>`:''}</div>
          <div class="rk-modal-seg"><i class="fas fa-users" style="opacity:.5;font-size:.7rem;margin-right:4px;"></i><strong id="modal-num-seg">${numSeg}</strong> seguidor${numSeg!==1?'es':''}</div>
        </div>
        ${uidActual&&uidActual!==uid?`<button class="btn-seguir ${yoLeSigo?'siguiendo':''}" id="modal-btn-seguir" style="margin-left:auto;">${yoLeSigo?`<i class="fas fa-user-check"></i> Siguiendo`:`<i class="fas fa-user-plus"></i> Seguir`}</button>`:''}
      </div>
      <div class="rk-modal-saldo">
        <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:rgba(34,197,94,0.6);">Saldo</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:1.4rem;font-weight:800;color:#22c55e;">${saldo.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} €</span>
      </div>
      <div class="rk-modal-stats">
        <div class="rk-modal-stat"><span class="rk-modal-stat-val">${apuestas.length}</span><span class="rk-modal-stat-label">Apuestas</span></div>
        <div class="rk-modal-stat"><span class="rk-modal-stat-val" style="color:#22c55e;">${pct!==null?pct+'%':'—'}</span><span class="rk-modal-stat-label">Acierto</span></div>
        <div class="rk-modal-stat"><span class="rk-modal-stat-val" style="color:${beneficio>=0?'#22c55e':'#ff6b6b'};">${beneficio>=0?'+':''}${beneficio.toFixed(0)} €</span><span class="rk-modal-stat-label">Beneficio</span></div>
        <div class="rk-modal-stat"><span class="rk-modal-stat-val" style="color:#f5c518;">${ganadas.length}</span><span class="rk-modal-stat-label">Ganadas</span></div>
      </div>`;

    let _sig=yoLeSigo, _num=numSeg;
    document.getElementById('modal-btn-seguir')?.addEventListener('click', async () => {
      const btn=document.getElementById('modal-btn-seguir'), numEl=document.getElementById('modal-num-seg');
      if (btn) { btn.disabled=true; btn.style.opacity='0.6'; }
      try {
        if (_sig) {
          const s=await db.collection('seguidores').where('seguidor','==',uidActual).where('siguiendoA','==',uid).limit(1).get();
          if (!s.empty) await s.docs[0].ref.delete();
          _num=Math.max(0,_num-1); _sig=false;
          if (numEl) numEl.textContent=_num;
          if (btn) { btn.innerHTML=`<i class="fas fa-user-plus"></i> Seguir`; btn.classList.remove('siguiendo'); }
        } else {
          await db.collection('seguidores').add({ seguidor:uidActual, siguiendoA:uid, fecha:firebase.firestore.FieldValue.serverTimestamp() });
          _num++; _sig=true;
          if (numEl) numEl.textContent=_num;
          if (btn) { btn.innerHTML=`<i class="fas fa-user-check"></i> Siguiendo`; btn.classList.add('siguiendo'); }
        }
      } catch(e){ console.error(e); }
      finally { if(btn){btn.disabled=false;btn.style.opacity='1';} }
    });

  } catch(err) {
    body.innerHTML=`<div style="text-align:center;padding:30px;color:#8a8f9e;">Error al cargar los datos.</div>`;
  }
}

function actualizarMiBanner(lista) {
  const banner=document.getElementById('mi-posicion-banner'), posEl=document.getElementById('mi-pos-num'), valEl=document.getElementById('mi-pos-val');
  if (!uidActual||!lista) { banner?.classList.remove('visible'); return; }
  const miPos=lista.findIndex(u=>u.uid===uidActual);
  if (miPos===-1) { banner?.classList.remove('visible'); return; }
  if(posEl) posEl.textContent=`${miPos+1}º`;
  if(valEl) valEl.textContent=formatValor(lista[miPos],criterioActual);
  banner?.classList.add('visible');
}

function formatValor(u,criterio) {
  switch(criterio) {
    case 'saldo': return `${(u.saldo||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
    case 'beneficio': { const b=u.stats.beneficio||0; return `${b>=0?'+':''}${b.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})} €`; }
    case 'acierto': return u.stats.acierto!==null?`${u.stats.acierto}%`:'—';
    case 'ganadas': return `${u.stats.ganadas||0} ✓`;
    default: return '—';
  }
}
function getValorClass(u,criterio) {
  switch(criterio) {
    case 'saldo': return 'amarillo';
    case 'beneficio': return (u.stats.beneficio||0)>=0?'positivo':'negativo';
    case 'acierto': return 'amarillo';
    case 'ganadas': return 'positivo';
    default: return 'neutro';
  }
}
function buildSubInfo(u) {
  const {ganadas,perdidas,resueltas,racha}=u.stats, parts=[];
  if (resueltas>0) parts.push(`${ganadas}G · ${perdidas}P`);
  if (racha>1) parts.push(`🔥 Racha ${racha}`);
  else if (racha<-1) parts.push(`❄️ Racha ${racha}`);
  return parts.join(' · ')||'Sin apuestas aún';
}