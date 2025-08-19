// ========== UTILS SOLO PARA PARTIDO ==========
function removeTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ========== OBTENER partidoId DE LA URL ==========
const params = new URLSearchParams(location.search);
const partidoId = params.get('partidoId');

// ========== FIREBASE ==========
if (typeof firebase === "undefined") {
  throw new Error('Firebase no está disponible');
}

// ========== CARGA DE DATOS DEL PARTIDO ==========
const detalleDiv = document.getElementById('detalle-partido');
let partidoInfo = null;

async function cargarPartidoYMercados() {
  if (!partidoId) {
    detalleDiv.innerHTML = "<div style='color:#b71c1c;font-weight:bold'>No se especificó partido.</div>";
    return;
  }
  try {
    const doc = await db.collection('partidos').doc(partidoId).get();
    if (!doc.exists) {
      detalleDiv.innerHTML = "<div style='color:#b71c1c;font-weight:bold'>Partido no encontrado.</div>";
      return;
    }
    partidoInfo = doc.data();
    partidoInfo.partidoId = partidoId;
    renderizarPartido(partidoInfo);
  } catch (e) {
    detalleDiv.innerHTML = "<div style='color:#b71c1c;font-weight:bold'>Error cargando partido.</div>";
  }
}
cargarPartidoYMercados();

// ========== RENDER PARTIDO Y MERCADOS ==========
function renderizarPartido(partido) {
  let escudo1 = `Equipos/${removeTildes(partido.equipo1.toLowerCase().replace(/\s/g, ''))}.png`;
  let escudo2 = `Equipos/${removeTildes(partido.equipo2.toLowerCase().replace(/\s/g, ''))}.png`;
  let nombre = `${partido.equipo1} vs ${partido.equipo2}`;
  let fechaHora = partido.fecha ? `${partido.fecha} ${partido.hora || ''}` : '';
  let deporte = partido.deporte || "";
  let mercados = partido.mercados || {};

  detalleDiv.innerHTML = `
    <div class="partido-header">
      <img src="${escudo1}" class="escudo" alt="${partido.equipo1}" />
      <div class="partido-info">
        <div>${nombre}</div>
        <div>${deporte} | ${fechaHora}</div>
      </div>
      <img src="${escudo2}" class="escudo" alt="${partido.equipo2}" />
    </div>
    <div id="mercados-partido"></div>
  `;
  renderizarMercados(mercados, partido);
}

