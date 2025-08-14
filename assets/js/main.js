/* =========================================================
   1.  CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
   ========================================================= */

/* ================= FIREBASE INIT =================== */
if (typeof firebaseConfig === "undefined") {
  var firebaseConfig = {
    apiKey: "AIzaSyDgdI3UcnHuRlcynH-pCHcGORcGBAD3FSU",
    authDomain: "winnet-708db.firebaseapp.com",
    projectId: "winnet-708db",
    storageBucket: "winnet-708db.appspot.com",
    messagingSenderId: "869401097323",
    appId: "1:869401097323:web:fddb5e44af9d27a7cfed2e",
    measurementId: "G-12LH5QRVD0"
  };
}
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db   = firebase.firestore();
const auth = firebase.auth();

/* ========== ELEMENTOS GLOBALES Y UTILIDADES ========== */
const betList      = document.getElementById('bet-list');
const totalOddsEl  = document.getElementById('total-odds');
const stakeInput   = document.getElementById('stake');
const winEl        = document.getElementById('potential-winnings');
const sidebar      = document.getElementById('userSidebar');
const mobileBtn    = document.getElementById('mobileMenuBtn');
const cartIcon      = document.getElementById('cartIcon');
const totalOddsText = document.getElementById('totalOddsText');
const betBadge      = mobileBtn ? mobileBtn.querySelector('.bet-badge') : null;
const qsButtons     = document.querySelectorAll('.qs');

/* ========== GLOBAL BETS ARRAY ========== */
let bets = []; // almacén de selecciones

// ==== LOCALSTORAGE Carrito ====
function guardarCarrito() {
  localStorage.setItem('carritoApuestas', JSON.stringify(bets));
}
function cargarCarrito() {
  try {
    const datos = localStorage.getItem('carritoApuestas');
    if (datos) {
      const arr = JSON.parse(datos);
      if (Array.isArray(arr)) {
        bets = arr;
      }
    }
  } catch {}
}

/* ============ FUNCIÓN LIMPIAR PARENTESIS TARJETAS ============ */
function limpiaParentesisTarjetas(tipo) {
  return tipo.replace(/\s*\([^)]+\)\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

function normalizaPeriodoCorners(tipo) {
  // Busca los periodos y los reemplaza
  return tipo
    .replace(/\bencuentro\b/gi, "Encuentro")
    .replace(/\bprimera\b/gi, "1ª Mitad")
    .replace(/\bsegunda\b/gi, "2ª Mitad");
}

/* ============ PUBLIC API PARA OTRAS PÁGINAS ============ */
window.addBetToSlip = function({ partido, tipo, cuota, partidoId, mercado }) {
  // Restricción 1: Solo una apuesta "resultado" por partido
  if (
    window.location.pathname.endsWith('partido.html') &&
    mercado === "resultado"
  ) {
    const yaExiste = bets.some(b =>
      b.partidoId === partidoId &&
      b.mercado === "resultado"
    );
    if (yaExiste) {
      alert(`Ya tienes una apuesta para el mercado "Resultado" de este partido en tu carrito.`);
      return;
    }
  } else {
    // Restricción 2: No permitir duplicados exactos en otros mercados
    const yaExisteExacta = bets.some(b =>
      b.partidoId === partidoId &&
      b.mercado === mercado &&
      b.tipo === tipo &&
      b.cuota === cuota
    );
    if (yaExisteExacta) {
      alert("Ya tienes esta selección exacta añadida en tu carrito.");
      return;
    }
  }
  // Añadir apuesta si pasa las restricciones
  bets.push({ partido, tipo, cuota, partidoId, mercado });
  guardarCarrito();
  refreshSlip();
};

// Función para capitalizar la primera letra de una palabra
function capitalizarPalabra(palabra) {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

/* ================= LISTENERS GENERALES ================= */
// Verificar que stakeInput existe antes de añadir el evento
if (stakeInput) {
  console.log('stakeInput existe');
  stakeInput.addEventListener('input', updatePotentialWinnings);
} else {
  console.error('stakeInput no se encuentra en el DOM');
}

// Verificar que qsButtons tiene botones antes de añadir los eventos
if (qsButtons && qsButtons.length) {
  console.log('qsButtons existen y tienen elementos');
  qsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const valor = parseFloat(btn.textContent) || 0;
      console.log(`Valor seleccionado: ${valor}`);
      stakeInput.value = valor;
      updatePotentialWinnings();
    });
  });
} else {
  console.error('qsButtons no tiene botones o no está definido');
}