function renderizarMercados(mercados, partido) {
  const mercadosDiv = document.getElementById('mercados-partido');
  mercadosDiv.innerHTML = '';

  // Mercado 1X2 (Fútbol/Baloncesto/Tenis)
  if (mercados.resultado && Array.isArray(mercados.resultado.opciones)) {
    let deporte = (partido.deporte || "").toLowerCase();
    let cuotasHTML = '';
    if (deporte === "futbol") {
      let cuota1 = mercados.resultado.opciones.find(opt => opt.valor === "1")?.cuota ?? "-";
      let cuotaX = mercados.resultado.opciones.find(opt => opt.valor === "X")?.cuota ?? "-";
      let cuota2 = mercados.resultado.opciones.find(opt => opt.valor === "2")?.cuota ?? "-";
      cuotasHTML = `
        <div class="cuota">
          <div class="nombre-equipo-cuota">${partido.equipo1}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${partido.equipo1}"
            data-cuota="${cuota1}"
            data-partidoid="${partido.partidoId}">
            ${typeof cuota1 === "number" ? cuota1.toFixed(2) : cuota1}
          </div>
        </div>
        <div class="cuota">
          <div class="nombre-equipo-cuota">Empate</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="Empate"
            data-cuota="${cuotaX}"
            data-partidoid="${partido.partidoId}">
            ${typeof cuotaX === "number" ? cuotaX.toFixed(2) : cuotaX}
          </div>
        </div>
        <div class="cuota">
          <div class="nombre-equipo-cuota">${partido.equipo2}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${partido.equipo2}"
            data-cuota="${cuota2}"
            data-partidoid="${partido.partidoId}">
            ${typeof cuota2 === "number" ? cuota2.toFixed(2) : cuota2}
          </div>
        </div>
      `;
      mercadosDiv.innerHTML += `
        <div class="mercado-block">
          <div class="mercado-header">
            <span>Resultado</span>
            <span class="flecha">&#x25BC;</span>
          </div>
          <div class="mercado-content">
            <div class="cuotas cuotas-futbol">${cuotasHTML}</div>
          </div>
        </div>
      `;
    } else if (deporte === "baloncesto" || deporte === "tenis") {
      let cuota1 = mercados.resultado.opciones.find(opt => opt.valor === "1")?.cuota ?? "-";
      let cuota2 = mercados.resultado.opciones.find(opt => opt.valor === "2")?.cuota ?? "-";
      cuotasHTML = `
        <div class="cuota">
          <div class="nombre-equipo-cuota">${partido.equipo1}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${partido.equipo1}"
            data-cuota="${cuota1}"
            data-partidoid="${partido.partidoId}">
            ${typeof cuota1 === "number" ? cuota1.toFixed(2) : cuota1}
          </div>
        </div>
        <div class="cuota cuota-derecha">
          <div class="nombre-equipo-cuota">${partido.equipo2}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${partido.equipo2}"
            data-cuota="${cuota2}"
            data-partidoid="${partido.partidoId}">
            ${typeof cuota2 === "number" ? cuota2.toFixed(2) : cuota2}
          </div>
        </div>
      `;
      let claseCuotas = deporte === "baloncesto" ? "cuotas-baloncesto" : "cuotas-tenis";
      mercadosDiv.innerHTML += `
        <div class="mercado-block">
          <div class="mercado-header">
            <span>Ganador</span>
            <span class="flecha">&#x25BC;</span>
          </div>
          <div class="mercado-content">
            <div class="cuotas ${claseCuotas}">${cuotasHTML}</div>
          </div>
        </div>
      `;
    }
  }

  // Mercado Goleadores
  if (mercados.goleadores && Array.isArray(mercados.goleadores.opciones) && mercados.goleadores.opciones.length) {
    let html = `<div class="mercado-block">
      <div class="mercado-header">
        <span>Goleadores</span>
        <span class="flecha">&#x25BC;</span>
      </div>
      <div class="mercado-content">
        <div class="goleadores-lista">`;
    mercados.goleadores.opciones.forEach(gol => {
      html += `
        <div class="goleador-opcion"
          data-partido="${partido.equipo1} vs ${partido.equipo2}"
          data-jugador="${gol.nombre}"
          data-cuota="${gol.cuota}"
          data-partidoid="${partido.partidoId}">
          <span class="nombre-goleador">${gol.nombre}</span>
          <span class="cuota-goleador">${gol.cuota}</span>
        </div>
      `;
    });
    html += `</div></div></div>`;
    mercadosDiv.innerHTML += html;
  }

  // --- Doble Oportunidad ---
  if (mercados.dobleOportunidad && Array.isArray(mercados.dobleOportunidad.opciones) && mercados.dobleOportunidad.opciones.length) {
    let html = `<div class="mercado-block">
      <div class="mercado-header">
        <span>Doble Oportunidad</span>
        <span class="flecha">&#x25BC;</span>
      </div>
      <div class="mercado-content">
        <div class="cuotas doble-oportunidad-lista">`;
  
    mercados.dobleOportunidad.opciones.forEach(opt => {
      let label = opt.nombre;
      if (label === "1X") label = `${partido.equipo1} o Empate`;
      else if (label === "X2") label = `Empate o ${partido.equipo2}`;
      else if (label === "12") label = `${partido.equipo1} o ${partido.equipo2}`;
  
      html += `
        <div class="cuota">
          <div class="nombre-equipo-cuota">${label}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${label}"
            data-cuota="${opt.cuota}"
            data-partidoid="${partido.partidoId}"
            data-mercado="doble-oportunidad"
          >
            ${typeof opt.cuota === "number" ? opt.cuota.toFixed(2) : opt.cuota}
          </div>
        </div>
      `;
    });
  
    html += `</div></div></div>`;
    mercadosDiv.innerHTML += html;
  }

  // --- Ambos Marcan ---
  if (mercados.ambosMarcan && Array.isArray(mercados.ambosMarcan.opciones) && mercados.ambosMarcan.opciones.length) {
    let segmentos = [...new Set(mercados.ambosMarcan.opciones.map(opt => opt.segmento))];
    let html = `<div class="mercado-block">
      <div class="mercado-header">
        <span>Ambos Marcan</span>
        <span class="flecha">&#x25BC;</span>
      </div>
      <div class="mercado-content">
        ${segmentos.map(seg =>
          `<div class="ambos-marcan-segmento">
            <div class="ambos-marcan-titulo">${seg}</div>
            <div class="cuotas ambos-marcan-lista">
              ${
                mercados.ambosMarcan.opciones
                  .filter(opt => opt.segmento === seg)
                  .map(opt => `
                    <div class="cuota">
                      <div class="nombre-equipo-cuota">${opt.tipo}</div>
                      <div class="valor-cuota cuota-btn"
                        data-partido="${partido.equipo1} vs ${partido.equipo2}"
                        data-tipo="${opt.segmento} - ${opt.tipo}"
                        data-cuota="${opt.cuota}"
                        data-partidoid="${partido.partidoId}"
                        data-mercado="ambos-marcan"
                      >${typeof opt.cuota === "number" ? opt.cuota.toFixed(2) : opt.cuota}</div>
                    </div>
                  `).join('')
              }
            </div>
          </div>`
        ).join('')}
      </div>
    </div>`;
    mercadosDiv.innerHTML += html;
  }

  // --- Goles Impar/Par ---
  if (mercados.golesImparPar && Array.isArray(mercados.golesImparPar.opciones) && mercados.golesImparPar.opciones.length) {
    let segmentos = [...new Set(mercados.golesImparPar.opciones.map(opt => opt.segmento))];
    let html = `<div class="mercado-block">
      <div class="mercado-header">
        <span>Goles Impar/Par</span>
        <span class="flecha">&#x25BC;</span>
      </div>
      <div class="mercado-content">
        ${segmentos.map(seg =>
          `<div class="goles-imparpar-segmento">
            <div class="goles-imparpar-titulo">${seg}</div>
            <div class="cuotas goles-imparpar-lista">
              ${
                mercados.golesImparPar.opciones
                  .filter(opt => opt.segmento === seg)
                  .map(opt => `
                    <div class="cuota">
                      <div class="nombre-equipo-cuota">${opt.tipo}</div>
                      <div class="valor-cuota cuota-btn"
                        data-partido="${partido.equipo1} vs ${partido.equipo2}"
                        data-tipo="${opt.segmento} - ${opt.tipo}"
                        data-cuota="${opt.cuota}"
                        data-partidoid="${partido.partidoId}"
                        data-mercado="goles-imparpar"
                      >${typeof opt.cuota === "number" ? opt.cuota.toFixed(2) : opt.cuota}</div>
                    </div>
                  `).join('')
              }
            </div>
          </div>`
        ).join('')}
      </div>
    </div>`;
    mercadosDiv.innerHTML += html;
  }

  // MERCADO TARJETAS AVANZADO
  if (
    mercados.tarjetas &&
    mercados.tarjetas.opciones &&
    typeof mercados.tarjetas.opciones === "object"
  ) {
    mercadosDiv.innerHTML += renderDesplegableTarjetas(mercados.tarjetas.opciones, partido);
  }

  // MERCADO CORNERS AVANZADO
  if (
    mercados.corners &&
    mercados.corners.opciones &&
    typeof mercados.corners.opciones === "object"
  ) {
    mercadosDiv.innerHTML += renderDesplegableCorners(mercados.corners.opciones, partido);
  }

  // Mercado Corners (simple - array)
  if (mercados.corners && Array.isArray(mercados.corners.opciones) && mercados.corners.opciones.length) {
    let html = `<div class="mercado-block">
      <div class="mercado-header">
        <span>Corners</span>
        <span class="flecha">&#x25BC;</span>
      </div>
      <div class="mercado-content">
        <div class="cuotas corners-lista">`;
    mercados.corners.opciones.forEach(opt => {
      html += `
        <div class="cuota">
          <div class="nombre-equipo-cuota">${opt.nombre}</div>
          <div class="valor-cuota cuota-btn"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${opt.nombre}"
            data-cuota="${opt.cuota}"
            data-partidoid="${partido.partidoId}">
            ${typeof opt.cuota === "number" ? opt.cuota.toFixed(2) : opt.cuota}
          </div>
        </div>
      `;
    });
    html += `</div></div></div>`;
    mercadosDiv.innerHTML += html;
  }

  asignarDesplegablesMercados();
  asignarEventosCuotasYMercados();
}

// ========== RENDER DESPLEGABLE TARJETAS AVANZADO ==========
function renderDesplegableTarjetas(tarjetasObj, partido) {
  // Configuración igual que en el admin
  const segmentos = [
    { id: 'primera', label: '1ª Mitad' },
    { id: 'segunda', label: '2ª Mitad' },
    { id: 'encuentro', label: 'Encuentro' }
  ];
  const equipos = [
    { id: 'equipo1', label: partido.equipo1 },
    { id: 'equipo2', label: partido.equipo2 },
    { id: 'ambos', label: "Ambos equipos" }
  ];
  const columnas = [
    { id: 'mas', label: 'Más de' },
    { id: 'exactamente', label: 'Exactamente' },
    { id: 'menos', label: 'Menos de' }
  ];
  // Detecta número de filas (tarjetas) automáticamente del primer segmento/equipo
  let filas = [];
  for (let seg of Object.values(tarjetasObj)) {
    for (let eq of Object.values(seg)) {
      filas = Object.keys(eq).map(n=>parseInt(n)).filter(n=>!isNaN(n));
      filas.sort((a,b)=>a-b);
      break;
    }
    if(filas.length) break;
  }

  let html = `<div class="mercado-block">
    <div class="mercado-header">
      <span>Tarjetas</span>
      <span class="flecha">&#x25BC;</span>
    </div>
    <div class="mercado-content">
      <div class="tarjetas-tabs" style="display:flex;gap:8px;margin-bottom:8px;">`;

  segmentos.forEach((seg, i) => {
    html += `<button type="button" class="tab-seg${i===0?' active':''}" data-seg="${seg.id}">${seg.label}</button>`;
  });

  html += `</div>
  <div class="tarjetas-subtabs" style="display:flex;gap:8px;margin-bottom:12px;">`;

  equipos.forEach((eq, j) => {
    html += `<button type="button" class="tab-eq${j===0?' active':''}" data-eq="${eq.id}">${eq.label}</button>`;
  });

  html += `</div>
  <div id="tarjetas-tabla-container"></div>
  </div>
  </div>`;

  // Tabla inicial (primera pestaña)
  setTimeout(() => renderTarjetasTabla(tarjetasObj, segmentos[0].id, equipos[0].id, columnas, filas, partido), 0);

  // Eventos para tabs
  setTimeout(() => {
    const mercadoBloque = document.querySelector('.mercado-block .mercado-content');
    if (!mercadoBloque) return;

    let currentSeg = segmentos[0].id;
    let currentEq = equipos[0].id;

    function activarTab(segId, eqId) {
      // Cambia pestañas
      mercadoBloque.querySelectorAll('.tarjetas-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.seg === segId);
      });
      mercadoBloque.querySelectorAll('.tarjetas-subtabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.eq === eqId);
      });
      renderTarjetasTabla(tarjetasObj, segId, eqId, columnas, filas, partido);
      currentSeg = segId;
      currentEq = eqId;
    }

    mercadoBloque.querySelectorAll('.tarjetas-tabs button').forEach(btn => {
      btn.onclick = () => activarTab(btn.dataset.seg, currentEq);
    });
    mercadoBloque.querySelectorAll('.tarjetas-subtabs button').forEach(btn => {
      btn.onclick = () => activarTab(currentSeg, btn.dataset.eq);
    });
  }, 0);

  return html;
}