// Verificar la existencia del botón de borrar apuestas
const clearBtn = document.getElementById('clear-bets');
if (clearBtn) {
  console.log('Botón "Clear Bets" encontrado');
  clearBtn.addEventListener('click', () => {
    console.log('Limpiando apuestas');
    bets = [];
    guardarCarrito();
    refreshSlip();
    cambiarPestania('simple');
  });
} else {
  console.error('No se encontró el botón "Clear Bets"');
}

function refreshSlip() {
  // Verificar si betList existe antes de continuar
  if (!betList) {
    console.error('betList no existe en el DOM');
    return;
  }

  console.log('Refrescando la lista de apuestas');
  betList.innerHTML = ''; // Limpiar la lista de apuestas

  // Verificar si bets tiene elementos
  if (bets && bets.length) {
    console.log(`Hay ${bets.length} apuestas para mostrar`);
    bets.forEach(({ partido, tipo, cuota, mercado }, i) => {
      let tipoTexto = tipo;
      
      // Verificar el tipo de mercado
      if (mercado === 'resultado') {
        tipoTexto = tipo.toLowerCase() === 'empate' ? 'Empate' : `Gana ${tipo}`;
      } else if (mercado === 'tarjetas') {
        let partes = tipo.split(' - ').map(s => s.trim());
        let main = '', cantidad = '', equipo = '', periodo = '';

        if (partes.length === 4) {
          [main, cantidad, equipo, periodo] = partes;
        } else if (partes.length === 3) {
          const match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)/i);
          if (match) {
            [main, cantidad] = [match[1], match[2]];
          } else {
            main = partes[0];
          }
          [equipo, periodo] = partes.slice(1);
        } else {
          main = tipo;
        }

        main = main.replace(/\(.*/, '').replace(/\d+\)\s*$/, '').trim();
        tipoTexto = `Tarjetas: ${main} ${cantidad ? ` ${cantidad} tarjeta${cantidad == 1 ? '' : 's'}` : ''} ${periodo ? ` - ${periodo}` : ''} ${equipo ? ` - ${equipo}` : ''}`;
      } else if (mercado === 'corners') {
        let partes = tipo.split(' - ').map(s => s.trim());
        let main = '', cantidad = '', equipo = '', periodo = '';

        const match = partes[0].match(/(Más de|Menos de|Exactamente)\s*(\d+)?\s*corners?/i);
        if (match) {
          [main, cantidad] = [match[1], match[2] || ''];
        } else {
          main = partes[0];
        }

        const posiblesPeriodos = ['primera', '1ª mitad', 'segunda', '2ª mitad', 'encuentro'];
        partes.forEach(parte => {
          let lower = parte.toLowerCase();
          if (lower === 'primera') periodo = "1ª Mitad"; 
          else if (lower === 'segunda') periodo = "2ª Mitad"; 
          else if (lower === 'encuentro') periodo = "Encuentro"; 
        });

        equipo = partes.find(parte => {
          let lower = parte.toLowerCase();
          if (parte === partes[0] || cantidad === parte || posiblesPeriodos.includes(lower) || /^\d+\)?$/.test(parte)) return false;
          return true;
        }) || "";

        tipoTexto = `Corners: ${main} ${cantidad ? ` ${cantidad} corners` : ''} ${periodo ? ` - ${periodo}` : ''} ${equipo ? ` - ${equipo}` : ''}`;
      } else if (mercado === 'goleadores') {
        tipoTexto = `Gol de ${tipo}`;
      }

      betList.insertAdjacentHTML('beforeend', `
        <li class="bs-item">
          <div class="bs-top">
            <span class="bs-deporte">⚽</span>
            <span class="bs-tipo">${tipoTexto}</span>
            <span class="bs-cuota">${cuota}</span>
            <button class="bs-remove" data-index="${i}">✕</button>
          </div>
          <div class="bs-info">${partido}</div>
        </li>
      `);
    });

    // Asignar evento de eliminación a los botones "✕"
    const removeButtons = document.querySelectorAll('.bs-remove');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index, 10);
        console.log(`Eliminando apuesta en el índice ${index}`);
        bets.splice(index, 1); // Eliminar apuesta del array
        guardarCarrito();
        refreshSlip(); // Volver a renderizar la lista de apuestas
        updatePotentialWinnings(); // Actualizar las posibles ganancias
      });
    });

  } else {
    console.error('No hay apuestas para mostrar');
  }

  // Calcular la cuota total
  const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
  if (totalOddsEl) {
    totalOddsEl.textContent = bets.length ? totalOdds.toFixed(2).replace('.', ',') : '0,00';
  }

  const tabCombi = document.querySelector('.bs-tab[data-target="combi"]');
  if (tabCombi) tabCombi.textContent = `Combinada (${bets.length})`;

  cambiarPestania && cambiarPestania(bets.length >= 2 ? 'combi' : 'simple');
  updatePotentialWinnings();
  updateMobileButton();
  actualizarBadgeApuestas();
  guardarCarrito();
}