function renderTarjetasTabla(tarjetasObj, segId, eqId, columnas, filas, partido) {
  const tablaCont = document.querySelector('.mercado-block .mercado-content #tarjetas-tabla-container');
  if (!tablaCont) return;
  let eqObj = tarjetasObj[segId]?.[eqId] || {};
  let html = `<table class="tarjetas-table"><thead><tr><th></th>`;
  columnas.forEach(col => html += `<th>${col.label}</th>`);
  html += "</tr></thead><tbody>";

  filas.forEach(n => {
    const tieneDatos = columnas.some(col => {
      let cuota = eqObj[n]?.[col.id];
      return cuota !== null && cuota !== undefined && cuota !== "";
    });

    if (!tieneDatos) return; // ❌ No hay datos → saltar esta fila

    html += `<tr><td>${n}</td>`;
    columnas.forEach(col => {
      let cuota = eqObj[n]?.[col.id];
      if (cuota === null || cuota === undefined || cuota === "") {
        html += `<td><div class="cuota cuota-btn cuota-tarjeta-disabled" style="pointer-events:none;opacity:.5;">-</div></td>`;
      } else {
        html += `<td>
          <div class="cuota cuota-btn cuota-tarjeta"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${col.label} ${n} ${n===1?"tarjeta":"tarjetas"} (${col.label} - ${n}) - ${getSegmentoLabel(segId)} - ${(eqId==='equipo1')?partido.equipo1:(eqId==='equipo2'?partido.equipo2:"Ambos equipos")}"
            data-cuota="${cuota}"
            data-partidoid="${partido.partidoId}"
            data-mercado="tarjetas"
          >${typeof cuota === "number" ? cuota.toFixed(2) : cuota}</div>
        </td>`;
      }
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  tablaCont.innerHTML = html;

  // Vuelve a asignar eventos para cuotas-boton de tarjetas
  document.querySelectorAll('.cuota-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      if (typeof window.addBetToSlip === "function") {
        let mercado = 'tarjetas';
        window.addBetToSlip({
          partido: btn.dataset.partido,
          tipo: btn.dataset.tipo,
          cuota: btn.dataset.cuota,
          partidoId: btn.dataset.partidoid,
          mercado
        });
      }
    });
  });
}


function renderDesplegableCorners(cornersObj, partido) {
  const segmentos = [
    { id: 'encuentro', label: 'Encuentro' },
    { id: 'primera', label: '1ª Mitad' },
    { id: 'segunda', label: '2ª Mitad' }
  ];
  const equipos = [
    { id: 'ambos', label: "Ambos equipos" },
    { id: 'equipo1', label: partido.equipo1 },
    { id: 'equipo2', label: partido.equipo2 }
  ];
  const columnas = [
    { id: 'mas', label: 'Más de' },
    { id: 'exactamente', label: 'Exactamente' },
    { id: 'menos', label: 'Menos de' }
  ];
  // Filas de 4 a 17
  let filas = Array.from({length: 14}, (_, i) => i + 4);

  let html = `<div class="mercado-block">
    <div class="mercado-header">
      <span>Corners</span>
      <span class="flecha">&#x25BC;</span>
    </div>
    <div class="mercado-content">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold" for="select-corner-segmento"></label>
        <select id="select-corner-segmento" style="padding:6px 9px;border-radius:5px;font-weight:600;color:white;background-color:#222;">
          ${segmentos.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}
        </select>
        <label style="font-weight:bold" for="select-corner-equipo"></label>
        <select id="select-corner-equipo" style="padding:6px 9px;border-radius:5px;font-weight:600;color:white;background-color:#222;">
          ${equipos.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}
        </select>
      </div>
      <div id="corners-tabla-container"></div>
    </div>
  </div>`;

  setTimeout(() => renderCornersTabla(cornersObj, segmentos[0].id, equipos[0].id, columnas, filas, partido), 0);

  setTimeout(() => {
    const selectSeg = document.getElementById('select-corner-segmento');
    const selectEq = document.getElementById('select-corner-equipo');
    if (!selectSeg || !selectEq) return;
    function actualizar() {
      renderCornersTabla(cornersObj, selectSeg.value, selectEq.value, columnas, filas, partido);
    }
    selectSeg.onchange = actualizar;
    selectEq.onchange = actualizar;
  }, 0);

  return html;
}