function updatePotentialWinnings() {
  if (!stakeInput || !winEl || !totalOddsEl) return;
  const stake = parseFloat(stakeInput.value) || 0;
  const cuota = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  const win   = stake * cuota;
  winEl.textContent = win > 0 ? `${win.toFixed(2).replace('.', ',')} €` : '0,00 €';
}



function updateMobileButton() {
  if (!cartIcon || !totalOddsText || !totalOddsEl) return;
  const total = parseFloat(totalOddsEl.textContent.replace(',', '.')) || 0;
  if (!bets.length) {
    cartIcon.style.display      = 'inline';
    totalOddsText.style.display = 'none';
  } else {
    cartIcon.style.display      = 'none';
    totalOddsText.style.display = 'inline';
    totalOddsText.textContent   = total.toFixed(2).replace('.', ',');
  }
}

function actualizarBadgeApuestas() {
  if (!betBadge) return;
  const cantidad = bets.length;
  if (cantidad > 0) {
    betBadge.style.display = 'inline-block';
    betBadge.textContent = cantidad;
  } else {
    betBadge.style.display = 'none';
  }
}

/* =============== ELIMINAR APUESTA INDIVIDUAL ================ */
if (betList) {
  betList.addEventListener('click', e => {
    if (!e.target.classList.contains('bs-remove')) return;
    const idx = parseInt(e.target.dataset.index, 10);
    if (!isNaN(idx)) {
      bets.splice(idx, 1);
      guardarCarrito();
      refreshSlip();
    }
  });
}

/* ============ Cargar carrito al iniciar ========== */
cargarCarrito();
refreshSlip();

/* ========== SIDEBAR MÓVIL UNIVERSAL ========== */
const sidebarOverlay = document.getElementById('sidebar-overlay');
const bsToggle = document.querySelector('.bs-toggle');

// Abrir sidebar
function openSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'block';
    sidebarOverlay.classList.add('active');
  }
  document.body.style.overflow = "hidden";
}

// Cerrar sidebar
function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'none';
    sidebarOverlay.classList.remove('active');
  }
  document.body.style.overflow = "";
}

// Abrir al pulsar el botón flotante
if (mobileBtn) mobileBtn.addEventListener('click', openSidebar);

// Cerrar al pulsar el overlay
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// Cerrar al pulsar el botón "▼" del sidebar
if (bsToggle) bsToggle.addEventListener('click', closeSidebar);

// Cerrar al pulsar fuera del sidebar (en móvil)
document.addEventListener('click', function(e) {
  if (
    window.innerWidth <= 768 &&
    sidebar &&
    sidebar.classList.contains('open') &&
    !sidebar.contains(e.target) &&
    mobileBtn &&
    !mobileBtn.contains(e.target) &&
    (!sidebarOverlay || !sidebarOverlay.contains(e.target))
  ) {
    closeSidebar();
  }
});

// Por defecto, overlay oculto
if (sidebarOverlay) sidebarOverlay.style.display = 'none';