function renderCornersTabla(cornersObj, segId, eqId, columnas, filas, partido) {
  const tablaCont = document.querySelector('.mercado-block .mercado-content #corners-tabla-container');
  if (!tablaCont) return;
  let eqObj = cornersObj[segId]?.[eqId] || {};
  let html = `<table class="tarjetas-table" style="width:100%;table-layout:fixed;"><thead><tr><th style="width:19%"></th>`;
  let colWidth = (81 / columnas.length).toFixed(2);
  columnas.forEach(col => html += `<th style="width:${colWidth}%">${col.label}</th>`);
  html += "</tr></thead><tbody>";
  filas.forEach(n => {
    html += `<tr><td>${n}</td>`;
    columnas.forEach(col => {
      let cuota = eqObj[n]?.[col.id];
      if (cuota === null || cuota === undefined || cuota === "") {
        html += `<td><div class="cuota cuota-btn cuota-corner-disabled" style="pointer-events:none;opacity:.5;">-</div></td>`;
      } else {
        html += `<td>
          <div class="cuota cuota-btn cuota-corner"
            data-partido="${partido.equipo1} vs ${partido.equipo2}"
            data-tipo="${col.label} ${n} ${n===1?"corner":"corners"} (${col.label} - ${n}) - ${segId} - ${(eqId==='equipo1')?partido.equipo1:(eqId==='equipo2'?partido.equipo2:"Ambos equipos")}"
            data-cuota="${cuota}"
            data-partidoid="${partido.partidoId}"
            data-mercado="corners"
          >${typeof cuota === "number" ? cuota.toFixed(2) : cuota}</div>
        </td>`;
      }
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  tablaCont.innerHTML = html;

  document.querySelectorAll('.cuota-btn.cuota-corner').forEach(btn => {
    btn.addEventListener('click', function () {
      if (typeof window.addBetToSlip === "function") {
        let mercado = 'corners';
        window.addBetToSlip({
          partido: btn.dataset.partido,
          tipo: btn.dataset.tipo,
          cuota: btn.dataset.cuota,
          partidoId: btn.dataset.partidoid,
          mercado
        });
      }
    });
  });
}


// ========== DESPLEGABLES DE MERCADO ==========
function asignarDesplegablesMercados() {
  document.querySelectorAll('.mercado-header').forEach(header => {
    header.addEventListener('click', function() {
      const bloque = header.closest('.mercado-block');
      bloque.classList.toggle('open');
    });
  });
  // Por defecto, abre el primero
  const primerBloque = document.querySelector('.mercado-block');
  if (primerBloque) primerBloque.classList.add('open');
}

// ========== AÑADIR APUESTA AL SLIP GLOBAL ==========
function asignarEventosCuotasYMercados() {
  document.querySelectorAll('.cuota-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      if (typeof window.addBetToSlip === "function") {
        let mercado = '';
        const mercadoBlock = btn.closest('.mercado-block');
        if (mercadoBlock && mercadoBlock.querySelector('.mercado-header span')) {
          mercado = mercadoBlock.querySelector('.mercado-header span').textContent
            .trim()
            .toLowerCase();
        }

        // Añadir la apuesta sin restricciones
        window.addBetToSlip({
          partido: btn.dataset.partido,
          tipo: btn.dataset.tipo,
          cuota: btn.dataset.cuota,
          partidoId: btn.dataset.partidoid,
          mercado
        });
      }
    });
  });

  document.querySelectorAll('.goleador-opcion').forEach(div => {
    div.addEventListener('click', function () {
      if (typeof window.addBetToSlip === "function") {
        window.addBetToSlip({
          partido: div.dataset.partido,
          tipo: div.dataset.jugador,
          cuota: div.dataset.cuota,
          partidoId: div.dataset.partidoid,
          mercado: 'goleadores'
        });
      }
    });
  });
}


// ========== RENDER DESPLEGABLE TARJETAS AVANZADO CON SELECTORES ==========
function renderDesplegableTarjetas(tarjetasObj, partido) {
  const segmentos = [
    { id: 'encuentro', label: 'Encuentro' },
    { id: 'primera', label: '1ª Mitad' },
    { id: 'segunda', label: '2ª Mitad' }
  ];
  const equipos = [
    { id: 'ambos', label: "Ambos equipos" },
    { id: 'equipo1', label: partido.equipo1 },
    { id: 'equipo2', label: partido.equipo2 }
  ];
  const columnas = [
    { id: 'mas', label: 'Más de' },
    { id: 'exactamente', label: 'Exactamente' },
    { id: 'menos', label: 'Menos de' }
  ];

  // Detectar filas (nº tarjetas disponibles)
  let filas = [];
  for (let seg of Object.values(tarjetasObj)) {
    for (let eq of Object.values(seg)) {
      filas = Object.keys(eq).map(n=>parseInt(n)).filter(n=>!isNaN(n));
      filas.sort((a,b)=>a-b);
      break;
    }
    if(filas.length) break;
  }

  let html = `<div class="mercado-block">
    <div class="mercado-header">
      <span>Tarjetas</span>
      <span class="flecha">&#x25BC;</span>
    </div>
    <div class="mercado-content">
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
        <label style="font-weight:bold" for="select-segmento"></label>
        <select id="select-segmento" style="padding:6px 9px;border-radius:5px;font-weight:600;color:white;background-color:#222;">
          ${segmentos.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}
        </select>
        <label style="font-weight:bold" for="select-equipo"></label>
        <select id="select-equipo" style="padding:6px 9px;border-radius:5px;font-weight:600;color:white;background-color:#222;">
          ${equipos.map(e=>`<option value="${e.id}">${e.label}</option>`).join('')}
        </select>
      </div>
      <div id="tarjetas-tabla-container"></div>
    </div>
  </div>`;

  setTimeout(() => renderTarjetasTabla(tarjetasObj, segmentos[0].id, equipos[0].id, columnas, filas, partido), 0);

  setTimeout(() => {
    const selectSeg = document.getElementById('select-segmento');
    const selectEq = document.getElementById('select-equipo');
    if (!selectSeg || !selectEq) return;
    function actualizar() {
      renderTarjetasTabla(tarjetasObj, selectSeg.value, selectEq.value, columnas, filas, partido);
    }
    selectSeg.onchange = actualizar;
    selectEq.onchange = actualizar;
  }, 0);

  return html;
}

function getSegmentoLabel(segId) {
  const segmentos = [
    { id: 'encuentro', label: 'Encuentro' },
    { id: 'primera', label: '1ª Mitad' },
    { id: 'segunda', label: '2ª Mitad' }
  ];
  return segmentos.find(s => s.id === segId)?.label || '';
}

function getEquipoLabel(eqId, partido) {
  if (eqId === 'ambos') return "Ambos equipos";
  if (eqId === 'equipo1') return partido.equipo1;
  if (eqId === 'equipo2') return partido.equipo2;
  return '';
}

// Para el sidebar
function mostrarTarjetaSidebar({ main, cantidad, segId, eqId, partido }) {
  const periodo = getSegmentoLabel(segId);
  const equipo = getEquipoLabel(eqId, partido);
  return `Tarjetas: ${main} ${cantidad} tarjetas - ${periodo} - ${equipo}`;
}