/* ============ GUARDAR APUESTA AL PULSAR "ACEPTAR" ========== */
const acceptBtn = document.querySelector('.accept-btn');
if (acceptBtn) {
  acceptBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Debes iniciar sesión para realizar una apuesta.');
      return;
    }
    if (bets.length === 0) {
      alert('No hay apuestas en el carrito.');
      return;
    }
    const stake = parseFloat(stakeInput.value) || 0;
    if (stake <= 0) {
      alert('El importe debe ser mayor que cero.');
      return;
    }
    const betsSinPartidoId = bets.filter(b => !b.partidoId);
    if (betsSinPartidoId.length > 0) {
      alert('Error interno: Hay una apuesta sin partidoId. Por favor, contacta soporte o vuelve a añadir el partido.');
      console.error("Apuestas sin partidoId:", betsSinPartidoId);
      return;
    }
    const userRef = db.collection('usuarios').doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const saldoActual = parseFloat(userData?.saldo) || 0;
    if (stake > saldoActual) {
      alert('No tienes saldo suficiente para realizar esta apuesta.');
      return;
    }
    const totalOdds = bets.reduce((acc, b) => acc * parseFloat(b.cuota), 1);
    const potentialWin = stake * totalOdds;
    const apuestaData = {
      usuarioId: user.uid,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      stake: stake,
      totalOdds: totalOdds,
      potentialWin: potentialWin,
      bets: bets.map(b => ({
        partido: b.partido,
        tipo: b.mercado === 'tarjetas'
          ? limpiaParentesisTarjetas(b.tipo)
          : b.mercado === 'corners'
            ? normalizaPeriodoCorners(limpiaParentesisTarjetas(b.tipo))
            : b.tipo,
        cuota: parseFloat(b.cuota),
        partidoId: b.partidoId,
        mercado: b.mercado
      })),
      estado: "pendiente",
      resultado: null,
      aceptadaPorUsuario: false
    };
    try {
      await db.collection('apuestas').add(apuestaData);
      await userRef.update({
        saldo: firebase.firestore.FieldValue.increment(-stake)
      });
      alert('¡Apuesta realizada con éxito!');
      bets = [];
      guardarCarrito();
      refreshSlip();
      stakeInput.value = 5;
      updatePotentialWinnings();
      closeSidebar();
      if (typeof headerLeft !== "undefined" && headerLeft) {
        headerLeft.innerHTML = `${(saldoActual - stake).toFixed(2)} €`;
      }
    } catch (error) {
      console.error('Error al guardar la apuesta:', error);
      alert('Ocurrió un error al guardar la apuesta. Intenta de nuevo.');
    }
  });
}


/* ========== FUNCIÓN OPCIONAL PARA CARGAR PARTIDOS Y MOSTRARLOS EN LA PRINCIPAL ========== */
function removeTildes(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Global para acceder al ID
let listaPartidos = [];

// Solo ejecuta si existe el contenedor de partidos (página principal)
if (document.getElementById('partidos-container')) {
  function partidoHaComenzado(partido) {
    if (!partido.fecha || !partido.hora) return false;
    const [anio, mes, dia] = partido.fecha.split('-');
    const [hora, minuto] = partido.hora.split(':');
    const fechaHoraPartido = new Date(anio, mes - 1, dia, hora, minuto);
    const ahora = new Date();
    return ahora >= fechaHoraPartido;
  }

  async function cargarPartidos() {
    try {
      const snapshot = await db.collection('partidos').get();
      listaPartidos = snapshot.docs.map(doc => ({
        ...doc.data(),
        partidoId: doc.id
      }));
      mostrarPartidos(listaPartidos);
    } catch (error) {
      console.error("Error al cargar partidos:", error);
    }
  }
  cargarPartidos();

  function mostrarPartidos(partidos) {
    const container = document.getElementById('partidos-container');
    container.innerHTML = '';
    if (!Array.isArray(partidos)) return;

    // Agrupa partidos por fecha, y almacena la fecha real (Date) asociada a cada grupo
    const partidosPorFecha = {};
    const fechaClaves = []; // { claveFecha, fechaObj }

    partidos.forEach((partido) => {
      if (!partido.fecha) return;
      const fechaObj = new Date(partido.fecha + 'T00:00');
      const hoyObj = new Date();
      hoyObj.setHours(0,0,0,0);

      const mananaObj = new Date(hoyObj);
      mananaObj.setDate(hoyObj.getDate() + 1);

      let claveFecha;
      if (fechaObj.getTime() === hoyObj.getTime()) {
        claveFecha = "Hoy";
      } else if (fechaObj.getTime() === mananaObj.getTime()) {
        claveFecha = "Mañana";
      } else {
        const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'short' });
        const diaNumero = fechaObj.getDate();
        claveFecha = `${diaSemana} ${diaNumero}`;
      }

      if (!partidosPorFecha[claveFecha]) {
        partidosPorFecha[claveFecha] = [];
        fechaClaves.push({ claveFecha, fechaObj });
      }
      partidosPorFecha[claveFecha].push(partido);
    });

    // Ordenar el array de claves: "Hoy" primero, luego fechas futuras ordenadas
    fechaClaves.sort((a, b) => {
      if (a.claveFecha === "Hoy") return -1;
      if (b.claveFecha === "Hoy") return 1;
      return a.fechaObj - b.fechaObj;
    });

    for (const { claveFecha } of fechaClaves) {
      const grupo = partidosPorFecha[claveFecha];
      // Filtra partidos NO comenzados
      const partidosVisibles = grupo.filter(partido => !partidoHaComenzado(partido));
      if (partidosVisibles.length === 0) continue; // No hay partidos ese día, omite todo el grupo

      const grupoDiv = document.createElement('div');
      grupoDiv.classList.add('grupo-fecha');
      const fechaDiv = document.createElement('div');
      fechaDiv.classList.add('fecha');
      fechaDiv.textContent = claveFecha;
      grupoDiv.appendChild(fechaDiv);

      partidosVisibles.forEach((partido) => {
        const equipo1 = partido.equipo1;
        const equipo2 = partido.equipo2;
        const deporte = (partido.deporte || "").toLowerCase();
        const escudo1 = `Equipos/${removeTildes(equipo1.toLowerCase().replace(/\s/g, ''))}.png`;
        const escudo2 = `Equipos/${removeTildes(equipo2.toLowerCase().replace(/\s/g, ''))}.png`;
        const nacionalidad1 = partido.nacionalidad1 || "";
        const nacionalidad2 = partido.nacionalidad2 || "";
        const bandera1 = nacionalidad1
          ? `<img src="banderas/${removeTildes(nacionalidad1.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad1}" class="bandera"/>`
          : '';
        const bandera2 = nacionalidad2
          ? `<img src="banderas/${removeTildes(nacionalidad2.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad2}" class="bandera"/>`
          : '';
        const horaPartido = partido.hora || '00:00';
        let cuota1 = '-', cuotaX = '-', cuota2 = '-';
        if (partido.mercados && partido.mercados.resultado && Array.isArray(partido.mercados.resultado.opciones)) {
          partido.mercados.resultado.opciones.forEach(opcion => {
            if (opcion.valor === "1") cuota1 = opcion.cuota.toFixed(2);
            else if (opcion.valor === "X") cuotaX = opcion.cuota.toFixed(2);
            else if (opcion.valor === "2") cuota2 = opcion.cuota.toFixed(2);
          });
        }
        const partidoDiv = document.createElement('div');
        partidoDiv.classList.add('partido');
        let cuotasHTML = '';
        let claseCuotas = '';
        if (deporte === 'futbol') {
          claseCuotas = 'cuotas-futbol';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo1}"
                      data-mercado="resultado">
                ${cuota1}
              </div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">Empate</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="Empate"
                      data-mercado="resultado">
                ${cuotaX}
              </div>
            </div>
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo2}"
                      data-mercado="resultado">
                ${cuota2}
              </div>
            </div>
          `;
        } else if (deporte === 'baloncesto' || deporte === 'tenis') {
          claseCuotas = deporte === 'baloncesto' ? 'cuotas-baloncesto' : 'cuotas-tenis';
          cuotasHTML = `
            <div class="cuota">
              <div class="nombre-equipo-cuota">${equipo1}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo1}">
                ${cuota1}
              </div>
            </div>
            <div class="cuota cuota-derecha">
              <div class="nombre-equipo-cuota">${equipo2}</div>
              <div class="valor-cuota cuota-btn"
                      data-partido="${equipo1} vs ${equipo2}"
                      data-tipo="${equipo2}">
                ${cuota2}
              </div>
            </div>
          `;
        }
        let equiposHTML = '';
        if (deporte === "tenis") {
          equiposHTML = `
            <div class="info-equipos">
              <div class="equipo equipo1">
                <div class="bandera-wrapper">
                  ${bandera1 ? `<img src="banderas/${removeTildes(nacionalidad1.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad1}" class="bandera" />` : ''}
                </div>
                <span>${equipo1}</span>
              </div>
              <div class="hora">${horaPartido}</div>
              <div class="equipo equipo2">
                <div class="bandera-wrapper">
                  ${bandera2 ? `<img src="banderas/${removeTildes(nacionalidad2.toLowerCase().replace(/\s/g, ''))}.png" alt="${nacionalidad2}" class="bandera" />` : ''}
                </div>
                <span>${equipo2}</span>
              </div>
            </div>
          `;
        } else {
          equiposHTML = `
            <div class="info-equipos">
              <div class="equipo equipo1">
                <div class="escudo-wrapper"><img src="${escudo1}" alt="${equipo1}" class="escudo" /></div>
                <span>${equipo1}</span>
              </div>
              <div class="hora">${horaPartido}</div>
              <div class="equipo equipo2">
                <div class="escudo-wrapper"><img src="${escudo2}" alt="${equipo2}" class="escudo" /></div>
                <span>${equipo2}</span>
              </div>
            </div>
          `;
        }
        let goleadoresHTML = '';
        if (
          deporte === 'futbol' &&
          partido.mercados &&
          partido.mercados.goleadores &&
          Array.isArray(partido.mercados.goleadores.opciones) &&
          partido.mercados.goleadores.opciones.length > 0
        ) {
          const partidoId = partido.partidoId || (partido.id ?? 'p'+Math.random());
          goleadoresHTML += `<div class="goleadores-lista" id="goleadores-${partidoId}" style="display:none;">`;
          partido.mercados.goleadores.opciones.forEach(gol => {
            goleadoresHTML += `
              <div class="goleador-opcion"
                  data-partido="${equipo1} vs ${equipo2}"
                  data-jugador="${gol.nombre}"
                  data-cuota="${gol.cuota}"
                  data-partidoid="${partidoId}">
                <span class="nombre-goleador">${gol.nombre}</span>
                <span class="cuota-goleador">${gol.cuota}</span>
              </div>`;
          });
          goleadoresHTML += `</div>`;
        }
        let verMasHTML = `<a class="ver-partido-btn" href="partido.html?partidoId=${partido.partidoId}">Ver mercados</a>`;
        partidoDiv.innerHTML = `
          <div class="info-hora">${equiposHTML}</div>
          <div class="cuotas ${claseCuotas}">${cuotasHTML}</div>
          ${goleadoresHTML}
          ${verMasHTML}
        `;
        grupoDiv.appendChild(partidoDiv);
      });
      container.appendChild(grupoDiv);
    }
    asignarEventosGoleadores();
  }

  function asignarEventosGoleadores() {
    document.querySelectorAll('.btn-goleadores').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.dataset.id;
        const lista = document.getElementById('goleadores-' + id);
        if (lista) lista.style.display = lista.style.display === 'block' ? 'none' : 'block';
      });
    });
  }
  // Scroll logo
  if (document.getElementById('logo-scroll')) {
    document.getElementById('logo-scroll').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  // Añadir apuestas desde cuotas y goleadores en la principal
  if (document.getElementById('partidos-container')) {
    document.getElementById('partidos-container').addEventListener('click', e => {
      // Añadir desde cuotas normales
      const cuotaBtn = e.target.closest('.valor-cuota.cuota-btn');
      if (cuotaBtn) {
        const partidoNombre = cuotaBtn.dataset.partido;
        const tipo = cuotaBtn.dataset.tipo;
        const cuota = cuotaBtn.textContent.trim();
        const mercado = cuotaBtn.dataset.mercado || "resultado";
        const partidoObj = listaPartidos.find(p => 
          `${p.equipo1} vs ${p.equipo2}` === partidoNombre
        );
        if (!partidoObj) {
          alert('No se encontró el partido en Firestore.');
          return;
        }
        const partidoId = partidoObj.partidoId;

        // --- SOLO limitar mercado resultado en index.html ---
        if (mercado === "resultado") {
          const yaExiste = bets.some(b =>
            b.partidoId === partidoId &&
            b.mercado === "resultado"
          );
          if (yaExiste) {
            alert('Ya tienes una apuesta para el mercado "Resultado" de este partido en tu carrito.');
            return;
          }
        }

        window.addBetToSlip({ partido: partidoNombre, tipo, cuota, partidoId, mercado });
        guardarCarrito();
        refreshSlip();
        return;
      }
      // Añadir desde opción de goleador
      const goleadorDiv = e.target.closest('.goleador-opcion');
      if (goleadorDiv) {
        const partido = goleadorDiv.dataset.partido;
        const tipo = goleadorDiv.dataset.jugador;
        const cuota = goleadorDiv.dataset.cuota;
        const partidoId = goleadorDiv.dataset.partidoid;
        guardarCarrito();
        refreshSlip();
        // Si quieres que se abra automáticamente en móvil al añadir apuesta, descomenta:
        // if (window.innerWidth <= 768) openSidebar();
        return;
      }
    });
  }
}

/* =========== PESTAÑAS =========== */
function cambiarPestania(target) {
  document.querySelectorAll('.bs-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.target === target)
  );
  document.querySelectorAll('[data-content]').forEach(sec =>
    sec.style.display = sec.dataset.content === target ? 'block' : 'none'
  );
}

/* ========== SALDO ALL-IN ========== */
let saldoUsuario = 0;
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();
      saldoUsuario = parseFloat(userData?.saldo) || 0;
    } catch (error) {}
  } else {
    saldoUsuario = 0;
  }
});
const allInBtn = document.querySelector('.qs.all-in');
if (allInBtn && stakeInput) {
  allInBtn.addEventListener('click', function() {
    stakeInput.value = saldoUsuario > 0 ? saldoUsuario : '';
    updatePotentialWinnings();
  });
}

/* ========== HEADER (opcional, solo ejecuta si existe) ========== */
const headerLeft = document.getElementById('header-left');
const headerRight = document.getElementById('header-right');
if (headerLeft && headerRight) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        const userData = userDoc.data();
        headerLeft.innerHTML = userData ? `${parseFloat(userData.saldo).toFixed(2)} €` : '';
        headerRight.innerHTML = `
          <div class="user-menu" style="position: relative; display: inline-block;">
            <span class="username" style="cursor:pointer;">${userData?.username || user.email}</span>
            <div class="dropdown-content" id="dropdown-menu" style="
                display: none;
                position: absolute;
                right: 0;
                top: 100%;
                box-shadow: 0 4px 8px rgba(255, 255, 0, 0.3);
                border-radius: 4px;
                padding: 10px;
                opacity: 0;
                transition: opacity 0.3s ease;
                z-index: 1000;
                background-color: var(--rojo-oscuro);
                font-size: 16px;
                min-width: 140px;
              ">
              ${userData?.rol === "admin" ? `<a href="adminhub.html" id="admin-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Panel Admin</a>` : ''}
              <a href="apuestas.html" id="apuestas-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Mis apuestas</a>
              <a href="#" id="logout-link" style="display:block; padding: 8px; color: white; text-decoration: none;">Cerrar sesión</a>
            </div>
          </div>
        `;

        const username = document.querySelector('.username');
        const dropdownMenu = document.getElementById('dropdown-menu');
        let menuOpen = false;

        function openMenu() {
          dropdownMenu.style.display = 'block';
          requestAnimationFrame(() => {
            dropdownMenu.style.opacity = '1';
          });
          menuOpen = true;
        }
        function closeMenu() {
          dropdownMenu.style.opacity = '0';
          setTimeout(() => {
            dropdownMenu.style.display = 'none';
          }, 300);
          menuOpen = false;
        }
        username.addEventListener('mouseenter', () => {
          if (!menuOpen) openMenu();
        });
        document.addEventListener('click', (event) => {
          const isClickInsideMenu = dropdownMenu.contains(event.target);
          const isClickOnUsername = username.contains(event.target);
          if (!isClickInsideMenu && !isClickOnUsername && menuOpen) {
            closeMenu();
          }
        });
        document.getElementById('logout-link').addEventListener('click', async (e) => {
          e.preventDefault();
          await auth.signOut();
          localStorage.removeItem('carritoApuestas');
          window.location.href = 'login.html';
        });

      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      }
    } else {
      headerLeft.innerHTML = `<a href="register.html" class="header-btn">Registrarse</a>`;
      headerRight.innerHTML = `<a href="login.html" class="header-btn">Iniciar sesión</a>`;
    }
  });
}

window.addBetToSlip
